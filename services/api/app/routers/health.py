from fastapi import APIRouter

from app import __version__

router = APIRouter(tags=["operations"])


@router.get("/")
def service_discovery() -> dict[str, str]:
    return {
        "service": "synapsesync-api",
        "status": "prototype-to-mvp",
        "health": "/health",
        "docs": "/docs",
    }


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "synapsesync-api",
        "architecture": "modular-monolith",
        "version": __version__,
    }
