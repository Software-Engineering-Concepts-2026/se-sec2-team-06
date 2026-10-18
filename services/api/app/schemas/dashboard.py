from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DashboardCountBucket(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    label: str
    count: int


class DashboardTaskStatus(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    not_started: int = 0
    in_progress: int = 0
    completed: int = 0


class DashboardTagCount(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tag_id: int | None
    tag_name: str
    color: str
    count: int


class DashboardWeakTopic(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tag_id: int
    tag_name: str
    color: str
    average_percent: float
    attempt_count: int


class DashboardOverview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    quiz_activity: list[DashboardCountBucket]
    task_status: DashboardTaskStatus
    documents_by_tag: list[DashboardTagCount]
    topics_to_review: list[DashboardWeakTopic]
