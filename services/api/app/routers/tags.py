from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models import User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.tag import TagCatalogResponse, TagCreate, TagSummary
from app.tags.service import (
    DuplicateTagNameError,
    create_tag,
    list_tag_catalog,
)


router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=TagCatalogResponse)
def get_tags(
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    return list_tag_catalog(session, user.id)


@router.post("", response_model=TagSummary, status_code=status.HTTP_201_CREATED)
def post_tag(
    payload: TagCreate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TagSummary:
    require_same_origin(request)
    try:
        tag = create_tag(
            session,
            user.id,
            payload.name,
            payload.color,
        )
    except DuplicateTagNameError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return TagSummary.model_validate(tag)
