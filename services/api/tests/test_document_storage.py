from __future__ import annotations

from pathlib import Path

import pytest

from app.storage.documents import (
    InvalidStorageKeyError,
    UploadTooLargeError,
    delete_document_file,
    promote_document,
    read_document,
    stage_document,
)


def test_stages_upload_under_generated_name_and_never_uses_client_filename(tmp_path: Path):
    staging = tmp_path / "private-staging"
    payload = b"private study note"

    staged = stage_document([payload], "../../outside.txt", staging)

    assert staged.size_bytes == len(payload)
    assert staged.temporary_path.parent == staging
    assert staged.temporary_path.name != "outside.txt"
    assert staged.temporary_path.read_bytes() == payload


def test_accepts_exact_twenty_megabytes_when_streaming_chunks(tmp_path: Path):
    chunk = b"x" * 1_000_000
    staged = stage_document((chunk for _ in range(20)), "large.txt", tmp_path / "stage")

    assert staged.size_bytes == 20_000_000
    assert staged.temporary_path.stat().st_size == 20_000_000


def test_rejects_one_byte_over_limit_and_removes_partial_staging_file(tmp_path: Path):
    staging = tmp_path / "stage"
    chunk = b"x" * 1_000_000

    def chunks_with_one_extra_byte():
        yield from (chunk for _ in range(20))
        yield b"x"

    with pytest.raises(UploadTooLargeError):
        stage_document(chunks_with_one_extra_byte(), "too-large.txt", staging)

    assert list(staging.iterdir()) == []


def test_promotes_reads_and_deletes_using_an_opaque_key(tmp_path: Path):
    payload = b"saved document"
    staged = stage_document([payload], "lecture.txt", tmp_path / "stage")

    storage_key = promote_document(staged, tmp_path / "documents")

    assert storage_key != "lecture.txt"
    assert "/" not in storage_key and "\\" not in storage_key
    assert read_document(storage_key, tmp_path / "documents") == payload
    delete_document_file(storage_key, tmp_path / "documents")
    assert not (tmp_path / "documents" / storage_key).exists()


@pytest.mark.parametrize("storage_key", ["../secret.txt", "..\\secret.txt", "/etc/passwd"])
def test_rejects_a_storage_key_that_could_escape_the_private_directory(tmp_path: Path, storage_key: str):
    with pytest.raises(InvalidStorageKeyError):
        read_document(storage_key, tmp_path / "documents")
