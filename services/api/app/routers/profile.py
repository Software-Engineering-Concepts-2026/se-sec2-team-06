from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import User
from app.routers.auth import _public_user, get_current_user, get_db, require_same_origin
from app.schemas.auth import PublicUser
from app.storage.providers import FileStorageProvider, StorageProviderError
from app.storage.profile_images import (
    AvatarTooLargeError,
    InvalidAvatarError,
    validate_avatar_upload,
)

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=PublicUser)
def get_profile(user: User = Depends(get_current_user)) -> dict[str, object]:
    return _public_user(user)


@router.patch("/profile", response_model=PublicUser)
def update_profile(
    payload: dict[str, object],
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    require_same_origin(request)
    allowed_fields = {"display_name", "bio", "learning_goal", "learning_topics"}
    if set(payload) - allowed_fields:
        raise HTTPException(status_code=422, detail="ข้อมูลโปรไฟล์ไม่ถูกต้อง")

    if "display_name" in payload:
        display_name = payload["display_name"]
        if not isinstance(display_name, str) or not display_name.strip() or len(display_name.strip()) > 80:
            raise HTTPException(status_code=422, detail="ชื่อที่ใช้แสดงต้องมี 1 ถึง 80 ตัวอักษร")
        user.display_name = display_name.strip()

    if "bio" in payload:
        bio = payload["bio"]
        if bio is not None and (not isinstance(bio, str) or len(bio) > 500):
            raise HTTPException(status_code=422, detail="คำแนะนำตัวต้องมีไม่เกิน 500 ตัวอักษร")
        user.bio = bio

    if "learning_goal" in payload:
        learning_goal = payload["learning_goal"]
        if learning_goal is not None and (
            not isinstance(learning_goal, str) or len(learning_goal.strip()) > 200
        ):
            raise HTTPException(status_code=422, detail="เป้าหมายการเรียนต้องมีไม่เกิน 200 ตัวอักษร")
        user.learning_goal = learning_goal.strip() or None if isinstance(learning_goal, str) else None

    if "learning_topics" in payload:
        learning_topics = payload["learning_topics"]
        if not isinstance(learning_topics, list) or len(learning_topics) > 10:
            raise HTTPException(status_code=422, detail="เลือกหัวข้อที่สนใจได้ไม่เกิน 10 หัวข้อ")
        normalized_topics: list[str] = []
        seen_topics: set[str] = set()
        for topic in learning_topics:
            if not isinstance(topic, str) or not topic.strip() or len(topic.strip()) > 40:
                raise HTTPException(status_code=422, detail="หัวข้อที่สนใจต้องมี 1 ถึง 40 ตัวอักษร")
            normalized_topic = topic.strip()
            duplicate_key = normalized_topic.casefold()
            if duplicate_key not in seen_topics:
                normalized_topics.append(normalized_topic)
                seen_topics.add(duplicate_key)
        user.learning_topics = normalized_topics

    session.add(user)
    session.commit()
    session.refresh(user)
    return _public_user(user)


@router.put("/profile/avatar", response_model=PublicUser)
def upload_profile_avatar(
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    require_same_origin(request)
    try:
        avatar = validate_avatar_upload(file)
    except AvatarTooLargeError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except InvalidAvatarError as error:
        raise HTTPException(status_code=415, detail=str(error)) from error

    storage: FileStorageProvider = request.app.state.storage_provider
    storage_key = storage.new_key(user.id, avatar.suffix)
    try:
        storage.put("profile-avatars", storage_key, avatar.content, avatar.content_type)
    except (StorageProviderError, OSError) as error:
        raise HTTPException(status_code=503, detail="ไม่สามารถบันทึกภาพโปรไฟล์ได้ชั่วคราว") from error

    previous_key = user.avatar_key
    user.avatar_key = storage_key
    session.add(user)
    try:
        session.commit()
    except SQLAlchemyError as error:
        session.rollback()
        try:
            storage.delete("profile-avatars", storage_key)
        except (StorageProviderError, OSError):
            pass
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้") from error

    if previous_key and previous_key != storage_key:
        try:
            storage.delete("profile-avatars", previous_key)
        except (StorageProviderError, OSError):
            # The new avatar is already committed; a failed cleanup must not undo it.
            pass
    return _public_user(user)


@router.get("/profile/avatar")
def get_profile_avatar(
    request: Request,
    user: User = Depends(get_current_user),
) -> Response:
    if not user.avatar_key:
        raise HTTPException(status_code=404, detail="ยังไม่มีภาพโปรไฟล์")

    storage: FileStorageProvider = request.app.state.storage_provider
    suffix = f".{user.avatar_key.rsplit('.', 1)[-1].lower()}" if "." in user.avatar_key else ""
    media_type = {
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix)
    if media_type is None:
        raise HTTPException(status_code=404, detail="ไม่พบภาพโปรไฟล์")
    try:
        content = storage.read("profile-avatars", user.avatar_key)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบภาพโปรไฟล์") from error
    except (StorageProviderError, OSError) as error:
        raise HTTPException(status_code=503, detail="ไม่สามารถโหลดภาพโปรไฟล์ได้ชั่วคราว") from error
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
