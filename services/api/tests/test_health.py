import asyncio
from importlib import import_module

import httpx
import pytest


def load_app():
    try:
        module = import_module("app.main")
    except ModuleNotFoundError:
        pytest.fail("app.main must exist before the health contract can pass")

    return module.app


async def request(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=load_app())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


def test_health_endpoint_returns_the_container_health_contract() -> None:
    response = asyncio.run(request("/health"))

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "synapsesync-api",
        "architecture": "modular-monolith",
        "version": "0.1.0",
    }


def test_root_endpoint_exposes_service_discovery_without_overclaiming_status() -> None:
    response = asyncio.run(request("/"))

    assert response.status_code == 200
    assert response.json() == {
        "service": "synapsesync-api",
        "status": "prototype-to-mvp",
        "health": "/health",
        "docs": "/docs",
    }
