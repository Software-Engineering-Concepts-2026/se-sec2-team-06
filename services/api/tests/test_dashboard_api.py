from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models import Deadline, Document, Quiz, QuizAttempt, Tag, User


def _register(client, email: str = "dashboard@example.com") -> dict[str, object]:
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Dashboard Learner", "email": email, "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201
    return response.json()


def _quiz(session, user_id: int, title: str, tags: list[Tag], attempts: list[tuple[int, int, datetime]]) -> Quiz:
    quiz = Quiz(
        user_id=user_id,
        title=title,
        source_filename="lesson.md",
        source_type="md",
        language="th",
        difficulty="basic",
        question_count=max((total for _, total, _ in attempts), default=1),
        prompt_version="quiz_generation_v1",
        tags=tags,
    )
    session.add(quiz)
    session.flush()
    session.add_all(
        QuizAttempt(
            quiz_id=quiz.id,
            user_id=user_id,
            score=score,
            total_questions=total,
            started_at=submitted_at,
            submitted_at=submitted_at,
        )
        for score, total, submitted_at in attempts
    )
    return quiz


def test_dashboard_requires_authentication(client_factory):
    with client_factory() as client:
        response = client.get("/api/dashboard/overview")

    assert response.status_code == 401


def test_dashboard_aggregates_owned_data_and_keeps_zero_scores(client_factory):
    with client_factory() as client:
        owner = _register(client, "dashboard-owner@example.com")
        other_cookie = _register(client, "dashboard-other@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            english = session.scalar(select(Tag).where(Tag.slug == "english"))
            assert math and english
            custom = Tag(
                name="เซต",
                name_key="เซต",
                owner_id=owner["id"],
                parent_id=None,
                is_builtin=False,
                color="pink",
            )
            session.add(custom)
            session.flush()
            bangkok = ZoneInfo("Asia/Bangkok")
            local_today = datetime.now(timezone.utc).astimezone(bangkok).date()
            now = datetime.combine(local_today, time(12), tzinfo=bangkok).astimezone(timezone.utc)
            doc1 = Document(
                user_id=owner["id"], title="Algebra", original_filename="algebra.pdf",
                file_type="pdf", size_bytes=100, storage_key="dashboard-doc-a", tags=[math, english],
            )
            doc2 = Document(
                user_id=owner["id"], title="Sets", original_filename="sets.md",
                file_type="md", size_bytes=50, storage_key="dashboard-doc-b", tags=[math],
            )
            doc3 = Document(
                user_id=owner["id"], title="Untaged", original_filename="notes.txt",
                file_type="txt", size_bytes=20, storage_key="dashboard-doc-c",
            )
            session.add_all([doc1, doc2, doc3])
            session.add_all([
                Deadline(user_id=owner["id"], title="Start", subject="คณิตศาสตร์", due_at=now, priority="low", status="not_started"),
                Deadline(user_id=owner["id"], title="Doing", subject="คณิตศาสตร์", due_at=now, priority="medium", status="in_progress"),
                Deadline(user_id=owner["id"], title="Done", subject="คณิตศาสตร์", due_at=now, priority="high", status="completed", is_completed=True),
            ])
            _quiz(session, owner["id"], "Math review", [math], [
                (0, 1, now - timedelta(minutes=30)),
                (1, 1, now - timedelta(hours=1)),
            ])
            _quiz(session, owner["id"], "Set basics", [custom], [(0, 2, now - timedelta(hours=2))])
            other = session.scalar(select(User).where(User.email == "dashboard-other@example.com"))
            session.add(Document(
                user_id=other.id, title="Private", original_filename="private.pdf",
                file_type="pdf", size_bytes=100, storage_key="dashboard-private-doc", tags=[math],
            ))
            _quiz(session, other.id, "Private quiz", [math], [(1, 1, now)])
            session.commit()

        restored_owner = client.post(
            "/api/auth/login",
            json={"email": "dashboard-owner@example.com", "password": "studyPlan42"},
            headers={"Origin": "http://testserver"},
        )
        assert restored_owner.status_code == 200

        response = client.get("/api/dashboard/overview?period=day&time_zone=Asia%2FBangkok")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload["quiz_activity"]) == 7
    assert payload["quiz_activity"][-1]["count"] == 3
    assert payload["task_status"] == {"not_started": 1, "in_progress": 1, "completed": 1}
    documents = {item["tag_name"]: item["count"] for item in payload["documents_by_tag"]}
    assert documents["คณิตศาสตร์"] == 2
    assert documents["ภาษาอังกฤษ"] == 1
    assert documents["ยังไม่ติดแท็ก"] == 1
    assert "Private" not in str(payload)
    topics = {item["tag_name"]: item for item in payload["topics_to_review"]}
    assert topics["คณิตศาสตร์"]["average_percent"] == 50
    assert topics["คณิตศาสตร์"]["attempt_count"] == 2
    assert topics["เซต"]["average_percent"] == 0


def test_dashboard_empty_data_has_empty_charts_and_zero_task_counts(client_factory):
    with client_factory() as client:
        _register(client, "dashboard-empty@example.com")
        response = client.get("/api/dashboard/overview?period=week&time_zone=UTC")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["quiz_activity"]) == 8
    assert all(item["count"] == 0 for item in payload["quiz_activity"])
    assert payload["task_status"] == {"not_started": 0, "in_progress": 0, "completed": 0}
    assert payload["documents_by_tag"] == []
    assert payload["topics_to_review"] == []


def test_dashboard_buckets_use_requested_iana_timezone(client_factory):
    from app.services.dashboard import get_dashboard_overview

    with client_factory() as client:
        owner = _register(client, "dashboard-timezone@example.com")
        with client.app.state.session_factory() as session:
            utc = get_dashboard_overview(
                session,
                owner["id"],
                period="week",
                time_zone="UTC",
                now_utc=datetime(2026, 1, 4, 23, 30, tzinfo=timezone.utc),
            )
            bangkok = get_dashboard_overview(
                session,
                owner["id"],
                period="week",
                time_zone="Asia/Bangkok",
                now_utc=datetime(2026, 1, 4, 23, 30, tzinfo=timezone.utc),
            )

    assert utc.quiz_activity[-1].label == "2026-W01"
    assert bangkok.quiz_activity[-1].label == "2026-W02"


def test_dashboard_rejects_invalid_timezone(client_factory):
    with client_factory() as client:
        _register(client, "dashboard-invalid-zone@example.com")
        response = client.get("/api/dashboard/overview?time_zone=Not%2FAZone")

    assert response.status_code == 422
