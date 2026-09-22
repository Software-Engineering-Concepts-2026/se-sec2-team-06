import pytest

from scripts.generate_repo_contributors import normalize_contributors


def test_empty_payload_returns_empty_list():
    assert normalize_contributors([]) == []


def test_deleted_author_and_malformed_week_are_ignored_safely():
    payload = [
        {"author": None, "weeks": [{"w": 1, "c": 9}]},
        {
            "author": {"login": "valid"},
            "weeks": [
                {"w": "bad", "c": 2, "a": 4, "d": 1},
                {"w": 2, "c": 3, "a": 6, "d": 2},
            ],
        },
    ]

    result = normalize_contributors(payload, include_logins=None)

    assert [item["login"] for item in result] == ["valid"]
    assert result[0]["total"] == 5
    assert result[0]["additions"] == 10
    assert result[0]["deletions"] == 3
    assert result[0]["weeks"] == [
        {"timestamp": 0, "commits": 2, "additions": 4, "deletions": 1},
        {"timestamp": 2, "commits": 3, "additions": 6, "deletions": 2},
    ]


def test_allow_list_is_case_insensitive():
    payload = [{"author": {"login": "TeamMember"}, "total": 4}]

    result = normalize_contributors(payload, include_logins=["teammember"])

    assert [item["login"] for item in result] == ["TeamMember"]


def test_recent_weeks_are_sorted_and_limited_to_requested_boundary():
    payload = [
        {
            "author": {"login": "member"},
            "weeks": [{"w": 3, "c": 3}, {"w": 1, "c": 1}, {"w": 2, "c": 2}],
        }
    ]

    result = normalize_contributors(payload, include_logins=None, weeks=2)

    assert [week["timestamp"] for week in result[0]["weeks"]] == [2, 3]
    assert result[0]["weekly_commits"] == [2, 3]


def test_max_contributors_limits_sorted_output():
    payload = [
        {"author": {"login": "low"}, "total": 1},
        {"author": {"login": "high"}, "total": 5},
    ]

    result = normalize_contributors(payload, include_logins=None, max_contributors=1)

    assert [item["login"] for item in result] == ["high"]


def test_invalid_max_contributors_is_rejected():
    with pytest.raises(ValueError, match="max_contributors"):
        normalize_contributors([], max_contributors=0)


def test_invalid_weeks_is_rejected():
    with pytest.raises(ValueError, match="weeks"):
        normalize_contributors([], weeks=0)
