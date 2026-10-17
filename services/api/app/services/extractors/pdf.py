from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_pdf(content: bytes) -> tuple[str, list[tuple[str, int, int]]]:
    # Uploaded PDFs may contain minor cross-reference damage; non-strict mode
    # lets pypdf repair the index and extract readable pages instead of rejecting
    # otherwise usable files.
    reader = PdfReader(BytesIO(content), strict=False)
    page_texts: list[str] = []
    locators: list[tuple[str, int, int]] = []
    pieces: list[str] = []
    cursor = 0

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = (page.extract_text() or "").replace("\r\n", "\n").replace("\r", "\n")
        page_text = "\n".join(line.rstrip() for line in page_text.split("\n")).strip()
        if not page_text:
            continue
        if pieces:
            pieces.append("\n\n")
            cursor += 2
        start = cursor
        pieces.append(page_text)
        cursor += len(page_text)
        locators.append((f"Page {page_number}", start, cursor))
        page_texts.append(page_text)

    return "\n\n".join(page_texts), locators
