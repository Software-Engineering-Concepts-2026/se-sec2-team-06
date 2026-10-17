from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Quiz, QuizAttempt, Tag, User


def _register(client, email: str = "progress-owner@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Progress Learner", "email": email, "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_quiz(session, user_id: int, title: str, tags: list[Tag] | None = None) -> Quiz:
    quiz = Quiz(
        user_id=user_id,
        title=title,
        source_filename="lesson.md",
        source_type="md",
        language="th",
        difficulty="basic",
        question_count=5,
        prompt_version="quiz_generation_v1",
        created_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
    )
    quiz.tags.extend(tags or [])
    session.add(quiz)
    session.commit()
    session.refresh(quiz)
    return quiz


def _create_attempt(
    session,
    quiz: Quiz,
    user_id: int,
    *,
    days_ago: int,
    score: int,
) -> QuizAttempt:
    submitted_at = datetime(2026, 10, 12, 12, tzinfo=timezone.utc) - timedelta(days=days_ago)
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user_id,
        started_at=submitted_at,
        submitted_at=submitted_at,
        score=score,
        total_questions=5,
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def _other_user(session) -> User:
    user = User(email="other-progress@example.com", display_name="Other Learner", password_hash="$argon2id$test")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _subject(session, slug: str) -> Tag:
    tag = session.scalar(select(Tag).where(Tag.slug == slug))
    assert tag is not None
    return tag


def _child_tag(session, owner_id: int, parent: Tag, name: str) -> Tag:
    tag = Tag(
        name=name,
        name_key=name.casefold(),
        color="violet",
        slug=None,
        owner_id=owner_id,
        parent_id=parent.id,
        is_builtin=False,
    )
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def test_empty_progress_returns_empty_not_zero_result(client_factory):
    with client_factory() as client:
        _register(client)
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "topics_practiced": 0,
        "latest_attempt": None,
        "recent_attempts": [],
        "topics": [],
    }


def test_zero_score_is_a_real_latest_result(client_factory):
    with client_factory() as client:
        owner = _register(client, "zero-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            quiz = _create_quiz(session, owner["id"], "Zero score quiz", [math])
            attempt = _create_attempt(session, quiz, owner["id"], days_ago=0, score=0)
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["latest_attempt"]["attempt_id"] == attempt.id
    assert payload["latest_attempt"]["score"] == 0
    assert len(payload["recent_attempts"]) == 1


def test_progress_timestamps_include_the_utc_offset(client_factory):
    with client_factory() as client:
        owner = _register(client, "utc-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            quiz = _create_quiz(session, owner["id"], "UTC timestamp quiz", [math])
            _create_attempt(session, quiz, owner["id"], days_ago=0, score=3)
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    value = response.json()["latest_attempt"]["submitted_at"]
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)


def test_retakes_are_kept_and_newest_first(client_factory):
    with client_factory() as client:
        owner = _register(client, "retakes-progress@example.com")
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Retake quiz")
            older = _create_attempt(session, quiz, owner["id"], days_ago=4, score=1)
            newer = _create_attempt(session, quiz, owner["id"], days_ago=1, score=4)
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert [item["attempt_id"] for item in payload["recent_attempts"]] == [newer.id, older.id]
    assert [item["score"] for item in payload["recent_attempts"]] == [4, 1]


def test_progress_filters_by_subject_and_descendant_topic_and_searches_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "subject-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            physics = _subject(session, "physics")
            calculus = _child_tag(session, owner["id"], math, "Calculus")
            direct_quiz = _create_quiz(session, owner["id"], "Math foundation", [math])
            topic_quiz = _create_quiz(session, owner["id"], "Topic review", [calculus])
            other_quiz = _create_quiz(session, owner["id"], "Physics review", [physics])
            direct_attempt = _create_attempt(session, direct_quiz, owner["id"], days_ago=3, score=3)
            topic_attempt = _create_attempt(session, topic_quiz, owner["id"], days_ago=2, score=2)
            _create_attempt(session, other_quiz, owner["id"], days_ago=1, score=5)
            math_id, calculus_id = math.id, calculus.id

        subject_response = client.get("/api/progress", params={"tag_id": math_id})
        search_response = client.get("/api/progress", params={"q": "calculus"})
        topic_response = client.get(f"/api/progress/topics/{calculus_id}")

    assert subject_response.status_code == 200, subject_response.text
    assert {item["attempt_id"] for item in subject_response.json()["recent_attempts"]} == {
        direct_attempt.id,
        topic_attempt.id,
    }
    assert subject_response.json()["topics_practiced"] == 2
    assert search_response.status_code == 200, search_response.text
    assert [item["attempt_id"] for item in search_response.json()["recent_attempts"]] == [topic_attempt.id]
    assert topic_response.status_code == 200, topic_response.text
    assert [item["attempt_id"] for item in topic_response.json()["attempts"]] == [topic_attempt.id]


def test_progress_topic_filter_matches_exact_flat_tag(client_factory):
    with client_factory() as client:
        owner = _register(client, "flat-progress@example.com")
        custom_response = client.post(
            "/api/tags",
            json={"name": "Organic chemistry", "color": "green"},
            headers={"Origin": "http://testserver"},
        )
        custom = custom_response.json()
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            flat_tag = session.get(Tag, custom["id"])
            assert flat_tag is not None and flat_tag.parent_id is None
            quiz = _create_quiz(session, owner["id"], "Chemistry practice", [flat_tag])
            attempt = _create_attempt(session, quiz, owner["id"], days_ago=0, score=4)
        overview = client.get("/api/progress", params={"tag_id": custom["id"]})
        topic = client.get(f"/api/progress/topics/{custom['id']}")
        unrelated = client.get("/api/progress", params={"tag_id": math.id})

    assert custom_response.status_code == 201, custom_response.text
    assert overview.status_code == topic.status_code == unrelated.status_code == 200
    assert [item["attempt_id"] for item in overview.json()["recent_attempts"]] == [attempt.id]
    assert [item["attempt_id"] for item in topic.json()["attempts"]] == [attempt.id]
    assert topic.json()["name"] == "Organic chemistry"
    assert unrelated.json()["recent_attempts"] == []


def test_recent_attempt_is_not_duplicated_for_multiple_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "multi-tag-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            sets = _child_tag(session, owner["id"], math, "Sets")
            quiz = _create_quiz(session, owner["id"], "Tagged twice", [math, sets])
            attempt = _create_attempt(session, quiz, owner["id"], days_ago=0, score=4)
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert [item["attempt_id"] for item in payload["recent_attempts"]] == [attempt.id]
    assert payload["topics_practiced"] == 2
    assert {topic["tag_id"] for topic in payload["topics"]} == {math.id, sets.id}
    assert all(topic["attempt_count"] == 1 for topic in payload["topics"])


def test_unsubmitted_quiz_has_no_progress_record(client_factory):
    with client_factory() as client:
        owner = _register(client, "unsubmitted-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            _create_quiz(session, owner["id"], "Not submitted", [math])
        response = client.get("/api/progress")

    assert response.status_code == 200, response.text
    assert response.json()["latest_attempt"] is None
    assert response.json()["recent_attempts"] == []
    assert response.json()["topics"] == []


def test_progress_never_exposes_another_users_data(client_factory):
    with client_factory() as client:
        owner = _register(client, "owner-scope-progress@example.com")
        with client.app.state.session_factory() as session:
            math = _subject(session, "math")
            other = _other_user(session)
            own_quiz = _create_quiz(session, owner["id"], "My quiz", [math])
            other_quiz = _create_quiz(session, other.id, "Private quiz", [math])
            own_attempt = _create_attempt(session, own_quiz, owner["id"], days_ago=0, score=2)
            _create_attempt(session, other_quiz, other.id, days_ago=1, score=5)
            # Even a malformed row that points this user's attempt at a foreign quiz must stay private.
            _create_attempt(session, other_quiz, owner["id"], days_ago=2, score=1)
            math_id = math.id
        overview = client.get("/api/progress")
        topic = client.get(f"/api/progress/topics/{math_id}")

    assert overview.status_code == 200, overview.text
    assert [item["attempt_id"] for item in overview.json()["recent_attempts"]] == [own_attempt.id]
    assert "Private quiz" not in overview.text
    assert topic.status_code == 200, topic.text
    assert [item["attempt_id"] for item in topic.json()["attempts"]] == [own_attempt.id]
