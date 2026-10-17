from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.quiz import SubmittedAnswer
from app.services.quiz_grader import grade_answers


def _question(question_id: int, kind: str, correct_answer):
    return SimpleNamespace(
        id=question_id,
        kind=kind,
        choices=["A", "B", "C", "D"] if kind == "multiple_choice" else None,
        correct_answer=correct_answer,
        explanation=f"Explanation for {question_id}.",
        evidence=f"Evidence for {question_id}.",
        source_locator=None,
    )


def test_grade_multiple_choice_by_option_index():
    result = grade_answers(
        [_question(1, "multiple_choice", 2)],
        [SubmittedAnswer(question_id=1, selected_choice_index=2)],
    )

    assert result.score == 1
    assert result.questions[0].is_correct is True
    assert result.questions[0].correct_answer == 2


def test_grade_true_false_by_boolean():
    result = grade_answers(
        [_question(1, "true_false", False)],
        [SubmittedAnswer(question_id=1, selected_boolean=False)],
    )

    assert result.score == 1
    assert result.questions[0].is_correct is True


def test_reject_wrong_answer_value_type():
    with pytest.raises(ValueError):
        grade_answers(
            [_question(1, "multiple_choice", 0)],
            [SubmittedAnswer(question_id=1, selected_boolean=True)],
        )


def test_reject_duplicate_or_foreign_question_ids():
    question = _question(1, "multiple_choice", 0)
    duplicate_answers = [
        SubmittedAnswer(question_id=1, selected_choice_index=0),
        SubmittedAnswer(question_id=1, selected_choice_index=1),
    ]
    with pytest.raises(ValueError):
        grade_answers([question], duplicate_answers)

    with pytest.raises(ValueError):
        grade_answers([question], [SubmittedAnswer(question_id=999, selected_choice_index=0)])


def test_unanswered_questions_are_marked_incorrect():
    result = grade_answers(
        [_question(1, "true_false", True), _question(2, "multiple_choice", 0)],
        [SubmittedAnswer(question_id=1, selected_boolean=True)],
    )

    assert [item.is_correct for item in result.questions] == [True, False]
    assert result.questions[1].submitted_answer is None


def test_score_is_count_of_correct_answers():
    result = grade_answers(
        [
            _question(1, "multiple_choice", 1),
            _question(2, "true_false", True),
            _question(3, "true_false", False),
        ],
        [
            SubmittedAnswer(question_id=1, selected_choice_index=1),
            SubmittedAnswer(question_id=2, selected_boolean=False),
            SubmittedAnswer(question_id=3, selected_boolean=False),
        ],
    )

    assert result.score == 2
    assert result.total_questions == 3


def test_submitted_answer_requires_exactly_one_answer_value():
    with pytest.raises(ValidationError):
        SubmittedAnswer(question_id=1)
    with pytest.raises(ValidationError):
        SubmittedAnswer(question_id=1, selected_choice_index=0, selected_boolean=True)
