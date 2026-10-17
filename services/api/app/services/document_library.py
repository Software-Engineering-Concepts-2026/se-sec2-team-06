from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from threading import Lock
from typing import Any, Literal

from app.services.extractors.markdown import extract_markdown
from app.services.extractors.plain_text import decode_text
from app.storage.documents import (
    MAX_DOCUMENT_BYTES,
    UnsupportedDocumentError,
    UploadTooLargeError,
)

MAX_READER_TEXT_CHARS = 2_000_000
MAX_SEARCH_TEXT_CHARS = 500_000
MAX_PDF_PAGES = 2_000
MAX_PDF_STREAM_OUTPUT_BYTES = 8_000_000
MAX_PDF_TOTAL_CONTENT_BYTES = 24_000_000
MAX_PDF_TOTAL_XFORM_INVOCATIONS = 256
MAX_PDF_XFORM_RESOURCE_DEPTH = 32
MAX_PDF_XFORM_RESOURCE_NODES = 4_096
MAX_PDF_XFORM_INVOCATIONS = 128
MAX_PDF_OPERATIONS_PER_STREAM = 50_000
MAX_PDF_TOTAL_OPERATIONS = 100_000
MAX_PDF_TOTAL_OPERANDS = 100_000


class DocumentLibraryError(ValueError):
    """Base class for user-correctable document-library extraction failures."""


class InvalidDocumentError(DocumentLibraryError):
    pass


class EmptyDocumentError(DocumentLibraryError):
    pass


class _StopPdfTextExtraction(BaseException):
    """Abort pypdf when a bounded PDF extraction budget is exhausted."""


class _PdfOperationBudget:
    def __init__(self) -> None:
        self.count = 0
        self.exceeded = False


class _PdfOperandBudget:
    def __init__(self) -> None:
        self.count = 0
        self.exceeded = False


_active_pdf_operand_budget: ContextVar[_PdfOperandBudget | None] = ContextVar(
    "active_pdf_operand_budget", default=None
)
_pdf_read_object_patch_lock = Lock()
_pdf_read_object_budget_patched = False


def _install_pdf_operand_budget() -> None:
    """Stop pypdf before it accumulates an unbounded content-stream operand list."""
    global _pdf_read_object_budget_patched
    if _pdf_read_object_budget_patched:
        return

    with _pdf_read_object_patch_lock:
        if _pdf_read_object_budget_patched:
            return

        from pypdf.generic import _data_structures

        # ContentStream accumulates operands locally before an operation is
        # appended, so bound each object read rather than only completed ops.
        read_object = _data_structures.read_object

        def bounded_read_object(
            stream: Any, pdf: Any, *args: Any, **kwargs: Any
        ) -> Any:
            budget = _active_pdf_operand_budget.get()
            if budget is not None:
                if budget.count >= MAX_PDF_TOTAL_OPERANDS:
                    budget.exceeded = True
                    raise _StopPdfTextExtraction()
                budget.count += 1
            return read_object(stream, pdf, *args, **kwargs)

        _data_structures.read_object = bounded_read_object
        _pdf_read_object_budget_patched = True


class _BoundedPdfOperations(list[tuple[object, bytes]]):
    def __init__(self, budget: _PdfOperationBudget) -> None:
        super().__init__()
        self.budget = budget
        self.stream_count = 0

    def append(self, operation: tuple[object, bytes]) -> None:
        if (
            self.stream_count >= MAX_PDF_OPERATIONS_PER_STREAM
            or self.budget.count >= MAX_PDF_TOTAL_OPERATIONS
        ):
            self.budget.exceeded = True
            raise _StopPdfTextExtraction()
        self.stream_count += 1
        self.budget.count += 1
        super().append(operation)


@dataclass(frozen=True)
class LibraryExtraction:
    file_type: Literal["pdf", "md", "txt"]
    extracted_text: str
    extracted_text_truncated: bool
    search_text: str
    search_text_truncated: bool
    search_available: bool


def _normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in normalized.split("\n")).strip()


def _extract_pdf(content: bytes) -> tuple[str, bool]:
    from pypdf import PdfReader, apply_configuration, get_configuration
    from pypdf.generic import ContentStream, NameObject

    try:
        _install_pdf_operand_budget()
        overrides = {
            "maximum_declared_stream_length": MAX_DOCUMENT_BYTES,
            "array_based_stream_maximum_output_length": MAX_PDF_STREAM_OUTPUT_BYTES,
            "zlib_maximum_output_length": MAX_PDF_STREAM_OUTPUT_BYTES,
            "lzw_maximum_output_length": MAX_PDF_STREAM_OUTPUT_BYTES,
            "run_length_maximum_output_length": MAX_PDF_STREAM_OUTPUT_BYTES,
            "brotli_maximum_output_length": MAX_PDF_STREAM_OUTPUT_BYTES,
            "stream_decoding_work_maximum_length": MAX_PDF_STREAM_OUTPUT_BYTES * 2,
            "xform_maximum_invocations_per_extraction": MAX_PDF_XFORM_INVOCATIONS,
        }
        supported_overrides = {
            name: value for name, value in overrides.items()
            if hasattr(get_configuration(), name)
        }
        with apply_configuration(**supported_overrides):
            # Real-world PDFs frequently contain recoverable xref/metadata
            # inconsistencies. Keep pypdf's bounded parsing safeguards below,
            # but let it repair those minor format issues during loading.
            reader = PdfReader(BytesIO(content), strict=False)
            pages = reader.pages
            if len(pages) > MAX_PDF_PAGES:
                raise InvalidDocumentError("PDF contains too many pages to safely extract")
            pieces: list[str] = []
            chars = 0
            total_content_bytes = 0
            total_xform_invocations = 0
            resource_nodes_scanned = 0
            operation_budget = _PdfOperationBudget()
            seen_xform_streams: set[int] = set()
            root_resource_summaries: dict[int, tuple[dict[str, int], set[str]]] = {}
            truncated = False
            operand_budget = _PdfOperandBudget()

            def bounded_xform_stream(stream: Any, decoded_data: bytes) -> ContentStream:
                if isinstance(stream, ContentStream):
                    content_stream = stream
                else:
                    content_stream = ContentStream(None, reader)
                    for key, value in stream.items():
                        if str(key) not in {"/Length", "/Filter", "/DecodeParms"}:
                            content_stream[key] = value
                    content_stream.set_data(decoded_data)
                if not isinstance(content_stream._operations, _BoundedPdfOperations):
                    content_stream._operations = _BoundedPdfOperations(operation_budget)
                return content_stream

            for page in pages:
                # pypdf parses a page's full operation list before it calls the
                # text visitor. Pre-decode page streams and enforce a document-wide
                # byte budget first, so many individually small pages cannot evade
                # the per-stream limits and exhaust memory through operation lists.
                page_content = page.get_contents()
                if page_content is not None:
                    page_content_bytes = len(page_content.get_data())
                    if total_content_bytes + page_content_bytes > MAX_PDF_TOTAL_CONTENT_BYTES:
                        truncated = True
                        break
                    total_content_bytes += page_content_bytes
                    # Reuse the already decoded stream; extract_text otherwise
                    # creates another ContentStream and copies these bytes again.
                    page[NameObject("/Contents")] = page_content
                    page_content._operations = _BoundedPdfOperations(operation_budget)

                form_sizes_by_name: dict[str, int] = {}
                image_names: set[str] = set()
                form_resources_incomplete = False
                seen_resource_dictionaries: set[int] = set()

                def collect_xforms(resources: object, depth: int = 0) -> bool:
                    nonlocal total_content_bytes, form_resources_incomplete, resource_nodes_scanned
                    nonlocal form_sizes_by_name, image_names
                    if depth > MAX_PDF_XFORM_RESOURCE_DEPTH:
                        form_resources_incomplete = True
                        return False
                    try:
                        resolved_resources = resources.get_object()
                        resource_identity = id(resolved_resources)
                        if depth == 0 and resource_identity in root_resource_summaries:
                            form_sizes_by_name, image_names = root_resource_summaries[resource_identity]
                            return True
                        if resource_identity in seen_resource_dictionaries:
                            return True
                        if resource_nodes_scanned >= MAX_PDF_XFORM_RESOURCE_NODES:
                            form_resources_incomplete = True
                            return False
                        seen_resource_dictionaries.add(resource_identity)
                        resource_nodes_scanned += 1
                        xobjects = resolved_resources.get("/XObject")
                        if xobjects is None:
                            if depth == 0 and not form_resources_incomplete:
                                root_resource_summaries[resource_identity] = (form_sizes_by_name, image_names)
                            return True
                        xobjects = xobjects.get_object()
                        entries = xobjects.items()
                    except (AttributeError, TypeError):
                        form_resources_incomplete = True
                        return True

                    for name, reference in entries:
                        if resource_nodes_scanned >= MAX_PDF_XFORM_RESOURCE_NODES:
                            form_resources_incomplete = True
                            return False
                        resource_nodes_scanned += 1
                        try:
                            xobject = reference.get_object()
                        except AttributeError:
                            xobject = reference
                        key = str(name)
                        try:
                            subtype = xobject.get("/Subtype")
                            if subtype == NameObject("/Image"):
                                image_names.add(key)
                                continue
                            form_data = xobject.get_data()
                            form_size = len(form_data)
                        except (AttributeError, TypeError):
                            form_resources_incomplete = True
                            continue

                        form_sizes_by_name[key] = max(form_sizes_by_name.get(key, 0), form_size)
                        xform_identity = id(xobject)
                        if xform_identity not in seen_xform_streams:
                            if total_content_bytes + form_size > MAX_PDF_TOTAL_CONTENT_BYTES:
                                return False
                            total_content_bytes += form_size
                            seen_xform_streams.add(xform_identity)

                        bounded_xform = bounded_xform_stream(xobject, form_data)
                        xobjects[NameObject(key)] = bounded_xform
                        xobject = bounded_xform

                        try:
                            nested_resources = xobject.get_inherited("/Resources", default=None)
                        except (AttributeError, TypeError):
                            nested_resources = None
                        if nested_resources is not None and not collect_xforms(nested_resources, depth + 1):
                            return False
                    if depth == 0 and not form_resources_incomplete:
                        root_resource_summaries[resource_identity] = (form_sizes_by_name, image_names)
                    return True

                try:
                    page_resources = page.get_inherited("/Resources", default=None)
                except (AttributeError, TypeError):
                    page_resources = None
                if page_resources is not None:
                    if not collect_xforms(page_resources) or form_resources_incomplete:
                        truncated = True
                        break

                separator = "\n\n" if pieces else ""
                remaining = MAX_READER_TEXT_CHARS + 1 - chars - len(separator)
                if remaining <= 0:
                    truncated = True
                    break

                page_pieces: list[str] = []
                page_chars = 0
                page_truncated = False

                def collect_text(text: str, *_metadata: object) -> None:
                    nonlocal page_chars, page_truncated
                    if not text:
                        return
                    available = remaining - page_chars
                    if available <= 0:
                        page_truncated = True
                        raise _StopPdfTextExtraction()
                    page_pieces.append(text[:available])
                    page_chars += min(len(text), available)
                    if len(text) > available:
                        page_truncated = True
                        raise _StopPdfTextExtraction()

                def guard_form_invocations(operator: bytes, operands: object, *_metadata: object) -> None:
                    nonlocal total_content_bytes, total_xform_invocations, page_truncated
                    if operator != b"Do" or not operands:
                        return

                    name = str(operands[0])
                    if not form_resources_incomplete and name in image_names and name not in form_sizes_by_name:
                        return
                    if total_xform_invocations >= MAX_PDF_TOTAL_XFORM_INVOCATIONS:
                        page_truncated = True
                        raise _StopPdfTextExtraction()
                    total_xform_invocations += 1

                    # Count decoded form bytes for every invocation to bound
                    # repeated traversal. Unknown nested references are charged
                    # at the maximum per-stream allowance.
                    form_size = (
                        MAX_PDF_STREAM_OUTPUT_BYTES
                        if form_resources_incomplete
                        else form_sizes_by_name.get(name, MAX_PDF_STREAM_OUTPUT_BYTES)
                    )
                    if total_content_bytes + form_size > MAX_PDF_TOTAL_CONTENT_BYTES:
                        page_truncated = True
                        raise _StopPdfTextExtraction()
                    total_content_bytes += form_size

                try:
                    operand_budget_token = _active_pdf_operand_budget.set(operand_budget)
                    try:
                        page.extract_text(
                            visitor_text=collect_text,
                            visitor_operand_before=guard_form_invocations,
                        )
                    finally:
                        _active_pdf_operand_budget.reset(operand_budget_token)
                except _StopPdfTextExtraction:
                    pass
                if operation_budget.exceeded or operand_budget.exceeded:
                    page_truncated = True

                page_text = _normalize_text("".join(page_pieces))
                if page_text:
                    pieces.append(separator)
                    pieces.append(page_text[:remaining])
                    chars += len(separator) + min(len(page_text), remaining)
                if page_truncated or chars > MAX_READER_TEXT_CHARS:
                    truncated = True
                    break
            return "".join(pieces), truncated
    except InvalidDocumentError:
        raise
    except Exception as exc:
        raise InvalidDocumentError("PDF could not be parsed") from exc


def extract_library_text(filename: str, content: bytes) -> LibraryExtraction:
    if not isinstance(content, bytes):
        raise InvalidDocumentError("Uploaded document must be bytes")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise UploadTooLargeError(f"Document exceeds the {MAX_DOCUMENT_BYTES}-byte limit")
    if not content:
        raise EmptyDocumentError("The uploaded document is empty")

    basename = PurePosixPath(str(filename).replace("\\", "/")).name
    extension = PurePosixPath(basename).suffix.lower()
    if extension not in {".pdf", ".md", ".txt"}:
        raise UnsupportedDocumentError("Supported formats are PDF, Markdown, and TXT")

    pdf_text_truncated = False
    try:
        if extension == ".md":
            text, _locators = extract_markdown(content)
            file_type: Literal["pdf", "md", "txt"] = "md"
        elif extension == ".txt":
            text = decode_text(content)
            file_type = "txt"
        else:
            if not content.lstrip().startswith(b"%PDF-"):
                raise InvalidDocumentError("Invalid PDF file")
            text, pdf_text_truncated = _extract_pdf(content)
            file_type = "pdf"
    except (InvalidDocumentError, EmptyDocumentError, UnsupportedDocumentError, UploadTooLargeError):
        raise
    except Exception as exc:
        raise InvalidDocumentError("Document could not be parsed") from exc

    text = _normalize_text(text)
    if not text and file_type != "pdf":
        raise EmptyDocumentError("No readable text was found in the document")

    extracted_text_truncated = pdf_text_truncated or len(text) > MAX_READER_TEXT_CHARS
    extracted_text = text[:MAX_READER_TEXT_CHARS]
    search_text_truncated = pdf_text_truncated or len(text) > MAX_SEARCH_TEXT_CHARS
    search_text = text[:MAX_SEARCH_TEXT_CHARS]

    return LibraryExtraction(
        file_type=file_type,
        extracted_text=extracted_text,
        extracted_text_truncated=extracted_text_truncated,
        search_text=search_text,
        search_text_truncated=search_text_truncated,
        search_available=bool(search_text.strip()),
    )
