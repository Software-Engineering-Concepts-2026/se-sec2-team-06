from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_factory(tmp_path: Path):
    def make_client(**app_options) -> TestClient:
        main = importlib.import_module("app.main")
        database_url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
        return TestClient(main.create_app(
            database_url=database_url,
            image_storage_dir=tmp_path / "profile-images",
            **app_options,
        ))

    return make_client


def registration_payload(**overrides):
    return {
        "display_name": "Study Learner",
        "email": "learner@example.com",
        "password": "studyPlan42",
        **overrides,
    }


def same_origin_headers():
    return {"Origin": "http://testserver"}
