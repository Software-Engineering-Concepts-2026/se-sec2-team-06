from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TutorAttachment(Base):
    __tablename__ = "tutor_attachments"
    __table_args__ = (UniqueConstraint("storage_key", name="uq_tutor_attachment_storage_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("tutor_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(64), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(32), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    messages: Mapped[list["TutorMessage"]] = relationship(
        "TutorMessage",
        secondary="tutor_message_attachments",
        back_populates="attachments",
        order_by="TutorMessage.sequence",
    )


class TutorMessageAttachment(Base):
    __tablename__ = "tutor_message_attachments"

    message_id: Mapped[int] = mapped_column(
        ForeignKey("tutor_messages.id", ondelete="CASCADE"), primary_key=True
    )
    attachment_id: Mapped[int] = mapped_column(
        ForeignKey("tutor_attachments.id", ondelete="CASCADE"), primary_key=True
    )
