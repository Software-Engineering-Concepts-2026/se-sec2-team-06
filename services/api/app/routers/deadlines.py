from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import Deadline, Tag, User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.deadline import DeadlineCompletionUpdate, DeadlineCreate, DeadlineSummary


router = APIRouter(prefix="/deadlines", tags=["deadlines"])


def _to_sqlite_utc(value):
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _owned_deadline(session: Session, user_id: int, deadline_id: int) -> Deadline:
    deadline = session.scalar(
        select(Deadline).where(
            Deadline.id == deadline_id,
            Deadline.user_id == user_id,
        )
    )
    if deadline is None:
        raise HTTPException(status_code=404, detail="ไม่พบงานที่ต้องการ")
    return deadline


@router.get("", response_model=list[DeadlineSummary])
def list_deadlines(
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Deadline]:
    return list(
        session.scalars(
            select(Deadline)
            .where(Deadline.user_id == user.id)
            .order_by(Deadline.due_at.asc(), Deadline.id.asc())
        ).all()
    )


@router.post("", response_model=DeadlineSummary, status_code=status.HTTP_201_CREATED)
def create_deadline(
    payload: DeadlineCreate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Deadline:
    require_same_origin(request)
    if payload.tag_id is not None:
        subject = session.scalar(
            select(Tag).where(
                Tag.id == payload.tag_id,
                or_(
                    and_(
                        Tag.is_builtin.is_(True),
                        Tag.owner_id.is_(None),
                        Tag.parent_id.is_(None),
                    ),
                    and_(Tag.is_builtin.is_(False), Tag.owner_id == user.id),
                ),
            )
        )
        if subject is None:
            raise HTTPException(status_code=404, detail="ไม่พบแท็กนี้")
    else:
        subject = session.scalar(
            select(Tag).where(
                Tag.name == payload.subject,
                Tag.is_builtin.is_(True),
                Tag.owner_id.is_(None),
                Tag.parent_id.is_(None),
            )
        )
        if subject is None:
            raise HTTPException(status_code=422, detail="กรุณาเลือกวิชาจากแท็กที่มีอยู่")
    deadline = Deadline(
        user_id=user.id,
        title=payload.title,
        subject=subject.name,
        tag_id=subject.id,
        due_at=_to_sqlite_utc(payload.due_at),
        priority=payload.priority,
        status="not_started",
        is_completed=False,
    )
    session.add(deadline)
    session.commit()
    session.refresh(deadline)
    return deadline


@router.patch("/{deadline_id}", response_model=DeadlineSummary)
def update_deadline(
    deadline_id: int,
    payload: DeadlineCompletionUpdate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Deadline:
    require_same_origin(request)
    deadline = _owned_deadline(session, user.id, deadline_id)
    next_status = payload.status or ("completed" if payload.is_completed else "not_started")
    deadline.status = next_status
    deadline.is_completed = next_status == "completed"
    session.commit()
    session.refresh(deadline)
    return deadline


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deadline(
    deadline_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    require_same_origin(request)
    deadline = _owned_deadline(session, user.id, deadline_id)
    session.delete(deadline)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
