from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TutorConversation(Base):
    __tablename__ = "tutor_conversations"
    __table_args__ = (
        UniqueConstraint("user_id", "create_request_id", name="uq_tutor_conversation_create_request"),
        CheckConstraint(
            "status IN ('processing', 'awaiting_clarification', 'retryable_error', 'answered')",
            name="ck_tutor_conversation_status",
        ),
        Index("ix_tutor_conversations_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="processing", nullable=False)
    provider_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    create_request_id: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )

    user = relationship("User")
    messages: Mapped[list[TutorMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="TutorMessage.sequence",
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary="tutor_conversation_tags",
        back_populates="tutor_conversations",
        order_by="Tag.name_key",
    )


class TutorMessage(Base):
    __tablename__ = "tutor_messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "sequence", name="uq_tutor_message_sequence"),
        UniqueConstraint("conversation_id", "request_id", name="uq_tutor_message_request"),
        CheckConstraint("role IN ('user', 'assistant')", name="ck_tutor_message_role"),
        CheckConstraint(
            "kind IN ('question', 'clarification_reply', 'answer', 'clarification')",
            name="ck_tutor_message_kind",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("tutor_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    request_id: Mapped[str] = mapped_column(String(80), nullable=False)
    provider_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    response_language: Mapped[str] = mapped_column(
        String(2), default="th", server_default="th", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    conversation: Mapped[TutorConversation] = relationship(back_populates="messages")
    attachments: Mapped[list["TutorAttachment"]] = relationship(
        "TutorAttachment",
        secondary="tutor_message_attachments",
        back_populates="messages",
        order_by="TutorAttachment.id",
    )
