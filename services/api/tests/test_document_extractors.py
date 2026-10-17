from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest

from app.services.document_extractor import (
    EmptyDocumentError,
    SourceTextTooLongError,
    UnsupportedDocumentError,
    extract_document,
)


FIXTURES = Path(__file__).parent / "fixtures"


def test_markdown_decodes_bom_and_normalizes_newlines():
    result = extract_document("lesson.md", b"\xef\xbb\xbf# Lesson\r\n\r\nText")

    assert result.source_type == "md"
    assert result.text == "# Lesson\n\nText"


def test_markdown_preserves_headings_tables_lists_and_code_fences():
    source = """# Topic

| Name | Value |
| --- | --- |
| A | 1 |

- first
- second

```python
print('hello')
```
"""

    result = extract_document("lesson.md", source.encode())

    for fragment in ("# Topic", "| Name | Value |", "- first", "```python", "print('hello')"):
        assert fragment in result.text


def test_markdown_removes_html_comments_and_redundant_blank_lines():
    result = extract_document(
        "lesson.md", b"# Topic\n\n\n<!-- hidden note -->\n\n\nVisible text\n\n\n"
    )

    assert "hidden note" not in result.text
    assert "Visible text" in result.text
    assert "\n\n\n" not in result.text


def test_markdown_preserves_comment_like_text_inside_code_fence():
    result = extract_document("lesson.md", b"```html\n<!-- code example -->\n```\n")

    assert "<!-- code example -->" in result.text


def test_markdown_preserves_comment_like_text_inside_inline_and_indented_code():
    source = (
        "Use `<!-- inline example -->` in the template.\n\n"
        "    <!-- indented example -->\n"
    )

    result = extract_document("lesson.md", source.encode())

    assert "`<!-- inline example -->`" in result.text
    assert "    <!-- indented example -->" in result.text


def test_txt_decodes_utf8_bom():
    result = extract_document("notes.txt", b"\xef\xbb\xbfFirst line\r\nSecond line")

    assert result.source_type == "txt"
    assert result.text == "First line\nSecond line"


def test_docx_extracts_paragraphs_and_table_cells():
    from docx import Document

    document = Document()
    document.add_paragraph("Paragraph one")
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Cell A"
    table.cell(0, 1).text = "Cell B"
    data = BytesIO()
    document.save(data)

    result = extract_document("notes.docx", data.getvalue())

    assert result.source_type == "docx"
    assert "Paragraph one" in result.text
    assert "Cell A" in result.text
    assert "Cell B" in result.text


def test_pdf_extracts_text_with_page_locator():
    result = extract_document("lesson.pdf", (FIXTURES / "tiny-text.pdf").read_bytes())

    assert result.source_type == "pdf"
    assert "PDF learning text for extraction." in result.text
    assert result.locators
    assert result.locators[0].label == "Page 1"


def test_rejects_unsupported_doc_extension():
    with pytest.raises(UnsupportedDocumentError):
        extract_document("legacy.doc", b"not a supported document")


def test_rejects_empty_or_scanned_pdf():
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    data = BytesIO()
    writer.write(data)

    with pytest.raises(EmptyDocumentError):
        extract_document("scanned.pdf", data.getvalue())


def test_rejects_file_over_20mb_before_parsing():
    from app.services.document_extractor import MAX_UPLOAD_BYTES, UploadTooLargeError

    with pytest.raises(UploadTooLargeError):
        extract_document("lesson.md", b"x" * (MAX_UPLOAD_BYTES + 1))


def test_rejects_text_over_20000_chars_without_truncation():
    with pytest.raises(SourceTextTooLongError):
        extract_document("lesson.txt", ("x" * 20_001).encode())
