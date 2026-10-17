from __future__ import annotations

import re

from app.services.extractors.plain_text import decode_text


_FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
_HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")


def _remove_html_comments(text: str) -> str:
    output: list[str] = []
    in_fence = False
    fence_char = ""
    fence_length = 0
    in_comment = False

    for line in text.split("\n"):
        if not in_comment:
            fence_match = _FENCE.match(line)
            if fence_match:
                marker = fence_match.group(1)
                if not in_fence:
                    in_fence = True
                    fence_char = marker[0]
                    fence_length = len(marker)
                elif marker[0] == fence_char and len(marker) >= fence_length:
                    in_fence = False
                output.append(line)
                continue

        if in_fence:
            output.append(line)
            continue

        # Four-space or tab-indented blocks are Markdown code blocks. Preserve
        # their contents verbatim, including strings that resemble comments.
        if not in_comment and (line.startswith("    ") or line.startswith("\t")):
            output.append(line)
            continue

        cleaned: list[str] = []
        cursor = 0
        while cursor < len(line):
            if in_comment:
                close = line.find("-->", cursor)
                if close < 0:
                    cursor = len(line)
                else:
                    cursor = close + 3
                    in_comment = False
                continue

            # HTML-looking text inside inline code is data, not markup. Only
            # treat a backtick run as a code span when this line has a matching
            # run of the same length (other run lengths may appear inside it).
            if line[cursor] == "`":
                end = cursor
                while end < len(line) and line[end] == "`":
                    end += 1
                marker = line[cursor:end]
                closing = re.search(rf"(?<!`)`{{{len(marker)}}}(?!`)", line[end:])
                if closing:
                    close_end = end + closing.end()
                    cleaned.append(line[cursor:close_end])
                    cursor = close_end
                    continue
                cleaned.append(marker)
                cursor = end
                continue

            opening = line.find("<!--", cursor)
            backtick = line.find("`", cursor)
            if backtick >= 0 and (opening < 0 or backtick < opening):
                cleaned.append(line[cursor:backtick])
                cursor = backtick
                continue
            if opening < 0:
                cleaned.append(line[cursor:])
                break
            cleaned.append(line[cursor:opening])
            cursor = opening + 4
            close = line.find("-->", cursor)
            if close < 0:
                in_comment = True
                cursor = len(line)
            else:
                cursor = close + 3

        output.append("".join(cleaned))

    normalized = "\n".join(output)
    normalized = re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", normalized)
    return normalized.strip()


def extract_markdown(content: bytes) -> tuple[str, list[tuple[str, int, int]]]:
    text = _remove_html_comments(decode_text(content))
    matches = list(_HEADING.finditer(text))
    locators: list[tuple[str, int, int]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        locators.append((f"Heading: {match.group(1)}", match.start(), end))
    if text and not locators:
        locators.append(("Section 1", 0, len(text)))
    return text, locators
