from __future__ import annotations

from dataclasses import replace

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.ai.provider import (
    GeneratedQuiz,
    InsufficientMaterial,
    ProviderRequest,
    QuizProvider,
    parse_provider_response,
    build_prompt,
)
from app.models import Quiz, QuizQuestion, User
from app.schemas.quiz import QuizOptions
from app.services.document_extractor import ExtractedDocument


class InsufficientMaterialError(ValueError):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidProviderResponseError(ValueError):
    """Raised after one bounded repair request still returns an invalid quiz."""


def _safe_validation_messages(error: Exception) -> tuple[str, ...]:
    if isinstance(error, ValidationError):
        details = error.errors(include_input=False)
        return tuple(
            f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
            for item in details[:8]
        )
    return (str(error)[:300],)


def _validate_requested_quiz(quiz: GeneratedQuiz, options: QuizOptions) -> None:
    if len(quiz.questions) != options.question_count:
        raise ValueError(f"Expected exactly {options.question_count} questions")
    allowed_kinds = set(options.question_types)
    if any(question.kind not in allowed_kinds for question in quiz.questions):
        raise ValueError("Provider returned a question kind that was not requested")


async def _request_valid_quiz(
    provider: QuizProvider,
    request: ProviderRequest,
    options: QuizOptions,
) -> GeneratedQuiz:
    current_request = request
    for attempt_number in range(2):
        raw_json = await provider.generate_quiz(current_request)
        try:
            response = parse_provider_response(raw_json)
            if isinstance(response, InsufficientMaterial):
                raise InsufficientMaterialError(response.message)
            _validate_requested_quiz(response, options)
            return response
        except InsufficientMaterialError:
            raise
        except (ValidationError, ValueError) as error:
            if attempt_number == 1:
                raise InvalidProviderResponseError(
                    "Provider did not return a valid quiz after one repair attempt"
                ) from error
            current_request = replace(
                current_request,
                repair_errors=_safe_validation_messages(error),
            )
    raise InvalidProviderResponseError("Provider did not return a valid quiz")


async def generate_and_save_quiz(
    session: Session,
    user: User,
    source: ExtractedDocument,
    options: QuizOptions,
    provider: QuizProvider,
    *,
    input_token_budget: int | None = None,
    source_filename: str = "uploaded document",
    source_storage_key: str | None = None,
) -> Quiz:
    request = build_prompt(source, options, max_input_tokens=input_token_budget)
    generated = await _request_valid_quiz(provider, request, options)

    quiz = Quiz(
        user_id=user.id,
        title=generated.title.strip(),
        source_filename=source_filename[:255],
        source_type=source.source_type,
        source_storage_key=source_storage_key,
        language=options.language,
        difficulty=options.difficulty,
        question_count=options.question_count,
        provider=getattr(provider, "provider_name", provider.__class__.__name__)[:80],
        model=getattr(provider, "model_name", None),
        prompt_version=request.prompt_version,
    )
    for position, question in enumerate(generated.questions, start=1):
        quiz.questions.append(
            QuizQuestion(
                position=position,
                kind=question.kind,
                prompt=question.prompt.strip(),
                choices=list(question.choices) if question.kind == "multiple_choice" else None,
                correct_answer=question.correct_answer,
                explanation=question.explanation.strip(),
                evidence=question.evidence.strip(),
                source_locator=question.source_locator,
            )
        )

    session.add(quiz)
    try:
        session.commit()
        session.refresh(quiz)
    except Exception:
        session.rollback()
        raise
    return quiz
