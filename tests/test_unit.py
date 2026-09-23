import pytest

from scripts.generate_repo_contributors import normalize_contributors


def test_empty_payload_returns_empty_list():
    assert normalize_contributors([]) == []


def test_deleted_author_is_skipped_and_malformed_week_values_are_sanitized():
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


def test_non_dictionary_rows_and_records_without_login_are_skipped():
    payload = [
        None,
        "not a contributor record",
        {"author": None, "weeks": [{"w": 1, "c": 2}]},
        {"author": {"id": 123}, "weeks": []},
        {"author": {"login": "valid"}, "total": 1},
    ]

    result = normalize_contributors(payload, include_logins=None)

    assert [item["login"] for item in result] == ["valid"]


def test_login_falls_back_to_author_name_then_top_level_login():
    payload = [
        {"author": {"name": "Author Name"}, "login": "Top Level", "total": 2},
        {"author": None, "login": "Top Level", "total": 1},
    ]

    result = normalize_contributors(payload, include_logins=None)

    assert [item["login"] for item in result] == ["Author Name", "Top Level"]


@pytest.mark.parametrize("include_logins", [[], ["someone-else"]])
def test_empty_or_nonmatching_allow_list_returns_no_contributors(include_logins):
    payload = [{"author": {"login": "teammate"}, "total": 1}]

    assert normalize_contributors(payload, include_logins=include_logins) == []


def test_invalid_and_negative_week_values_are_sanitized_without_losing_valid_values():
    payload = [
        {
            "author": {"login": "member"},
            "weeks": [
                {"w": "bad", "c": "many", "a": None, "d": -4},
                {"w": 9, "c": 3, "a": 6, "d": 2},
            ],
        }
    ]

    result = normalize_contributors(payload, include_logins=None)

    assert result[0]["weeks"] == [
        {"timestamp": 0, "commits": 0, "additions": 0, "deletions": 0},
        {"timestamp": 9, "commits": 3, "additions": 6, "deletions": 2},
    ]
    assert result[0]["weekly_commits"] == [0, 3]
    assert result[0]["total"] == 3
    assert result[0]["additions"] == 6
    assert result[0]["deletions"] == 2


def test_missing_total_uses_week_commits_and_ties_sort_by_casefolded_login():
    payload = [
        {"author": {"login": "Charlie"}, "total": 3},
        {"author": {"login": "Beta"}, "weeks": [{"w": 1, "c": 3}]},
        {"author": {"login": "alpha"}, "total": 3},
    ]

    result = normalize_contributors(payload, include_logins=None)

    assert [(item["login"], item["total"]) for item in result] == [
        ("alpha", 3),
        ("Beta", 3),
        ("Charlie", 3),
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
