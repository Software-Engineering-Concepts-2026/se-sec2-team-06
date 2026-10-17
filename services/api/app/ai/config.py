from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values


@dataclass(frozen=True)
class AISettings:
    provider: str
    base_url: str | None
    model: str | None
    api_key: str | None
    timeout_seconds: float = 30
    input_token_budget: int | None = None

    @classmethod
    def from_environment(cls, api_dir: Path) -> "AISettings":
        env_path = Path(api_dir) / ".env"
        file_values = dotenv_values(env_path) if env_path.is_file() else {}

        def value(name: str, default: str | None = None) -> str | None:
            if name in os.environ:
                return os.environ[name]
            return file_values.get(name, default)

        raw_timeout = value("AI_TIMEOUT_SECONDS", "30")
        try:
            timeout = float(raw_timeout or "30")
        except ValueError as exc:
            raise ValueError("AI_TIMEOUT_SECONDS must be a number") from exc
        if timeout <= 0:
            raise ValueError("AI_TIMEOUT_SECONDS must be greater than zero")

        raw_token_budget = value("AI_MAX_INPUT_TOKENS")
        try:
            token_budget = int(raw_token_budget) if raw_token_budget else None
        except ValueError as exc:
            raise ValueError("AI_MAX_INPUT_TOKENS must be a positive integer") from exc
        if token_budget is not None and token_budget <= 0:
            raise ValueError("AI_MAX_INPUT_TOKENS must be a positive integer")

        return cls(
            provider=(value("AI_PROVIDER") or "unconfigured").strip() or "unconfigured",
            base_url=(value("AI_BASE_URL") or "").strip() or None,
            model=(value("AI_MODEL") or "").strip() or None,
            api_key=(value("AI_API_KEY") or "").strip() or None,
            timeout_seconds=timeout,
            input_token_budget=token_budget,
        )
