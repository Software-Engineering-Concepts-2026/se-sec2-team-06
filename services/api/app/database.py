from __future__ import annotations

from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def migrate_quiz_source_storage_key(engine) -> None:
    """Add the nullable source-object key to existing quiz tables."""
    inspector = inspect(engine)
    if "quizzes" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("quizzes")}
    if "source_storage_key" in existing_columns:
        return

    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE quizzes ADD COLUMN source_storage_key VARCHAR(128)"
        )


def migrate_profile_fields(engine) -> None:
    """Add learning-profile columns to existing local SQLite databases."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "learning_goal" not in existing_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN learning_goal VARCHAR(200)")
        if "learning_topics" not in existing_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN learning_topics JSON NOT NULL DEFAULT '[]'"
            )


def migrate_tag_colors(engine) -> None:
    """Add the default palette key to tags in existing local SQLite databases."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "tags" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("tags")}
    if "color" in existing_columns:
        return

    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE tags ADD COLUMN color VARCHAR(16) NOT NULL DEFAULT 'violet'"
        )


def migrate_flat_tag_uniqueness(engine) -> None:
    """Prevent same-owner flat tags from differing only by letter case."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "tags" not in inspector.get_table_names():
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("tags")}
    if "uq_tag_owner_flat_name_key" in existing_indexes:
        return

    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_owner_flat_name_key "
            "ON tags (owner_id, name_key) "
            "WHERE owner_id IS NOT NULL AND parent_id IS NULL"
        )


def migrate_tutor_message_selection(engine) -> None:
    """Add provider/model and response-language fields to existing local Tutor messages."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "tutor_messages" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("tutor_messages")}
    with engine.begin() as connection:
        if "provider_id" not in existing_columns:
            connection.exec_driver_sql("ALTER TABLE tutor_messages ADD COLUMN provider_id VARCHAR(40)")
        if "model_id" not in existing_columns:
            connection.exec_driver_sql("ALTER TABLE tutor_messages ADD COLUMN model_id VARCHAR(160)")
        if "response_language" not in existing_columns:
            connection.exec_driver_sql(
                "ALTER TABLE tutor_messages ADD COLUMN response_language VARCHAR(2) NOT NULL DEFAULT 'th'"
            )


def migrate_deadline_tag_id(engine) -> None:
    """Link saved deadlines to tags while preserving unmatched legacy labels."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if not {"deadlines", "tags"}.issubset(table_names):
        return

    columns = {column["name"] for column in inspector.get_columns("deadlines")}
    indexes = {index["name"] for index in inspector.get_indexes("deadlines")}
    with engine.begin() as connection:
        if "tag_id" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE deadlines ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL"
            )
        if "ix_deadlines_tag_id" not in indexes:
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_deadlines_tag_id ON deadlines (tag_id)"
            )
        connection.exec_driver_sql(
            "UPDATE deadlines SET tag_id = ("
            "SELECT tags.id FROM tags "
            "WHERE tags.is_builtin = 1 AND tags.owner_id IS NULL AND tags.parent_id IS NULL "
            "AND lower(trim(tags.name)) = lower(trim(deadlines.subject)) "
            "ORDER BY tags.id LIMIT 1) "
            "WHERE tag_id IS NULL"
        )


def migrate_deadline_status(engine) -> None:
    """Add a three-state task status while preserving legacy completion values."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "deadlines" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("deadlines")}
    if "status" not in columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE deadlines ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'not_started'"
            )
            if "is_completed" in columns:
                connection.exec_driver_sql(
                    "UPDATE deadlines SET status = CASE WHEN is_completed = 1 "
                    "THEN 'completed' ELSE 'not_started' END"
                )
        return

    with engine.begin() as connection:
        if "is_completed" in columns:
            connection.exec_driver_sql(
                "UPDATE deadlines SET status = CASE WHEN is_completed = 1 "
                "THEN 'completed' ELSE 'not_started' END "
                "WHERE status IS NULL OR status NOT IN ('not_started', 'in_progress', 'completed')"
            )
            connection.exec_driver_sql(
                "UPDATE deadlines SET is_completed = CASE WHEN status = 'completed' "
                "THEN 1 ELSE 0 END WHERE is_completed != CASE WHEN status = 'completed' THEN 1 ELSE 0 END"
            )


def create_session_factory(database_url: str) -> sessionmaker:
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")

    is_sqlite = url.get_backend_name() == "sqlite"
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    engine = create_engine(url, connect_args=connect_args)

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def enable_sqlite_foreign_keys(connection, _record) -> None:
            connection.create_function(
                "casefold",
                1,
                lambda value: value.casefold() if value is not None else None,
                deterministic=True,
            )
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
