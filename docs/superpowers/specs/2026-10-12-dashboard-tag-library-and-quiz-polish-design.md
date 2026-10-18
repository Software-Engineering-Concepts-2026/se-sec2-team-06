# Dashboard, Tags, Document Library, and Quiz Library Polish

**Status:** Approved by the user on 2026-10-12. This document is the implementation source of truth for the follow-up scope.

## Goal

Make the shared tag experience simpler, improve document and quiz browsing/reading, restore a clear quiz-creation path, and turn the signed-in Home page into a useful study dashboard. Keep the experience consistent across the existing themes and responsive layouts.

## Approved design decisions

### 1. Shared, flat tag experience

- Keep the existing built-in subject tags and their colors as the initial catalog.
- Remove the user-facing “หลัก/ย่อย” hierarchy and the parent-subject selection step when creating a tag. A newly created tag is appended to the shared tag list.
- Preserve any existing parent metadata internally as legacy data; do not delete or rewrite existing assignments as part of the UI change.
- Tags created by a learner remain private to that learner. Tag IDs and ownership are validated by the API.
- Keep the ten-color palette for custom tags. Built-in tags retain their current assigned colors.
- Render selectable tags as compact chips. Selecting a chip applies or removes it immediately; there is no separate save-tags action.
- Place tag creation below the existing tag list. Search the catalog by tag name, and make the selected state clear in every theme.
- Use the same tag catalog and assignment behavior in document library, quiz library, Tutor, deadline planner, and progress features wherever tags are used.

### 2. Document library and reader

- Keep document search, tag filters, upload, edit-tags, open, and delete actions available.
- Use a compact responsive card grid: four cards per row on wide screens, two on medium screens, and one on narrow screens. Show at most six desktop rows (24 documents) per page, then paginate.
- Show a real document preview/thumbnail where supported, rather than an empty generic preview. Keep a file-type fallback for formats that cannot be previewed.
- Keep tag assignment compact: chips first, tag creation underneath, immediate assignment.
- Center the reader in the available content area and enlarge the readable page/content. PDF pages fit the viewer width by default and may be zoomed; all pages remain reachable through scrolling/page controls.
- Retain the existing fullscreen and zoom controls. Avoid nested horizontal/vertical scrollbars where the page can fit naturally.
- Preserve clear loading, unsupported-preview, empty-library, and error states.

### 3. Quiz library and attempt review

- Keep a visible **Create quiz** action on the quiz library even when quizzes already exist.
- Use compact quiz cards: two columns on wide screens, one on narrow screens, with at most six desktop rows (12 quizzes) per page and pagination beyond that.
- Make the best score a green-highlighted metric placed on the right beside the repeat/start action.
- Add a circular red trash action to each quiz card. It opens a confirmation dialog before deletion and explicitly warns that the quiz, all attempts, answers, and associated review history will be permanently removed.
- On confirmation, delete only the selected quiz and its dependent attempt/review data; preserve every other quiz. Enforce ownership in the API and cascade deletion in the database.
- Move **Back to quiz library** to a visible corner of the quiz-detail summary and style it red so it is easy to find.
- Keep quiz search, tag filters, history, repeat, and attempt review behavior.

### 4. Home page and dashboard

- Use a card-based, rounded dashboard inspired by the supplied reference: clear hierarchy, compact information, and theme-aware soft color surfaces. Keep the same layout structure in all themes rather than creating a separate layout per theme.
- Signed-in Home shows a concise welcome/header and useful feature shortcuts, followed by:
  - An upcoming-deadlines preview sorted by nearest deadline, with a link to the full deadline planner.
  - A progress summary using the latest real quiz result and practice history; a score of zero is shown as zero, not as missing data.
  - The four dashboard visualizations below.
  - Recent quiz and document cards with links to their full libraries.
- The layout may use a two-column dashboard on wide screens and stack these sections on smaller screens. Shortcuts link to the existing feature pages and do not replace their full workflows.
- Build every section only from the current learner’s real data. Show a section-specific empty or error state when that data is absent or unavailable.
- Signed-out Home keeps the animated atom visual and clear sign-in/create-account calls to action. Reuse the atom visual on Login.
- The dashboard includes four visualizations:

  1. **Quiz activity:** bar chart of submitted/completed quiz attempts per day or week. Provide day/week selection. Starting a quiz without submitting it does not count as a completed attempt.
  2. **Task completion:** donut chart with counts for `not_started`, `in_progress`, and `completed` tasks, including a readable legend and counts.
  3. **Document library by tag:** chart of document counts by assigned tag, including an “untagged” category. A document assigned to multiple tags appears once in each relevant tag’s count; the chart is a per-tag distribution, so those counts need not sum to the unique-document total.
  4. **Topics to review:** horizontal bar chart of quiz-level average scores grouped by the quiz’s tags, ordered from lowest score upward. Show the number of submitted attempts used for each average. This is a tag-level signal, not question-level mastery; do not imply otherwise.

- The earlier study-time chart and manual study timer are out of scope after the user replaced that chart with quiz activity.
- Charts use actual persisted data only. Show an honest empty state when data is absent, distinguish a score of zero from missing data, and never render placeholder/example values as learner data.
- Chart labels, legends, and accessible text provide the important values without relying on color alone.

### 5. Theme, dropdown, and motion consistency

- Use one shared layout and theme tokens across the existing dark, light, and purple themes. Cards, chart palettes, tags, dropdowns, and dialogs adapt to the selected theme.
- Polish remaining subject, provider, and model dropdowns with consistent sizing, spacing, focus/selected states, and readable options. Preserve keyboard and screen-reader operation.
- Add a restrained shared page-entry/pop-in motion so content feels consistent across pages. Respect `prefers-reduced-motion` and do not make interaction state depend on animation.

## Data and API behavior

- Add a task status enum with `not_started`, `in_progress`, and `completed`. Migrate legacy incomplete tasks to `not_started` and completed tasks to `completed`; preserve current task records and deadlines.
- Update task create/edit/complete flows and filters to use the three statuses. Existing “all / unfinished / completed” filters continue to work, with unfinished including both `not_started` and `in_progress`.
- Provide an authenticated, owner-scoped dashboard overview API that returns the selected period’s quiz activity, task counts, document counts by tag, and quiz average scores by tag. The exact route should follow the existing API versioning and router conventions.
- Keep dashboard aggregation server-side or otherwise ensure it uses complete, owner-scoped data rather than a partial client page of paginated records.
- Add an owner-scoped quiz delete API. It must delete only the requested quiz and dependent attempts/reviews, and return a clear not-found/unauthorized response without leaking another learner’s data.
- Reuse existing quiz-attempt, document, and tag records; do not add a study-session table or timer in this scope.

## Acceptance criteria

### Tags

- Creating a tag requires a name and color, but no parent subject.
- A new tag appears at the end of the current learner’s tag list and is selectable in every supported feature.
- Clicking a tag chip applies/removes it immediately and the displayed assignment updates without a separate save action.
- Existing tagged documents/quizzes remain assigned after the flat presentation is introduced.

### Documents

- On wide screens, the library shows up to four document cards per row and no more than 24 per page; paging reveals the rest.
- Search and tag filtering work together and preserve an all-documents option.
- Selecting a card opens the matching document and preserves its metadata and tags.
- The reader shows content centered and at a readable size; PDF zoom/fullscreen and access to all pages continue to work.
- Empty, unsupported, and error states never create fake document cards.

### Quizzes

- Create quiz remains visible with an empty or populated library.
- On wide screens, the library shows up to two quiz cards per row and no more than 12 per page.
- Best score is green and visually grouped with the repeat/start action.
- Canceling delete leaves the selected quiz and all data intact. Confirming delete removes only that quiz and its attempts/answers/reviews.
- The quiz-detail back-to-library action is visible, red, and returns to the library.

### Dashboard

- Quiz activity responds to day/week selection and counts submitted attempts only.
- Task counts distinguish not started, in progress, and completed, and total counts match the learner’s tasks.
- Document distribution is grouped by tag and includes untagged documents; multi-tag counts follow the per-tag rule above.
- Weak-topic bars are based on submitted quiz scores grouped by tag, show their sample counts, and do not claim question-level analytics.
- An account with no underlying records sees useful empty states rather than seeded data.
- Requests and results are isolated to the signed-in learner.

### Global UI

- Layouts remain usable at desktop, tablet, and phone widths across all existing themes.
- Dropdowns can be used by keyboard and expose clear focus/selection states.
- Shared entrance animation is disabled or reduced when the user requests reduced motion.

## Out of scope

- Study-time tracking or an elapsed-time timer.
- Teacher/group dashboards or cross-learner analytics.
- Per-question/topic mastery analytics unless questions are separately tagged in a future design.
- Automatic AI recommendations beyond presenting evidence-backed quiz score trends.
- Changing authentication, provider credentials, or AI-generation behavior.

## Review note

The written specification has been approved. The implementation plans are being prepared separately; no product-code changes are included in this specification step.
