from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Quiz, QuizAnswer, QuizAttempt, QuizQuestion, User


def _register(client):
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Quiz Owner", "email": "owner@example.com", "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201
    return response.json()


def _quiz(session, user_id: int, title: str = "Quiz"):
    quiz = Quiz(
        user_id=user_id,
        title=title,
        source_filename="lesson.md",
        source_type="md",
        language="en",
        difficulty="basic",
        question_count=2,
        prompt_version="quiz_generation_v1",
    )
    quiz.questions.extend(
        [
            QuizQuestion(
                position=1,
                kind="multiple_choice",
                prompt="Choose one.",
                choices=["A", "B", "C", "D"],
                correct_answer=1,
                explanation="B is supported.",
                evidence="Evidence B.",
            ),
            QuizQuestion(
                position=2,
                kind="true_false",
                prompt="This statement is true.",
                choices=None,
                correct_answer=True,
                explanation="The statement is true.",
                evidence="Evidence says true.",
            ),
        ]
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)
    return quiz


def _other_user(session):
    other = User(
        email="other@example.com",
        display_name="Other User",
        password_hash="$argon2id$test",
    )
    session.add(other)
    session.commit()
    session.refresh(other)
    return other


def test_submit_saves_attempt_for_owner_and_reveals_results(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _quiz(session, owner["id"])
            question_ids = [question.id for question in quiz.questions]

        response = client.post(
            f"/api/quizzes/{quiz.id}/attempts",
            json={
                "answers": [
                    {"question_id": question_ids[0], "selected_choice_index": 1},
                    {"question_id": question_ids[1], "selected_boolean": True},
                ]
            },
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            attempt = session.scalar(select(QuizAttempt))
            saved_answers = session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()

    result = response.json()
    assert response.status_code == 201
    assert result["score"] == 2
    assert result["total_questions"] == 2
    assert result["questions"][0]["correct_answer"] == 1
    assert result["questions"][1]["correct_answer"] is True
    assert len(saved_answers) == 2
    assert attempt.user_id == owner["id"]


def test_submit_other_users_quiz_is_not_found(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _other_user(session)
            quiz = _quiz(session, other.id, "Private quiz")

        response = client.post(
            f"/api/quizzes/{quiz.id}/attempts",
            json={"answers": []},
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 404
    assert "Private quiz" not in response.text
    assert owner["id"] != other.id


def test_attempt_history_is_owner_scoped_and_newest_first(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _other_user(session)
            owner_quiz = _quiz(session, owner["id"], "Owner quiz")
            other_quiz = _quiz(session, other.id, "Other quiz")
            now = datetime.now(timezone.utc)
            session.add_all(
                [
                    QuizAttempt(
                        quiz_id=owner_quiz.id,
                        user_id=owner["id"],
                        started_at=now - timedelta(days=1),
                        submitted_at=now - timedelta(days=1),
                        score=1,
                        total_questions=2,
                    ),
                    QuizAttempt(
                        quiz_id=owner_quiz.id,
                        user_id=owner["id"],
                        started_at=now,
                        submitted_at=now,
                        score=2,
                        total_questions=2,
                    ),
                    QuizAttempt(
                        quiz_id=other_quiz.id,
                        user_id=other.id,
                        started_at=now,
                        submitted_at=now,
                        score=0,
                        total_questions=2,
                    ),
                ]
            )
            session.commit()

        response = client.get(f"/api/quizzes/{owner_quiz.id}/attempts")

    assert response.status_code == 200
    assert [item["score"] for item in response.json()] == [2, 1]
    assert all(item["quiz_id"] == owner_quiz.id for item in response.json())


def test_invalid_submission_saves_no_attempt(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _quiz(session, owner["id"])
            question_ids = [question.id for question in quiz.questions]

        response = client.post(
            f"/api/quizzes/{quiz.id}/attempts",
            json={"answers": [{"question_id": question_ids[0], "selected_boolean": True}]},
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            attempts = session.scalars(select(QuizAttempt)).all()

    assert response.status_code == 422
    assert attempts == []


def _submit(client, quiz_id: int, question_ids: list[int], choice_index: int = 1):
    return client.post(
        f"/api/quizzes/{quiz_id}/attempts",
        json={
            "answers": [
                {"question_id": question_ids[0], "selected_choice_index": choice_index},
                {"question_id": question_ids[1], "selected_boolean": True},
            ]
        },
        headers={"Origin": "http://testserver"},
    )


def test_submit_returns_question_text_choices_and_saved_answer(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _quiz(session, owner["id"], "Set theory basics")
            question_ids = [question.id for question in quiz.questions]

        response = _submit(client, quiz.id, question_ids, choice_index=0)

    assert response.status_code == 201
    result = response.json()
    assert result["quiz_title"] == "Set theory basics"
    assert result["questions"][0] == {
        "question_id": question_ids[0],
        "position": 1,
        "kind": "multiple_choice",
        "prompt": "Choose one.",
        "choices": ["A", "B", "C", "D"],
        "submitted_answer": 0,
        "is_correct": False,
        "correct_answer": 1,
        "explanation": "B is supported.",
        "evidence": "Evidence B.",
        "source_locator": None,
    }
    assert result["questions"][1]["prompt"] == "This statement is true."
    assert result["questions"][1]["choices"] is None
    assert result["questions"][1]["submitted_answer"] is True


def test_attempt_detail_returns_persisted_review(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _quiz(session, owner["id"], "Saved review")
            question_ids = [question.id for question in quiz.questions]

        submitted = _submit(client, quiz.id, question_ids)
        attempt_id = submitted.json()["attempt_id"]
        response = client.get(f"/api/quizzes/{quiz.id}/attempts/{attempt_id}")

    assert response.status_code == 200
    assert response.json() == submitted.json()


def test_repeated_submission_creates_distinct_attempts_without_changing_first_review(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _quiz(session, owner["id"], "Repeatable quiz")
            question_ids = [question.id for question in quiz.questions]

        first = _submit(client, quiz.id, question_ids, choice_index=0).json()
        second = _submit(client, quiz.id, question_ids, choice_index=1).json()
        first_review = client.get(
            f"/api/quizzes/{quiz.id}/attempts/{first['attempt_id']}"
        )

    assert first["attempt_id"] != second["attempt_id"]
    assert first["score"] == 1
    assert second["score"] == 2
    assert first_review.status_code == 200
    assert first_review.json() == first


def test_attempt_detail_rejects_cross_owner_cross_quiz_and_unknown_ids(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _other_user(session)
            owner_quiz = _quiz(session, owner["id"], "Owner quiz")
            second_owner_quiz = _quiz(session, owner["id"], "Second owner quiz")
            other_quiz = _quiz(session, other.id, "Private quiz")
            owner_attempt = QuizAttempt(
                quiz_id=owner_quiz.id,
                user_id=owner["id"],
                score=1,
                total_questions=2,
            )
            other_attempt = QuizAttempt(
                quiz_id=other_quiz.id,
                user_id=other.id,
                score=1,
                total_questions=2,
            )
            session.add_all([owner_attempt, other_attempt])
            session.commit()
            owner_attempt_id = owner_attempt.id
            other_attempt_id = other_attempt.id

        cross_owner = client.get(
            f"/api/quizzes/{other_quiz.id}/attempts/{other_attempt_id}"
        )
        cross_quiz = client.get(
            f"/api/quizzes/{second_owner_quiz.id}/attempts/{owner_attempt_id}"
        )
        unknown = client.get(f"/api/quizzes/{owner_quiz.id}/attempts/99999")

    assert cross_owner.status_code == 404
    assert "Private quiz" not in cross_owner.text
    assert cross_quiz.status_code == 404
    assert unknown.status_code == 404
