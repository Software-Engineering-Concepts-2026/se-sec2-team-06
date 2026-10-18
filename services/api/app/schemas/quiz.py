from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator, model_validator

from app.schemas.tag import TagColor


QuestionKind = Literal["multiple_choice", "true_false"]
SourceType = Literal["md", "txt", "docx", "pdf"]
QuizLanguage = Literal["th", "en"]
QuizDifficulty = Literal["basic", "intermediate", "advanced"]


class QuizOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    question_count: int = Field(ge=5, le=20)
    language: QuizLanguage
    difficulty: QuizDifficulty
    question_types: list[QuestionKind]

    @field_validator("question_types")
    @classmethod
    def require_unique_question_types(cls, value: list[QuestionKind]) -> list[QuestionKind]:
        if not value:
            raise ValueError("At least one question type is required")
        if len(set(value)) != len(value):
            raise ValueError("Question types must be unique")
        return value


class QuizModelOption(BaseModel):
    id: str
    name: str


class QuizProviderOption(BaseModel):
    id: str
    name: str
    models: list[QuizModelOption]


class QuizProviderCatalog(BaseModel):
    providers: list[QuizProviderOption]


class QuizQuestionInProgress(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    position: int
    kind: QuestionKind
    prompt: str
    choices: list[str] | None = None


class QuizInProgress(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    title: str
    source_filename: str
    source_type: SourceType
    language: QuizLanguage
    difficulty: QuizDifficulty
    question_count: int
    created_at: datetime
    questions: list[QuizQuestionInProgress]


class QuizSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    title: str
    source_filename: str
    source_type: SourceType
    language: QuizLanguage
    difficulty: QuizDifficulty
    question_count: int
    created_at: datetime


class QuizTagSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    parent_id: int | None
    is_builtin: bool
    color: TagColor


class QuizLibraryItem(QuizSummary):
    tags: list[QuizTagSummary] = Field(default_factory=list)
    attempt_count: int
    latest_attempt: QuizAttemptSummary | None
    best_score: int | None


class QuizTagAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    tag_ids: list[StrictInt]

    @field_validator("tag_ids")
    @classmethod
    def require_unique_tag_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("Tag IDs must be unique")
        return value


class QuizTitleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: str = Field(min_length=1, max_length=160)

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value or not value.isprintable():
            raise ValueError("Title must contain printable characters")
        return value


class QuizQuestionResult(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    question_id: int
    is_correct: bool
    submitted_answer: StrictInt | StrictBool | None = None
    correct_answer: StrictInt | StrictBool
    explanation: str
    evidence: str
    source_locator: str | None = None


class QuizAttemptResult(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    attempt_id: int
    quiz_id: int
    score: int
    total_questions: int
    submitted_at: datetime
    questions: list[QuizQuestionResult]


class QuizAttemptSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    quiz_id: int
    score: int
    total_questions: int
    submitted_at: datetime


class QuizQuestionReview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    question_id: int
    position: int
    kind: QuestionKind
    prompt: str
    choices: list[str] | None
    submitted_answer: StrictInt | StrictBool | None
    is_correct: bool
    correct_answer: StrictInt | StrictBool
    explanation: str
    evidence: str
    source_locator: str | None


class QuizAttemptReview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    attempt_id: int
    quiz_id: int
    quiz_title: str
    score: int
    total_questions: int
    submitted_at: datetime
    questions: list[QuizQuestionReview]


class SubmittedAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    question_id: StrictInt = Field(gt=0)
    selected_choice_index: StrictInt | None = None
    selected_boolean: StrictBool | None = None

    @model_validator(mode="after")
    def require_one_selected_value(self) -> "SubmittedAnswer":
        if (self.selected_choice_index is None) == (self.selected_boolean is None):
            raise ValueError("Provide exactly one answer value")
        return self


class QuizSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    answers: list[SubmittedAnswer] = Field(max_length=20)
