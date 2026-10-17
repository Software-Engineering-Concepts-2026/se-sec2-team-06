# Quiz Tag Colors and Inline Picker — Design Specification

**Status:** Approved on 2026-10-11.  
**Date:** 2026-10-11  
**Scope:** Persisted tag colors, quick tag assignment, inline tag creation, and tighter quiz-library layout.

## 1. Purpose

Make quiz tags quick to scan and manage. Users should be able to search and click colored tag pills to add or remove them immediately, create a colored topic tag without leaving the quiz card, and find quizzes by title or tag. The tag catalog remains a reusable feature rather than a quiz-library-only implementation.

## 2. Approved user intent and constraints

- Tag assignment must use clickable pills, not a long checkbox list or a Save-tags button.
- Clicking an available tag adds it; clicking an attached tag removes it. The change saves automatically.
- A newly created custom topic tag is attached to the quiz from which it was created immediately.
- Custom tags choose a color from a fixed palette of 10 options. A saved color follows that tag everywhere it is used.
- Built-in subject tags receive fixed, distinct colors automatically.
- The quiz library should use its available width better and reduce excess whitespace while staying responsive.
- Keep title/tag search, subject/topic filtering, quiz history, and repeat attempts working.
- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`. Do not access or modify `D:\Project SE Sce 2\se-sec2-team-06`, do not modify `prototypes/`, and do not commit or push.

## 3. Tag color model

Add a required `color` token to the reusable Tag entity. Store a palette key, never an arbitrary CSS value, so server responses cannot inject styles and all consumers render colors consistently.

The palette contains 10 stable keys: `violet`, `blue`, `cyan`, `teal`, `green`, `lime`, `amber`, `orange`, `rose`, and `pink`. The frontend owns the presentation mapping from keys to theme-aware color values and selected/unselected styles. The backend validates keys against the same allowed set.

Each built-in subject has one fixed palette key assigned in the subject catalog. For the current seven subjects use:

| Subject | Color key |
| --- | --- |
| คณิตศาสตร์ (`math`) | `blue` |
| ภาษาอังกฤษ (`english`) | `violet` |
| ภาษาไทย (`thai`) | `rose` |
| ฟิสิกส์ (`physics`) | `cyan` |
| เคมี (`chemistry`) | `green` |
| ชีววิทยา (`biology`) | `lime` |
| สังคมศึกษา (`social-studies`) | `amber` |

The mapping is part of the seeded catalog and is not user-editable. User-created child tags default to `violet` only for backward-compatible clients; the new UI always sends the selected palette key.

## 4. Persistence and migration

- Add a non-null `color` column to `tags`, constrained by application validation to the 10 palette keys.
- New databases receive the field through normal table creation. Existing SQLite databases receive an additive startup migration: add the column with `violet` as the safe default, then update built-in subject rows to their fixed colors by stable slug. Existing custom tags retain `violet` until changed through a future color-editing feature; this phase does not add tag editing/deletion.
- Migration is idempotent, does not delete/rewrite quiz or attempt data, and does not require a database reset.
- Built-in seeding remains idempotent and refreshes their fixed color to match the catalog. Existing custom tags are never overwritten by seeding.

## 5. API contracts

Keep the existing authenticated endpoints and ownership rules.

- `GET /api/tags` includes `color` on each subject and child tag.
- `POST /api/tags` accepts `{ "name": "...", "parent_tag_id": 1, "color": "pink" }` and returns the created tag including `color`. `color` is optional for compatibility and defaults to `violet`; invalid palette keys return `422`.
- `PUT /api/quizzes/{quiz_id}/tags` retains its atomic full-set replacement contract and returns a quiz item whose tag summaries include `color`.
- `GET /api/quizzes` retains title/tag search and filtering; all tag summaries include `color`.
- No response exposes another user's private tags. Existing clients that ignore the additive `color` property remain compatible.

## 6. Reusable frontend tag controls

Keep tag rendering and selection reusable under `WebApp/src/tags/`.

- Render tags as semantic buttons styled as rounded pills; use a stable `data-color` palette key, not a raw server-provided style.
- Selected/attached pills use a strong color fill and readable contrast; unselected pills use a subtle tinted or neutral treatment while retaining a visible color cue. Include accessible selected state (`aria-pressed`) and focus indication.
- Provide a compact inline picker for a quiz card: a search field, clickable built-in subject pills, and custom topic pills grouped under their parent subject. All pills—including built-in subjects—toggle assignment directly. Do not render a long checkbox list and do not include a separate save action.
- Search within the picker narrows the visible tag pills by name across subjects and topics; it does not change which tags are assigned.
- The create form stays in the picker and contains tag name, parent subject, and 10 labeled color swatches. A swatch is a single-choice radio group with keyboard support and a visible selected marker.
- Creating a tag creates it under the selected built-in subject and immediately attaches it to the current quiz. On success, its pill appears selected. On duplicate/validation/network errors, preserve entered values and show an accessible error.
- Existing library-level subject/topic filtering remains available separately from the card picker. Search and filtering continue to use the established API semantics.

## 7. Immediate-save and failure behavior

- On a pill click, update the card optimistically and issue `PUT /api/quizzes/{id}/tags` with the desired complete set of tag IDs.
- Avoid stale-write races from rapid clicks: maintain the latest desired tag set and serialize requests per quiz, sending the newest desired set after the current request settles. Do not issue overlapping replacement requests for the same quiz.
- If a save fails, restore the last server-confirmed tag set, stop the queue, and show an accessible retryable error. A subsequent user click may retry. Do not claim success until the server confirms the saved set.
- Prevent double-create submissions while the create request is in flight. After creation succeeds, include the returned ID in the desired set and persist attachment through the same serialized save mechanism. If attachment fails, report that the tag exists but could not be attached, and leave it visible in the catalog.
- Keep each card's state isolated so changing one quiz never overwrites another quiz's tags.

## 8. Quiz library layout

- Widen the library content from its current 1040px cap to approximately 1180px on desktop, without changing quiz detail-page width.
- Reduce excessive top/bottom padding and tighten vertical gaps between heading, search/filter controls, cards, and card metadata.
- Keep cards readable and avoid packing metadata into a dense table. Use responsive columns for metadata only when space permits; stack controls and cards on narrow screens.
- Keep the existing site theme tokens, accessible contrast, readable typography, and mobile overflow behavior. The tag palette must adapt to the existing theme system.

## 9. Security, compatibility, and non-goals

- Authentication, same-origin protection for mutations, owner scoping, and non-disclosing foreign-resource behavior remain unchanged.
- Only allow known palette keys. Never persist or interpolate raw CSS colors supplied by the client.
- No new dependency, color picker widget, AI-based tagging, tag sharing, tag deletion/renaming, per-user palette, or arbitrary custom colors in this phase.
- Do not change quiz generation, question/answer content, attempt grading/history, authentication, or provider integration.

## 10. Acceptance tests

### API and database

- New database creates tags with valid color keys; invalid keys are rejected.
- Existing SQLite database migrates idempotently without reset; old built-in subjects receive their fixed colors and old custom tags receive the safe default.
- Built-in seeding updates built-in colors but does not overwrite custom tag colors.
- Catalog, create, quiz-list, and quiz-tag-replacement responses include valid color keys.
- Color data remains owner-safe and existing tag/quiz assignment behavior is unchanged.

### Frontend components and page

- Palette presents exactly 10 accessible color choices; selected and unselected states are distinguishable.
- Built-in subject and custom tag chips render their persisted colors and expose selected state accessibly.
- Clicking a pill adds/removes without a checkbox or Save button; only the clicked quiz's association changes.
- Rapid toggles produce a final server state matching the last desired set without overlapping stale writes.
- Save failure rolls the card back to the confirmed state and announces an accessible error.
- Creating a child tag with a chosen color persists the color and immediately attaches it; validation and attachment failures are handled distinctly.
- Picker search and subject narrowing work without changing quiz-library filtering semantics.
- Library is wider and less vertically sparse on desktop, remains usable on small screens, and quiz detail layout is unchanged.
- Existing search, filters, title editing, attempt history, repeat attempts, theme behavior, and routes continue to work.

### Verification

- Focused API and WebApp tests pass.
- Full API and WebApp suites pass and the WebApp production build succeeds.
- Only the approved C: worktree is modified; no commit or push is made.

## 11. Definition of done

Users can visually distinguish tags by persistent, validated colors; manage quiz tags by clicking pills with immediate save; create a colored topic tag and attach it in one flow; and browse a more space-efficient quiz library without losing existing search, filtering, history, or repeat-attempt behavior.

**Review gate:** UI direction and written specification approved on 2026-10-11. Implementation must wait for review and approval of its implementation plan.
