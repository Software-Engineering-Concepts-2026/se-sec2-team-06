from fastapi import FastAPI

from app import __version__
from app.routers.health import router as health_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="SynapseSync API",
        description="Modular Monolith API for the SynapseSync learning platform.",
        version=__version__,
        redoc_url=None,
    )
    application.include_router(health_router)
    return application


app = create_app()
