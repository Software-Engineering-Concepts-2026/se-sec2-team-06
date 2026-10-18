from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.ai.catalog import get_provider_catalog, resolve_model_selection
from app.models import User
from app.routers.auth import get_current_user
from app.schemas.ai import AIProviderCatalog


router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/providers", response_model=AIProviderCatalog)
def list_ai_providers(
    request: Request,
    _user: User = Depends(get_current_user),
) -> dict[str, object]:
    configured_model = request.app.state.ai_settings.model
    default_selection = None
    if configured_model:
        try:
            selection = resolve_model_selection(
                provider_id=None,
                model_id=configured_model,
                default_model=configured_model,
            )
        except ValueError:
            pass
        else:
            default_selection = {
                "provider_id": selection.provider_id,
                "model_id": selection.model_id,
            }
    return {
        "providers": get_provider_catalog(),
        "default_selection": default_selection,
    }
