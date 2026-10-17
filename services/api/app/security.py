from __future__ import annotations

import hashlib
import secrets
import unicodedata

from pwdlib import PasswordHash


_password_hasher = PasswordHash.recommended()


def validate_password(password: str) -> None:
    if not isinstance(password, str):
        raise ValueError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร มีตัวอักษร และมีตัวเลข")

    categories = [unicodedata.category(char) for char in password]
    valid = (
        len(password) >= 8
        and any(category.startswith("L") for category in categories)
        and any(category.startswith("N") for category in categories)
    )
    if not valid:
        raise ValueError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร มีตัวอักษร และมีตัวเลข")


def hash_password(password: str) -> str:
    validate_password(password)
    return _password_hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return _password_hasher.verify(password, encoded_hash)
    except (ValueError, TypeError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
