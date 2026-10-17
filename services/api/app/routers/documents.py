from __future__ import annotations

import logging
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Document, Tag, User
from app.routers.auth import get_current_user, get_db, require_same_origin
from app.schemas.document import (
    DocumentProgressUpdate,
    DocumentSummary,
    DocumentTagAssignment,
    DocumentText,
    DocumentTitleUpdate,
)
from app.services.document_library import (
    DocumentLibraryError,
    EmptyDocumentError,
    InvalidDocumentError,
    extract_library_text,
)
from app.storage.providers import FileStorageProvider, StorageProviderError
from app.storage.documents import (
    DocumentStorageError,
    EmptyUploadError,
    StagedDocument,
    UploadTooLargeError,
    discard_staged_document,
    stage_document,
)
from app.tags.service import (
    DocumentOrTagNotFoundError,
    DocumentTagAssignmentPersistenceError,
    replace_document_tags,
)


router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_CHUNK_BYTES = 64 * 1024
logger = logging.getLogger(__name__)
_DOCUMENT_CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "md": "text/markdown",
    "txt": "text/plain",
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _get_owned_document(session: Session, user_id: int, document_id: int) -> Document:
    document = session.scalar(
        select(Document)
        .options(selectinload(Document.tags))
        .where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้")
    return document


def _summary(document: Document) -> DocumentSummary:
    return DocumentSummary.model_validate(
        {
            **{
                "id": document.id,
                "title": document.title,
                "original_filename": document.original_filename,
                "file_type": document.file_type,
                "size_bytes": document.size_bytes,
                "search_text_truncated": document.search_text_truncated,
                "created_at": document.created_at,
                "updated_at": document.updated_at,
                "last_page": document.last_page,
                "scroll_ratio": document.scroll_ratio,
            },
            "tags": [
                {
                    "id": tag.id,
                    "name": tag.name,
                    "parent_id": tag.parent_id,
                    "is_builtin": tag.is_builtin,
                    "color": tag.color,
                }
                for tag in sorted(document.tags, key=lambda item: item.id)
            ],
        }
    )


def _find_tag_filter(session: Session, user_id: int, tag_id: int) -> Tag:
    tag = session.scalar(
        select(Tag).where(
            Tag.id == tag_id,
            or_(
                and_(
                    Tag.is_builtin.is_(True),
                    Tag.owner_id.is_(None),
                    Tag.parent_id.is_(None),
                ),
                and_(
                    Tag.is_builtin.is_(False),
                    Tag.owner_id == user_id,
                ),
            ),
        )
    )
    if tag is None:
        raise HTTPException(status_code=404, detail="ไม่พบแท็กนี้")
    return tag


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=160),
    tag_id: int | None = Query(default=None, gt=0),
) -> list[DocumentSummary]:
    filters = [Document.user_id == user.id]
    search = (q or "").strip()
    if search:
        pattern = f"%{_escape_like(search.casefold())}%"
        if session.get_bind().dialect.name == "sqlite":
            title_match = func.casefold(Document.title).like(pattern, escape="\\")
            filename_match = func.casefold(Document.original_filename).like(pattern, escape="\\")
            text_match = func.casefold(Document.search_text).like(pattern, escape="\\")
        else:
            raw_pattern = f"%{_escape_like(search)}%"
            title_match = Document.title.ilike(raw_pattern, escape="\\")
            filename_match = Document.original_filename.ilike(raw_pattern, escape="\\")
            text_match = Document.search_text.ilike(raw_pattern, escape="\\")
        filters.append(or_(title_match, filename_match, text_match))

    if tag_id is not None:
        selected_tag = _find_tag_filter(session, user.id, tag_id)
        matching_tag_ids = select(Tag.id).where(Tag.id == selected_tag.id)
        if selected_tag.is_builtin:
            matching_tag_ids = select(Tag.id).where(
                or_(
                    Tag.id == selected_tag.id,
                    and_(
                        Tag.parent_id == selected_tag.id,
                        Tag.owner_id == user.id,
                        Tag.is_builtin.is_(False),
                    ),
                )
            )
        filters.append(Document.tags.any(Tag.id.in_(matching_tag_ids)))

    documents = session.scalars(
        select(Document)
        .options(selectinload(Document.tags))
        .where(*filters)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return [_summary(document) for document in documents]


@router.post("", response_model=DocumentSummary, status_code=status.HTTP_201_CREATED)
def upload_document(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    title: Annotated[str | None, Form(max_length=160)] = None,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentSummary:
    require_same_origin(request)
    staged: StagedDocument | None = None
    storage_key: str | None = None
    committed = False
    storage: FileStorageProvider = request.app.state.storage_provider
    try:
        staged = stage_document(
            iter(lambda: file.file.read(UPLOAD_CHUNK_BYTES), b""),
            file.filename or "",
            request.app.state.document_staging_dir,
        )
        content = staged.temporary_path.read_bytes()
        extraction = extract_library_text(staged.original_filename, content)
        display_title = (title or "").strip()
        if not display_title:
            display_title = Path(staged.original_filename).stem.strip() or "เอกสาร"
        if not display_title.isprintable():
            raise HTTPException(status_code=422, detail="ชื่อเอกสารไม่ถูกต้อง")

        storage_key = storage.new_key(user.id)
        storage.put(
            "documents",
            storage_key,
            content,
            _DOCUMENT_CONTENT_TYPES[extraction.file_type],
        )
        document = Document(
            user_id=user.id,
            title=display_title,
            original_filename=staged.original_filename,
            file_type=extraction.file_type,
            size_bytes=staged.size_bytes,
            storage_key=storage_key,
            extracted_text=extraction.extracted_text,
            extracted_text_truncated=extraction.extracted_text_truncated,
            search_text=extraction.search_text,
            search_text_truncated=extraction.search_text_truncated,
        )
        session.add(document)
        session.commit()
        committed = True
        return _summary(document)
    except UploadTooLargeError as error:
        session.rollback()
        raise HTTPException(status_code=413, detail="ไฟล์มีขนาดเกิน 20 MB") from error
    except EmptyUploadError as error:
        session.rollback()
        raise HTTPException(status_code=422, detail="ไฟล์ว่างเปล่า") from error
    except (DocumentStorageError, InvalidDocumentError) as error:
        session.rollback()
        raise HTTPException(status_code=415, detail=str(error)) from error
    except EmptyDocumentError as error:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    except DocumentLibraryError as error:
        session.rollback()
        raise HTTPException(status_code=415, detail="ไม่สามารถอ่านเอกสารนี้ได้") from error
    except (StorageProviderError, OSError) as error:
        session.rollback()
        raise HTTPException(status_code=503, detail="ไม่สามารถจัดเก็บเอกสารได้ชั่วคราว") from error
    except HTTPException:
        session.rollback()
        raise
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกเอกสารได้") from error
    finally:
        if staged is not None:
            discard_staged_document(staged)
        if storage_key is not None and not committed:
            # The object is created before its metadata row; compensate on any failed upload.
            try:
                storage.delete("documents", storage_key)
            except (StorageProviderError, OSError):
                pass
        file.file.close()


@router.get("/{document_id}", response_model=DocumentSummary)
def get_document(
    document_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentSummary:
    return _summary(_get_owned_document(session, user.id, document_id))


@router.get("/{document_id}/content")
def get_document_content(
    document_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document = _get_owned_document(session, user.id, document_id)
    if document.file_type != "pdf":
        raise HTTPException(status_code=415, detail="เนื้อหาไฟล์นี้ไม่ได้อยู่ในรูปแบบ PDF")
    try:
        storage: FileStorageProvider = request.app.state.storage_provider
        content = storage.read("documents", document.storage_key)
    except (OSError, DocumentStorageError) as error:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์เอกสารนี้") from error
    except StorageProviderError as error:
        raise HTTPException(status_code=503, detail="ไม่สามารถโหลดเอกสารได้ชั่วคราว") from error
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document = _get_owned_document(session, user.id, document_id)
    if document.file_type != "pdf":
        raise HTTPException(status_code=415, detail="ดาวน์โหลดได้เฉพาะเอกสาร PDF")
    try:
        storage: FileStorageProvider = request.app.state.storage_provider
        content = storage.read("documents", document.storage_key)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์เอกสารนี้") from error
    except StorageProviderError as error:
        raise HTTPException(status_code=503, detail="ไม่สามารถดาวน์โหลดเอกสารได้ชั่วคราว") from error
    except OSError as error:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์เอกสารนี้") from error

    encoded_filename = quote(document.original_filename, safe="")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="document.pdf"; filename*=UTF-8\'\'{encoded_filename}',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{document_id}/text", response_model=DocumentText)
def get_document_text(
    document_id: int,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentText:
    document = _get_owned_document(session, user.id, document_id)
    return DocumentText(
        text=document.extracted_text,
        text_truncated=document.extracted_text_truncated,
        search_text_truncated=document.search_text_truncated,
        search_available=bool(document.search_text.strip()),
    )


@router.patch("/{document_id}", response_model=DocumentSummary)
def rename_document(
    document_id: int,
    payload: DocumentTitleUpdate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentSummary:
    require_same_origin(request)
    document = _get_owned_document(session, user.id, document_id)
    document.title = payload.title
    try:
        session.commit()
        session.refresh(document)
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกชื่อเอกสารได้") from error
    return _summary(document)


@router.put("/{document_id}/tags", response_model=DocumentSummary)
def update_document_tags(
    document_id: int,
    payload: DocumentTagAssignment,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentSummary:
    require_same_origin(request)
    try:
        document = replace_document_tags(session, user.id, document_id, payload.tag_ids)
    except DocumentOrTagNotFoundError as error:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารหรือแท็กนี้") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail="เลือกได้หนึ่งวิชาและแท็กย่อยของวิชานั้น") from error
    except DocumentTagAssignmentPersistenceError as error:
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกแท็กเอกสารได้") from error
    return _summary(document)


@router.put("/{document_id}/progress", response_model=DocumentSummary)
def update_document_progress(
    document_id: int,
    payload: DocumentProgressUpdate,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentSummary:
    require_same_origin(request)
    document = _get_owned_document(session, user.id, document_id)
    if payload.page is not None:
        if document.file_type != "pdf":
            raise HTTPException(status_code=422, detail="บันทึกตำแหน่งหน้าได้เฉพาะเอกสาร PDF")
        document.last_page = payload.page
        document.scroll_ratio = None
    else:
        if document.file_type == "pdf":
            raise HTTPException(status_code=422, detail="เอกสาร PDF ต้องบันทึกตำแหน่งเป็นหน้า")
        document.scroll_ratio = payload.scroll_ratio
        document.last_page = None
    try:
        session.commit()
        session.refresh(document)
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกตำแหน่งอ่านได้") from error
    return _summary(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    request: Request,
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_same_origin(request)
    document = _get_owned_document(session, user.id, document_id)
    storage_key = document.storage_key
    session.delete(document)
    try:
        session.commit()
    except SQLAlchemyError as error:
        session.rollback()
        raise HTTPException(status_code=500, detail="ไม่สามารถลบเอกสารได้") from error
    storage: FileStorageProvider = request.app.state.storage_provider
    try:
        storage.delete("documents", storage_key)
    except (StorageProviderError, OSError):
        # The owner-scoped metadata is gone, so a leftover private object is unreachable.
        logger.warning("Document metadata was deleted but private object cleanup failed")
