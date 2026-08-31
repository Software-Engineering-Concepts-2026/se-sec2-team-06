"""Generate a repository-scoped contributor graph as a self-contained SVG.

The GitHub contributors endpoint returns one record per contributor with a
weekly commit series.  This module keeps the data fetching and SVG rendering
separate so the renderer can be tested with a fixture without network access.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


DEFAULT_API_URL = "https://api.github.com"
DEFAULT_WEEKS = 12
DEFAULT_MAX_CONTRIBUTORS = 10
DEFAULT_TEAM_LOGINS = frozenset({"THAKORN-MK", "Chaiwat2005", "67026146"})
REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def _as_non_negative_int(value: Any) -> int:
    """Convert an API value to a safe non-negative integer."""

    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _validate_repo(repo: str) -> str:
    repo = repo.strip()
    if not REPO_PATTERN.fullmatch(repo):
        raise ValueError(f"Repository must use OWNER/REPOSITORY format: {repo!r}")
    return repo


def fetch_contributors(
    repo: str,
    token: str | None = None,
    *,
    api_url: str = DEFAULT_API_URL,
    opener: Callable[[Request], Any] = urlopen,
    sleep_fn: Callable[[float], None] = time.sleep,
    max_attempts: int = 5,
) -> list[dict[str, Any]]:
    """Fetch repository contributor statistics from GitHub.

    GitHub responds with HTTP 202 while contributor statistics are being
    calculated.  Retry that response with a short backoff so scheduled runs
    eventually render the fresh data instead of committing an empty graph.
    """

    repo = _validate_repo(repo)
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1")

    endpoint = f"{api_url.rstrip('/')}/repos/{quote(repo, safe='/')}/stats/contributors"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "synapsesync-repository-contributors",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(endpoint, headers=headers, method="GET")
    for attempt in range(max_attempts):
        try:
            with opener(request) as response:
                status = getattr(response, "status", None) or response.getcode()
                raw_body = response.read()
        except HTTPError as error:
            status = error.code
            raw_body = error.read()
        except URLError as error:
            raise RuntimeError(f"Unable to reach GitHub API: {error.reason}") from error

        if status == 202:
            if attempt == max_attempts - 1:
                raise RuntimeError(
                    "GitHub is still calculating contributor statistics after "
                    f"{max_attempts} attempts"
                )
            sleep_fn(2**attempt)
            continue

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("GitHub API returned invalid JSON") from error

        if status >= 400:
            message = payload.get("message", "unknown GitHub API error") if isinstance(payload, dict) else str(payload)
            raise RuntimeError(f"GitHub API returned HTTP {status}: {message}")

        if not isinstance(payload, list):
            raise RuntimeError("GitHub contributor response must be a JSON array")
        return payload

    raise RuntimeError("GitHub contributor request did not complete")


def normalize_contributors(
    payload: Iterable[dict[str, Any]],
    *,
    max_contributors: int = DEFAULT_MAX_CONTRIBUTORS,
    weeks: int = DEFAULT_WEEKS,
    include_logins: Iterable[str] | None = DEFAULT_TEAM_LOGINS,
) -> list[dict[str, Any]]:
    """Normalize and sort GitHub's contributor response for rendering.

    The default allow-list keeps the README graph focused on the three
    SynapseSync team members.  Pass ``include_logins=None`` when a caller
    explicitly needs every repository contributor.
    """

    if max_contributors < 1:
        raise ValueError("max_contributors must be at least 1")
    if weeks < 1:
        raise ValueError("weeks must be at least 1")
    allowed_logins = None
    if include_logins is not None:
        allowed_logins = {str(login).casefold() for login in include_logins}

    normalized: list[dict[str, Any]] = []
    for entry in payload or []:
        if not isinstance(entry, dict):
            continue
        author = entry.get("author") or {}
        if not isinstance(author, dict):
            author = {}
        login = author.get("login") or author.get("name") or entry.get("login")
        if not login:
            # GitHub can return a null author for an account that was deleted.
            continue
        if allowed_logins is not None and str(login).casefold() not in allowed_logins:
            continue

        raw_weeks = entry.get("weeks") or []
        recent_weeks = []
        for week in raw_weeks:
            if not isinstance(week, dict):
                continue
            recent_weeks.append(
                {
                    "timestamp": _as_non_negative_int(week.get("w")),
                    "commits": _as_non_negative_int(week.get("c")),
                    "additions": _as_non_negative_int(week.get("a")),
                    "deletions": _as_non_negative_int(week.get("d")),
                }
            )
        recent_weeks.sort(key=lambda item: item["timestamp"])
        recent_weeks = recent_weeks[-weeks:]

        normalized.append(
            {
                "login": str(login),
                "total": _as_non_negative_int(entry.get("total"))
                or sum(item["commits"] for item in recent_weeks),
                "additions": sum(item["additions"] for item in recent_weeks),
                "deletions": sum(item["deletions"] for item in recent_weeks),
                "weeks": recent_weeks,
                "weekly_commits": [item["commits"] for item in recent_weeks],
            }
        )

    normalized.sort(key=lambda item: (-item["total"], item["login"].casefold()))
    return normalized[:max_contributors]


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _number(value: int) -> str:
    return f"{value:,}"


def _date_label(timestamp: int) -> str:
    if not timestamp:
        return "—"
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%d %b")


def _weekly_data(contributors: list[dict[str, Any]]) -> list[tuple[int, int]]:
    totals: dict[int, int] = {}
    for contributor in contributors:
        for week in contributor.get("weeks", []):
            timestamp = _as_non_negative_int(week.get("timestamp"))
            totals[timestamp] = totals.get(timestamp, 0) + _as_non_negative_int(week.get("commits"))
    return sorted((timestamp, total) for timestamp, total in totals.items() if timestamp)


def _bar_svg(x: float, y: float, width: float, height: float, fill: str, *, opacity: float = 1.0) -> str:
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{width:.1f}" height="{height:.1f}" '
        f'rx="5" fill="{fill}" opacity="{opacity:.2f}"/>'
    )


def render_svg(
    *,
    repo: str,
    contributors: list[dict[str, Any]],
    generated_at: str,
) -> str:
    """Render a self-contained, repository-scoped contributor dashboard."""

    repo = _validate_repo(repo)
    display_repo = repo.rsplit("/", 1)[-1]
    weekly = _weekly_data(contributors)
    chart_weekly = weekly[-DEFAULT_WEEKS:]
    contributor_count = len(contributors)

    width = 1100
    chart_x, chart_y, chart_width, chart_height = 52, 126, 996, 236
    card_gap = 24
    card_width = width - 2 * chart_x
    card_height = 266
    cards_y = chart_y + chart_height + 42
    rows = max(1, contributor_count)
    height = int(cards_y + rows * card_height + max(0, rows - 1) * card_gap + 58)

    max_commits = max((value for _timestamp, value in chart_weekly), default=1)
    svg: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 {width} {height}" '
        'role="img" aria-labelledby="repo-contributors-title repo-contributors-desc">',
        '<title id="repo-contributors-title">SynapseSync team repository contributors</title>',
        f'<desc id="repo-contributors-desc">Selected team contributors to {_escape(repo)} on the default branch, generated {_escape(generated_at)}</desc>',
        '<style>'
        '.title{font:700 28px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f7f7fb}'
        '.subtitle{font:400 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#b9c1e7}'
        '.section{font:700 16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f7f7fb}'
        '.muted{font:400 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#9da7d5}'
        '.name{font:700 16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f7f7fb}'
        '.stat{font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#7dd8da}'
        '.diff-added{font:700 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#4ade80}'
        '.diff-removed{font:700 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f87171}'
        '.diff-separator{font:600 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#b9c1e7}'
        '.card-commit-count{font:700 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f7f7fb}'
        '.card-date{font:600 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#9da7d5}'
        '.label{font:400 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#9da7d5}'
        '</style>',
        '<rect width="100%" height="100%" rx="18" fill="#11183f"/>',
        '<circle cx="1020" cy="45" r="8" fill="#7dd8da" opacity=".9"/>',
        '<circle cx="1044" cy="45" r="8" fill="#a855f7" opacity=".9"/>',
        f'<text x="52" y="52" class="title">SynapseSync · Team Contributors</text>',
        f'<text x="52" y="79" class="subtitle">{_escape(repo)} · default branch · generated {_escape(generated_at)}</text>',
        f'<text x="52" y="108" class="section">Commits over time</text>',
    ]

    # Chart background and guide lines.
    svg.append(f'<rect x="{chart_x}" y="{chart_y}" width="{chart_width}" height="{chart_height}" rx="14" fill="#171f4d" stroke="#2a3671"/>')
    baseline = chart_y + chart_height - 38
    usable_height = chart_height - 70
    for index in range(5):
        y = baseline - usable_height * index / 4
        value = round(max_commits * index / 4)
        svg.append(f'<line x1="{chart_x + 18}" y1="{y:.1f}" x2="{chart_x + chart_width - 18}" y2="{y:.1f}" stroke="#344176" stroke-dasharray="3 6"/>')
        svg.append(f'<text x="{chart_x + 28}" y="{y - 7:.1f}" class="muted">{_number(value)}</text>')

    if chart_weekly:
        slot = (chart_width - 90) / len(chart_weekly)
        bar_width = max(8.0, min(54.0, slot * 0.62))
        for index, (timestamp, commits) in enumerate(chart_weekly):
            bar_height = usable_height * commits / max_commits if max_commits else 0
            x = chart_x + 58 + index * slot + (slot - bar_width) / 2
            y = baseline - bar_height
            svg.append(_bar_svg(x, y, bar_width, bar_height, "#22d3ee", opacity=0.92))
            if index == 0 or index == len(chart_weekly) - 1 or index % 3 == 0:
                svg.append(f'<text x="{x + bar_width / 2:.1f}" y="{baseline + 24}" text-anchor="middle" class="muted">{_escape(_date_label(timestamp))}</text>')
    else:
        svg.append(f'<text x="{chart_x + chart_width / 2}" y="{chart_y + chart_height / 2}" text-anchor="middle" class="subtitle">ยังไม่มีข้อมูล contributor บน default branch</text>')

    summary_y = chart_y - 14
    svg.append(f'<text x="{chart_x + chart_width - 24}" y="{summary_y:.1f}" text-anchor="end" class="stat">{_number(sum(value for _timestamp, value in chart_weekly))} commits · last {DEFAULT_WEEKS} weeks</text>')

    if contributors:
        for index, contributor in enumerate(contributors):
            x = chart_x
            y = cards_y + index * (card_height + card_gap)
            login = contributor["login"]
            total = contributor["total"]
            additions = contributor["additions"]
            deletions = contributor["deletions"]
            svg.extend(
                [
                    f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_width:.1f}" height="{card_height}" rx="14" fill="#171f4d" stroke="#2a3671"/>',
                    f'<circle cx="{x + 28:.1f}" cy="{y + 31:.1f}" r="15" fill="#5959d6"/>',
                    f'<text x="{x + 28:.1f}" y="{y + 36:.1f}" text-anchor="middle" class="name">{_escape(login[:1].upper())}</text>',
                    f'<text x="{x + 54:.1f}" y="{y + 30:.1f}" class="name">{_escape(login)}</text>',
                    f'<text x="{x + 54:.1f}" y="{y + 51:.1f}" class="stat">{_number(total)} commits</text>',
                    f'<text x="{x + card_width - 20:.1f}" y="{y + 30:.1f}" text-anchor="end" class="diff-separator"><tspan class="diff-added">+{_number(additions)}</tspan><tspan class="diff-separator"> / </tspan><tspan class="diff-removed">−{_number(deletions)}</tspan></text>',
                    f'<text x="{x + 24:.1f}" y="{y + 79:.1f}" class="label">weekly commits · date is week start</text>',
                ]
            )
            weeks_for_card = contributor.get("weeks", [])[-DEFAULT_WEEKS:]
            max_week = max((week["commits"] for week in weeks_for_card), default=1)
            mini_x = x + 24
            mini_y = y + 220
            mini_width = card_width - 48
            mini_slot = mini_width / max(1, len(weeks_for_card))
            mini_bar_width = max(10.0, min(42.0, mini_slot * 0.55))
            svg.append(f'<line x1="{mini_x:.1f}" y1="{mini_y:.1f}" x2="{mini_x + mini_width:.1f}" y2="{mini_y:.1f}" stroke="#344176"/>')
            for week_index, week in enumerate(weeks_for_card):
                bar_height = 100 * week["commits"] / max_week if max_week else 0
                bar_x = mini_x + week_index * mini_slot + (mini_slot - mini_bar_width) / 2
                bar_y = mini_y - bar_height
                svg.append(_bar_svg(bar_x, bar_y, mini_bar_width, bar_height, "#a855f7", opacity=0.92))
                count_y = max(y + 101, bar_y - 8)
                svg.append(f'<text x="{bar_x + mini_bar_width / 2:.1f}" y="{count_y:.1f}" text-anchor="middle" class="card-commit-count">{_number(week["commits"])}</text>')
                date_x = bar_x + mini_bar_width / 2
                svg.append(f'<text x="{date_x:.1f}" y="{mini_y + 24:.1f}" text-anchor="middle" class="card-date">{_escape(_date_label(week["timestamp"]))}</text>')
    else:
        svg.append(f'<rect x="{chart_x}" y="{cards_y}" width="{width - 2 * chart_x}" height="{card_height}" rx="14" fill="#171f4d" stroke="#2a3671"/>')
        svg.append(f'<text x="{width / 2}" y="{cards_y + 92}" text-anchor="middle" class="subtitle">ยังไม่พบข้อมูล contributor</text>')

    footer_y = height - 22
    svg.append(f'<text x="{width - 52}" y="{footer_y}" text-anchor="end" class="muted">Repository scope · selected team members · source: GitHub contributor statistics API</text>')
    svg.append("</svg>")
    return "\n".join(svg) + "\n"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"), help="GitHub repository in OWNER/REPOSITORY form")
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"), help="GitHub API token (prefer GITHUB_TOKEN)")
    parser.add_argument("--api-url", default=os.environ.get("GITHUB_API_URL", DEFAULT_API_URL))
    parser.add_argument("--output", required=True, help="Output SVG path")
    parser.add_argument("--input", help="Fixture JSON path; skips the network request")
    parser.add_argument("--weeks", type=int, default=DEFAULT_WEEKS)
    parser.add_argument("--max-contributors", type=int, default=DEFAULT_MAX_CONTRIBUTORS)
    parser.add_argument(
        "--include-login",
        action="append",
        dest="include_logins",
        help="Contributor login to include; repeat for multiple logins (default: the three team members)",
    )
    parser.add_argument("--generated-at", help="ISO timestamp for deterministic output")
    args = parser.parse_args()
    if not args.repo:
        parser.error("--repo is required when GITHUB_REPOSITORY is not set")
    return args


def main() -> int:
    args = _parse_args()
    if args.input:
        payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    else:
        payload = fetch_contributors(
            args.repo,
            args.token,
            api_url=args.api_url,
        )
    contributors = normalize_contributors(
        payload,
        max_contributors=args.max_contributors,
        weeks=args.weeks,
        include_logins=args.include_logins if args.include_logins is not None else DEFAULT_TEAM_LOGINS,
    )
    generated_at = args.generated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    svg = render_svg(repo=args.repo, contributors=contributors, generated_at=generated_at)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(svg, encoding="utf-8", newline="\n")
    temporary.replace(output)
    print(f"Wrote {output} for {len(contributors)} contributor(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
