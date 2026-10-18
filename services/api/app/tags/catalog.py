from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import Tag


BUILTIN_SUBJECTS: tuple[tuple[str, str], ...] = (
    ("math", "คณิตศาสตร์"),
    ("english", "ภาษาอังกฤษ"),
    ("thai", "ภาษาไทย"),
    ("physics", "ฟิสิกส์"),
    ("chemistry", "เคมี"),
    ("biology", "ชีววิทยา"),
    ("social-studies", "สังคมศึกษา"),
    ("other", "วิชาอื่น"),
)
BUILTIN_SUBJECT_COLORS: dict[str, str] = {
    "math": "blue",
    "english": "violet",
    "thai": "rose",
    "physics": "cyan",
    "chemistry": "green",
    "biology": "lime",
    "social-studies": "amber",
    "other": "teal",
}


def seed_builtin_subjects(session_factory: sessionmaker) -> None:
    with session_factory() as session:
        existing_subjects = {
            subject.slug: subject
            for subject in session.scalars(
                select(Tag).where(
                    Tag.is_builtin.is_(True),
                    Tag.parent_id.is_(None),
                    Tag.owner_id.is_(None),
                    Tag.slug.is_not(None),
                )
            ).all()
        }
        for slug, name in BUILTIN_SUBJECTS:
            subject = existing_subjects.get(slug)
            color = BUILTIN_SUBJECT_COLORS[slug]
            if subject is None:
                session.add(
                    Tag(
                        name=name,
                        name_key=name.casefold(),
                        slug=slug,
                        owner_id=None,
                        parent_id=None,
                        is_builtin=True,
                        color=color,
                    )
                )
            elif subject.color != color:
                subject.color = color
        session.commit()
