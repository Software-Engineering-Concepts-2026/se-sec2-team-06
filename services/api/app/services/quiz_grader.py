from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.models import QuizQuestion
from app.schemas.quiz import SubmittedAnswer


@dataclass(frozen=True)
class QuestionGrade:
    question_id: int
    is_correct: bool
    correct_answer: int | bool
    explanation: str
    evidence: str
    submitted_answer: int | bool | None = None
    source_locator: str | None = None


@dataclass(frozen=True)
class GradingResult:
    score: int
    total_questions: int
    questions: list[QuestionGrade]


def grade_answers(
    questions: Sequence[QuizQuestion],
    submitted: Sequence[SubmittedAnswer],
) -> GradingResult:
    questions_by_id = {question.id: question for question in questions}
    if len(questions_by_id) != len(questions):
        raise ValueError("Quiz contains duplicate question IDs")

    submitted_by_id: dict[int, SubmittedAnswer] = {}
    for answer in submitted:
        if answer.question_id in submitted_by_id:
            raise ValueError("Duplicate question IDs are not allowed")
        if answer.question_id not in questions_by_id:
            raise ValueError("Submitted answer references a question outside this quiz")
        submitted_by_id[answer.question_id] = answer

    grades: list[QuestionGrade] = []
    for question in questions:
        answer = submitted_by_id.get(question.id)
        submitted_value: int | bool | None = None

        if answer is None:
            is_correct = False
        elif question.kind == "multiple_choice":
            if answer.selected_choice_index is None or answer.selected_boolean is not None:
                raise ValueError("Multiple-choice questions require an option index")
            if not 0 <= answer.selected_choice_index < len(question.choices or []):
                raise ValueError("Selected option is outside the available choices")
            submitted_value = answer.selected_choice_index
            is_correct = submitted_value == question.correct_answer
        elif question.kind == "true_false":
            if answer.selected_boolean is None or answer.selected_choice_index is not None:
                raise ValueError("True/false questions require a boolean answer")
            submitted_value = answer.selected_boolean
            is_correct = submitted_value is question.correct_answer
        else:
            raise ValueError("Quiz contains an unsupported question type")

        grades.append(
            QuestionGrade(
                question_id=question.id,
                is_correct=is_correct,
                correct_answer=question.correct_answer,
                explanation=question.explanation,
                evidence=question.evidence,
                submitted_answer=submitted_value,
                source_locator=question.source_locator,
            )
        )

    return GradingResult(
        score=sum(grade.is_correct for grade in grades),
        total_questions=len(questions),
        questions=grades,
    )
