from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone

import pytest

from conftest import registration_payload, same_origin_headers


def test_register_creates_safe_profile_and_hashed_cookie_session(client_factory) -> None:
    with client_factory() as client:
        response = client.post(
            "/api/auth/register",
            json=registration_payload(email="Learner@Example.com", password="abcdefg1"),
            headers=same_origin_headers(),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["email"] == "learner@example.com"
        assert body["display_name"] == "Study Learner"
        assert "password_hash" not in body
        assert "session_token" not in body
        assert client.get("/api/auth/me").json() == body

        raw_token = client.cookies.get("synapsesync_session")
        auth_session = client.app.state.session_factory
        model = importlib.import_module("app.models").AuthSession
        with auth_session() as session:
            stored = session.query(model).one()
            assert stored.token_hash == importlib.import_module("app.security").hash_session_token(raw_token)
            assert raw_token not in stored.token_hash


@pytest.mark.parametrize(
    "payload",
    [
        registration_payload(email="not-an-email"),
        registration_payload(password="abc123"),
        registration_payload(password="onlyletters"),
        registration_payload(password="12345678"),
        registration_payload(password="abcdefgh"),
        registration_payload(password="😀😀😀😀😀😀😀1"),
        registration_payload(password=f"{'a' * 128}1"),
    ],
)
def test_register_rejects_invalid_email_or_weak_password(client_factory, payload) -> None:
    with client_factory() as client:
        response = client.post("/api/auth/register", json=payload, headers=same_origin_headers())

    assert response.status_code == 422


def test_register_rejects_duplicate_email_after_normalization(client_factory) -> None:
    with client_factory() as client:
        first = client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())
        duplicate = client.post(
            "/api/auth/register",
            json=registration_payload(email="  LEARNER@EXAMPLE.COM  "),
            headers=same_origin_headers(),
        )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "อีเมลนี้ถูกใช้แล้ว"}


def test_login_uses_one_generic_error_for_unknown_email_and_wrong_password(client_factory) -> None:
    with client_factory() as client:
        client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())
        wrong_password = client.post(
            "/api/auth/login",
            json={"email": "learner@example.com", "password": "wrongPass99"},
            headers=same_origin_headers(),
        )
        client.post("/api/auth/logout", headers=same_origin_headers())
        unknown_email = client.post(
            "/api/auth/login",
            json={"email": "unknown@example.com", "password": "wrongPass99"},
            headers=same_origin_headers(),
        )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json() == {"detail": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"}


def test_login_and_current_session_work_and_cookie_is_http_only(client_factory) -> None:
    with client_factory() as client:
        client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())
        client.post("/api/auth/logout", headers=same_origin_headers())
        response = client.post(
            "/api/auth/login",
            json={"email": "learner@example.com", "password": "studyPlan42"},
            headers=same_origin_headers(),
        )

        assert response.status_code == 200
        assert response.json()["email"] == "learner@example.com"
        assert client.get("/api/auth/me").status_code == 200
        cookie = response.headers["set-cookie"].lower()
        assert "httponly" in cookie
        assert "samesite=lax" in cookie
        assert "max-age=" in cookie
        assert "secure" not in cookie


def test_missing_and_expired_sessions_cannot_access_current_user(client_factory) -> None:
    with client_factory() as client:
        assert client.get("/api/auth/me").status_code == 401
        client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())
        raw_token = client.cookies.get("synapsesync_session")
        digest = importlib.import_module("app.security").hash_session_token(raw_token)
        model = importlib.import_module("app.models").AuthSession
        with client.app.state.session_factory() as session:
            stored = session.query(model).filter_by(token_hash=digest).one()
            stored.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            session.commit()

        assert client.get("/api/auth/me").status_code == 401


def test_logout_revokes_session_and_clears_cookie(client_factory) -> None:
    with client_factory() as client:
        client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())
        response = client.post("/api/auth/logout", headers=same_origin_headers())

        assert response.status_code == 204
        assert "max-age=0" in response.headers["set-cookie"].lower()
        assert client.get("/api/auth/me").status_code == 401
        model = importlib.import_module("app.models").AuthSession
        with client.app.state.session_factory() as session:
            assert session.query(model).count() == 0


def test_auth_cookie_can_be_marked_secure_for_https_deployment(client_factory) -> None:
    with client_factory(cookie_secure=True) as client:
        response = client.post("/api/auth/register", json=registration_payload(), headers=same_origin_headers())

    assert response.status_code == 201
    assert "secure" in response.headers["set-cookie"].lower()


def test_login_accepts_existing_account_password_without_new_registration_rules(client_factory) -> None:
    models = importlib.import_module("app.models")
    password_hash = importlib.import_module("pwdlib").PasswordHash.recommended().hash("onlyletters")

    with client_factory() as client:
        with client.app.state.session_factory() as session:
            session.add(models.User(
                email="learner@example.com",
                display_name="Study Learner",
                password_hash=password_hash,
            ))
            session.commit()

        response = client.post(
            "/api/auth/login",
            json={"email": "learner@example.com", "password": "onlyletters"},
            headers=same_origin_headers(),
        )

    assert response.status_code == 200
    assert response.json()["email"] == "learner@example.com"


def test_state_changing_auth_request_rejects_a_foreign_origin(client_factory) -> None:
    with client_factory() as client:
        response = client.post(
            "/api/auth/register",
            json=registration_payload(),
            headers={"Origin": "https://untrusted.example"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "คำขอจากแหล่งที่มาไม่ถูกต้อง"}
