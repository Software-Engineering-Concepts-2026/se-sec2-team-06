from __future__ import annotations

import importlib
from pathlib import Path
from urllib.parse import urlparse

from fastapi.testclient import TestClient
import pytest


def test_configured_data_directory_does_not_resolve_repository_root(tmp_path: Path, monkeypatch) -> None:
    main = importlib.import_module("app.main")
    configured_data_dir = tmp_path / "render-data"
    monkeypatch.setenv("SYNAPSESYNC_DATA_DIR", str(configured_data_dir))

    def unavailable_repository_root() -> Path:
        raise AssertionError("The repository-root fallback must not be evaluated when a data directory is configured")

    monkeypatch.setattr(main, "_repository_root", unavailable_repository_root)

    application = main.create_app(database_url="sqlite:///:memory:")

    assert application.state.image_storage_dir == configured_data_dir / "profile-images"
    assert application.state.document_storage_dir == configured_data_dir / "documents"
    assert application.state.tutor_attachment_storage_dir == configured_data_dir / "tutor-attachments"
    assert application.state.quiz_source_storage_dir == configured_data_dir / "quiz-sources"


@pytest.mark.parametrize("storage_backend", [None, "local"])
def test_render_service_requires_explicit_supabase_backend(
    tmp_path: Path,
    monkeypatch,
    storage_backend: str | None,
) -> None:
    main = importlib.import_module("app.main")
    from app.storage.providers import StorageConfigurationError

    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-test")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "")
    if storage_backend is None:
        monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    else:
        monkeypatch.setenv("STORAGE_BACKEND", storage_backend)

    with pytest.raises(StorageConfigurationError, match="Render.*STORAGE_BACKEND.*supabase"):
        main.create_app(database_url="sqlite:///:memory:")


def test_database_url_environment_variable_is_used_when_no_explicit_url(
    tmp_path: Path, monkeypatch
) -> None:
    main = importlib.import_module("app.main")
    database_path = tmp_path / "persistent.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    application = main.create_app()

    assert application.state.session_factory.kw["bind"].url.database == database_path.as_posix()


def test_explicit_database_url_overrides_environment_database_url(
    tmp_path: Path, monkeypatch
) -> None:
    main = importlib.import_module("app.main")
    environment_path = tmp_path / "environment.db"
    explicit_path = tmp_path / "explicit.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{environment_path.as_posix()}")

    application = main.create_app(database_url=f"sqlite:///{explicit_path.as_posix()}")

    assert application.state.session_factory.kw["bind"].url.database == explicit_path.as_posix()


def test_missing_database_url_keeps_the_local_sqlite_fallback(
    tmp_path: Path, monkeypatch
) -> None:
    main = importlib.import_module("app.main")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SYNAPSESYNC_DATA_DIR", raising=False)
    monkeypatch.setattr(main, "_repository_root", lambda: tmp_path)

    application = main.create_app()

    engine_url = application.state.session_factory.kw["bind"].url
    assert engine_url.drivername == "sqlite"
    assert engine_url.database == (tmp_path / ".local" / "synapsesync.db").as_posix()


def test_serves_spa_index_for_root_and_client_routes(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    client = TestClient(application)

    assert client.get("/").text == "<main>SynapseSync UI</main>"
    assert client.get("/tutor").text == "<main>SynapseSync UI</main>"


def test_serves_built_asset_instead_of_spa_fallback(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    assets_dir = web_dir / "assets"
    assets_dir.mkdir(parents=True)
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    (assets_dir / "app.js").write_text("window.synapseSync = true;", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    response = TestClient(application).get("/assets/app.js")

    assert response.status_code == 200
    assert response.text == "window.synapseSync = true;"


def test_unknown_api_path_does_not_return_spa_index(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    response = TestClient(application).get("/api/not-a-real-endpoint")

    assert response.status_code == 404
    assert "SynapseSync UI" not in response.text


def test_missing_web_build_keeps_api_root_response(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    application = main.create_app(
        database_url="sqlite:///:memory:",
        web_static_dir=tmp_path / "missing-web-build",
    )

    response = TestClient(application).get("/")

    assert response.status_code == 200
    assert response.json()["service"] == "synapsesync-api"


@pytest.mark.parametrize(
    ("method", "path", "expected_status", "expected_location"),
    [
        ("GET", "/api", 307, "/api/"),
        ("GET", "/api/health/", 307, "/api/health"),
        ("GET", "/api/auth/me/", 307, "/api/auth/me"),
        ("POST", "/api/auth/login/", 307, "/api/auth/login"),
        ("POST", "/api/not-real", 404, None),
        ("GET", "/api/auth/login", 405, None),
    ],
)
def test_frontend_serving_preserves_api_routing(
    tmp_path: Path,
    method: str,
    path: str,
    expected_status: int,
    expected_location: str | None,
) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    response = TestClient(application, follow_redirects=False).request(method, path)

    assert response.status_code == expected_status
    if expected_location is not None:
        assert urlparse(response.headers["location"]).path == expected_location


def test_frontend_serving_preserves_health_route(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    response = TestClient(application).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_frontend_serving_rejects_traversal_outside_web_root(tmp_path: Path) -> None:
    main = importlib.import_module("app.main")
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("<main>SynapseSync UI</main>", encoding="utf-8")
    secret_file = tmp_path / "secret.txt"
    secret_file.write_text("not public", encoding="utf-8")
    application = main.create_app(database_url="sqlite:///:memory:", web_static_dir=web_dir)

    response = TestClient(application).get("/%2e%2e/secret.txt")

    assert response.status_code == 404
    assert "not public" not in response.text
