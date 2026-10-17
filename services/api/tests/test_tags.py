from __future__ import annotations

import importlib

import pytest
from sqlalchemy import insert, inspect, select
from sqlalchemy.exc import IntegrityError
from starlette.testclient import TestClient

from app.database import Base, create_session_factory
from app.models import AuthSession, Quiz, Tag, User
from app.models.tag import quiz_tags


EXPECTED_SUBJECTS = {
    "math": "คณิตศาสตร์",
    "english": "ภาษาอังกฤษ",
    "thai": "ภาษาไทย",
    "physics": "ฟิสิกส์",
    "chemistry": "เคมี",
    "biology": "ชีววิทยา",
    "social-studies": "สังคมศึกษา",
    "other": "วิชาอื่น",
}


def _register(client, email: str) -> dict[str, object]:
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Tag Learner", "email": email, "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201
    return response.json()


def _subject_id(client, slug: str) -> int:
    with client.app.state.session_factory() as session:
        subject = session.scalar(
            select(Tag).where(Tag.slug == slug, Tag.is_builtin.is_(True))
        )
        assert subject is not None
        return subject.id


def _new_user(email: str = "tags@example.com") -> User:
    return User(
        email=email,
        display_name="Tag Learner",
        password_hash="$argon2id$test",
    )


def _new_quiz(user_id: int) -> Quiz:
    return Quiz(
        user_id=user_id,
        title="Existing quiz",
        source_filename="lesson.md",
        source_type="md",
        language="th",
        difficulty="basic",
        question_count=1,
        prompt_version="quiz_generation_v1",
    )


def _store_quiz(client, user_id: int, title: str = "Existing quiz") -> Quiz:
    with client.app.state.session_factory() as session:
        quiz = _new_quiz(user_id)
        quiz.title = title
        session.add(quiz)
        session.commit()
        session.refresh(quiz)
        return quiz


def _create_topic(client, name: str, subject_slug: str = "math") -> dict[str, object]:
    """Create a legacy child tag for backwards-compatibility assignment tests."""
    from app.security import hash_session_token

    raw_token = client.cookies.get("synapsesync_session")
    assert raw_token
    with client.app.state.session_factory() as session:
        stored_session = session.scalar(
            select(AuthSession).where(AuthSession.token_hash == hash_session_token(raw_token))
        )
        parent = session.scalar(select(Tag).where(Tag.slug == subject_slug))
        assert stored_session is not None and parent is not None
        tag = Tag(
            name=name,
            name_key=name.casefold(),
            slug=None,
            owner_id=stored_session.user_id,
            parent_id=parent.id,
            is_builtin=False,
            color="violet",
        )
        session.add(tag)
        session.commit()
        session.refresh(tag)
        return {
            "id": tag.id,
            "name": tag.name,
            "parent_id": tag.parent_id,
            "is_builtin": tag.is_builtin,
            "color": tag.color,
        }


def test_seed_subject_tags_is_idempotent_and_preserves_existing_quiz_data():
    models = importlib.import_module("app.models")
    assert hasattr(models, "Tag"), "Tag must be registered in the shared model package"

    from app.tags.catalog import seed_builtin_subjects

    factory = create_session_factory("sqlite://")
    engine = factory.kw["bind"]
    Base.metadata.create_all(bind=engine)
    with factory() as session:
        owner = _new_user()
        session.add(owner)
        session.flush()
        quiz = _new_quiz(owner.id)
        session.add(quiz)
        session.commit()
        quiz_id = quiz.id

    seed_builtin_subjects(factory)
    seed_builtin_subjects(factory)

    with factory() as session:
        roots = session.scalars(
            select(models.Tag).where(models.Tag.is_builtin.is_(True)).order_by(models.Tag.slug)
        ).all()
        assert {tag.slug: tag.name for tag in roots} == EXPECTED_SUBJECTS
        stored_quiz = session.get(Quiz, quiz_id)
        assert stored_quiz is not None
        assert stored_quiz.title == "Existing quiz"
    engine.dispose()


def test_builtin_seed_restores_fixed_colors_without_mutating_custom_tag_color():
    from app.tags.catalog import BUILTIN_SUBJECT_COLORS, seed_builtin_subjects

    factory = create_session_factory("sqlite://")
    engine = factory.kw["bind"]
    Base.metadata.create_all(bind=engine)
    seed_builtin_subjects(factory)

    with factory() as session:
        math = session.scalar(select(Tag).where(Tag.slug == "math"))
        assert math is not None
        owner = _new_user("tag-color-owner@example.test")
        session.add(owner)
        session.flush()
        custom = Tag(
            name="Sets",
            name_key="sets",
            slug=None,
            owner_id=owner.id,
            parent_id=math.id,
            is_builtin=False,
            color="pink",
        )
        math.color = "orange"
        session.add(custom)
        session.commit()
        custom_id = custom.id

    seed_builtin_subjects(factory)

    with factory() as session:
        subjects = session.scalars(select(Tag).where(Tag.is_builtin.is_(True))).all()
        custom = session.get(Tag, custom_id)

    assert {subject.slug: subject.color for subject in subjects} == BUILTIN_SUBJECT_COLORS
    assert custom is not None and custom.color == "pink"
    engine.dispose()


def test_quiz_tag_association_rejects_duplicate_pairs():
    table = Base.metadata.tables.get("quiz_tags")
    assert table is not None, "quiz_tags must be part of SQLAlchemy metadata"

    models = importlib.import_module("app.models")
    factory = create_session_factory("sqlite://")
    engine = factory.kw["bind"]
    Base.metadata.create_all(bind=engine)
    with factory() as session:
        owner = _new_user()
        session.add(owner)
        session.flush()
        quiz = _new_quiz(owner.id)
        tag = models.Tag(
            name="คณิตศาสตร์",
            slug="math",
            owner_id=None,
            parent_id=None,
            is_builtin=True,
            name_key="คณิตศาสตร์",
        )
        session.add_all([quiz, tag])
        session.commit()

        with pytest.raises(IntegrityError):
            session.execute(
                insert(table),
                [
                    {"quiz_id": quiz.id, "tag_id": tag.id},
                    {"quiz_id": quiz.id, "tag_id": tag.id},
                ],
            )
            session.commit()
        session.rollback()
    engine.dispose()


def test_app_startup_creates_tag_tables_additively(tmp_path):
    main = importlib.import_module("app.main")
    database_url = f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}"
    image_storage_dir = tmp_path / "profile-images"
    app = main.create_app(database_url=database_url, image_storage_dir=image_storage_dir)

    with TestClient(app) as client:
        with client.app.state.session_factory() as session:
            owner = _new_user("legacy@example.com")
            session.add(owner)
            session.flush()
            quiz = _new_quiz(owner.id)
            session.add(quiz)
            session.commit()
            quiz_id = quiz.id
        engine = client.app.state.session_factory.kw["bind"]

    with engine.begin() as connection:
        tables = set(inspect(engine).get_table_names())
        if "quiz_tags" in tables:
            connection.exec_driver_sql("DROP TABLE quiz_tags")
        if "tags" in tables:
            connection.exec_driver_sql("DROP TABLE tags")
    engine.dispose()

    upgraded_app = main.create_app(database_url=database_url, image_storage_dir=image_storage_dir)
    with TestClient(upgraded_app) as upgraded_client:
        upgraded_engine = upgraded_client.app.state.session_factory.kw["bind"]
        table_names = set(inspect(upgraded_engine).get_table_names())
        assert {"tags", "quiz_tags"}.issubset(table_names)
        with upgraded_client.app.state.session_factory() as session:
            stored_quiz = session.get(Quiz, quiz_id)
            assert stored_quiz is not None
            assert stored_quiz.title == "Existing quiz"


def test_list_tags_returns_builtin_then_only_owner_flat_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "first-tag-owner@example.com")
        math_id = _subject_id(client, "math")
        legacy_child = _create_topic(client, "Legacy child")
        quiz = _store_quiz(client, owner["id"])
        with client.app.state.session_factory() as session:
            session.execute(
                insert(quiz_tags).values(quiz_id=quiz.id, tag_id=legacy_child["id"])
            )
            session.commit()
        created = client.post(
            "/api/tags",
            json={"name": "Sets", "color": "cyan"},
            headers={"Origin": "http://testserver"},
        )
        assert created.status_code == 201
        response = client.get("/api/tags")
        assert response.status_code == 200
        tags = response.json()["tags"]
        builtin_tags = [tag for tag in tags if tag["is_builtin"]]
        custom_tags = [tag for tag in tags if not tag["is_builtin"]]
        assert {tag["name"] for tag in builtin_tags} == set(EXPECTED_SUBJECTS.values())
        assert [tag["id"] for tag in builtin_tags] == sorted(tag["id"] for tag in builtin_tags)
        assert [tag["id"] for tag in custom_tags] == sorted(tag["id"] for tag in custom_tags)
        assert [tag["name"] for tag in custom_tags] == ["Legacy child", "Sets"]
        assert custom_tags[0]["parent_id"] == math_id
        assert custom_tags[1]["parent_id"] is None
        assert all(set(tag) == {"id", "name", "color", "is_builtin", "parent_id"} for tag in tags)
        assert legacy_child["id"] == custom_tags[0]["id"]
        with client.app.state.session_factory() as session:
            stored_child = session.get(Tag, legacy_child["id"])
            association = session.execute(
                select(quiz_tags.c.tag_id).where(quiz_tags.c.quiz_id == quiz.id)
            ).scalar_one()
        assert stored_child is not None and stored_child.parent_id == math_id
        assert association == legacy_child["id"]

        _register(client, "second-tag-owner@example.com")
        other_catalog = client.get("/api/tags")
        assert other_catalog.status_code == 200
        assert all(tag["is_builtin"] for tag in other_catalog.json()["tags"])


def test_builtin_subject_catalog_exposes_fixed_palette_colors(client_factory):
    with client_factory() as client:
        _register(client, "tag-colors@example.com")
        response = client.get("/api/tags")

    assert response.status_code == 200
    assert {tag["name"]: tag["color"] for tag in response.json()["tags"]} == {
        "คณิตศาสตร์": "blue",
        "ภาษาอังกฤษ": "violet",
        "ภาษาไทย": "rose",
        "ฟิสิกส์": "cyan",
        "เคมี": "green",
        "ชีววิทยา": "lime",
        "สังคมศึกษา": "amber",
        "วิชาอื่น": "teal",
    }


def test_create_tag_is_parentless_and_keeps_selected_color(client_factory):
    with client_factory() as client:
        _register(client, "trim-tag@example.com")
        response = client.post(
            "/api/tags",
            json={"name": "  เซต  ", "color": "pink"},
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 201
    assert response.json()["name"] == "เซต"
    assert response.json()["parent_id"] is None
    assert response.json()["is_builtin"] is False
    assert response.json()["color"] == "pink"


def test_create_topic_tag_persists_requested_color(client_factory):
    with client_factory() as client:
        _register(client, "colored-topic@example.com")
        response = client.post(
            "/api/tags",
            json={"name": "Algebra", "color": "pink"},
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 201
    assert response.json()["color"] == "pink"


def test_create_topic_tag_rejects_unknown_color_key():
    from pydantic import ValidationError

    from app.schemas.tag import TagCreate

    with pytest.raises(ValidationError) as error:
        TagCreate.model_validate({"name": "Unsafe", "color": "#ff00ff"})

    color_errors = [item for item in error.value.errors() if item["loc"] == ("color",)]
    assert color_errors
    assert color_errors[0]["type"] == "literal_error"


def test_create_flat_tag_rejects_casefold_duplicate_for_owner(client_factory):
    with client_factory() as client:
        _register(client, "unique-tag-owner@example.com")
        first = client.post(
            "/api/tags",
            json={"name": "Grammar", "color": "rose"},
            headers={"Origin": "http://testserver"},
        )
        duplicate = client.post(
            "/api/tags",
            json={"name": "grammar", "color": "blue"},
            headers={"Origin": "http://testserver"},
        )

    assert first.status_code == 201
    assert duplicate.status_code == 409


def test_create_flat_tag_allows_same_name_for_other_owner(client_factory):
    with client_factory() as client:
        _register(client, "unique-tag-owner@example.com")
        first = client.post(
            "/api/tags",
            json={"name": "Grammar"},
            headers={"Origin": "http://testserver"},
        )
        _register(client, "other-unique-tag-owner@example.com")
        different_owner = client.post(
            "/api/tags",
            json={"name": "grammar"},
            headers={"Origin": "http://testserver"},
        )

    assert first.status_code == 201
    assert different_owner.status_code == 201


def test_create_tag_rejects_invalid_names_and_legacy_parent_input(client_factory):
    with client_factory() as client:
        _register(client, "invalid-tag@example.com")
        nested = client.post(
            "/api/tags",
            json={"name": "Nested", "parent_tag_id": 99999},
            headers={"Origin": "http://testserver"},
        )
        blank_name = client.post(
            "/api/tags",
            json={"name": "   "},
            headers={"Origin": "http://testserver"},
        )
        control_name = client.post(
            "/api/tags",
            json={"name": "bad\u0000name"},
            headers={"Origin": "http://testserver"},
        )
        long_name = client.post(
            "/api/tags",
            json={"name": "x" * 41},
            headers={"Origin": "http://testserver"},
        )

    assert [nested.status_code, blank_name.status_code, control_name.status_code, long_name.status_code] == [
        422,
        422,
        422,
        422,
    ]


def test_tag_endpoints_require_authentication_and_same_origin_for_mutation(client_factory):
    with client_factory() as client:
        unauthenticated_catalog = client.get("/api/tags")
        unauthenticated_create = client.post(
            "/api/tags",
            json={"name": "Sets"},
            headers={"Origin": "http://testserver"},
        )
        _register(client, "csrf-tag@example.com")
        math_id = _subject_id(client, "math")
        missing_origin = client.post(
            "/api/tags",
            json={"name": "Sets"},
        )
        quiz = _store_quiz(client, _register(client, "assignment-origin@example.com")["id"])
        missing_assignment_origin = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [math_id]},
        )

    assert unauthenticated_catalog.status_code == 401
    assert unauthenticated_create.status_code == 401
    assert missing_origin.status_code == 403
    assert missing_assignment_origin.status_code == 403


def test_owner_can_assign_multiple_tags_and_remove_all_tags(client_factory):
    with client_factory() as client:
        owner = _register(client, "assign-tags@example.com")
        quiz = _store_quiz(client, owner["id"])
        math_id = _subject_id(client, "math")
        english_id = _subject_id(client, "english")
        sets_tag = _create_topic(client, "Sets")
        grammar_tag = _create_topic(client, "Grammar", "english")

        assign = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [math_id, sets_tag["id"], grammar_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        remove_all = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": []},
            headers={"Origin": "http://testserver"},
        )

    assert assign.status_code == 200
    assert {tag["id"] for tag in assign.json()["tags"]} == {
        math_id,
        sets_tag["id"],
        grammar_tag["id"],
    }
    assert {tag["name"] for tag in assign.json()["tags"]} == {
        "คณิตศาสตร์",
        "Sets",
        "Grammar",
    }
    assert {tag["parent_id"] for tag in assign.json()["tags"]} == {
        None,
        sets_tag["parent_id"],
        grammar_tag["parent_id"],
    }
    assert remove_all.status_code == 200
    assert remove_all.json()["tags"] == []


def test_replace_quiz_tags_rejects_unavailable_or_duplicate_ids_atomically(client_factory):
    with client_factory() as client:
        owner = _register(client, "atomic-tags@example.com")
        quiz = _store_quiz(client, owner["id"])
        math_id = _subject_id(client, "math")
        own_tag = _create_topic(client, "Own tag")
        initial = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [own_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )

        duplicate = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [own_tag["id"], own_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            foreign_owner = _new_user("foreign-tag-owner@example.com")
            session.add(foreign_owner)
            session.flush()
            foreign_tag = Tag(
                name="Foreign",
                name_key="foreign",
                slug=None,
                owner_id=foreign_owner.id,
                parent_id=math_id,
                is_builtin=False,
            )
            session.add(foreign_tag)
            session.commit()
            foreign_tag_id = foreign_tag.id

        unavailable = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [foreign_tag_id]},
            headers={"Origin": "http://testserver"},
        )
        unknown = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [99999]},
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            saved_tag_ids = set(
                session.scalars(
                    select(quiz_tags.c.tag_id).where(quiz_tags.c.quiz_id == quiz.id)
                ).all()
            )

    assert initial.status_code == 200
    assert duplicate.status_code == 422
    assert unavailable.status_code == 404
    assert unknown.status_code == 404
    assert saved_tag_ids == {own_tag["id"]}


def test_replace_tags_on_another_users_quiz_returns_not_found(client_factory):
    with client_factory() as client:
        owner = _register(client, "quiz-tag-owner@example.com")
        math_id = _subject_id(client, "math")
        own_tag = _create_topic(client, "Owner topic")
        own_quiz = _store_quiz(client, owner["id"], "Owner quiz")
        owner_assignment = client.put(
            f"/api/quizzes/{own_quiz.id}/tags",
            json={"tag_ids": [math_id, own_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            other = _new_user("private-quiz-owner@example.com")
            session.add(other)
            session.flush()
            quiz = _new_quiz(other.id)
            session.add(quiz)
            session.commit()
            quiz_id = quiz.id

        response = client.put(
            f"/api/quizzes/{quiz_id}/tags",
            json={"tag_ids": [math_id, own_tag["id"]]},
            headers={"Origin": "http://testserver"},
        )

    assert owner_assignment.status_code == 200
    assert response.status_code == 404
    assert "private-quiz-owner" not in response.text
    assert owner["id"] != other.id


def test_deleting_quiz_removes_only_tag_associations(client_factory):
    with client_factory() as client:
        owner = _register(client, "delete-quiz-tags@example.com")
        math_id = _subject_id(client, "math")
        topic = _create_topic(client, "Deletion stays reusable")
        quiz = _store_quiz(client, owner["id"])
        assigned = client.put(
            f"/api/quizzes/{quiz.id}/tags",
            json={"tag_ids": [math_id, topic["id"]]},
            headers={"Origin": "http://testserver"},
        )
        assert assigned.status_code == 200

        with client.app.state.session_factory() as session:
            stored_quiz = session.get(Quiz, quiz.id)
            assert stored_quiz is not None
            session.delete(stored_quiz)
            session.commit()
            remaining_associations = session.execute(
                select(quiz_tags.c.quiz_id).where(quiz_tags.c.quiz_id == quiz.id)
            ).all()
            remaining_tags = set(
                session.scalars(
                    select(Tag.id).where(Tag.id.in_([math_id, topic["id"]]))
                ).all()
            )

    assert remaining_associations == []
    assert remaining_tags == {math_id, topic["id"]}
