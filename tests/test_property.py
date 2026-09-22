from hypothesis import given, settings, strategies as st

from scripts.generate_repo_contributors import normalize_contributors


login_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
    min_size=1,
    max_size=12,
)
week_strategy = st.fixed_dictionaries(
    {
        "w": st.integers(min_value=0, max_value=2_000_000_000),
        "c": st.integers(min_value=0, max_value=100),
        "a": st.integers(min_value=0, max_value=1_000),
        "d": st.integers(min_value=0, max_value=1_000),
    }
)
contributor_strategy = st.fixed_dictionaries(
    {
        "author": st.fixed_dictionaries({"login": login_strategy}),
        "total": st.integers(min_value=0, max_value=1_000),
        "weeks": st.lists(week_strategy, max_size=8),
    }
)
payload_strategy = st.lists(contributor_strategy, max_size=10)


@settings(max_examples=60)
@given(payload=payload_strategy)
def test_normalized_output_never_exceeds_requested_limit(payload):
    result = normalize_contributors(
        payload,
        include_logins=None,
        max_contributors=3,
        weeks=4,
    )

    assert len(result) <= 3


@settings(max_examples=60)
@given(payload=payload_strategy)
def test_normalized_weeks_are_sorted_and_capped(payload):
    result = normalize_contributors(
        payload,
        include_logins=None,
        max_contributors=10,
        weeks=4,
    )

    for contributor in result:
        timestamps = [week["timestamp"] for week in contributor["weeks"]]
        assert len(timestamps) <= 4
        assert timestamps == sorted(timestamps)


@settings(max_examples=60)
@given(payload=payload_strategy)
def test_normalized_aggregates_are_non_negative(payload):
    result = normalize_contributors(payload, include_logins=None)

    for contributor in result:
        assert contributor["total"] >= 0
        assert contributor["additions"] >= 0
        assert contributor["deletions"] >= 0
        assert all(week["commits"] >= 0 for week in contributor["weeks"])
