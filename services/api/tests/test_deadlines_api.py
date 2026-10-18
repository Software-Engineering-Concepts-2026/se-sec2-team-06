from __future__ import annotations

from datetime import datetime, timezone

import pytest

from conftest import registration_payload, same_origin_headers


DEADLINE_PATH = "/api/deadlines"


def _register(client, email: str) -> str:
    response = client.post(
        "/api/auth/register",
        json=registration_payload(email=email),
        headers=same_origin_headers(),
    )
    assert response.status_code == 201
    return client.cookies.get("synapsesync_session")


def _use_session_cookie(client, token: str) -> None:
    client.cookies.clear()
    client.cookies.set("synapsesync_session", token, domain="testserver.local", path="/")


def _payload(**overrides) -> dict[str, object]:
    return {
        "title": "Review set theory",
        "subject": "คณิตศาสตร์",
        "due_at": "2026-11-10T09:30:00+07:00",
        "priority": "medium",
        **overrides,
    }


def _create_deadline(client, **overrides) -> dict[str, object]:
    payload = _payload(**overrides)
    if "tag_id" not in payload:
        tags = client.get("/api/tags").json()["tags"]
        matching = next(tag for tag in tags if tag["name"] == payload["subject"])
        payload["tag_id"] = matching["id"]
    response = client.post(
        DEADLINE_PATH,
        json=payload,
        headers=same_origin_headers(),
    )
    assert response.status_code == 201
    return response.json()


def test_deadline_endpoints_require_authentication(client_factory):
    with client_factory() as client:
        read = client.get(DEADLINE_PATH)
        create = client.post(
            DEADLINE_PATH,
            json=_payload(),
            headers=same_origin_headers(),
        )

    assert read.status_code == 401
    assert create.status_code == 401


def test_create_deadline_trims_title_and_returns_saved_task(client_factory):
    with client_factory() as client:
        _register(client, "deadline-create@example.com")
        response = client.post(
            DEADLINE_PATH,
            json=_payload(title="  Review set theory  "),
            headers=same_origin_headers(),
        )

    assert response.status_code == 201
    assert response.json()["title"] == "Review set theory"
    assert response.json()["subject"] == "คณิตศาสตร์"
    assert response.json()["priority"] == "medium"
    assert response.json()["is_completed"] is False
    assert response.json()["id"] > 0


def test_create_deadline_accepts_a_builtin_subject_tag(client_factory):
    with client_factory() as client:
        _register(client, "deadline-other-subject@example.com")
        other = next(tag for tag in client.get("/api/tags").json()["tags"] if tag["name"] == "วิชาอื่น")
        response = client.post(
            DEADLINE_PATH,
            json=_payload(subject="วิชาอื่น", tag_id=other["id"]),
            headers=same_origin_headers(),
        )

    assert response.status_code == 201
    assert response.json()["subject"] == "วิชาอื่น"
    assert response.json()["tag_id"] == other["id"]


def test_create_deadline_from_owner_tag(client_factory):
    with client_factory() as client:
        _register(client, "deadline-custom-tag@example.com")
        custom = client.post(
            "/api/tags",
            json={"name": "ทฤษฎีเซต", "color": "cyan"},
            headers=same_origin_headers(),
        )
        response = client.post(
            DEADLINE_PATH,
            json=_payload(subject="ทฤษฎีเซต", tag_id=custom.json()["id"]),
            headers=same_origin_headers(),
        )

    assert custom.status_code == 201
    assert response.status_code == 201, response.text
    assert response.json()["tag_id"] == custom.json()["id"]
    assert response.json()["subject"] == "ทฤษฎีเซต"


def test_create_deadline_rejects_unknown_or_foreign_tag(client_factory):
    with client_factory() as client:
        owner_cookie = _register(client, "deadline-tag-owner@example.com")
        _register(client, "deadline-tag-foreign@example.com")
        foreign = client.post(
            "/api/tags",
            json={"name": "Private study", "color": "rose"},
            headers=same_origin_headers(),
        ).json()
        _use_session_cookie(client, owner_cookie)
        unknown_response = client.post(
            DEADLINE_PATH,
            json=_payload(tag_id=999999),
            headers=same_origin_headers(),
        )
        foreign_response = client.post(
            DEADLINE_PATH,
            json=_payload(tag_id=foreign["id"]),
            headers=same_origin_headers(),
        )

    assert unknown_response.status_code == 404
    assert foreign_response.status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": "   "},
        {"title": "x" * 161},
        {"subject": "วิทยาการคำนวณ"},
        {"priority": "critical"},
        {"due_at": "2026-11-10T09:30:00"},
    ],
)
def test_create_deadline_rejects_invalid_fields(client_factory, overrides):
    with client_factory() as client:
        _register(client, "deadline-invalid@example.com")
        response = client.post(
            DEADLINE_PATH,
            json=_payload(**overrides),
            headers=same_origin_headers(),
        )

    assert response.status_code == 422


def test_create_deadline_normalizes_offset_timestamp_to_utc(client_factory):
    with client_factory() as client:
        _register(client, "deadline-timezone@example.com")
        response = client.post(
            DEADLINE_PATH,
            json=_payload(due_at="2026-11-10T09:30:00+07:00"),
            headers=same_origin_headers(),
        )

    assert response.status_code == 201
    stored_due_at = datetime.fromisoformat(response.json()["due_at"].replace("Z", "+00:00"))
    assert stored_due_at == datetime(2026, 11, 10, 2, 30, tzinfo=timezone.utc)
    assert stored_due_at.utcoffset().total_seconds() == 0


def test_create_deadline_allows_past_due_tasks(client_factory):
    with client_factory() as client:
        _register(client, "deadline-past@example.com")
        response = client.post(
            DEADLINE_PATH,
            json=_payload(due_at="2020-01-02T03:04:00+00:00"),
            headers=same_origin_headers(),
        )

    assert response.status_code == 201
    assert response.json()["due_at"].startswith("2020-01-02T03:04:00")


def test_list_deadlines_is_owner_scoped_and_orders_by_due_at_then_id(client_factory):
    with client_factory() as client:
        first_owner_cookie = _register(client, "deadline-list-first@example.com")
        later = _create_deadline(client, title="Later", due_at="2026-12-01T12:00:00Z")
        tie_first = _create_deadline(client, title="Tie first", due_at="2026-11-10T02:30:00Z")
        earlier = _create_deadline(client, title="Earlier", due_at="2026-11-01T00:00:00Z")
        tie_second = _create_deadline(client, title="Tie second", due_at="2026-11-10T02:30:00Z")

        _register(client, "deadline-list-second@example.com")
        foreign = _create_deadline(client, title="Private task", due_at="2026-10-01T00:00:00Z")

        _use_session_cookie(client, first_owner_cookie)
        response = client.get(DEADLINE_PATH)

    assert response.status_code == 200
    assert [task["id"] for task in response.json()] == [
        earlier["id"],
        tie_first["id"],
        tie_second["id"],
        later["id"],
    ]
    assert foreign["id"] not in {task["id"] for task in response.json()}


def test_update_deadline_changes_completion_and_rejects_non_boolean_values(client_factory):
    with client_factory() as client:
        _register(client, "deadline-complete@example.com")
        task = _create_deadline(client)
        updated = client.patch(
            f"{DEADLINE_PATH}/{task['id']}",
            json={"is_completed": True},
            headers=same_origin_headers(),
        )
        invalid = client.patch(
            f"{DEADLINE_PATH}/{task['id']}",
            json={"is_completed": "false"},
            headers=same_origin_headers(),
        )

    assert updated.status_code == 200
    assert updated.json()["is_completed"] is True
    assert updated.json()["status"] == "completed"
    assert invalid.status_code == 422


def test_patch_deadline_accepts_three_statuses_and_derives_legacy_completion(client_factory):
    with client_factory() as client:
        _register(client, "deadline-three-status@example.com")
        task = _create_deadline(client)
        updates = []
        for status_value in ("in_progress", "completed", "not_started"):
            updates.append(client.patch(
                f"{DEADLINE_PATH}/{task['id']}",
                json={"status": status_value},
                headers=same_origin_headers(),
            ))
        invalid = client.patch(
            f"{DEADLINE_PATH}/{task['id']}",
            json={"status": "paused"},
            headers=same_origin_headers(),
        )

    assert [response.status_code for response in updates] == [200, 200, 200]
    assert [(response.json()["status"], response.json()["is_completed"]) for response in updates] == [
        ("in_progress", False),
        ("completed", True),
        ("not_started", False),
    ]
    assert invalid.status_code == 422


def test_deadline_mutations_are_owner_scoped(client_factory):
    with client_factory() as client:
        first_owner_cookie = _register(client, "deadline-private-first@example.com")
        second_owner_cookie = _register(client, "deadline-private-second@example.com")
        private_task = _create_deadline(client, title="Second owner's task")

        _use_session_cookie(client, first_owner_cookie)
        update = client.patch(
            f"{DEADLINE_PATH}/{private_task['id']}",
            json={"is_completed": True},
            headers=same_origin_headers(),
        )
        delete = client.delete(
            f"{DEADLINE_PATH}/{private_task['id']}",
            headers=same_origin_headers(),
        )
        _use_session_cookie(client, second_owner_cookie)
        owner_view = client.get(DEADLINE_PATH)

    assert update.status_code == 404
    assert delete.status_code == 404
    assert owner_view.status_code == 200
    assert owner_view.json() == [private_task]


def test_delete_deadline_removes_only_selected_task(client_factory):
    with client_factory() as client:
        _register(client, "deadline-delete@example.com")
        selected = _create_deadline(client, title="Delete this")
        keep = _create_deadline(client, title="Keep this")
        response = client.delete(
            f"{DEADLINE_PATH}/{selected['id']}",
            headers=same_origin_headers(),
        )
        remaining = client.get(DEADLINE_PATH)

    assert response.status_code == 204
    assert response.content == b""
    assert [task["id"] for task in remaining.json()] == [keep["id"]]


def test_deadline_mutations_require_same_origin(client_factory):
    with client_factory() as client:
        _register(client, "deadline-origin@example.com")
        task = _create_deadline(client)
        create = client.post(DEADLINE_PATH, json=_payload(title="No origin"))
        update = client.patch(
            f"{DEADLINE_PATH}/{task['id']}",
            json={"is_completed": True},
        )
        delete = client.delete(f"{DEADLINE_PATH}/{task['id']}")
        unchanged = client.get(DEADLINE_PATH)

    assert [create.status_code, update.status_code, delete.status_code] == [403, 403, 403]
    assert len(unchanged.json()) == 1
    assert unchanged.json()[0]["is_completed"] is False
