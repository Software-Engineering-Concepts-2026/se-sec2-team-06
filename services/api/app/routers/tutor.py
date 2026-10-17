from __future__ import annotations

import base64
import re
from typing import Literal, cast

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.ai.catalog import ModelSelection, resolve_model_selection
from app.ai.provider import ProviderError, ProviderNotConfigured, ProviderQuotaExceeded
from app.ai.tutor import (
    MAX_TUTOR_CONTEXT_MESSAGES,
    TutorImageInput,
    TutorProvider,
    TutorReply,
    TutorRequest,
    TutorTurn,
)
from app.models import Tag, TutorAttachment, TutorConversation, TutorMessage, User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.tutor import (
    TutorConversationCreate,
    TutorConversationDetail,
    TutorConversationSummary,
    TutorMessageInput,
    TutorRetryInput,
)
from app.services.tutor_conversations import (
    NewTutorAttachment,
    TutorAttachmentUnavailableError,
    TutorConversationNotFoundError,
    TutorRequestConflictError,
    TutorTagUnavailableError,
    TutorTurnInProgressError,
    add_user_message,
    claim_retryable_conversation,
    create_conversation,
    get_owned_conversation,
    mark_retryable_error,
    save_tutor_reply,
)
from app.storage.providers import FileStorageProvider, StorageObjectNotFoundError, StorageProviderError
from app.storage.tutor_attachments import (
    cleanup_tutor_attachments,
    InvalidTutorAttachmentError,
    MAX_TUTOR_ATTACHMENT_BYTES,
    TutorAttachmentTooLargeError,
    read_tutor_attachment,
    store_tutor_attachment,
)


router = APIRouter(prefix="/tutor/conversations", tags=["tutoring"])
MAX_TUTOR_IMAGES_PER_MESSAGE = 3
MAX_TUTOR_IMAGE_PAYLOAD_BYTES = 15 * 1024 * 1024


def _get_tutor_provider(
    request: Request,
    selection: ModelSelection | None,
) -> TutorProvider:
    injected_provider = request.app.state.tutor_provider
    if injected_provider is not None:
        return cast(TutorProvider, injected_provider)
    return request.app.state.tutor_provider_factory(
        selection.provider_id if selection else None,
        selection.model_id if selection else None,
    )


def _resolve_selection(
    request: Request,
    provider_id: str | None,
    model_id: str | None,
    *,
    has_images: bool = False,
) -> ModelSelection | None:
    configured_default = request.app.state.ai_settings.model
    if not provider_id and not model_id and not configured_default:
        if has_images:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "image_model_unavailable",
                    "message": "ยังไม่มีโมเดลที่ยืนยันว่ารองรับภาพ โปรดเลือกภาพค้างไว้แล้วลองใหม่เมื่อมีโมเดลที่รองรับ",
                },
            )
        return None
    try:
        selection = resolve_model_selection(
            provider_id,
            model_id,
            default_model=configured_default,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail="เลือก Provider และโมเดลที่รองรับจากรายการ",
        ) from error
    if has_images and not selection.supports_images:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "image_model_unsupported",
                "message": "โมเดลที่เลือกยังไม่ได้รับการยืนยันว่ารองรับภาพ ข้อความและภาพยังไม่ถูกส่ง",
                "provider_id": selection.provider_id,
                "model_id": selection.model_id,
            },
        )
    return selection


def _safe_provider_error(error: Exception, conversation_id: int) -> HTTPException:
    if isinstance(error, ProviderQuotaExceeded):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "provider_quota_full",
                "message": f"โควตาของ {error.provider_name} เต็มแล้ว ลองใหม่ภายหลังหรือเลือกผู้ให้บริการอื่น",
                "conversation_id": conversation_id,
                "retryable": True,
            },
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "tutor_provider_unavailable",
            "message": "บริการ AI ยังไม่พร้อม ข้อความของคุณถูกบันทึกแล้วและลองส่งใหม่ได้",
            "conversation_id": conversation_id,
            "retryable": True,
        },
    )


def _get_request(
    conversation: TutorConversation,
    user_message_id: int,
    storage: FileStorageProvider,
) -> TutorRequest:
    turns = []
    for message in conversation.messages[-MAX_TUTOR_CONTEXT_MESSAGES:]:
        images = []
        if message.id == user_message_id:
            for attachment in message.attachments:
                image_bytes = read_tutor_attachment(attachment.storage_key, storage)
                images.append(
                    TutorImageInput(
                        mime_type=attachment.mime_type,
                        base64_data=base64.b64encode(image_bytes).decode("ascii"),
                    )
                )
        turns.append(TutorTurn(role=message.role, content=message.content, images=images))
    response_language = next(
        (
            message.response_language
            for message in conversation.messages
            if message.id == user_message_id and message.role == "user"
        ),
        "th",
    )
    return TutorRequest(
        turns=turns,
        response_language=response_language,
        tag_labels=[tag.name for tag in conversation.tags],
    )


def _safe_attachment_filename(filename: str | None) -> str:
    normalized = (filename or "image").replace("\\", "/").split("/")[-1]
    safe = "".join(character for character in normalized if character >= " " and character != "\x7f")
    return safe[:255] or "image"


def _store_uploads(
    uploads: list[UploadFile],
    storage: FileStorageProvider,
    owner_id: int,
) -> tuple[list[NewTutorAttachment], list[str]]:
    if len(uploads) > MAX_TUTOR_IMAGES_PER_MESSAGE:
        raise HTTPException(status_code=422, detail="แนบภาพได้ไม่เกิน 3 ภาพต่อข้อความ")
    attachments: list[NewTutorAttachment] = []
    storage_keys: list[str] = []
    total_bytes = 0
    try:
        for upload in uploads:
            try:
                stored = store_tutor_attachment(upload, storage, owner_id)
            except TutorAttachmentTooLargeError as error:
                raise HTTPException(status_code=413, detail="ภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MiB") from error
            except InvalidTutorAttachmentError as error:
                raise HTTPException(status_code=415, detail=str(error)) from error
            except StorageProviderError as error:
                raise HTTPException(status_code=503, detail="พื้นที่จัดเก็บไฟล์ยังไม่พร้อมใช้งาน") from error
            storage_keys.append(stored.storage_key)
            total_bytes += stored.byte_size
            if total_bytes > MAX_TUTOR_IMAGE_PAYLOAD_BYTES:
                raise HTTPException(status_code=413, detail="ภาพทั้งหมดรวมกันต้องมีขนาดไม่เกิน 15 MiB")
            attachments.append(
                NewTutorAttachment(
                    storage_key=stored.storage_key,
                    original_filename=_safe_attachment_filename(upload.filename),
                    mime_type=stored.mime_type,
                    byte_size=stored.byte_size,
                )
            )
    except Exception:
        cleanup_tutor_attachments(storage, storage_keys)
        raise
    return attachments, storage_keys


def _ensure_owned_attachment_refs(
    session: Session,
    user_id: int,
    conversation_id: int,
    attachment_ids: list[int],
) -> None:
    if not attachment_ids:
        return
    if len(set(attachment_ids)) != len(attachment_ids):
        raise HTTPException(status_code=422, detail="เลือกภาพซ้ำไม่ได้")
    owned_ids = set(
        session.scalars(
            select(TutorAttachment.id).where(
                TutorAttachment.id.in_(attachment_ids),
                TutorAttachment.user_id == user_id,
                TutorAttachment.conversation_id == conversation_id,
            )
        ).all()
    )
    if owned_ids != set(attachment_ids):
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้")


async def _generate_and_store_reply(
    request: Request,
    session: Session,
    conversation: TutorConversation,
    user_id: int,
    user_message_id: int,
    selection: ModelSelection | None,
) -> TutorConversationDetail:
    try:
        provider = _get_tutor_provider(request, selection)
        tutor_request = _get_request(
            conversation,
            user_message_id,
            request.app.state.storage_provider,
        )
    except (ProviderError, ProviderNotConfigured, StorageProviderError, ValueError, TypeError, OSError) as error:
        session.rollback()
        mark_retryable_error(session, user_id, conversation.id, user_message_id)
        raise _safe_provider_error(error, conversation.id) from error

    # End auth and eager-load read transactions before the external provider call.
    session.commit()
    try:
        raw_reply = await provider.respond(tutor_request)
        reply = (
            raw_reply
            if isinstance(raw_reply, TutorReply)
            else TutorReply.model_validate(raw_reply)
        )
    except (ProviderError, ProviderNotConfigured, ValidationError, ValueError, TypeError) as error:
        session.rollback()
        mark_retryable_error(session, user_id, conversation.id, user_message_id)
        raise _safe_provider_error(error, conversation.id) from error

    return save_tutor_reply(
        session,
        user_id=user_id,
        conversation_id=conversation.id,
        user_message_id=user_message_id,
        reply_kind=reply.kind,
        content=reply.message,
        provider_id=getattr(provider, "provider_id", selection.provider_id if selection else None),
        model_id=getattr(provider, "model_name", selection.model_id if selection else None),
    )


def _tutor_detail_or_404(
    session: Session,
    user_id: int,
    conversation_id: int,
) -> TutorConversation:
    conversation = get_owned_conversation(session, user_id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="ไม่พบบทสนทนานี้")
    return conversation


@router.post(
    "",
    response_model=TutorConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation(
    payload: TutorConversationCreate,
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    require_same_origin(request)
    if payload.attachment_ids:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้")
    selection = _resolve_selection(request, payload.provider_id, payload.model_id)
    try:
        conversation, created = create_conversation(
            session,
            user_id=user.id,
            message=payload.message,
            tag_ids=payload.tag_ids,
            request_id=payload.request_id,
            provider_id=selection.provider_id if selection else None,
            model_id=selection.model_id if selection else None,
            response_language=payload.response_language,
        )
    except TutorTagUnavailableError as error:
        raise HTTPException(status_code=404, detail="ไม่พบแท็กที่เลือก") from error
    except TutorRequestConflictError as error:
        raise HTTPException(status_code=409, detail="รหัสคำขอนี้ถูกใช้กับข้อความอื่นแล้ว") from error

    if not created:
        response.status_code = status.HTTP_200_OK
        return conversation
    user_message = next(message for message in conversation.messages if message.role == "user")
    return await _generate_and_store_reply(
        request,
        session,
        conversation,
        user.id,
        user_message.id,
        selection,
    )


@router.post(
    "/with-images",
    response_model=TutorConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation_with_images(
    request: Request,
    response: Response,
    message: str = Form(..., min_length=1, max_length=4_000),
    request_id: str = Form(..., min_length=1, max_length=80),
    provider_id: str | None = Form(default=None),
    model_id: str | None = Form(default=None),
    response_language: Literal["th", "en"] = Form(default="th"),
    tag_ids: list[int] | None = Form(default=None),
    attachment_ids: list[int] | None = Form(default=None),
    images: list[UploadFile] | None = File(default=None),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    require_same_origin(request)
    uploads = images or []
    if attachment_ids:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้")
    selection = _resolve_selection(request, provider_id, model_id, has_images=bool(uploads))
    stored, storage_keys = _store_uploads(
        uploads,
        request.app.state.storage_provider,
        user.id,
    )
    try:
        conversation, created = create_conversation(
            session,
            user_id=user.id,
            message=message,
            tag_ids=tag_ids or [],
            request_id=request_id,
            provider_id=selection.provider_id if selection else None,
            model_id=selection.model_id if selection else None,
            response_language=response_language,
            new_attachments=stored,
        )
    except TutorTagUnavailableError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=404, detail="ไม่พบแท็กที่เลือก") from error
    except TutorRequestConflictError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=409, detail="รหัสคำขอนี้ถูกใช้กับข้อความอื่นแล้ว") from error
    except Exception:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise

    if not created:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        response.status_code = status.HTTP_200_OK
        return conversation
    user_message = next(item for item in conversation.messages if item.role == "user")
    return await _generate_and_store_reply(
        request,
        session,
        conversation,
        user.id,
        user_message.id,
        selection,
    )


@router.post(
    "/{conversation_id}/messages/with-images",
    response_model=TutorConversationDetail,
)
async def send_message_with_images(
    conversation_id: int,
    request: Request,
    message: str = Form(..., min_length=1, max_length=4_000),
    request_id: str = Form(..., min_length=1, max_length=80),
    provider_id: str | None = Form(default=None),
    model_id: str | None = Form(default=None),
    response_language: Literal["th", "en"] = Form(default="th"),
    attachment_ids: list[int] | None = Form(default=None),
    images: list[UploadFile] | None = File(default=None),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    require_same_origin(request)
    uploads = images or []
    referenced_ids = attachment_ids or []
    if len(uploads) + len(referenced_ids) > MAX_TUTOR_IMAGES_PER_MESSAGE:
        raise HTTPException(status_code=422, detail="แนบภาพได้ไม่เกิน 3 ภาพต่อข้อความ")
    _ensure_owned_attachment_refs(session, user.id, conversation_id, referenced_ids)
    selection = _resolve_selection(
        request,
        provider_id,
        model_id,
        has_images=bool(uploads or referenced_ids),
    )
    stored, storage_keys = _store_uploads(
        uploads,
        request.app.state.storage_provider,
        user.id,
    )
    try:
        conversation, user_message, created = add_user_message(
            session,
            user_id=user.id,
            conversation_id=conversation_id,
            message=message,
            request_id=request_id,
            provider_id=selection.provider_id if selection else None,
            model_id=selection.model_id if selection else None,
            response_language=response_language,
            attachment_ids=referenced_ids,
            new_attachments=stored,
        )
    except TutorConversationNotFoundError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=404, detail="ไม่พบบทสนทนานี้") from error
    except TutorAttachmentUnavailableError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้") from error
    except TutorRequestConflictError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=409, detail="รหัสคำขอนี้ถูกใช้กับข้อความอื่นแล้ว") from error
    except TutorTurnInProgressError as error:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise HTTPException(status_code=409, detail="บทสนทนานี้กำลังประมวลผล กรุณารอคำตอบก่อนส่งคำถามถัดไป") from error
    except Exception:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        raise

    if not created:
        cleanup_tutor_attachments(request.app.state.storage_provider, storage_keys)
        return conversation
    return await _generate_and_store_reply(
        request,
        session,
        conversation,
        user.id,
        user_message.id,
        selection,
    )


@router.get("", response_model=list[TutorConversationSummary])
def list_conversations(
    q: str | None = Query(default=None, max_length=200),
    tag_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TutorConversation]:
    statement = (
        select(TutorConversation)
        .options(selectinload(TutorConversation.messages), selectinload(TutorConversation.tags))
        .where(TutorConversation.user_id == user.id)
    )
    query = (q or "").strip()
    if query:
        escaped_query = query.replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped_query}%"
        statement = statement.where(
            or_(
                TutorConversation.title.ilike(pattern, escape="\\"),
                TutorConversation.messages.any(TutorMessage.content.ilike(pattern, escape="\\")),
            )
        )
    if tag_id is not None:
        statement = statement.where(TutorConversation.tags.any(Tag.id == tag_id))
    statement = statement.order_by(
        TutorConversation.updated_at.desc(),
        TutorConversation.id.desc(),
    )
    return list(session.scalars(statement).unique().all())


@router.get("/{conversation_id}", response_model=TutorConversationDetail)
def get_conversation(
    conversation_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    return _tutor_detail_or_404(session, user.id, conversation_id)


@router.get("/{conversation_id}/attachments/{attachment_id}")
def get_tutor_attachment(
    conversation_id: int,
    attachment_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    attachment = session.scalar(
        select(TutorAttachment)
        .join(TutorConversation, TutorConversation.id == TutorAttachment.conversation_id)
        .where(
            TutorAttachment.id == attachment_id,
            TutorAttachment.conversation_id == conversation_id,
            TutorAttachment.user_id == user.id,
            TutorConversation.user_id == user.id,
        )
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้")
    try:
        content = read_tutor_attachment(
            attachment.storage_key,
            request.app.state.storage_provider,
        )
    except StorageObjectNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้") from error
    except StorageProviderError as error:
        raise HTTPException(status_code=503, detail="พื้นที่จัดเก็บไฟล์ยังไม่พร้อมใช้งาน") from error
    except (InvalidTutorAttachmentError, OSError) as error:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้") from error
    return Response(
        content=content,
        media_type=attachment.mime_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=TutorConversationDetail,
)
async def send_message(
    conversation_id: int,
    payload: TutorMessageInput,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    require_same_origin(request)
    _ensure_owned_attachment_refs(
        session,
        user.id,
        conversation_id,
        payload.attachment_ids,
    )
    selection = _resolve_selection(
        request,
        payload.provider_id,
        payload.model_id,
        has_images=bool(payload.attachment_ids),
    )
    try:
        conversation, _message, created = add_user_message(
            session,
            user_id=user.id,
            conversation_id=conversation_id,
            message=payload.message,
            request_id=payload.request_id,
            provider_id=selection.provider_id if selection else None,
            model_id=selection.model_id if selection else None,
            response_language=payload.response_language,
            attachment_ids=payload.attachment_ids,
        )
    except TutorConversationNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบบทสนทนานี้") from error
    except TutorRequestConflictError as error:
        raise HTTPException(status_code=409, detail="รหัสคำขอนี้ถูกใช้กับข้อความอื่นแล้ว") from error
    except TutorAttachmentUnavailableError as error:
        raise HTTPException(status_code=404, detail="ไม่พบภาพในบทสนทนานี้") from error
    except TutorTurnInProgressError as error:
        raise HTTPException(status_code=409, detail="บทสนทนานี้กำลังประมวลผล กรุณารอคำตอบก่อนส่งคำถามถัดไป") from error

    if not created:
        return conversation
    return await _generate_and_store_reply(
        request,
        session,
        conversation,
        user.id,
        _message.id,
        selection,
    )


@router.post(
    "/{conversation_id}/retry",
    response_model=TutorConversationDetail,
)
async def retry_last_message(
    conversation_id: int,
    request: Request,
    payload: TutorRetryInput | None = None,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TutorConversation:
    require_same_origin(request)
    existing = _tutor_detail_or_404(session, user.id, conversation_id)
    existing_user_message = max(
        (message for message in existing.messages if message.role == "user"),
        key=lambda message: message.sequence,
        default=None,
    )
    if existing_user_message is None:
        raise HTTPException(status_code=409, detail="ไม่มีข้อความที่ต้องลองส่งใหม่")
    provider_id = (
        payload.provider_id
        if payload is not None and payload.provider_id
        else existing_user_message.provider_id or existing.provider_id
    )
    model_id = (
        payload.model_id
        if payload is not None and payload.model_id
        else existing_user_message.model_id or existing.model_id
    )
    selection = _resolve_selection(
        request,
        provider_id,
        model_id,
        has_images=bool(existing_user_message.attachments),
    )
    conversation = claim_retryable_conversation(session, user.id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=409, detail="ไม่มีข้อความที่ต้องลองส่งใหม่")
    user_message = max(
        (message for message in conversation.messages if message.role == "user"),
        key=lambda message: message.sequence,
        default=None,
    )
    if user_message is None:
        raise HTTPException(status_code=409, detail="ไม่มีข้อความที่ต้องลองส่งใหม่")
    user_message.response_language = (
        payload.response_language
        if payload is not None and payload.response_language is not None
        else user_message.response_language
    )
    return await _generate_and_store_reply(
        request,
        session,
        conversation,
        user.id,
        user_message.id,
        selection,
    )
