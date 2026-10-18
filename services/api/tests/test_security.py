from __future__ import annotations

import hashlib
import importlib

import pytest


def test_password_policy_accepts_eight_characters_with_a_letter_and_number() -> None:
    security = importlib.import_module("app.security")

    assert security.validate_password("abcdefg1") is None
    assert security.validate_password("猫猫猫猫猫猫猫1") is None


@pytest.mark.parametrize(
    "password",
    [
        "abc1234",
        "abcdefgh",
        "12345678",
        "😀😀😀😀😀😀😀1",
    ],
)
def test_password_policy_rejects_short_password_or_missing_letter_or_number(password: str) -> None:
    security = importlib.import_module("app.security")

    with pytest.raises(ValueError):
        security.validate_password(password)


def test_password_policy_counts_unicode_code_points() -> None:
    security = importlib.import_module("app.security")

    assert security.validate_password(f"{'ก' * 7}1") is None


def test_password_hash_is_argon2id_and_verifies_only_the_original_password() -> None:
    security = importlib.import_module("app.security")

    encoded = security.hash_password("studyPlan42")

    assert encoded.startswith("$argon2id$")
    assert security.verify_password("studyPlan42", encoded) is True
    assert security.verify_password("studyPlan43", encoded) is False


def test_session_tokens_are_random_and_only_the_sha256_digest_is_persistable() -> None:
    security = importlib.import_module("app.security")

    first = security.new_session_token()
    second = security.new_session_token()

    assert first != second
    assert len(first) >= 32
    assert security.hash_session_token(first) == hashlib.sha256(first.encode()).hexdigest()
    assert first not in security.hash_session_token(first)
