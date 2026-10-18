from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from pypdf import PdfWriter

from app.services.document_library import (
    EmptyDocumentError,
    InvalidDocumentError,
    UnsupportedDocumentError,
    extract_library_text,
)


FIXTURES = Path(__file__).parent / "fixtures"


def test_pdf_operand_budget_wrapper_forwards_parser_keywords(monkeypatch):
    from pypdf.generic import _data_structures

    from app.services import document_library

    parsing_budget = object()
    forwarded = {}

    def read_object(_stream, _pdf, forced_encoding=None, *, parsing_budget=None):
        forwarded["forced_encoding"] = forced_encoding
        forwarded["parsing_budget"] = parsing_budget
        return "parsed"

    monkeypatch.setattr(_data_structures, "read_object", read_object)
    monkeypatch.setattr(document_library, "_pdf_read_object_budget_patched", False)

    document_library._install_pdf_operand_budget()
    result = _data_structures.read_object(None, None, parsing_budget=parsing_budget)

    assert result == "parsed"
    assert forwarded["parsing_budget"] is parsing_budget


def test_document_model_registers_private_document_and_existing_tag_association():
    from app.models import Document

    assert Document.__tablename__ == "documents"
    assert {"extracted_text", "search_text", "storage_key", "user_id"}.issubset(
        Document.__table__.columns.keys()
    )
    assert "document_tags" in Document.metadata.tables


@pytest.mark.parametrize("filename", ["notes.docx", "notes.DOCX"])
def test_document_library_rejects_docx_uploads_case_insensitively(filename):
    with pytest.raises(UnsupportedDocumentError) as error:
        extract_library_text(filename, b"not a DOCX file")

    assert "PDF, Markdown, and TXT" in str(error.value)


def test_extracts_markdown_for_reading_and_search_without_quiz_token_limit():
    source = ("# Algebra\n\n" + ("set theory concepts " * 2_000)).encode()

    result = extract_library_text("algebra.md", source)

    assert result.file_type == "md"
    assert result.extracted_text.startswith("# Algebra")
    assert "set theory concepts" in result.search_text
    assert not result.extracted_text_truncated
    assert not result.search_text_truncated


def test_extracts_utf8_text_and_normalizes_line_endings():
    result = extract_library_text("notes.txt", b"First line\r\nSecond line")

    assert result.extracted_text == "First line\nSecond line"
    assert result.search_text == "First line\nSecond line"


def test_extracts_pdf_text_and_accepts_valid_pdf_without_extractable_text():
    text_result = extract_library_text("lesson.pdf", (FIXTURES / "tiny-text.pdf").read_bytes())
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    data = BytesIO()
    writer.write(data)
    scan_result = extract_library_text("scan.pdf", data.getvalue())

    assert text_result.file_type == "pdf"
    assert "PDF learning text for extraction." in text_result.extracted_text
    assert scan_result.extracted_text == ""
    assert scan_result.search_text == ""
    assert scan_result.search_available is False


def test_extracts_pdf_with_recoverable_cross_reference_offset():
    source = (FIXTURES / "tiny-text.pdf").read_bytes()
    startxref = source.rfind(b"startxref")
    eof = source.find(b"%%EOF", startxref)
    recoverable_pdf = source[:startxref] + b"startxref\n0\n" + source[eof:]

    result = extract_library_text("recoverable.pdf", recoverable_pdf)

    assert "PDF learning text for extraction." in result.extracted_text


def test_caps_reading_text_and_marks_both_reader_and_search_truncation():
    result = extract_library_text("large.txt", ("a" * 2_000_001).encode())

    assert len(result.extracted_text) == 2_000_000
    assert result.extracted_text_truncated is True
    assert len(result.search_text) == 500_000
    assert result.search_text_truncated is True


def test_pdf_text_is_capped_during_parser_callbacks(monkeypatch):
    from pypdf import get_configuration

    from app.services.document_library import MAX_READER_TEXT_CHARS

    callback_finished = False

    class HugePage:
        def get_contents(self):
            return None

        def extract_text(self, *, visitor_text, visitor_operand_before):
            assert callable(visitor_operand_before)
            assert get_configuration().zlib_maximum_output_length <= 8_000_000
            visitor_text("x" * (MAX_READER_TEXT_CHARS + 100), None, None, None, None)
            nonlocal callback_finished
            callback_finished = True
            return "x" * (MAX_READER_TEXT_CHARS + 100)

    class FakeReader:
        pages = [HugePage()]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("large-page.pdf", source_pdf)

    assert callback_finished is False
    assert len(result.extracted_text) == MAX_READER_TEXT_CHARS
    assert result.extracted_text_truncated is True
    assert result.search_text_truncated is True


def test_rejects_pdf_content_stream_that_exceeds_decompression_budget():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
    })
    stream = DecodedStreamObject()
    stream.set_data(b" " * 8_000_001)
    page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    data = BytesIO()
    writer.write(data)

    assert len(data.getvalue()) < 100_000
    with pytest.raises(InvalidDocumentError):
        extract_library_text("compressed-expansion.pdf", data.getvalue())


def test_pdf_extraction_stops_when_aggregate_page_content_budget_is_exceeded(monkeypatch):
    from pypdf.generic import NameObject

    from app.services.document_library import MAX_PDF_TOTAL_CONTENT_BYTES

    extracted_pages = []

    class FakeContent:
        def get_data(self):
            return b"x" * 8_000_000

    class FakePage(dict):
        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            assert callable(visitor_operand_before)
            extracted_pages.append(self)
            visitor_text("readable text", None, None, None, None)
            return "readable text"

    class FakeReader:
        pages = [FakePage() for _ in range(4)]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("many-streams.pdf", source_pdf)

    assert MAX_PDF_TOTAL_CONTENT_BYTES == 24_000_000
    assert len(extracted_pages) == 3
    assert result.extracted_text == "readable text\n\nreadable text\n\nreadable text"
    assert result.extracted_text_truncated is True
    assert result.search_text_truncated is True
    assert NameObject("/Contents") in FakeReader.pages[0]


def test_pdf_extraction_counts_form_xobject_streams_again_for_each_invocation(monkeypatch):
    from pypdf.generic import DictionaryObject, NameObject

    from app.services.document_library import MAX_PDF_TOTAL_CONTENT_BYTES

    extracted_form_calls = []

    class FakeContent:
        def get_data(self):
            return b"root"

    class FakeForm(DictionaryObject):
        def get_object(self):
            return self

        def get_data(self):
            return b"x" * 8_000_000

    form = FakeForm({NameObject("/Subtype"): NameObject("/Form")})
    xobjects = DictionaryObject({NameObject("/Fm"): form})
    resources = DictionaryObject({NameObject("/XObject"): xobjects})

    class FakePage(dict):
        def __init__(self):
            super().__init__({NameObject("/Resources"): resources})

        def get_inherited(self, key, default=None):
            return self.get(key, default)

        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            for _ in range(3):
                visitor_operand_before(b"Do", [NameObject("/Fm")], None, None)
                extracted_form_calls.append("form parsed")
                visitor_text("form text", None, None, None, None)
            return "form text"

    class FakeReader:
        pages = [FakePage()]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("repeated-form.pdf", source_pdf)

    assert MAX_PDF_TOTAL_CONTENT_BYTES == 24_000_000
    assert len(extracted_form_calls) == 1
    assert result.extracted_text == "form text"
    assert result.extracted_text_truncated is True
    assert result.search_text_truncated is True


def test_pdf_extraction_truncates_when_nested_form_resources_exceed_depth_budget(monkeypatch):
    from pypdf.generic import DictionaryObject, NameObject

    from app.services.document_library import MAX_PDF_XFORM_RESOURCE_DEPTH

    extraction_started = False

    class FakeContent:
        def get_data(self):
            return b"root"

    class FakeForm(DictionaryObject):
        def get_object(self):
            return self

        def get_data(self):
            return b"small form"

        def get_inherited(self, key, default=None):
            return self.get(key, default)

    nested_resources = None
    for _ in range(MAX_PDF_XFORM_RESOURCE_DEPTH + 3):
        form_values = {NameObject("/Subtype"): NameObject("/Form")}
        if nested_resources is not None:
            form_values[NameObject("/Resources")] = nested_resources
        form = FakeForm(form_values)
        nested_resources = DictionaryObject({
            NameObject("/XObject"): DictionaryObject({NameObject("/Fm"): form}),
        })

    class FakePage(dict):
        def __init__(self):
            super().__init__({NameObject("/Resources"): nested_resources})

        def get_inherited(self, key, default=None):
            return self.get(key, default)

        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            nonlocal extraction_started
            extraction_started = True
            visitor_text("nested form text", None, None, None, None)
            return "nested form text"

    class FakeReader:
        pages = [FakePage()]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("deeply-nested-forms.pdf", source_pdf)

    assert extraction_started is False
    assert result.extracted_text == ""
    assert result.extracted_text_truncated is True
    assert result.search_text_truncated is True


def test_pdf_extraction_scans_shared_form_resource_dags_once(monkeypatch):
    from pypdf.generic import DictionaryObject, NameObject

    from app.services import document_library

    max_depth = 8
    monkeypatch.setattr(document_library, "MAX_PDF_XFORM_RESOURCE_DEPTH", max_depth)
    form_data_calls = 0

    class FakeContent:
        def get_data(self):
            return b"root"

    class FakeForm(DictionaryObject):
        def get_object(self):
            return self

        def get_data(self):
            nonlocal form_data_calls
            form_data_calls += 1
            return b"form"

        def get_inherited(self, key, default=None):
            return self.get(key, default)

    nested_resources = None
    for _ in range(max_depth + 1):
        form_values = {NameObject("/Subtype"): NameObject("/Form")}
        if nested_resources is not None:
            form_values[NameObject("/Resources")] = nested_resources
        left_form = FakeForm(form_values)
        right_form = FakeForm(form_values)
        nested_resources = DictionaryObject({
            NameObject("/XObject"): DictionaryObject({
                NameObject("/Left"): left_form,
                NameObject("/Right"): right_form,
            }),
        })

    class FakePage(dict):
        def __init__(self):
            super().__init__({NameObject("/Resources"): nested_resources})

        def get_inherited(self, key, default=None):
            return self.get(key, default)

        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            visitor_text("shared form text", None, None, None, None)
            return "shared form text"

    class FakeReader:
        pages = [FakePage()]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("shared-form-resources.pdf", source_pdf)

    assert form_data_calls == (max_depth + 1) * 2
    assert result.extracted_text == "shared form text"
    assert result.extracted_text_truncated is False


def test_pdf_extraction_truncates_when_form_resource_node_budget_is_exceeded(monkeypatch):
    from pypdf.generic import DictionaryObject, NameObject

    from app.services import document_library

    monkeypatch.setattr(document_library, "MAX_PDF_XFORM_RESOURCE_NODES", 2)
    extraction_started = False

    class FakeContent:
        def get_data(self):
            return b"root"

    class FakeForm(DictionaryObject):
        def get_object(self):
            return self

        def get_data(self):
            return b"form"

    resources = DictionaryObject({
        NameObject("/XObject"): DictionaryObject({
            NameObject("/Left"): FakeForm({NameObject("/Subtype"): NameObject("/Form")}),
            NameObject("/Right"): FakeForm({NameObject("/Subtype"): NameObject("/Form")}),
        }),
    })

    class FakePage(dict):
        def __init__(self):
            super().__init__({NameObject("/Resources"): resources})

        def get_inherited(self, key, default=None):
            return self.get(key, default)

        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            nonlocal extraction_started
            extraction_started = True
            visitor_text("text", None, None, None, None)
            return "text"

    class FakeReader:
        pages = [FakePage()]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("many-form-resources.pdf", source_pdf)

    assert extraction_started is False
    assert result.extracted_text == ""
    assert result.extracted_text_truncated is True


def test_pdf_extraction_enforces_form_resource_node_budget_across_pages(monkeypatch):
    from pypdf.generic import DictionaryObject, NameObject

    from app.services import document_library

    monkeypatch.setattr(document_library, "MAX_PDF_XFORM_RESOURCE_NODES", 3)
    extracted_pages = []

    class FakeContent:
        def get_data(self):
            return b"root"

    class FakeForm(DictionaryObject):
        def get_object(self):
            return self

        def get_data(self):
            return b"form"

    class FakePage(dict):
        def __init__(self, page_number):
            form = FakeForm({NameObject("/Subtype"): NameObject("/Form")})
            resources = DictionaryObject({
                NameObject("/XObject"): DictionaryObject({NameObject("/Fm"): form}),
            })
            super().__init__({NameObject("/Resources"): resources})
            self.page_number = page_number

        def get_inherited(self, key, default=None):
            return self.get(key, default)

        def get_contents(self):
            return FakeContent()

        def extract_text(self, *, visitor_text, visitor_operand_before):
            extracted_pages.append(self.page_number)
            visitor_text(f"page {self.page_number}", None, None, None, None)
            return f"page {self.page_number}"

    class FakeReader:
        pages = [FakePage(1), FakePage(2)]

        def __init__(self, _stream, strict):
            assert strict is False

    monkeypatch.setattr("pypdf.PdfReader", FakeReader)
    source_pdf = (FIXTURES / "tiny-text.pdf").read_bytes()

    result = extract_library_text("many-page-resources.pdf", source_pdf)

    assert extracted_pages == [1]
    assert result.extracted_text == "page 1"
    assert result.extracted_text_truncated is True


def test_pdf_extraction_caps_parsed_operations_before_visiting_text(monkeypatch):
    from pypdf import PdfReader as RealPdfReader
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    from app.services import document_library

    operation_limit = 10
    monkeypatch.setattr(document_library, "MAX_PDF_OPERATIONS_PER_STREAM", operation_limit, raising=False)
    monkeypatch.setattr(document_library, "MAX_PDF_TOTAL_OPERATIONS", operation_limit, raising=False)
    readers = []

    class InspectingPdfReader(RealPdfReader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            readers.append(self)

    monkeypatch.setattr("pypdf.PdfReader", InspectingPdfReader)

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
    })
    stream = DecodedStreamObject()
    stream.set_data(b"q Q\n" * 20)
    page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    source = BytesIO()
    writer.write(source)

    result = extract_library_text("many-operations.pdf", source.getvalue())

    parsed_operations = readers[0].pages[0][NameObject("/Contents")].operations
    assert len(parsed_operations) == operation_limit
    assert result.extracted_text_truncated is True


def test_pdf_extraction_caps_operands_in_stream_without_operations(monkeypatch):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    from app.services import document_library

    monkeypatch.setattr(document_library, "MAX_PDF_TOTAL_OPERANDS", 10, raising=False)

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    stream = DecodedStreamObject()
    stream.set_data(b" ".join([b"1"] * 50))
    page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({
            NameObject("/F1"): DictionaryObject({
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }),
        }),
    })
    source = BytesIO()
    writer.write(source)

    result = extract_library_text("many-operands.pdf", source.getvalue())

    assert result.extracted_text_truncated is True


def test_pdf_extraction_caps_nested_operand_objects(monkeypatch):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    from app.services import document_library

    monkeypatch.setattr(document_library, "MAX_PDF_TOTAL_OPERANDS", 10, raising=False)

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    stream = DecodedStreamObject()
    stream.set_data(b"[" + b" ".join([b"1"] * 50) + b"]")
    page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({
            NameObject("/F1"): DictionaryObject({
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }),
        }),
    })
    source = BytesIO()
    writer.write(source)

    result = extract_library_text("many-nested-operands.pdf", source.getvalue())

    assert result.extracted_text_truncated is True


def test_pdf_extraction_caps_total_operations_across_pages(monkeypatch):
    from pypdf import PdfReader as RealPdfReader
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    from app.services import document_library

    monkeypatch.setattr(document_library, "MAX_PDF_OPERATIONS_PER_STREAM", 100)
    monkeypatch.setattr(document_library, "MAX_PDF_TOTAL_OPERATIONS", 10)
    readers = []

    class InspectingPdfReader(RealPdfReader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            readers.append(self)

    monkeypatch.setattr("pypdf.PdfReader", InspectingPdfReader)

    writer = PdfWriter()
    for _ in range(2):
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
        })
        stream = DecodedStreamObject()
        stream.set_data(b"q Q\n" * 3)
        page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    source = BytesIO()
    writer.write(source)

    result = extract_library_text("many-page-operations.pdf", source.getvalue())

    first_page_operations = readers[0].pages[0][NameObject("/Contents")].operations
    second_page_operations = readers[0].pages[1][NameObject("/Contents")].operations
    assert len(first_page_operations) == 6
    assert len(second_page_operations) == 4
    assert result.extracted_text_truncated is True


def test_pdf_extraction_caps_parsed_form_operations(monkeypatch):
    from pypdf import PdfReader as RealPdfReader
    from pypdf.generic import (
        ArrayObject,
        DecodedStreamObject,
        DictionaryObject,
        NameObject,
        NumberObject,
    )

    from app.services import document_library

    operation_limit = 10
    monkeypatch.setattr(document_library, "MAX_PDF_OPERATIONS_PER_STREAM", operation_limit)
    monkeypatch.setattr(document_library, "MAX_PDF_TOTAL_OPERATIONS", 100)
    readers = []

    class InspectingPdfReader(RealPdfReader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            readers.append(self)

    monkeypatch.setattr("pypdf.PdfReader", InspectingPdfReader)

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_resources = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
    form = DecodedStreamObject()
    form.set_data(b"q Q\n" * 20)
    form.update({
        NameObject("/Type"): NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/BBox"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(100), NumberObject(100)]),
        NameObject("/Resources"): font_resources,
    })
    form_reference = writer._add_object(form.flate_encode())
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): font_resources[NameObject("/Font")],
        NameObject("/XObject"): DictionaryObject({NameObject("/Fm"): form_reference}),
    })
    page_content = DecodedStreamObject()
    page_content.set_data(b"/Fm Do\n")
    page[NameObject("/Contents")] = writer._add_object(page_content.flate_encode())
    source = BytesIO()
    writer.write(source)

    result = extract_library_text("form-many-operations.pdf", source.getvalue())

    assert result.extracted_text_truncated is True
    parsed_form = readers[0].pages[0][NameObject("/Resources")][NameObject("/XObject")][NameObject("/Fm")]
    assert len(parsed_form.operations) == operation_limit


@pytest.mark.parametrize("filename", ["legacy.doc", "slides.pptx", "photo.png", "file.html"])
def test_rejects_unsupported_document_extensions(filename: str):
    with pytest.raises(UnsupportedDocumentError):
        extract_library_text(filename, b"not a supported study document")


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("empty.txt", b""),
        ("empty.md", b" \n \t"),
        ("broken.pdf", b"not a pdf"),
        ("binary.txt", b"\x00\xff"),
    ],
)
def test_rejects_empty_or_malformed_textual_documents(filename: str, content: bytes):
    with pytest.raises((EmptyDocumentError, InvalidDocumentError)):
        extract_library_text(filename, content)
