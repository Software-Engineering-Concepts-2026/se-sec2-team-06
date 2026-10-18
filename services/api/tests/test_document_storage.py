from __future__ import annotations

from pathlib import Path

import pytest

from app.storage.documents import (
    DocumentStorageError,
    EmptyUploadError,
    InvalidStorageKeyError,
    UnsupportedDocumentError,
    UploadTooLargeError,
    discard_staged_document,
    delete_document_file,
    promote_document,
    quarantine_document_file,
    read_document,
    remove_quarantined_document_file,
    restore_quarantined_document_file,
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
def test_rejects_a_storage_key_that_could_escape_the_private_directory(
    tmp_path: Path, storage_key: str
):
    with pytest.raises(InvalidStorageKeyError):
        read_document(storage_key, tmp_path / "documents")


@pytest.mark.parametrize("filename", ["", "folder/", "notes.doc", "notes.csv", None])
def test_rejects_missing_or_unsupported_upload_names(tmp_path: Path, filename):
    with pytest.raises(UnsupportedDocumentError):
        stage_document([b"content"], filename, tmp_path / "stage")


def test_sanitizes_windows_path_and_normalizes_extension(tmp_path: Path):
    staged = stage_document([b"content"], r"C:\private\lecture.PDF", tmp_path / "stage")

    assert staged.original_filename == "lecture.PDF"
    assert staged.extension == ".pdf"
    assert staged.temporary_path.read_bytes() == b"content"


def test_truncates_long_client_filename_without_truncating_extension(tmp_path: Path):
    staged = stage_document([b"content"], f"{'x' * 300}.TXT", tmp_path / "stage")

    assert len(staged.original_filename) == 255
    assert staged.original_filename.endswith(".TXT")
    assert staged.extension == ".txt"


def test_empty_upload_is_rejected_and_partial_file_is_removed(tmp_path: Path):
    staging = tmp_path / "stage"

    with pytest.raises(EmptyUploadError):
        stage_document([b"", b""], "empty.txt", staging)

    assert list(staging.iterdir()) == []


def test_invalid_stream_chunk_is_rejected_and_partial_file_is_removed(tmp_path: Path):
    staging = tmp_path / "stage"

    with pytest.raises(DocumentStorageError, match="invalid data"):
        stage_document([b"partial", "not bytes"], "notes.txt", staging)

    assert list(staging.iterdir()) == []


def test_promoting_a_staged_file_that_was_removed_fails_clearly(tmp_path: Path):
    staged = stage_document([b"content"], "notes.txt", tmp_path / "stage")
    staged.temporary_path.unlink()

    with pytest.raises(DocumentStorageError, match="no longer available"):
        promote_document(staged, tmp_path / "documents")


def test_discard_is_safe_for_present_and_already_removed_staged_file(tmp_path: Path):
    staged = stage_document([b"content"], "notes.txt", tmp_path / "stage")

    discard_staged_document(staged)
    discard_staged_document(staged)

    assert not staged.temporary_path.exists()


def test_quarantine_restore_and_remove_preserve_document_bytes(tmp_path: Path):
    payload = b"recoverable document"
    staged = stage_document([payload], "lesson.md", tmp_path / "stage")
    storage_dir = tmp_path / "documents"
    storage_key = promote_document(staged, storage_dir)
    quarantine_dir = tmp_path / "quarantine"

    quarantined = quarantine_document_file(storage_key, storage_dir, quarantine_dir)

    assert quarantined is not None and quarantined.read_bytes() == payload
    assert not (storage_dir / storage_key).exists()
    restore_quarantined_document_file(storage_key, storage_dir, quarantined)
    assert read_document(storage_key, storage_dir) == payload

    quarantined_again = quarantine_document_file(storage_key, storage_dir, quarantine_dir)
    assert quarantined_again is not None
    remove_quarantined_document_file(quarantined_again)
    remove_quarantined_document_file(quarantined_again)
    assert not quarantined_again.exists()


def test_quarantine_of_missing_document_returns_none(tmp_path: Path):
    result = quarantine_document_file("a" * 43, tmp_path / "documents", tmp_path / "stage")

    assert result is None
