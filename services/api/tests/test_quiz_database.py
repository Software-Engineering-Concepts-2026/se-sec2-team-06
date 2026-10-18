from __future__ import annotations

import importlib
from datetime import datetime, timezone

from sqlalchemy import inspect


def test_create_app_creates_quiz_and_tag_tables_without_changing_users(client_factory):
    with client_factory() as client:
        engine = client.app.state.session_factory.kw["bind"]
        inspector = inspect(engine)

        assert {
            "quizzes",
            "quiz_questions",
            "quiz_attempts",
            "quiz_answers",
            "tags",
            "quiz_tags",
        }.issubset(set(inspector.get_table_names()))
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        assert not user_columns.intersection({"quiz_id", "quiz_history", "questions", "attempts"})


def test_quiz_and_attempt_rows_reference_user(client_factory):
    models = importlib.import_module("app.models")
    with client_factory() as client:
        with client.app.state.session_factory() as session:
            user = models.User(
                email="quiz-owner@example.com",
                display_name="Quiz Owner",
                password_hash="$argon2id$test",
            )
            session.add(user)
            session.flush()
            quiz = models.Quiz(
                user_id=user.id,
                title="Sample quiz",
                source_filename="lesson.md",
                source_type="md",
                language="en",
                difficulty="basic",
                question_count=5,
                prompt_version="quiz_generation_v1",
            )
            session.add(quiz)
            session.flush()
            question = models.QuizQuestion(
                quiz_id=quiz.id,
                position=1,
                kind="true_false",
                prompt="The sky is blue.",
                choices=None,
                correct_answer=True,
                explanation="Sample explanation",
                evidence="Sample evidence",
            )
            session.add(question)
            session.flush()
            attempt = models.QuizAttempt(
                quiz_id=quiz.id,
                user_id=user.id,
                started_at=datetime.now(timezone.utc),
                submitted_at=datetime.now(timezone.utc),
                score=1,
                total_questions=1,
            )
            session.add(attempt)
            session.flush()
            answer = models.QuizAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                submitted_answer=True,
                is_correct=True,
            )
            session.add(answer)
            session.commit()

            assert attempt.user_id == user.id
            assert quiz.user_id == user.id
            assert answer.question_id == question.id


def test_quiz_in_progress_serialization_omits_answer_key():
    from app.schemas.quiz import QuizInProgress, QuizQuestionInProgress

    quiz = QuizInProgress(
        id=1,
        title="Sample quiz",
        source_filename="lesson.md",
        source_type="md",
        language="en",
        difficulty="basic",
        question_count=1,
        created_at=datetime.now(timezone.utc),
        questions=[
            QuizQuestionInProgress(
                id=10,
                position=1,
                kind="multiple_choice",
                prompt="Choose one",
                choices=["A", "B", "C", "D"],
            )
        ],
    )

    serialized = quiz.model_dump_json()

    assert "correct_answer" not in serialized
    assert "choices" in serialized
