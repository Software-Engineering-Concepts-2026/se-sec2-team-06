from __future__ import annotations


def decode_text(content: bytes) -> str:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Document must be valid UTF-8 text") from exc
    if "\x00" in text:
        raise ValueError("Document contains binary data")
    return text.replace("\r\n", "\n").replace("\r", "\n")
