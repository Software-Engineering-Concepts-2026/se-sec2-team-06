from __future__ import annotations

import os
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse
from dotenv import dotenv_values

from app import __version__
from app.ai.config import AISettings
from app.ai.provider import QuizProvider, build_provider
from app.ai.tutor import TutorProvider, build_tutor_provider
from app.database import (
    Base,
    create_session_factory,
    migrate_flat_tag_uniqueness,
    migrate_deadline_tag_id,
    migrate_deadline_status,
    migrate_profile_fields,
    migrate_quiz_source_storage_key,
    migrate_tag_colors,
    migrate_tutor_message_selection,
)
from app.models import AuthSession, Deadline, Document, Quiz, QuizAnswer, QuizAttempt, QuizQuestion, Tag, TutorAttachment, TutorConversation, TutorMessage, TutorMessageAttachment, User  # noqa: F401 — register model metadata.
from app.middleware.quiz_upload_guard import QuizUploadGuardMiddleware
from app.routers.auth import router as auth_router
from app.routers.ai import router as ai_router
from app.routers.documents import router as documents_router
from app.routers.deadlines import router as deadlines_router
from app.routers.dashboard import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.profile import router as profile_router
from app.routers.progress import router as progress_router
from app.routers.quizzes import router as quizzes_router
from app.routers.tags import router as tags_router
from app.routers.tutor import router as tutor_router
from app.tags.catalog import seed_builtin_subjects
from app.storage.providers import FileStorageProvider, create_storage_provider


def _repository_root() -> Path:
    return Path(__file__).resolve().parents[3]


def create_app(
    database_url: str | None = None,
    image_storage_dir: str | Path | None = None,
    document_storage_dir: str | Path | None = None,
    document_staging_dir: str | Path | None = None,
    tutor_attachment_storage_dir: str | Path | None = None,
    quiz_source_storage_dir: str | Path | None = None,
    cookie_secure: bool | None = None,
    quiz_provider: QuizProvider | None = None,
    quiz_provider_factory: Callable[[str, str], QuizProvider] | None = None,
    ai_settings: AISettings | None = None,
    tutor_provider: TutorProvider | None = None,
    tutor_provider_factory: Callable[[str | None, str | None], TutorProvider] | None = None,
    storage_provider: FileStorageProvider | None = None,
    web_static_dir: str | Path | None = None,
) -> FastAPI:
    if quiz_provider is not None and quiz_provider_factory is not None:
        raise ValueError("Provide either quiz_provider or quiz_provider_factory, not both")
    if tutor_provider is not None and tutor_provider_factory is not None:
        raise ValueError("Provide either tutor_provider or tutor_provider_factory, not both")

    configured_data_dir = os.environ.get("SYNAPSESYNC_DATA_DIR")
    data_dir = Path(configured_data_dir) if configured_data_dir else _repository_root() / ".local"
    configured_web_dir = str(web_static_dir) if web_static_dir is not None else os.environ.get("SYNAPSESYNC_WEB_DIR")
    web_dir = Path(configured_web_dir).resolve() if configured_web_dir else None
    configured_database_url = database_url or os.environ.get("DATABASE_URL")
    resolved_database_url = configured_database_url or (
        f"sqlite:///{(data_dir / 'synapsesync.db').as_posix()}"
    )
    resolved_image_storage_dir = Path(image_storage_dir) if image_storage_dir else data_dir / "profile-images"
    resolved_document_storage_dir = Path(document_storage_dir) if document_storage_dir else data_dir / "documents"
    resolved_document_staging_dir = Path(document_staging_dir) if document_staging_dir else data_dir / "document-staging"
    resolved_tutor_attachment_storage_dir = (
        Path(tutor_attachment_storage_dir)
        if tutor_attachment_storage_dir
        else data_dir / "tutor-attachments"
    )
    resolved_quiz_source_storage_dir = (
        Path(quiz_source_storage_dir)
        if quiz_source_storage_dir
        else data_dir / "quiz-sources"
    )
    if storage_provider is None:
        api_dir = Path(__file__).resolve().parent.parent
        file_values = dotenv_values(api_dir / ".env")

        def setting(name: str) -> str | None:
            return os.environ.get(name, file_values.get(name))

        resolved_storage_provider = create_storage_provider(
            image_storage_dir=resolved_image_storage_dir,
            document_storage_dir=resolved_document_storage_dir,
            tutor_attachment_storage_dir=resolved_tutor_attachment_storage_dir,
            quiz_source_storage_dir=resolved_quiz_source_storage_dir,
            supabase_url=setting("SUPABASE_URL"),
            supabase_secret_key=setting("SUPABASE_SECRET_KEY"),
            storage_backend=setting("STORAGE_BACKEND"),
            is_render=bool(os.environ.get("RENDER_SERVICE_ID", "").strip()),
        )
    else:
        resolved_storage_provider = storage_provider
    session_factory = create_session_factory(resolved_database_url)
    engine = session_factory.kw["bind"]

    @asynccontextmanager
    async def lifespan(_application: FastAPI):
        if engine.url.get_backend_name() == "sqlite" and engine.url.database not in (None, ":memory:"):
            Path(engine.url.database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        resolved_image_storage_dir.mkdir(parents=True, exist_ok=True)
        resolved_document_storage_dir.mkdir(parents=True, exist_ok=True)
        resolved_document_staging_dir.mkdir(parents=True, exist_ok=True)
        resolved_tutor_attachment_storage_dir.mkdir(parents=True, exist_ok=True)
        resolved_quiz_source_storage_dir.mkdir(parents=True, exist_ok=True)
        Base.metadata.create_all(bind=engine)
        migrate_quiz_source_storage_key(engine)
        migrate_profile_fields(engine)
        migrate_tag_colors(engine)
        migrate_flat_tag_uniqueness(engine)
        migrate_tutor_message_selection(engine)
        seed_builtin_subjects(session_factory)
        migrate_deadline_tag_id(engine)
        migrate_deadline_status(engine)
        yield
        close_storage = getattr(resolved_storage_provider, "close", None)
        if close_storage is not None:
            close_storage()
        engine.dispose()

    application = FastAPI(
        title="SynapseSync API",
        description="Modular Monolith API for the SynapseSync learning platform.",
        version=__version__,
        redoc_url=None,
        lifespan=lifespan,
    )
    application.state.session_factory = session_factory
    application.state.image_storage_dir = resolved_image_storage_dir
    application.state.document_storage_dir = resolved_document_storage_dir
    application.state.document_staging_dir = resolved_document_staging_dir
    application.state.tutor_attachment_storage_dir = resolved_tutor_attachment_storage_dir
    application.state.quiz_source_storage_dir = resolved_quiz_source_storage_dir
    application.state.storage_provider = resolved_storage_provider
    application.state.cookie_secure = cookie_secure
    resolved_ai_settings = ai_settings or AISettings.from_environment(Path(__file__).resolve().parent.parent)
    application.state.ai_settings = resolved_ai_settings
    application.state.quiz_provider = quiz_provider
    application.state.quiz_provider_factory = quiz_provider_factory or (
        lambda provider_id, model_id: build_provider(
            resolved_ai_settings,
            model_provider=provider_id,
            model=model_id,
        )
    )
    application.state.tutor_provider = tutor_provider
    application.state.tutor_provider_factory = tutor_provider_factory or (
        lambda provider_id, model_id: build_tutor_provider(
            resolved_ai_settings,
            provider_id=provider_id,
            model_id=model_id,
        )
    )
    application.add_middleware(
        QuizUploadGuardMiddleware,
        session_factory=session_factory,
    )

    index_file = web_dir / "index.html" if web_dir is not None else None
    if web_dir is not None and index_file is not None and index_file.is_file():
        @application.middleware("http")
        async def serve_web_app(request: Request, call_next):
            request_path = request.scope["path"]
            reserved_paths = ("/api", "/health", "/docs", "/openapi.json", "/redoc")
            is_reserved_path = any(
                request_path == reserved_path or request_path.startswith(f"{reserved_path}/")
                for reserved_path in reserved_paths
            )
            if request.method not in {"GET", "HEAD"} or is_reserved_path:
                return await call_next(request)

            requested_file = (web_dir / request_path.lstrip("/")).resolve()
            if not requested_file.is_relative_to(web_dir):
                return PlainTextResponse("Not Found", status_code=404)
            if requested_file.is_file():
                return FileResponse(requested_file)
            if Path(request_path).suffix:
                return await call_next(request)
            return FileResponse(index_file)

    application.include_router(health_router)
    application.include_router(health_router, prefix="/api")
    application.include_router(auth_router, prefix="/api")
    application.include_router(ai_router, prefix="/api")
    application.include_router(profile_router, prefix="/api")
    application.include_router(quizzes_router, prefix="/api")
    application.include_router(tags_router, prefix="/api")
    application.include_router(documents_router, prefix="/api")
    application.include_router(deadlines_router, prefix="/api")
    application.include_router(tutor_router, prefix="/api")
    application.include_router(progress_router, prefix="/api")
    application.include_router(dashboard_router, prefix="/api")

    return application


app = create_app()
