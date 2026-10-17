from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, aliased, selectinload

from app.ai.catalog import get_provider_catalog, resolve_model_selection
from app.ai.provider import (
    ProviderError,
    ProviderNotConfigured,
    ProviderQuotaExceeded,
    QuizProvider,
)
from app.models import Quiz, QuizAnswer, QuizAttempt, Tag, User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.quiz import (
    QuizAttemptReview,
    QuizAttemptSummary,
    QuizInProgress,
    QuizLibraryItem,
    QuizOptions,
    QuizProviderCatalog,
    QuizSubmission,
    QuizSummary,
    QuizTagAssignment,
    QuizTagSummary,
    QuizTitleUpdate,
)
from app.services.document_extractor import (
    EmptyDocumentError,
    InvalidDocumentError,
    SourceTextTooLongError,
    UnsupportedDocumentError,
    UploadTooLargeError,
    extract_document,
)
from app.services.quiz_generator import (
    InsufficientMaterialError,
    InvalidProviderResponseError,
    generate_and_save_quiz,
)
from app.services.quiz_grader import grade_answers
from app.storage.providers import FileStorageProvider
from app.tags.service import (
    QuizOrTagNotFoundError,
    TagAssignmentPersistenceError,
    replace_quiz_tags,
)

UPLOAD_CHUNK_BYTES = 64 * 1024
_QUIZ_SOURCE_TYPES = {
    "pdf": (".pdf", "application/pdf"),
    "docx": (".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "md": (".md", "text/markdown"),
    "txt": (".txt", "text/plain"),
}
_LOGGER = logging.getLogger(__name__)

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


async def read_upload_limited(upload: UploadFile, max_bytes: int = 20_000_000) -> bytes:
    if max_bytes < 0:
        raise ValueError("max_bytes must not be negative")
    content = bytearray()
    while True:
        remaining = max_bytes - len(content)
        chunk = await upload.read(min(UPLOAD_CHUNK_BYTES, remaining + 1))
        if not chunk:
            break
        if len(content) + len(chunk) > max_bytes:
            raise UploadTooLargeError(f"Upload exceeds {max_bytes} bytes")
        content.extend(chunk)
    return bytes(content)


def _safe_source_filename(filename: str | None) -> str:
    normalized = (filename or "uploaded-document").replace("\\", "/").split("/")[-1]
    safe = "".join(character for character in normalized if character >= " " and character != "\x7f")
    return (safe[:255] or "uploaded-document")


def _cleanup_quiz_source(storage: FileStorageProvider, storage_key: str | None) -> None:
    if storage_key is None:
        return
    try:
        storage.delete("quiz-sources", storage_key)
    except Exception:
        _LOGGER.warning("Could not remove an unreferenced quiz source from private storage")


def _provider_from_request(
    request: Request,
    provider_id: str,
    model_id: str,
) -> QuizProvider:
    injected_provider = request.app.state.quiz_provider
    if injected_provider is not None:
        return injected_provider
    return request.app.state.quiz_provider_factory(provider_id, model_id)


def _get_owned_quiz(session: Session, user_id: int, quiz_id: int) -> Quiz:
    quiz = session.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id, Quiz.user_id == user_id)
    )
    if quiz is None:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบนี้")
    return quiz


def _build_library_item(
    session: Session,
    quiz: Quiz,
    user_id: int,
    *,
    attempt_count: int | None = None,
    best_score: int | None = None,
    latest_attempt: QuizAttempt | None = None,
) -> QuizLibraryItem:
    if attempt_count is None:
        attempt_count, best_score = session.execute(
            select(func.count(QuizAttempt.id), func.max(QuizAttempt.score)).where(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.user_id == user_id,
            )
        ).one()
        latest_attempt = session.scalar(
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user_id)
            .order_by(QuizAttempt.submitted_at.desc(), QuizAttempt.id.desc())
            .limit(1)
        )
    return QuizLibraryItem.model_validate(
        {
            **QuizSummary.model_validate(quiz).model_dump(),
            "tags": [
                QuizTagSummary.model_validate(tag).model_dump()
                for tag in sorted(quiz.tags, key=lambda item: item.id)
            ],
            "attempt_count": attempt_count,
            "latest_attempt": (
                QuizAttemptSummary.model_validate(latest_attempt)
                if latest_attempt is not None
                else None
            ),
            "best_score": best_score,
        }
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _build_attempt_review(
    quiz: Quiz,
    attempt: QuizAttempt,
    answers: list[QuizAnswer],
) -> QuizAttemptReview:
    answers_by_question_id = {answer.question_id: answer for answer in answers}
    return QuizAttemptReview(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        score=attempt.score,
        total_questions=attempt.total_questions,
        submitted_at=attempt.submitted_at,
        questions=[
            {
                "question_id": question.id,
                "position": question.position,
                "kind": question.kind,
                "prompt": question.prompt,
                "choices": question.choices,
                "submitted_answer": (
                    answers_by_question_id[question.id].submitted_answer
                    if question.id in answers_by_question_id
                    else None
                ),
                "is_correct": (
                    answers_by_question_id[question.id].is_correct
                    if question.id in answers_by_question_id
                    else False
                ),
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "evidence": question.evidence,
                "source_locator": question.source_locator,
            }
            for question in quiz.questions
        ],
    )


@router.get("/providers", response_model=QuizProviderCatalog)
def list_quiz_providers(
    _user: User = Depends(get_current_user),
) -> dict[str, object]:
    return {"providers": get_provider_catalog()}


@router.post("/generate", response_model=QuizInProgress, status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    question_count: Annotated[int, Form()] = 10,
    language: Annotated[str, Form()] = "th",
    difficulty: Annotated[str, Form()] = "intermediate",
    question_types: Annotated[list[str], Form()] = ["multiple_choice"],
    provider: Annotated[str | None, Form()] = None,
    model: Annotated[str | None, Form()] = None,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizInProgress:
    require_same_origin(request)
    try:
        selection = resolve_model_selection(
            provider,
            model,
            default_model=request.app.state.ai_settings.model,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail="เลือก Provider และโมเดลที่รองรับจากรายการ",
        ) from error

    try:
        options = QuizOptions.model_validate(
            {
                "question_count": question_count,
                "language": language,
                "difficulty": difficulty,
                "question_types": question_types,
            }
        )
    except ValidationError as error:
        raise HTTPException(status_code=422, detail="ตัวเลือกแบบทดสอบไม่ถูกต้อง") from error

    try:
        content = await read_upload_limited(file)
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413, detail="ไฟล์มีขนาดเกิน 20 MB") from error
    finally:
        await file.close()

    safe_filename = _safe_source_filename(file.filename)
    try:
        source = extract_document(safe_filename, content, file.content_type)
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413, detail="ไฟล์มีขนาดเกิน 20 MB") from error
    except (UnsupportedDocumentError, InvalidDocumentError) as error:
        raise HTTPException(status_code=415, detail=str(error)) from error
    except (EmptyDocumentError, SourceTextTooLongError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    source_suffix, source_content_type = _QUIZ_SOURCE_TYPES[source.source_type]
    storage = request.app.state.storage_provider
    source_storage_key: str | None = None
    try:
        source_storage_key = storage.new_key(user.id, source_suffix)
        storage.put("quiz-sources", source_storage_key, content, source_content_type)
    except Exception as error:
        _cleanup_quiz_source(storage, source_storage_key)
        raise HTTPException(status_code=503, detail="พื้นที่จัดเก็บไฟล์ยังไม่พร้อมใช้งาน") from error

    try:
        try:
            quiz = await generate_and_save_quiz(
                session,
                user,
                source,
                options,
                _provider_from_request(request, selection.provider_id, selection.model_id),
                input_token_budget=request.app.state.ai_settings.input_token_budget,
                source_filename=safe_filename,
                source_storage_key=source_storage_key,
            )
        except Exception:
            _cleanup_quiz_source(storage, source_storage_key)
            raise
    except InsufficientMaterialError as error:
        raise HTTPException(status_code=422, detail=error.message) from error
    except ProviderNotConfigured as error:
        raise HTTPException(
            status_code=503,
            detail="ยังไม่ได้ตั้งค่า API key ของ UP AI Connect ในฝั่งเซิร์ฟเวอร์",
        ) from error
    except ProviderQuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "provider_quota_full",
                "provider": error.provider_id,
                "provider_name": error.provider_name,
                "model": error.model_id,
                "message": (
                    f"โควตาหรือขีดจำกัดการเรียกใช้ของ {error.provider_name} เต็มแล้ว "
                    "กรุณาเลือก Provider อื่นแล้วลองอีกครั้ง"
                ),
            },
        ) from error
    except InvalidProviderResponseError as error:
        raise HTTPException(status_code=502, detail="AI provider ส่งข้อมูลข้อสอบที่ไม่ถูกต้อง") from error
    except ProviderError as error:
        raise HTTPException(status_code=502, detail="ไม่สามารถสร้างข้อสอบจาก AI provider ได้") from error
    except SQLAlchemyError as error:
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกข้อสอบได้") from error
    except Exception as error:
        # Provider implementations may expose vendor-specific exceptions. Keep
        # their messages and uploaded content out of API responses.
        raise HTTPException(status_code=502, detail="ไม่สามารถสร้างข้อสอบได้ในขณะนี้") from error

    return QuizInProgress.model_validate(quiz)


@router.get("", response_model=list[QuizLibraryItem])
def list_quizzes(
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=160),
    tag_id: int | None = Query(default=None, gt=0),
) -> list[QuizLibraryItem]:
    attempt_stats = (
        select(
            QuizAttempt.quiz_id.label("quiz_id"),
            func.count(QuizAttempt.id).label("attempt_count"),
            func.max(QuizAttempt.score).label("best_score"),
        )
        .where(QuizAttempt.user_id == user.id)
        .group_by(QuizAttempt.quiz_id)
        .subquery()
    )
    latest_attempt_id = (
        select(QuizAttempt.id)
        .where(QuizAttempt.quiz_id == Quiz.id, QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.submitted_at.desc(), QuizAttempt.id.desc())
        .limit(1)
        .correlate(Quiz)
        .scalar_subquery()
    )
    latest_attempt = aliased(QuizAttempt)
    quiz_filters = [Quiz.user_id == user.id]
    search_text = (q or "").strip()
    if search_text:
        folded_pattern = f"%{_escape_like(search_text.casefold())}%"
        tag_search = Tag.name_key.like(folded_pattern, escape="\\")
        if session.get_bind().dialect.name == "sqlite":
            title_search = func.casefold(Quiz.title).like(folded_pattern, escape="\\")
        else:
            title_pattern = f"%{_escape_like(search_text)}%"
            title_search = Quiz.title.ilike(title_pattern, escape="\\")
        quiz_filters.append(
            or_(
                title_search,
                Quiz.tags.any(tag_search),
            )
        )

    if tag_id is not None:
        selected_tag = session.scalar(
            select(Tag).where(
                Tag.id == tag_id,
                or_(
                    and_(
                        Tag.is_builtin.is_(True),
                        Tag.owner_id.is_(None),
                        Tag.parent_id.is_(None),
                    ),
                    and_(
                        Tag.is_builtin.is_(False),
                        Tag.owner_id == user.id,
                    ),
                ),
            )
        )
        if selected_tag is None:
            raise HTTPException(status_code=404, detail="ไม่พบแท็กนี้")
        matching_tag_ids = select(Tag.id).where(Tag.id == selected_tag.id)
        if selected_tag.is_builtin:
            matching_tag_ids = select(Tag.id).where(
                or_(
                    Tag.id == selected_tag.id,
                    and_(
                        Tag.parent_id == selected_tag.id,
                        Tag.owner_id == user.id,
                        Tag.is_builtin.is_(False),
                    ),
                )
            )
        quiz_filters.append(Quiz.tags.any(Tag.id.in_(matching_tag_ids)))

    rows = session.execute(
        select(
            Quiz,
            func.coalesce(attempt_stats.c.attempt_count, 0),
            attempt_stats.c.best_score,
            latest_attempt,
        )
        .options(selectinload(Quiz.tags))
        .outerjoin(attempt_stats, attempt_stats.c.quiz_id == Quiz.id)
        .outerjoin(latest_attempt, latest_attempt.id == latest_attempt_id)
        .where(*quiz_filters)
        .order_by(Quiz.created_at.desc(), Quiz.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return [
        _build_library_item(
            session,
            quiz,
            user.id,
            attempt_count=attempt_count,
            best_score=best_score,
            latest_attempt=latest,
        )
        for quiz, attempt_count, best_score, latest in rows
    ]


@router.patch("/{quiz_id}", response_model=QuizLibraryItem)
def rename_quiz(
    quiz_id: int,
    payload: QuizTitleUpdate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizLibraryItem:
    require_same_origin(request)
    quiz = session.scalar(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == user.id)
    )
    if quiz is None:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบนี้")

    quiz.title = payload.title
    try:
        session.commit()
        session.refresh(quiz)
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกชื่อแบบทดสอบได้") from error

    return _build_library_item(session, quiz, user.id)


@router.put("/{quiz_id}/tags", response_model=QuizLibraryItem)
def update_quiz_tags(
    quiz_id: int,
    payload: QuizTagAssignment,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizLibraryItem:
    require_same_origin(request)
    try:
        quiz = replace_quiz_tags(session, user.id, quiz_id, payload.tag_ids)
    except QuizOrTagNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบหรือแท็กนี้") from error
    except TagAssignmentPersistenceError as error:
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกแท็กของแบบทดสอบได้") from error
    return _build_library_item(session, quiz, user.id)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    require_same_origin(request)
    quiz = _get_owned_quiz(session, user.id, quiz_id)
    source_storage_key = quiz.source_storage_key
    try:
        session.delete(quiz)
        session.commit()
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถลบแบบทดสอบได้") from error
    _cleanup_quiz_source(request.app.state.storage_provider, source_storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{quiz_id}", response_model=QuizInProgress)
def read_quiz(
    quiz_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizInProgress:
    return QuizInProgress.model_validate(_get_owned_quiz(session, user.id, quiz_id))


@router.post(
    "/{quiz_id}/attempts",
    response_model=QuizAttemptReview,
    status_code=status.HTTP_201_CREATED,
)
def submit_quiz_attempt(
    quiz_id: int,
    payload: QuizSubmission,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizAttemptReview:
    require_same_origin(request)
    quiz = _get_owned_quiz(session, user.id, quiz_id)
    try:
        result = grade_answers(quiz.questions, payload.answers)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="คำตอบแบบทดสอบไม่ถูกต้อง") from error

    submitted_at = datetime.now(timezone.utc)
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        started_at=submitted_at,
        submitted_at=submitted_at,
        score=result.score,
        total_questions=result.total_questions,
    )
    answers_by_id = {answer.question_id: answer for answer in payload.answers}
    for grade in result.questions:
        answer = answers_by_id.get(grade.question_id)
        submitted_value = None
        if answer is not None:
            submitted_value = (
                answer.selected_choice_index
                if answer.selected_choice_index is not None
                else answer.selected_boolean
            )
        attempt.answers.append(
            QuizAnswer(
                question_id=grade.question_id,
                submitted_answer=submitted_value,
                is_correct=grade.is_correct,
            )
        )
    session.add(attempt)
    try:
        session.commit()
        session.refresh(attempt)
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกผลแบบทดสอบได้") from error

    saved_answers = list(
        session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    )
    return _build_attempt_review(quiz, attempt, saved_answers)


@router.get(
    "/{quiz_id}/attempts/{attempt_id}",
    response_model=QuizAttemptReview,
)
def read_quiz_attempt(
    quiz_id: int,
    attempt_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizAttemptReview:
    quiz = _get_owned_quiz(session, user.id, quiz_id)
    attempt = session.scalar(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == user.id,
        )
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="ไม่พบประวัติการทำแบบทดสอบนี้")

    saved_answers = list(
        session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    )
    return _build_attempt_review(quiz, attempt, saved_answers)


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptSummary])
def list_quiz_attempts(
    quiz_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[QuizAttempt]:
    quiz = _get_owned_quiz(session, user.id, quiz_id)
    return list(
        session.scalars(
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user.id)
            .order_by(QuizAttempt.submitted_at.desc(), QuizAttempt.id.desc())
        ).all()
    )
