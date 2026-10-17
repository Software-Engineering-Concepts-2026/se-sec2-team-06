from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import Quiz, QuizAnswer, QuizAttempt, QuizQuestion, Tag, User


class _MemoryStorageProvider:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}
        self.delete_calls: list[tuple[str, str]] = []
        self._next_key_id = 0

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        self._next_key_id += 1
        return f"{owner_id}/{self._next_key_id:043d}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.objects[(bucket, key)] = (content, content_type)

    def read(self, bucket: str, key: str) -> bytes:
        return self.objects[(bucket, key)][0]

    def delete(self, bucket: str, key: str) -> None:
        self.delete_calls.append((bucket, key))
        self.objects.pop((bucket, key), None)


def _register(client, email="owner@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Quiz Owner", "email": email, "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201
    return response.json()


def _create_quiz(session, user_id: int, title: str, created_at: datetime):
    quiz = Quiz(
        user_id=user_id,
        title=title,
        source_filename="lesson.md",
        source_type="md",
        language="en",
        difficulty="basic",
        question_count=1,
        prompt_version="quiz_generation_v1",
        created_at=created_at,
    )
    quiz.questions.append(
        QuizQuestion(
            position=1,
            kind="multiple_choice",
            prompt="Choose an answer.",
            choices=["A", "B", "C", "D"],
            correct_answer=2,
            explanation="The source says C.",
            evidence="Evidence excerpt.",
        )
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)
    return quiz


def _second_user(session):
    user = User(
        email="other@example.com",
        display_name="Other User",
        password_hash="$argon2id$test",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_list_returns_only_current_users_quizzes(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _second_user(session)
            _create_quiz(session, owner["id"], "Owner quiz", datetime.now(timezone.utc))
            _create_quiz(session, other.id, "Other quiz", datetime.now(timezone.utc))

        response = client.get("/api/quizzes")

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["Owner quiz"]
    assert response.json()[0]["source_filename"] == "lesson.md"


def test_list_orders_newest_first(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            now = datetime.now(timezone.utc)
            _create_quiz(session, owner["id"], "Older", now - timedelta(days=1))
            _create_quiz(session, owner["id"], "Newer", now)

        response = client.get("/api/quizzes")

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["Newer", "Older"]


def test_list_includes_attempt_count_latest_and_best_score(client_factory):
    with client_factory() as client:
        owner = _register(client)
        base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Attempted quiz", base_time)
            quiz.question_count = 5
            quiz.questions.extend(
                QuizQuestion(
                    position=position,
                    kind="multiple_choice",
                    prompt=f"Question {position}",
                    choices=["A", "B", "C", "D"],
                    correct_answer=0,
                    explanation="A is supported.",
                    evidence="Evidence excerpt.",
                )
                for position in range(2, 6)
            )
            attempts = [
                QuizAttempt(
                    quiz_id=quiz.id,
                    user_id=owner["id"],
                    started_at=base_time + timedelta(days=day),
                    submitted_at=base_time + timedelta(days=day),
                    score=score,
                    total_questions=5,
                )
                for day, score in [(1, 2), (2, 5), (3, 3)]
            ]
            session.add_all(attempts)
            session.commit()
            latest_attempt_id = attempts[-1].id

        response = client.get("/api/quizzes")

    assert response.status_code == 200
    item = response.json()[0]
    assert item["attempt_count"] == 3
    assert item["latest_attempt"]["id"] == latest_attempt_id
    assert item["latest_attempt"]["score"] == 3
    assert item["best_score"] == 5


def test_list_has_null_scores_for_quizzes_without_attempts(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            _create_quiz(session, owner["id"], "Not attempted", datetime.now(timezone.utc))

        response = client.get("/api/quizzes")

    assert response.status_code == 200
    item = response.json()[0]
    assert item["attempt_count"] == 0
    assert item["latest_attempt"] is None
    assert item["best_score"] is None


def test_library_items_include_tag_metadata_and_empty_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "library-tags@example.com")
        with client.app.state.session_factory() as session:
            subject = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert subject is not None
            subject_id = subject.id
            tagged = _create_quiz(
                session,
                owner["id"],
                "Tagged quiz",
                datetime.now(timezone.utc),
            )
            tagged.tags.append(subject)
            _create_quiz(
                session,
                owner["id"],
                "Untagged quiz",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )

        response = client.get("/api/quizzes")

    assert response.status_code == 200
    by_title = {item["title"]: item for item in response.json()}
    assert by_title["Tagged quiz"]["tags"] == [
        {
            "id": subject_id,
            "name": "คณิตศาสตร์",
            "parent_id": None,
            "is_builtin": True,
            "color": "blue",
        }
    ]
    assert by_title["Untagged quiz"]["tags"] == []
    assert all("correct_answer" not in item for item in by_title.values())


def test_owner_can_delete_quiz_and_cascades_history_but_keeps_shared_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "delete-owner@example.com")
        with client.app.state.session_factory() as session:
            subject = session.scalar(select(Tag).where(Tag.slug == "math"))
            quiz = _create_quiz(session, owner["id"], "Delete me", datetime.now(timezone.utc))
            question = quiz.questions[0]
            quiz.tags.append(subject)
            attempt = QuizAttempt(
                quiz_id=quiz.id,
                user_id=owner["id"],
                score=1,
                total_questions=1,
            )
            session.add(attempt)
            session.flush()
            answer = QuizAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                submitted_answer=0,
                is_correct=True,
            )
            session.add(answer)
            quiz_id, question_id, attempt_id, answer_id, tag_id = (
                quiz.id, question.id, attempt.id, answer.id, subject.id,
            )
            session.commit()

        response = client.delete(
            f"/api/quizzes/{quiz_id}",
            headers={"Origin": "http://testserver"},
        )

        assert response.status_code == 204
        with client.app.state.session_factory() as session:
            assert session.get(Quiz, quiz_id) is None
            assert session.get(QuizQuestion, question_id) is None
            assert session.get(QuizAttempt, attempt_id) is None
            assert session.get(QuizAnswer, answer_id) is None
            assert session.get(Tag, tag_id) is not None
            assert session.execute(select(func.count()).select_from(Quiz.__table__.metadata.tables["quiz_tags"])).scalar_one() == 0


def test_owner_can_delete_quiz_and_removes_source_object(client_factory):
    storage = _MemoryStorageProvider()
    with client_factory(storage_provider=storage) as client:
        owner = _register(client, "quiz-source-delete-owner@example.com")
        with client.app.state.session_factory() as session:
            other = _second_user(session)
            owner_quiz = _create_quiz(session, owner["id"], "Owner source quiz", datetime.now(timezone.utc))
            foreign_quiz = _create_quiz(session, other.id, "Foreign source quiz", datetime.now(timezone.utc))
            owner_key = storage.new_key(owner["id"], ".md")
            foreign_key = storage.new_key(other.id, ".txt")
            storage.put("quiz-sources", owner_key, b"owner source", "text/markdown")
            storage.put("quiz-sources", foreign_key, b"foreign source", "text/plain")
            owner_quiz.source_storage_key = owner_key
            foreign_quiz.source_storage_key = foreign_key
            session.commit()
            owner_quiz_id, foreign_quiz_id = owner_quiz.id, foreign_quiz.id

        foreign_delete = client.delete(
            f"/api/quizzes/{foreign_quiz_id}",
            headers={"Origin": "http://testserver"},
        )
        assert foreign_delete.status_code == 404
        assert storage.delete_calls == []

        owner_delete = client.delete(
            f"/api/quizzes/{owner_quiz_id}",
            headers={"Origin": "http://testserver"},
        )

    assert owner_delete.status_code == 204
    assert storage.delete_calls == [("quiz-sources", owner_key)]
    assert ("quiz-sources", foreign_key) in storage.objects


def test_delete_quiz_returns_same_not_found_for_foreign_and_unknown_ids(client_factory):
    with client_factory() as client:
        owner = _register(client, "delete-foreign-owner@example.com")
        with client.app.state.session_factory() as session:
            other = _second_user(session)
            foreign_quiz = _create_quiz(session, other.id, "Private quiz", datetime.now(timezone.utc))
            foreign_quiz_id = foreign_quiz.id

        headers = {"Origin": "http://testserver"}
        foreign = client.delete(f"/api/quizzes/{foreign_quiz_id}", headers=headers)
        unknown = client.delete("/api/quizzes/999999", headers=headers)

    assert foreign.status_code == unknown.status_code == 404
    assert foreign.json() == unknown.json()


def test_delete_quiz_requires_same_origin(client_factory):
    with client_factory() as client:
        owner = _register(client, "delete-origin@example.com")
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Protected quiz", datetime.now(timezone.utc))

        response = client.delete(f"/api/quizzes/{quiz.id}")
        listed = client.get("/api/quizzes")

    assert response.status_code == 403
    assert len(listed.json()) == 1


def test_quiz_tag_responses_include_color_for_subject_and_custom_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "quiz-tag-colors@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            child = Tag(
                name="Sets",
                name_key="sets",
                slug=None,
                owner_id=owner["id"],
                parent_id=math.id,
                is_builtin=False,
                color="pink",
            )
            quiz = _create_quiz(
                session,
                owner["id"],
                "Colored tags",
                datetime.now(timezone.utc),
            )
            session.add(child)
            session.flush()
            quiz_id, math_id, child_id = quiz.id, math.id, child.id
            session.commit()

        assignment = client.put(
            f"/api/quizzes/{quiz_id}/tags",
            json={"tag_ids": [math_id, child_id]},
            headers={"Origin": "http://testserver"},
        )
        listing = client.get("/api/quizzes")

    assert assignment.status_code == 200, assignment.text
    assert {tag["id"]: tag["color"] for tag in assignment.json()["tags"]} == {
        math_id: "blue",
        child_id: "pink",
    }
    library_item = next(item for item in listing.json() if item["id"] == quiz_id)
    assert {tag["id"]: tag["color"] for tag in library_item["tags"]} == {
        math_id: "blue",
        child_id: "pink",
    }


def _create_child_tag(session, name: str, owner_id: int, parent_id: int) -> Tag:
    tag = Tag(
        name=name,
        name_key=name.casefold(),
        slug=None,
        owner_id=owner_id,
        parent_id=parent_id,
        is_builtin=False,
    )
    session.add(tag)
    session.flush()
    return tag


def test_quiz_search_matches_title_or_attached_tag_case_insensitively(client_factory):
    with client_factory() as client:
        owner = _register(client, "search-tags@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            linear_algebra = _create_child_tag(session, "Linear Algebra", owner["id"], math.id)
            tagged = _create_quiz(
                session, owner["id"], "Foundations", datetime.now(timezone.utc)
            )
            tagged.tags.append(linear_algebra)
            title_match = _create_quiz(
                session,
                owner["id"],
                "Sets and Functions",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )

        title_results = client.get("/api/quizzes", params={"q": "sEtS"})
        tag_results = client.get("/api/quizzes", params={"q": "linear alg"})

    assert title_results.status_code == 200
    assert [item["id"] for item in title_results.json()] == [title_match.id]
    assert tag_results.status_code == 200
    assert [item["id"] for item in tag_results.json()] == [tagged.id]


def test_quiz_search_casefolds_non_ascii_title_and_tag_text(client_factory):
    with client_factory() as client:
        owner = _register(client, "unicode-search@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            topic = _create_child_tag(session, "Économie", owner["id"], math.id)
            title_match = _create_quiz(
                session,
                owner["id"],
                "Économie des ensembles",
                datetime.now(timezone.utc),
            )
            tag_match = _create_quiz(
                session,
                owner["id"],
                "Study session",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )
            tag_match.tags.append(topic)
            session.commit()

        response = client.get("/api/quizzes", params={"q": "écon"})

    assert response.status_code == 200
    assert {item["id"] for item in response.json()} == {title_match.id, tag_match.id}


def test_subject_filter_includes_child_tags_and_child_filter_is_exact(client_factory):
    with client_factory() as client:
        owner = _register(client, "subject-filter@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            english = session.scalar(select(Tag).where(Tag.slug == "english"))
            assert math is not None and english is not None
            sets = _create_child_tag(session, "Sets", owner["id"], math.id)
            algebra = _create_child_tag(session, "Algebra", owner["id"], math.id)
            subject_quiz = _create_quiz(
                session, owner["id"], "Math subject", datetime.now(timezone.utc)
            )
            subject_quiz.tags.append(math)
            sets_quiz = _create_quiz(
                session,
                owner["id"],
                "Topic: sets",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )
            sets_quiz.tags.append(sets)
            algebra_quiz = _create_quiz(
                session,
                owner["id"],
                "Topic: algebra",
                datetime.now(timezone.utc) - timedelta(seconds=2),
            )
            algebra_quiz.tags.append(algebra)
            english_quiz = _create_quiz(
                session,
                owner["id"],
                "English subject",
                datetime.now(timezone.utc) - timedelta(seconds=3),
            )
            english_quiz.tags.append(english)
            math_id = math.id
            sets_id = sets.id

        subject_results = client.get("/api/quizzes", params={"tag_id": math_id})
        topic_results = client.get("/api/quizzes", params={"tag_id": sets_id})

    assert {item["title"] for item in subject_results.json()} == {
        "Math subject",
        "Topic: sets",
        "Topic: algebra",
    }
    assert [item["title"] for item in topic_results.json()] == ["Topic: sets"]


def test_replace_quiz_tags_accepts_independent_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "flat-assignment@example.com")
        first = client.post(
            "/api/tags", json={"name": "Practice"}, headers={"Origin": "http://testserver"}
        )
        second = client.post(
            "/api/tags", json={"name": "Revision"}, headers={"Origin": "http://testserver"}
        )
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            quiz = _create_quiz(session, owner["id"], "Independent tags", datetime.now(timezone.utc))
            math_id = math.id

        response = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [math_id, first.json()["id"], second.json()["id"]]},
            headers={"Origin": "http://testserver"},
        )

    assert first.status_code == second.status_code == 201
    assert response.status_code == 200, response.text
    assert {tag["id"] for tag in response.json()["tags"]} == {
        math_id, first.json()["id"], second.json()["id"],
    }


def test_replace_tags_removes_only_unselected_tag(client_factory):
    with client_factory() as client:
        owner = _register(client, "flat-replacement@example.com")
        first_tag = client.post(
            "/api/tags", json={"name": "Keep"}, headers={"Origin": "http://testserver"}
        ).json()
        removed_tag = client.post(
            "/api/tags", json={"name": "Remove"}, headers={"Origin": "http://testserver"}
        ).json()
        with client.app.state.session_factory() as session:
            first_quiz = _create_quiz(session, owner["id"], "Target quiz", datetime.now(timezone.utc))
            other_quiz = _create_quiz(
                session, owner["id"], "Unrelated quiz", datetime.now(timezone.utc) - timedelta(seconds=1)
            )
        initial = client.put(
            f"/api/quizzes/{first_quiz.id}/tags",
            json={"tag_ids": [first_tag["id"], removed_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        other_assignment = client.put(
            f"/api/quizzes/{other_quiz.id}/tags",
            json={"tag_ids": [removed_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        replacement = client.put(
            f"/api/quizzes/{first_quiz.id}/tags",
            json={"tag_ids": [first_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        unrelated = other_assignment

    assert initial.status_code == replacement.status_code == 200
    assert [tag["id"] for tag in replacement.json()["tags"]] == [first_tag["id"]]
    assert [tag["id"] for tag in unrelated.json()["tags"]] == [removed_tag["id"]]


def test_quiz_filter_accepts_parentless_owner_tag(client_factory):
    with client_factory() as client:
        owner = _register(client, "flat-filter@example.com")
        custom_tag = client.post(
            "/api/tags", json={"name": "Cell biology"}, headers={"Origin": "http://testserver"}
        ).json()
        with client.app.state.session_factory() as session:
            tagged = _create_quiz(session, owner["id"], "Cell quiz", datetime.now(timezone.utc))
            untagged = _create_quiz(
                session, owner["id"], "Another quiz", datetime.now(timezone.utc) - timedelta(seconds=1)
            )
        assigned = client.put(
            f"/api/quizzes/{tagged.id}/tags",
            json={"tag_ids": [custom_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        response = client.get("/api/quizzes", params={"tag_id": custom_tag["id"]})

    assert assigned.status_code == 200, assigned.text
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()] == [tagged.id]
    assert tagged.id != untagged.id


def test_replace_tags_rejects_foreign_custom_tag(client_factory):
    with client_factory() as client:
        _register(client, "flat-tag-owner@example.com")
        foreign_tag = client.post(
            "/api/tags", json={"name": "Private review"}, headers={"Origin": "http://testserver"}
        ).json()
        other = _register(client, "flat-tag-target@example.com")
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, other["id"], "Target quiz", datetime.now(timezone.utc))

        response = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [foreign_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 404
    assert "Private review" not in response.text


def test_search_and_tag_filter_are_combined_and_remain_owner_scoped(client_factory):
    with client_factory() as client:
        owner = _register(client, "combined-filter@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            biology = session.scalar(select(Tag).where(Tag.slug == "biology"))
            assert math is not None and biology is not None
            own_match = _create_quiz(
                session, owner["id"], "Set theory", datetime.now(timezone.utc)
            )
            own_match.tags.append(math)
            wrong_tag = _create_quiz(
                session,
                owner["id"],
                "Set biology notes",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )
            wrong_tag.tags.append(biology)
            other = _second_user(session)
            other_match = _create_quiz(
                session,
                other.id,
                "Set theory from another account",
                datetime.now(timezone.utc) - timedelta(seconds=2),
            )
            other_match.tags.append(math)
            math_id = math.id

        response = client.get(
            "/api/quizzes",
            params={"q": "set", "tag_id": math_id},
        )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [own_match.id]
    assert own_match.id != wrong_tag.id != other_match.id


def test_library_filter_rejects_unavailable_tag_without_disclosing_it(client_factory):
    with client_factory() as client:
        owner = _register(client, "unavailable-filter@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            foreign_owner = _second_user(session)
            foreign_tag = _create_child_tag(session, "Private topic", foreign_owner.id, math.id)
            foreign_tag_id = foreign_tag.id

        response = client.get("/api/quizzes", params={"tag_id": foreign_tag_id})

    assert response.status_code == 404
    assert "Private topic" not in response.text
    assert owner["id"] != foreign_owner.id


def test_quiz_search_and_tag_filter_do_not_duplicate_paginated_rows(client_factory):
    with client_factory() as client:
        owner = _register(client, "paginated-tags@example.com")
        with client.app.state.session_factory() as session:
            math = session.scalar(select(Tag).where(Tag.slug == "math"))
            assert math is not None
            advanced_math = _create_child_tag(session, "Advanced math", owner["id"], math.id)
            first = _create_quiz(
                session, owner["id"], "First quiz", datetime.now(timezone.utc)
            )
            first.tags.extend([math, advanced_math])
            second = _create_quiz(
                session,
                owner["id"],
                "Second quiz",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )
            second.tags.append(advanced_math)
            _create_quiz(
                session,
                owner["id"],
                "Unrelated language quiz",
                datetime.now(timezone.utc) - timedelta(seconds=2),
            )

        first_page = client.get(
            "/api/quizzes", params={"q": "math", "limit": 1, "offset": 0}
        )
        second_page = client.get(
            "/api/quizzes", params={"q": "math", "limit": 1, "offset": 1}
        )

    assert first_page.status_code == second_page.status_code == 200
    assert len(first_page.json()) == len(second_page.json()) == 1
    assert first_page.json()[0]["id"] != second_page.json()[0]["id"]
    assert {first_page.json()[0]["id"], second_page.json()[0]["id"]} == {
        first.id,
        second.id,
    }


def test_existing_untagged_quizzes_remain_listable_and_searchable(client_factory):
    with client_factory() as client:
        owner = _register(client, "untagged-search@example.com")
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(
                session, owner["id"], "Legacy untagged quiz", datetime.now(timezone.utc)
            )
            _create_quiz(
                session,
                owner["id"],
                "Different quiz",
                datetime.now(timezone.utc) - timedelta(seconds=1),
            )

        all_quizzes = client.get("/api/quizzes")
        title_search = client.get("/api/quizzes", params={"q": "legacy untagged"})

    assert all_quizzes.status_code == 200
    untagged_item = next(item for item in all_quizzes.json() if item["id"] == quiz.id)
    assert untagged_item["tags"] == []
    assert title_search.status_code == 200
    assert [item["id"] for item in title_search.json()] == [quiz.id]


def test_owner_can_rename_quiz_and_title_is_trimmed(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Original title", datetime.now(timezone.utc))

        response = client.patch(
            f"/api/quizzes/{quiz.id}",
            json={"title": "  Sets: an introduction  "},
            headers={"Origin": "http://testserver"},
        )

        with client.app.state.session_factory() as session:
            stored = session.get(Quiz, quiz.id)

    assert response.status_code == 200
    assert response.json()["title"] == "Sets: an introduction"
    assert response.json()["attempt_count"] == 0
    assert stored.title == "Sets: an introduction"


@pytest.mark.parametrize("title", ["", "   ", "\n\t", "\x00\x01", "x" * 161])
def test_rename_rejects_blank_control_only_and_overlong_title(client_factory, title):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Original title", datetime.now(timezone.utc))

        response = client.patch(
            f"/api/quizzes/{quiz.id}",
            json={"title": title},
            headers={"Origin": "http://testserver"},
        )

        with client.app.state.session_factory() as session:
            stored = session.get(Quiz, quiz.id)

    assert response.status_code == 422
    assert stored.title == "Original title"


def test_rename_other_users_quiz_returns_not_found(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _second_user(session)
            quiz = _create_quiz(session, other.id, "Private title", datetime.now(timezone.utc))

        response = client.patch(
            f"/api/quizzes/{quiz.id}",
            json={"title": "Attempted rename"},
            headers={"Origin": "http://testserver"},
        )

        with client.app.state.session_factory() as session:
            stored = session.get(Quiz, quiz.id)

    assert response.status_code == 404
    assert "Private title" not in response.text
    assert stored.title == "Private title"
    assert owner["id"] != other.id


def test_read_returns_owner_quiz_without_answer_key(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            quiz = _create_quiz(session, owner["id"], "Owner quiz", datetime.now(timezone.utc))

        response = client.get(f"/api/quizzes/{quiz.id}")

    assert response.status_code == 200
    assert response.json()["source_filename"] == "lesson.md"
    assert response.json()["questions"][0]["prompt"] == "Choose an answer."
    assert "correct_answer" not in response.text
    assert "explanation" not in response.text
    assert "evidence" not in response.text


def test_read_other_users_quiz_is_not_found(client_factory):
    with client_factory() as client:
        owner = _register(client)
        with client.app.state.session_factory() as session:
            other = _second_user(session)
            quiz = _create_quiz(session, other.id, "Private quiz", datetime.now(timezone.utc))

        response = client.get(f"/api/quizzes/{quiz.id}")

    assert response.status_code == 404
    assert "Private quiz" not in response.text
    assert response.json()["detail"]
    assert owner["id"] != other.id


def test_read_unknown_quiz_is_not_found(client_factory):
    with client_factory() as client:
        _register(client)
        response = client.get("/api/quizzes/9999")

    assert response.status_code == 404
    assert response.json()["detail"]
