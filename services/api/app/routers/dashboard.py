from __future__ import annotations

from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models import User
from app.routers.auth import get_current_user, get_db
from app.schemas.dashboard import DashboardOverview
from app.services.dashboard import get_dashboard_overview


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def read_dashboard_overview(
    period: Literal["day", "week"] = Query(default="day"),
    time_zone: str = Query(default="UTC", min_length=1, max_length=80),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardOverview:
    try:
        ZoneInfo(time_zone)
        return get_dashboard_overview(session, user.id, period=period, time_zone=time_zone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise HTTPException(status_code=422, detail="เขตเวลาไม่ถูกต้อง") from error
