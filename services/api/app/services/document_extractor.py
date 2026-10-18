from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

MAX_UPLOAD_BYTES = 20_000_000
MAX_SOURCE_CHARS = 20_000


class DocumentExtractionError(ValueError):
    """Base class for expected source-document validation failures."""


class UploadTooLargeError(DocumentExtractionError):
    pass


class UnsupportedDocumentError(DocumentExtractionError):
    pass


class InvalidDocumentError(DocumentExtractionError):
    pass


class EmptyDocumentError(DocumentExtractionError):
    pass


class SourceTextTooLongError(DocumentExtractionError):
    pass


@dataclass(frozen=True)
class TextLocator:
    label: str
    start: int
    end: int


@dataclass(frozen=True)
class ExtractedDocument:
    source_type: Literal["md", "txt", "docx", "pdf"]
    text: str
    locators: list[TextLocator]


def _normalize_plain_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.split("\n")).strip()


def extract_document(
    filename: str,
    content: bytes,
    content_type: str | None = None,
) -> ExtractedDocument:
    """Extract bounded, normalized text without retaining the uploaded bytes."""
    del content_type  # Extension selects a parser; MIME headers are user-controlled.
    if not isinstance(content, bytes):
        raise InvalidDocumentError("Uploaded document must be bytes")
    if len(content) > MAX_UPLOAD_BYTES:
        raise UploadTooLargeError(f"Upload exceeds {MAX_UPLOAD_BYTES} bytes")

    extension = Path(filename).suffix.lower()
    if extension == ".doc":
        raise UnsupportedDocumentError("Legacy .doc files are not supported; save as .docx or .pdf")
    if extension not in {".md", ".txt", ".docx", ".pdf"}:
        raise UnsupportedDocumentError("Supported formats are .md, .txt, .docx, and text-based .pdf")

    locators: list[TextLocator] = []
    try:
        if extension == ".md":
            from app.services.extractors.markdown import extract_markdown

            text, raw_locators = extract_markdown(content)
            source_type: Literal["md", "txt", "docx", "pdf"] = "md"
            locators = [TextLocator(label, start, end) for label, start, end in raw_locators]
        elif extension == ".txt":
            from app.services.extractors.plain_text import decode_text

            text = _normalize_plain_text(decode_text(content))
            source_type = "txt"
            if text:
                locators = [TextLocator("Section 1", 0, len(text))]
        elif extension == ".docx":
            if not content.startswith(b"PK\x03\x04"):
                raise InvalidDocumentError("Invalid DOCX file")
            from app.services.extractors.docx import extract_docx

            text = _normalize_plain_text(extract_docx(content))
            source_type = "docx"
            if text:
                locators = [TextLocator("Document", 0, len(text))]
        else:
            if not content.lstrip().startswith(b"%PDF-"):
                raise InvalidDocumentError("Invalid PDF file")
            from app.services.extractors.pdf import extract_pdf

            text, raw_locators = extract_pdf(content)
            source_type = "pdf"
            locators = [TextLocator(label, start, end) for label, start, end in raw_locators]
    except DocumentExtractionError:
        raise
    except (UnicodeDecodeError, ValueError, OSError, Exception) as exc:
        # Parser libraries expose different malformed-file exceptions; do not
        # leak their internals or parser diagnostics to callers.
        raise InvalidDocumentError("Document could not be parsed") from exc

    text = _normalize_plain_text(text)
    if not text:
        raise EmptyDocumentError("No usable text was found in the document")
    if len(text) > MAX_SOURCE_CHARS:
        raise SourceTextTooLongError(
            f"Extracted text contains {len(text)} characters; limit is {MAX_SOURCE_CHARS}"
        )

    return ExtractedDocument(source_type=source_type, text=text, locators=locators)
