import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1]))

from generate_repo_contributors import fetch_contributors, normalize_contributors, render_svg


def _payload():
    return [
        {
            "author": {"login": "THAKORN-MK"},
            "total": 7,
            "weeks": [
                {"w": 1700000000, "a": 12, "d": 2, "c": 3},
                {"w": 1700604800, "a": 8, "d": 1, "c": 4},
            ],
        },
        {
            "author": {"login": "Chaiwat2005"},
            "total": 2,
            "weeks": [
                {"w": 1700000000, "a": 3, "d": 0, "c": 2},
            ],
        },
    ]


def test_normalize_contributors_sorts_by_repository_commit_total():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)

    assert [item["login"] for item in contributors] == ["THAKORN-MK", "Chaiwat2005"]
    assert contributors[0]["total"] == 7
    assert contributors[0]["additions"] == 20
    assert contributors[0]["deletions"] == 3
    assert contributors[0]["weekly_commits"] == [3, 4]


def test_normalize_contributors_defaults_to_the_three_team_members():
    payload = _payload() + [
        {
            "author": {"login": "thammarat-ai"},
            "total": 99,
            "weeks": [{"w": 1700000000, "a": 1, "d": 1, "c": 99}],
        }
    ]

    contributors = normalize_contributors(payload)

    assert [item["login"] for item in contributors] == ["THAKORN-MK", "Chaiwat2005"]
    assert all(item["login"] != "thammarat-ai" for item in contributors)


def test_fetch_contributors_retries_when_github_is_still_calculating():
    class FakeResponse:
        def __init__(self, status, body):
            self.status = status
            self._body = json.dumps(body).encode("utf-8")

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return self._body

    responses = iter([FakeResponse(202, []), FakeResponse(200, _payload())])
    requests = []

    def fake_opener(request):
        requests.append(request)
        return next(responses)

    result = fetch_contributors(
        "Software-Engineering-Concepts-2026/se-sec2-team-06",
        token="test-token",
        opener=fake_opener,
        sleep_fn=lambda _seconds: None,
        max_attempts=2,
    )

    assert result == _payload()
    assert len(requests) == 2
    assert requests[0].full_url.endswith(
        "/repos/Software-Engineering-Concepts-2026/se-sec2-team-06/stats/contributors"
    )
    assert requests[0].get_header("Authorization") == "Bearer test-token"


def test_fetch_contributors_retries_when_202_body_is_empty():
    class RawResponse:
        def __init__(self, status, body):
            self.status = status
            self._body = body

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return self._body

    responses = iter([RawResponse(202, b""), RawResponse(200, json.dumps(_payload()).encode("utf-8"))])

    result = fetch_contributors(
        "Software-Engineering-Concepts-2026/se-sec2-team-06",
        opener=lambda _request: next(responses),
        sleep_fn=lambda _seconds: None,
        max_attempts=2,
    )

    assert result == _payload()


def test_render_svg_is_repo_scoped_and_contains_contributor_cards():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)
    svg = render_svg(
        repo="Software-Engineering-Concepts-2026/se-sec2-team-06",
        contributors=contributors,
        generated_at="2026-08-31T00:00:00Z",
    )

    assert svg.startswith("<svg ")
    assert "SynapseSync" in svg
    assert "THAKORN-MK" in svg
    assert "Chaiwat2005" in svg
    assert "Commits over time" in svg
    assert "github-readme-activity-graph" not in svg
    assert "ghchart.rshah.org" not in svg


def test_render_svg_styles_additions_and_deletions_as_large_colored_stats():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)
    svg = render_svg(
        repo="Software-Engineering-Concepts-2026/se-sec2-team-06",
        contributors=contributors,
        generated_at="2026-08-31T00:00:00Z",
    )

    assert ".diff-added{font:700 15px" in svg
    assert ".diff-removed{font:700 15px" in svg
    assert '<tspan class="diff-added">+20</tspan>' in svg
    assert '<tspan class="diff-removed">−3</tspan>' in svg


def test_render_svg_stacks_contributor_cards_one_per_row():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)
    svg = render_svg(
        repo="Software-Engineering-Concepts-2026/se-sec2-team-06",
        contributors=contributors,
        generated_at="2026-08-31T00:00:00Z",
    )

    root = ET.fromstring(svg)
    cards = [
        element
        for element in root.iter("{http://www.w3.org/2000/svg}rect")
        if element.attrib.get("fill") == "#171f4d"
        and element.attrib.get("stroke") == "#2a3671"
        and float(element.attrib.get("width", 0)) > 900
        and float(element.attrib.get("y", 0)) >= 400
    ]

    assert len(cards) == len(contributors)
    assert len({element.attrib["y"] for element in cards}) == len(contributors)


def test_render_svg_labels_each_contributor_week_with_date_and_commit_count():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)
    svg = render_svg(
        repo="Software-Engineering-Concepts-2026/se-sec2-team-06",
        contributors=contributors,
        generated_at="2026-08-31T00:00:00Z",
    )

    expected_buckets = sum(len(contributor["weeks"]) for contributor in contributors)

    assert svg.count('class="card-date"') == expected_buckets
    assert svg.count('class="card-commit-count"') == expected_buckets
    assert "14 Nov" in svg
    assert "3" in svg


def test_render_svg_places_commit_summary_away_from_date_labels():
    contributors = normalize_contributors(_payload(), max_contributors=10, weeks=12)
    svg = render_svg(
        repo="Software-Engineering-Concepts-2026/se-sec2-team-06",
        contributors=contributors,
        generated_at="2026-08-31T00:00:00Z",
    )

    root = ET.fromstring(svg)
    summary = next(
        element
        for element in root.iter("{http://www.w3.org/2000/svg}text")
        if "last 12 weeks" in "".join(element.itertext())
    )

    # Date labels sit at the chart baseline; the summary must not share that row.
    assert float(summary.attrib["y"]) < 200
