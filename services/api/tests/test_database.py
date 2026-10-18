from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, select, text


def test_users_have_unique_email_and_sessions_reference_a_user(tmp_path) -> None:
    database = importlib.import_module("app.database")
    models = importlib.import_module("app.models")
    integrity_error = importlib.import_module("sqlalchemy.exc").IntegrityError
    database_url = f"sqlite:///{Path(tmp_path / 'accounts.db').as_posix()}"
    session_factory = database.create_session_factory(database_url)
    database.Base.metadata.create_all(session_factory.kw["bind"])
    token = importlib.import_module("app.security").new_session_token()
    token_digest = importlib.import_module("app.security").hash_session_token(token)

    with session_factory() as session:
        user = models.User(email="learner@example.test", display_name="Learner", password_hash="$argon2id$test")
        session.add(user)
        session.commit()
        user_id = user.id

        session.add(models.User(email="learner@example.test", display_name="Duplicate", password_hash="$argon2id$test"))
        with pytest.raises(integrity_error):
            session.commit()
        session.rollback()

        session.add(models.AuthSession(
            user_id=user_id,
            token_hash=token_digest,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        ))
        session.commit()
        assert session.query(models.AuthSession).one().token_hash == token_digest
        assert token not in session.query(models.AuthSession).one().token_hash

    with session_factory() as session:
        session.add(models.AuthSession(
            user_id=9999,
            token_hash="b" * 64,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        ))
        with pytest.raises(integrity_error):
            session.commit()


def test_migrate_quiz_source_storage_key_is_idempotent_and_preserves_rows(tmp_path) -> None:
    database = importlib.import_module("app.database")
    models = importlib.import_module("app.models")
    database_url = f"sqlite:///{Path(tmp_path / 'legacy-quiz-source.db').as_posix()}"
    session_factory = database.create_session_factory(database_url)
    engine = session_factory.kw["bind"]
    database.Base.metadata.create_all(bind=engine)

    with session_factory() as session:
        user = models.User(
            email="legacy-quiz-source@example.test",
            display_name="Legacy Quiz",
            password_hash="$argon2id$test",
        )
        session.add(user)
        session.flush()
        quiz = models.Quiz(
            user_id=user.id,
            title="Retained quiz",
            source_filename="lesson.txt",
            source_type="txt",
            language="en",
            difficulty="basic",
            question_count=0,
            prompt_version="quiz_generation_v1",
        )
        session.add(quiz)
        session.commit()
        quiz_id = quiz.id

    if "source_storage_key" in {column["name"] for column in inspect(engine).get_columns("quizzes")}:
        with engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE quizzes DROP COLUMN source_storage_key")

    database.migrate_quiz_source_storage_key(engine)
    database.migrate_quiz_source_storage_key(engine)

    columns = {column["name"]: column for column in inspect(engine).get_columns("quizzes")}
    with session_factory() as session:
        preserved_quiz = session.get(models.Quiz, quiz_id)

    assert "source_storage_key" in columns
    assert columns["source_storage_key"]["nullable"] is True
    assert preserved_quiz is not None
    assert preserved_quiz.title == "Retained quiz"
    assert preserved_quiz.source_filename == "lesson.txt"
    assert preserved_quiz.source_storage_key is None
    engine.dispose()


@pytest.mark.parametrize(
    "database_url",
    [
        "postgres://learner:secret@localhost:5432/synapsesync",
        "postgresql://learner:secret@localhost:5432/synapsesync?sslmode=require",
    ],
)
def test_postgresql_database_urls_use_psycopg_driver(database_url: str) -> None:
    database = importlib.import_module("app.database")

    session_factory = database.create_session_factory(database_url)
    engine = session_factory.kw["bind"]
    try:
        assert engine.url.drivername == "postgresql+psycopg"
    finally:
        engine.dispose()


def test_startup_migrates_existing_sqlite_profiles_without_losing_user_data(tmp_path) -> None:
    from fastapi.testclient import TestClient

    database_url = f"sqlite:///{Path(tmp_path / 'legacy.db').as_posix()}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users ("
            "id INTEGER PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, "
            "display_name VARCHAR(80) NOT NULL, password_hash VARCHAR(255) NOT NULL, "
            "bio TEXT, avatar_key VARCHAR(100), created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"
        ))
        connection.execute(text(
            "INSERT INTO users (id, email, display_name, password_hash, bio, avatar_key, created_at, updated_at) "
            "VALUES (1, 'legacy@example.com', 'Legacy Learner', 'hash', 'Keep this bio', NULL, "
            "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"
        ))
    engine.dispose()

    main = importlib.import_module("app.main")
    with TestClient(main.create_app(database_url=database_url, image_storage_dir=tmp_path / "images")) as client:
        user = client.app.state.session_factory()
        try:
            legacy_user = user.get(importlib.import_module("app.models").User, 1)
            assert legacy_user.display_name == "Legacy Learner"
            assert legacy_user.bio == "Keep this bio"
            assert legacy_user.learning_goal is None
            assert legacy_user.learning_topics == []
        finally:
            user.close()


def test_startup_migrates_existing_sqlite_tag_colors_idempotently(tmp_path) -> None:
    from fastapi.testclient import TestClient

    from app.database import Base, create_session_factory
    from app.models import Quiz, Tag, User
    from app.models.tag import quiz_tags

    database_url = f"sqlite:///{Path(tmp_path / 'legacy-tags.db').as_posix()}"
    session_factory = create_session_factory(database_url)
    engine = session_factory.kw["bind"]
    Base.metadata.create_all(bind=engine)

    with session_factory() as session:
        owner = User(
            email="legacy-tags@example.test",
            display_name="Legacy Tags",
            password_hash="$argon2id$test",
        )
        session.add(owner)
        session.flush()
        subject = Tag(
            name="คณิตศาสตร์",
            name_key="คณิตศาสตร์",
            slug="math",
            owner_id=None,
            parent_id=None,
            is_builtin=True,
            color="pink",
        )
        session.add(subject)
        session.flush()
        child = Tag(
            name="เซต",
            name_key="เซต",
            slug=None,
            owner_id=owner.id,
            parent_id=subject.id,
            is_builtin=False,
            color="orange",
        )
        quiz = Quiz(
            user_id=owner.id,
            title="Legacy quiz",
            source_filename="sets.md",
            source_type="md",
            language="th",
            difficulty="basic",
            question_count=1,
            prompt_version="quiz_generation_v1",
        )
        session.add_all([child, quiz])
        session.flush()
        quiz_id, subject_id, child_id = quiz.id, subject.id, child.id
        session.execute(quiz_tags.insert().values(quiz_id=quiz_id, tag_id=child_id))
        session.commit()

    # Simulate the pre-color schema while retaining the legacy tag and association rows.
    with engine.begin() as connection:
        connection.exec_driver_sql("ALTER TABLE tags DROP COLUMN color")
    engine.dispose()

    main = importlib.import_module("app.main")
    for _ in range(2):
        app = main.create_app(database_url=database_url, image_storage_dir=tmp_path / "images")
        with TestClient(app):
            pass

    upgraded_factory = create_session_factory(database_url)
    upgraded_engine = upgraded_factory.kw["bind"]
    columns = {column["name"] for column in inspect(upgraded_engine).get_columns("tags")}
    assert "color" in columns
    with upgraded_factory() as session:
        stored_subject = session.get(Tag, subject_id)
        stored_child = session.get(Tag, child_id)
        stored_quiz = session.get(Quiz, quiz_id)
        stored_associations = session.execute(
            quiz_tags.select().where(quiz_tags.c.quiz_id == quiz_id)
        ).mappings().all()

    assert stored_subject is not None and stored_subject.color == "blue"
    assert stored_child is not None and stored_child.color == "violet"
    assert stored_quiz is not None and stored_quiz.title == "Legacy quiz"
    assert [row["tag_id"] for row in stored_associations] == [child_id]
    upgraded_engine.dispose()


def test_migrate_flat_tag_uniqueness_is_idempotent_and_preserves_children(tmp_path) -> None:
    from app.database import Base, migrate_flat_tag_uniqueness
    from app.models import Tag, User

    database_url = f"sqlite:///{Path(tmp_path / 'flat-tags.db').as_posix()}"
    session_factory = importlib.import_module("app.database").create_session_factory(database_url)
    engine = session_factory.kw["bind"]
    Base.metadata.create_all(bind=engine)
    with session_factory() as session:
        owner = User(
            email="flat-tags@example.test",
            display_name="Flat Tags",
            password_hash="$argon2id$test",
        )
        math = Tag(
            name="คณิตศาสตร์",
            name_key="คณิตศาสตร์",
            slug="math",
            owner_id=None,
            parent_id=None,
            is_builtin=True,
            color="blue",
        )
        english = Tag(
            name="ภาษาอังกฤษ",
            name_key="ภาษาอังกฤษ",
            slug="english",
            owner_id=None,
            parent_id=None,
            is_builtin=True,
            color="violet",
        )
        session.add_all([owner, math, english])
        session.flush()
        legacy_math = Tag(
            name="Legacy",
            name_key="legacy",
            slug=None,
            owner_id=owner.id,
            parent_id=math.id,
            is_builtin=False,
        )
        legacy_english = Tag(
            name="Legacy",
            name_key="legacy",
            slug=None,
            owner_id=owner.id,
            parent_id=english.id,
            is_builtin=False,
        )
        flat = Tag(
            name="Flat tag",
            name_key="flat tag",
            slug=None,
            owner_id=owner.id,
            parent_id=None,
            is_builtin=False,
        )
        session.add_all([legacy_math, legacy_english, flat])
        session.commit()
        expected_ids = {legacy_math.id, legacy_english.id, flat.id}

    migrate_flat_tag_uniqueness(engine)
    migrate_flat_tag_uniqueness(engine)

    indexes = {index["name"]: index for index in inspect(engine).get_indexes("tags")}
    assert "uq_tag_owner_flat_name_key" in indexes
    assert bool(indexes["uq_tag_owner_flat_name_key"]["unique"]) is True
    with session_factory() as session:
        stored_tags = session.scalars(select(Tag).where(Tag.id.in_(expected_ids))).all()
        assert {tag.id for tag in stored_tags} == expected_ids
        children = [tag for tag in stored_tags if tag.parent_id is not None]
        assert len(children) == 2
        assert children[0].parent_id != children[1].parent_id
    engine.dispose()


def test_migrate_tutor_message_selection_adds_message_metadata_without_losing_rows(tmp_path) -> None:
    database = importlib.import_module("app.database")
    database_url = f"sqlite:///{Path(tmp_path / 'legacy-tutor.db').as_posix()}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE tutor_messages ("
            "id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, "
            "role VARCHAR(16) NOT NULL, content TEXT NOT NULL)"
        ))
        connection.execute(text(
            "INSERT INTO tutor_messages (id, conversation_id, role, content) "
            "VALUES (7, 3, 'user', 'Keep this question')"
        ))

    database.migrate_tutor_message_selection(engine)
    database.migrate_tutor_message_selection(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("tutor_messages")}
    with engine.connect() as connection:
        row = connection.execute(text(
            "SELECT id, conversation_id, role, content, provider_id, model_id, response_language "
            "FROM tutor_messages WHERE id=7"
        )).one()

    assert {"provider_id", "model_id", "response_language"}.issubset(columns)
    assert tuple(row) == (7, 3, "user", "Keep this question", None, None, "th")
    engine.dispose()


def test_migrate_deadline_tag_id_preserves_unmatched_subject(tmp_path) -> None:
    from app.database import migrate_deadline_tag_id

    engine = create_engine(f"sqlite:///{Path(tmp_path / 'legacy-deadlines.db').as_posix()}")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE tags (id INTEGER PRIMARY KEY, name VARCHAR(40) NOT NULL, "
            "name_key VARCHAR(80) NOT NULL, owner_id INTEGER, parent_id INTEGER, "
            "is_builtin BOOLEAN NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO tags (id, name, name_key, owner_id, parent_id, is_builtin) "
            "VALUES (4, 'คณิตศาสตร์', 'คณิตศาสตร์', NULL, NULL, 1)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE deadlines (id INTEGER PRIMARY KEY, subject VARCHAR(32) NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO deadlines (id, subject) VALUES (1, 'คณิตศาสตร์'), (2, 'Legacy subject')"
        )

    migrate_deadline_tag_id(engine)
    migrate_deadline_tag_id(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("deadlines")}
    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT id, subject, tag_id FROM deadlines ORDER BY id")
        ).all()

    assert "tag_id" in columns
    assert [tuple(row) for row in rows] == [
        (1, "คณิตศาสตร์", 4),
        (2, "Legacy subject", None),
    ]
    engine.dispose()


def test_migrate_deadline_status_maps_legacy_completion_and_is_idempotent(tmp_path) -> None:
    from app.database import migrate_deadline_status

    engine = create_engine(f"sqlite:///{Path(tmp_path / 'legacy-deadline-status.db').as_posix()}")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE deadlines (id INTEGER PRIMARY KEY, is_completed BOOLEAN NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO deadlines (id, is_completed) VALUES (1, 0), (2, 1)"
        )

    migrate_deadline_status(engine)
    with engine.connect() as connection:
        initial_rows = connection.exec_driver_sql(
            "SELECT id, is_completed, status FROM deadlines ORDER BY id"
        ).all()
    assert initial_rows == [(1, 0, "not_started"), (2, 1, "completed")]
    with engine.begin() as connection:
        connection.exec_driver_sql("UPDATE deadlines SET status='in_progress' WHERE id=1")
    migrate_deadline_status(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("deadlines")}
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(
            "SELECT id, is_completed, status FROM deadlines ORDER BY id"
        ).all()

    assert "status" in columns
    assert rows == [(1, 0, "in_progress"), (2, 1, "completed")]
    engine.dispose()
