from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models import User
from app.routers.auth import get_current_user, get_db
from app.schemas.progress import ProgressOverview, TopicProgressDetail
from app.services.progress import (
    ProgressTagNotFoundError,
    get_progress_overview,
    get_topic_progress,
)


router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressOverview)
def read_progress(
    q: str | None = Query(default=None, max_length=200),
    tag_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressOverview:
    try:
        return get_progress_overview(session, user.id, query=q, tag_id=tag_id)
    except ProgressTagNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบแท็กที่เลือก") from error


@router.get("/topics/{tag_id}", response_model=TopicProgressDetail)
def read_topic_progress(
    tag_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TopicProgressDetail:
    try:
        return get_topic_progress(session, user.id, tag_id)
    except ProgressTagNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบแท็กที่เลือก") from error
