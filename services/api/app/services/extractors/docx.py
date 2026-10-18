from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.run import CT_R
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from docx.oxml.ns import qn


_BLOCK_WRAPPERS = {
    qn("w:customXml"),
    qn("w:ins"),
    qn("w:sdt"),
    qn("w:smartTag"),
}


def _wrapped_content(element):
    if element.tag == qn("w:sdt"):
        return element.find(qn("w:sdtContent"))
    return element


def _iter_blocks(parent, document):
    for child in parent.iterchildren():
        if isinstance(child, CT_P):
            yield "paragraph", Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield "table", Table(child, document)
        elif child.tag in _BLOCK_WRAPPERS:
            content = _wrapped_content(child)
            if content is not None:
                yield from _iter_blocks(content, document)


def _paragraph_text(paragraph: Paragraph) -> str:
    if not any(child.tag == qn("w:sdt") for child in paragraph._p.iter()):
        return paragraph.text

    parts: list[str] = []

    def append_inline_content(parent):
        for child in parent.iterchildren():
            if isinstance(child, CT_R):
                parts.append(Run(child, paragraph).text)
            elif child.tag in _BLOCK_WRAPPERS:
                content = _wrapped_content(child)
                if content is not None:
                    append_inline_content(content)
            elif child.tag in {qn("w:hyperlink"), qn("w:fldSimple")}:
                append_inline_content(child)

    append_inline_content(paragraph._p)
    return "".join(parts)


def _table_text(table: Table, document) -> list[str]:
    rows: list[str] = []
    for row in table.rows:
        cells = []
        for cell in row.cells:
            cell_blocks = []
            for kind, block in _iter_blocks(cell._tc, document):
                if kind == "paragraph":
                    text = _paragraph_text(block).strip()
                    if text:
                        cell_blocks.append(text)
                else:
                    cell_blocks.extend(_table_text(block, document))
            cells.append("\n".join(cell_blocks).strip())
        if any(cells):
            rows.append(" | ".join(cells))
    return rows


def extract_docx(content: bytes) -> str:
    document = Document(BytesIO(content))
    blocks: list[str] = []
    for kind, block in _iter_blocks(document.element.body, document):
        if kind == "paragraph":
            text = _paragraph_text(block).strip()
            if text:
                blocks.append(text)
        else:
            blocks.extend(_table_text(block, document))
    return "\n\n".join(blocks).strip()
