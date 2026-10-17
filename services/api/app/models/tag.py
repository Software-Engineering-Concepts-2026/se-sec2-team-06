from __future__ import annotations

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


quiz_tags = Table(
    "quiz_tags",
    Base.metadata,
    Column("quiz_id", ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_quiz_tags_tag_id", "tag_id"),
)


tutor_conversation_tags = Table(
    "tutor_conversation_tags",
    Base.metadata,
    Column(
        "conversation_id",
        ForeignKey("tutor_conversations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_tutor_conversation_tags_tag_id", "tag_id"),
)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_tag_slug"),
        UniqueConstraint("owner_id", "parent_id", "name_key", name="uq_tag_owner_parent_name_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    name_key: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(16), default="violet", server_default="violet", nullable=False)
    slug: Mapped[str | None] = mapped_column(String(40), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("tags.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    parent: Mapped[Tag | None] = relationship(
        back_populates="children",
        remote_side="Tag.id",
    )
    children: Mapped[list[Tag]] = relationship(back_populates="parent")
    quizzes: Mapped[list[Quiz]] = relationship(
        "Quiz",
        secondary=quiz_tags,
        back_populates="tags",
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        secondary="document_tags",
        back_populates="tags",
    )
    tutor_conversations: Mapped[list["TutorConversation"]] = relationship(
        "TutorConversation",
        secondary=tutor_conversation_tags,
        back_populates="tags",
    )
