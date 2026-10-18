from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models import User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.tag import TagCatalogResponse, TagCreate, TagSummary, TagUpdate
from app.tags.service import (
    DuplicateTagNameError,
    TagHasChildrenError,
    TagNotFoundError,
    create_tag,
    delete_tag,
    list_tag_catalog,
    update_tag,
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


@router.put("/{tag_id}", response_model=TagSummary)
def put_tag(
    tag_id: int,
    payload: TagUpdate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TagSummary:
    require_same_origin(request)
    try:
        tag = update_tag(session, user.id, tag_id, payload.name, payload.color)
    except TagNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except DuplicateTagNameError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return TagSummary.model_validate(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_tag(
    tag_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_same_origin(request)
    try:
        delete_tag(session, user.id, tag_id)
    except TagNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except TagHasChildrenError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return None
