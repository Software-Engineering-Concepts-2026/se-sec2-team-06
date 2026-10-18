# Quiz Tags and Search — Design Specification

**Status:** Approved on 2026-10-11.  
**Date:** 2026-10-11  
**Scope:** Reusable tag foundation and authenticated quiz-library tagging/search.

## 1. Purpose

Help a signed-in user organize and find generated quizzes by either the quiz title or its tags. The tag foundation must be separate from quiz-specific UI so later features can reuse tag catalog, creation, and selection behavior.

## 2. Approved user intent

- The library search must find quizzes by title or by an attached tag name.
- A quiz may have multiple tags.
- The system provides subject tags before the user creates topic tags.
- Users can create their own topic tags under a subject.
- The tag implementation is a reusable module, not code embedded only in the quiz-library page.
- Do not add `วิทยาการคำนวณ` to the initial subject list.
- Continue in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06` only. Do not modify `D:\Project SE Sce 2\se-sec2-team-06`, do not change `prototypes/`, and do not commit or push.

## 3. Initial tag catalog and hierarchy

The initial built-in subject tags are shared, read-only roots with stable slugs:

1. `math` — คณิตศาสตร์
2. `english` — ภาษาอังกฤษ
3. `thai` — ภาษาไทย
4. `physics` — ฟิสิกส์
5. `chemistry` — เคมี
6. `biology` — ชีววิทยา
7. `social-studies` — สังคมศึกษา

Each user may create custom topic tags as children of one of these subjects, for example `คณิตศาสตร์ → เซต` or `ภาษาอังกฤษ → Grammar`. The hierarchy is one level deep in this phase: users cannot create root subjects or nested grandchildren.

Built-in subject tags are available to select, but are not automatically assigned to every quiz. A user can attach multiple root or custom child tags to one quiz. Selecting a subject as a library filter also includes quizzes tagged with any child of that subject; selecting a child filters to that child.

Existing quizzes start untagged and remain searchable by title. The library lets the owner attach or remove tags after quiz generation.

## 4. Architecture

Use a normalized, reusable Tag domain module with quiz-specific associations:

- A shared `Tag` entity stores built-in subject roots and user-owned topic tags.
- A quiz-tag association table links quizzes and tags; it has a uniqueness constraint so the same tag cannot be attached twice to one quiz.
- Backend tag catalog, schemas, validation, and service logic live in a dedicated `services/api/app/tags/` package. The database model lives with the other SQLAlchemy models. Future features can reuse the Tag module and add their own association table, preserving database foreign keys rather than using a polymorphic target ID.
- Frontend tag selection/display/filter controls live in a reusable `WebApp/src/tags/` module. The quiz library is the first consumer; future screens can reuse those controls.
- The initial subject catalog is maintained as data in the tag module and seeded idempotently. Existing SQLite databases receive additive tag and association tables; existing quiz and attempt records are not rewritten or deleted.

This is preferred over JSON fields on each quiz (which are harder to query and reuse) and over a generic polymorphic tagging system for every entity (which adds unnecessary complexity before another feature needs it).

## 5. Quiz-library experience

- Show attached subject/topic tags as readable chips on quiz cards.
- Provide an accessible action to manage a quiz's tags. The owner can select multiple built-in subjects or their own topic tags, remove selected tags, and create a new topic under a selected subject without leaving the library.
- Provide one search field with the label/placeholder `ค้นหาชื่อข้อสอบหรือ tag`. Matching is case-insensitive substring search over quiz titles and names of tags attached to the user's quizzes.
- Provide a subject/tag filter. A subject filter includes direct subject assignments and child-topic assignments. A topic filter matches that topic only.
- When both a search term and a tag filter are active, apply the search match and selected-tag filter together. Search matches title OR attached tag name; the selected filter is an additional constraint.
- Search and filter apply on submission (Enter or the search button), not on every keystroke. Changing the query or filter resets pagination to the first page.
- Results remain newest-first and use the existing 20-item pagination. Empty, loading, and error states remain accessible; an empty search/filter result offers a way to clear filters.
- Tag creation and quiz assignment are explicit user actions. The system does not infer or auto-assign tags from document content.

## 6. API and data behavior

All endpoints require the existing authenticated session. Mutations require the existing same-origin protection.

- `GET /api/tags` returns the built-in subjects and only the current user's custom child tags, grouped or linked by parent subject.
- `GET /api/tags` returns `{ "subjects": [...] }`. Each subject has `{ "id", "name", "slug", "children" }`; each child has `{ "id", "name", "parent_id", "is_builtin": false }`. Subject roots use `is_builtin: true` and an empty `children` list when there are no custom tags.
- `POST /api/tags` creates a custom child tag from `{ "name": "...", "parent_tag_id": 1 }` and returns `{ "id", "name", "parent_id", "is_builtin": false }`. A user may select only an existing built-in subject as parent. Names are trimmed, non-empty, printable, and limited to 40 characters. Duplicate names are rejected within the same user and parent, using case-insensitive uniqueness for Latin text.
- `PUT /api/quizzes/{quiz_id}/tags` replaces that owned quiz's tag set from `{ "tag_ids": [1, 2] }` and returns the updated `QuizLibraryItem`. Every ID must be a built-in subject or a custom tag owned by the requester; duplicate IDs are rejected and the operation is atomic. `QuizLibraryItem.tags` is a list of `{ "id", "name", "parent_id", "is_builtin" }` objects.
- `GET /api/quizzes` retains `limit` and `offset` and adds optional `q` and `tag_id` query parameters. `q` searches title or attached tag names. `tag_id` filters by a subject including its children or by one exact topic tag. The result remains owner-scoped and includes the existing attempt summaries and attached tag metadata.

Unknown quizzes and tags that are not available to the current user return non-disclosing `404` responses. Invalid tag names, parent types, or request shapes return `422`. A duplicate custom tag returns `409` with a safe message. A quiz never reveals another user's private tags.

## 7. Security and persistence constraints

- The server is authoritative for tag ownership and quiz-tag associations; UI filtering is not a security boundary.
- Built-in subject tags are not editable or deletable by users.
- Custom topic tags are private to their owner and cannot be attached to another user's quiz.
- Deleting a quiz removes only its association rows; it does not delete shared subjects or the user's reusable custom tags.
- No full source contents, answer keys, or unrelated profile data are added to tag/list responses.
- No third-party search service or new dependency is needed; search is performed by the existing API/database.

## 8. Acceptance tests

### Backend

- Built-in subject seeding is idempotent and exposes exactly the seven approved subjects.
- A user can list built-ins and their own child tags but cannot see another user's custom tags.
- Tag creation trims and validates names, requires a built-in subject parent, and rejects duplicates and invalid input.
- The owner can attach multiple available tags and remove tags; invalid or foreign tag IDs do not partially change associations.
- Quiz library search matches title or attached tag name, is case-insensitive, and remains scoped to the signed-in user.
- Subject filtering includes child-tagged quizzes; child filtering is exact; combining a query and filter returns only rows satisfying both conditions.
- Pagination remains newest-first and does not return duplicate quizzes when multiple tags match.

### Frontend

- Quiz cards display their tags and support opening the reusable tag manager, creating a child tag, and saving/removing associations.
- Search by title and by tag name works, and subject/topic filters follow the specified matching semantics.
- Changing a query/filter resets to page one; load-more preserves filters and deduplicates shifted results.
- Loading, empty/no-match, save success/failure, and API-error states are accessible.
- Existing authenticated routes, quiz-taking/history flows, theme behavior, and other tests continue to work.

## 9. Out of scope

- Adding any subject beyond the seven listed above, including วิทยาการคำนวณ.
- Automatic AI-generated tags or automatic subject inference.
- More than one child level, user-created root subjects, editing/deleting tags, or sharing tags between users.
- Filtering by several selected tag filters at once; one tag filter at a time is sufficient, while each quiz may carry multiple tags.
- Searching document contents, question text, answers, or attempt history.
- Applying tags during quiz generation; this phase assigns tags from the quiz library after creation.
- Changes to AI provider integration, public deployment, commit, push, or PR creation.

## 10. Definition of done

- The user can organize quizzes with the seven subject roots and custom child tags, including multiple tags per quiz.
- The user can find quizzes by title or attached tag name and filter by subject or a specific child tag.
- Tag data is owner-safe, persistent, and provided through a reusable backend/frontend module.
- All relevant API and WebApp tests pass, and the WebApp production build succeeds.
- Only the approved C: worktree changes; no commit or push is made.

**Review gate:** Conversational architecture and written specification approved on 2026-10-11. Implementation must wait for review and approval of its implementation plan.
