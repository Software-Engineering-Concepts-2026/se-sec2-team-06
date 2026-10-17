from __future__ import annotations

from datetime import datetime, timezone
from http.cookies import CookieError, SimpleCookie
from typing import Any, Callable
from urllib.parse import urlsplit

from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthSession, User
from app.routers.auth import COOKIE_NAME
from app.security import hash_session_token
from app.services.document_extractor import MAX_UPLOAD_BYTES
from app.storage.documents import MAX_DOCUMENT_BYTES

MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024
MAX_QUIZ_REQUEST_BYTES = MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
MAX_DOCUMENT_REQUEST_BYTES = MAX_DOCUMENT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
UPLOAD_REQUEST_LIMITS = {
    "/api/quizzes/generate": MAX_QUIZ_REQUEST_BYTES,
    "/api/documents": MAX_DOCUMENT_REQUEST_BYTES,
}


class _RequestBodyTooLarge(BaseException):
    """Escape FastAPI's generic multipart parse-error conversion unchanged."""

    pass


def _headers(scope: dict[str, Any]) -> dict[bytes, bytes]:
    return {key.lower(): value for key, value in scope.get("headers", [])}


def _same_origin(scope: dict[str, Any], headers: dict[bytes, bytes]) -> bool:
    origin_header = headers.get(b"origin")
    host_header = headers.get(b"host")
    if not origin_header or not host_header:
        return False
    try:
        origin = urlsplit(origin_header.decode("latin-1"))
        host = host_header.decode("latin-1")
    except (UnicodeDecodeError, ValueError):
        return False
    return (
        origin.scheme.lower() == str(scope.get("scheme", "")).lower()
        and origin.netloc.lower() == host.lower()
        and origin.path in ("", "/")
        and not origin.query
        and not origin.fragment
        and not origin.username
        and not origin.password
    )


def _session_token(headers: dict[bytes, bytes]) -> str | None:
    cookie_header = headers.get(b"cookie")
    if not cookie_header:
        return None
    try:
        cookies = SimpleCookie()
        cookies.load(cookie_header.decode("latin-1"))
    except (CookieError, UnicodeDecodeError):
        return None
    morsel = cookies.get(COOKIE_NAME)
    return morsel.value if morsel is not None else None


def _has_valid_session(session_factory: Callable[[], Session], token: str | None) -> bool:
    if not token:
        return False
    try:
        with session_factory() as session:
            stored = session.scalar(
                select(AuthSession).where(
                    AuthSession.token_hash == hash_session_token(token)
                )
            )
            if stored is None:
                return False
            expiry = stored.expires_at
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            return (
                expiry > datetime.now(timezone.utc)
                and session.get(User, stored.user_id) is not None
            )
    except Exception:
        # Fail closed: do not parse a large upload if authentication storage fails.
        return False


class QuizUploadGuardMiddleware:
    """Authenticate and cap upload requests before FastAPI parses multipart data."""

    def __init__(self, app, session_factory: Callable[[], Session]):
        self.app = app
        self.session_factory = session_factory

    async def __call__(self, scope, receive, send):
        request_limit = UPLOAD_REQUEST_LIMITS.get(scope.get("path"))
        if scope.get("type") != "http" or scope.get("method") != "POST" or request_limit is None:
            await self.app(scope, receive, send)
            return

        headers = _headers(scope)
        if not _same_origin(scope, headers):
            await JSONResponse(
                status_code=403,
                content={"detail": "คำขอจากแหล่งที่มาไม่ถูกต้อง"},
            )(scope, receive, send)
            return

        if not _has_valid_session(self.session_factory, _session_token(headers)):
            await JSONResponse(
                status_code=401,
                content={"detail": "กรุณาเข้าสู่ระบบ"},
            )(scope, receive, send)
            return

        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > request_limit:
                    raise _RequestBodyTooLarge
            except ValueError:
                await JSONResponse(
                    status_code=400,
                    content={"detail": "ขนาดคำขอไม่ถูกต้อง"},
                )(scope, receive, send)
                return
            except _RequestBodyTooLarge:
                await JSONResponse(
                    status_code=413,
                    content={"detail": "คำขอมีขนาดเกินขีดจำกัด"},
                )(scope, receive, send)
                return

        received_bytes = 0

        async def receive_limited():
            nonlocal received_bytes
            message = await receive()
            if message.get("type") == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > request_limit:
                    raise _RequestBodyTooLarge
            return message

        try:
            await self.app(scope, receive_limited, send)
        except _RequestBodyTooLarge:
            await JSONResponse(
                status_code=413,
                content={"detail": "คำขอมีขนาดเกินขีดจำกัด"},
            )(scope, receive, send)
