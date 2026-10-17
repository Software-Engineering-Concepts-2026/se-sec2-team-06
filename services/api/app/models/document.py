from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


document_tags = Table(
    "document_tags",
    Base.metadata,
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_document_tags_tag_id", "tag_id"),
)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_user_created", "user_id", "created_at"),
        Index("ix_documents_user_title", "user_id", "title"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(8), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    extracted_text_truncated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    search_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    search_text_truncated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )
    last_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scroll_ratio: Mapped[float | None] = mapped_column(nullable=True)

    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=document_tags,
        back_populates="documents",
    )
