from __future__ import annotations

import pytest

from app.ai.config import AISettings


_AI_ENV_KEYS = (
    "AI_PROVIDER",
    "AI_BASE_URL",
    "AI_MODEL",
    "AI_API_KEY",
    "AI_TIMEOUT_SECONDS",
    "AI_MAX_INPUT_TOKENS",
)


def _clear_ai_environment(monkeypatch) -> None:
    for key in _AI_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_settings_use_env_file_defaults_and_environment_overrides(tmp_path, monkeypatch):
    _clear_ai_environment(monkeypatch)
    api_dir = tmp_path / "api"
    api_dir.mkdir()
    (api_dir / ".env").write_text(
        "AI_PROVIDER=file-provider\n"
        "AI_BASE_URL=https://file.example/v1\n"
        "AI_MODEL=file-model\n"
        "AI_API_KEY=file-secret\n"
        "AI_TIMEOUT_SECONDS=12.5\n"
        "AI_MAX_INPUT_TOKENS=4096\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("AI_PROVIDER", "  env-provider  ")
    monkeypatch.setenv("AI_API_KEY", " env-secret ")
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", "")

    settings = AISettings.from_environment(api_dir)

    assert settings.provider == "env-provider"
    assert settings.base_url == "https://file.example/v1"
    assert settings.model == "file-model"
    assert settings.api_key == "env-secret"
    assert settings.timeout_seconds == 30
    assert settings.input_token_budget == 4096


def test_settings_default_to_unconfigured_when_values_are_absent_or_blank(tmp_path, monkeypatch):
    _clear_ai_environment(monkeypatch)
    api_dir = tmp_path / "empty"
    api_dir.mkdir()
    monkeypatch.setenv("AI_PROVIDER", "  ")
    monkeypatch.setenv("AI_BASE_URL", "  ")
    monkeypatch.setenv("AI_MODEL", "")
    monkeypatch.setenv("AI_API_KEY", " ")

    settings = AISettings.from_environment(api_dir)

    assert settings.provider == "unconfigured"
    assert settings.base_url is None
    assert settings.model is None
    assert settings.api_key is None
    assert settings.timeout_seconds == 30
    assert settings.input_token_budget is None


@pytest.mark.parametrize("timeout", ["not-a-number", "0", "-2"])
def test_settings_reject_invalid_timeout(tmp_path, monkeypatch, timeout):
    _clear_ai_environment(monkeypatch)
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", timeout)

    with pytest.raises(ValueError, match="AI_TIMEOUT_SECONDS"):
        AISettings.from_environment(tmp_path)


@pytest.mark.parametrize("budget", ["not-an-integer", "0", "-1"])
def test_settings_reject_invalid_input_token_budget(tmp_path, monkeypatch, budget):
    _clear_ai_environment(monkeypatch)
    monkeypatch.setenv("AI_MAX_INPUT_TOKENS", budget)

    with pytest.raises(ValueError, match="AI_MAX_INPUT_TOKENS"):
        AISettings.from_environment(tmp_path)
