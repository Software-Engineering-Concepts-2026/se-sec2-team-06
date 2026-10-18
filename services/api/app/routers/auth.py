from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Generator
from urllib.parse import urlsplit

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AuthSession, User
from app.schemas.auth import LoginRequest, PublicUser, RegisterRequest
from app.security import hash_password, hash_session_token, new_session_token, validate_password, verify_password

COOKIE_NAME = "synapsesync_session"
SESSION_TTL = timedelta(days=14)
SESSION_MAX_AGE = int(SESSION_TTL.total_seconds())
LOGIN_ERROR = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"

router = APIRouter(prefix="/auth", tags=["authentication"])


def get_db(request: Request) -> Generator[Session, None, None]:
    with request.app.state.session_factory() as session:
        yield session


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        raise HTTPException(status_code=403, detail="คำขอจากแหล่งที่มาไม่ถูกต้อง")

    parsed_origin = urlsplit(origin)
    expected_netloc = request.url.netloc
    if (
        parsed_origin.scheme.lower() != request.url.scheme.lower()
        or parsed_origin.netloc.lower() != expected_netloc.lower()
        or parsed_origin.path not in ("", "/")
        or parsed_origin.query
        or parsed_origin.fragment
        or parsed_origin.username
        or parsed_origin.password
    ):
        raise HTTPException(status_code=403, detail="คำขอจากแหล่งที่มาไม่ถูกต้อง")


def get_current_user(
    request: Request,
    session: Session = Depends(get_db),
    raw_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> User:
    if not raw_token:
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบ")

    stored_session = session.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_session_token(raw_token))
    )
    if stored_session is None:
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบ")

    expiry = stored_session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= datetime.now(timezone.utc):
        session.delete(stored_session)
        session.commit()
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบ")

    user = session.get(User, stored_session.user_id)
    if user is None:
        session.delete(stored_session)
        session.commit()
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบ")
    return user


def _public_user(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "bio": user.bio,
        "learning_goal": user.learning_goal,
        "learning_topics": user.learning_topics or [],
        "avatar_url": "/api/profile/avatar" if user.avatar_key else None,
    }


def _cookie_secure(request: Request) -> bool:
    configured = request.app.state.cookie_secure
    return configured if configured is not None else request.url.scheme.lower() == "https"


def _set_session_cookie(response: Response, request: Request, raw_token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        max_age=SESSION_MAX_AGE,
        path="/",
        secure=_cookie_secure(request),
        httponly=True,
        samesite="lax",
    )


@router.post("/register", response_model=PublicUser, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
) -> dict[str, object]:
    require_same_origin(request)
    try:
        validate_password(payload.password)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    normalized_email = str(payload.email).strip().casefold()
    if session.scalar(select(User.id).where(User.email == normalized_email)) is not None:
        raise HTTPException(status_code=409, detail="อีเมลนี้ถูกใช้แล้ว")

    user = User(
        email=normalized_email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    raw_token = new_session_token()
    session.add(user)
    try:
        session.flush()
        session.add(AuthSession(
            user_id=user.id,
            token_hash=hash_session_token(raw_token),
            expires_at=datetime.now(timezone.utc) + SESSION_TTL,
        ))
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="อีเมลนี้ถูกใช้แล้ว") from error

    session.refresh(user)
    _set_session_cookie(response, request, raw_token)
    return _public_user(user)


@router.post("/login", response_model=PublicUser)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
) -> dict[str, object]:
    require_same_origin(request)
    normalized_email = str(payload.email).strip().casefold()
    user = session.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail=LOGIN_ERROR)

    raw_token = new_session_token()
    session.add(AuthSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=datetime.now(timezone.utc) + SESSION_TTL,
    ))
    session.commit()
    _set_session_cookie(response, request, raw_token)
    return _public_user(user)


@router.get("/me", response_model=PublicUser)
def current_user(user: User = Depends(get_current_user)) -> dict[str, object]:
    return _public_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
    raw_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> None:
    require_same_origin(request)
    if raw_token:
        stored_session = session.scalar(
            select(AuthSession).where(AuthSession.token_hash == hash_session_token(raw_token))
        )
        if stored_session is not None:
            session.delete(stored_session)
            session.commit()

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=_cookie_secure(request),
        httponly=True,
        samesite="lax",
    )
