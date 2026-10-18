# Shuwichada Deadline Planner Design

## Status

Draft for user review. The product direction was approved in conversation on 2026-10-11. Implementation has not started.

## Goal

Bring Shuwichada's deadline-planner prototype into the signed-in SynapseSync app so learners can record upcoming work, see the nearest deadlines first, track completion, and remove a selected task. Keep task data available after refresh by persisting it in the API's existing SQLite database, scoped to the signed-in user.

## Product scope

### Included in the first release

- An authenticated `/deadlines` page linked from the shared navbar.
- A task form with title, subject, local due date, local due time, and urgency.
- Prototype subject choices: Physics, Mathematics, Chemistry, Biology, and Other (displayed in Thai).
- Three urgency levels: high (`ด่วน`), medium (`ปานกลาง`), and low (`ไม่ด่วน`).
- A task list ordered by due time, earliest first, with title, subject, due date/time, and urgency badge visible on each item.
- Filters for all tasks, incomplete tasks, and completed tasks. The selected filter is applied to the list and its empty state.
- A per-task completion control and a delete action that requires confirmation.
- An empty-library state when no tasks exist, and a filter-specific empty state when no task matches.
- A compact seven-day overview based only on saved tasks, following the Shuwichada prototype. It is a summary, not a second task editor.
- Shared SynapseSync themes, accessible labels and keyboard-operable controls, plus responsive layout adapting the prototype's form/list composition.
- Persistent, owner-scoped task storage through the existing API and SQLite setup.

### Excluded from the first release

- Actual reminders, notifications, or calendar integrations.
- Recurring tasks, sharing, collaboration, AI features, or attachments.
- Editing a task after creation; the requested first release covers creation, completion, and deletion.
- Sample or seeded tasks in the user-facing page. New accounts begin with an empty list.

## User experience

### Deadline page

- The navbar shows a `กำหนดส่งงาน` link only to signed-in users. A signed-out visit to `/deadlines` redirects to login and returns to the page after successful login.
- The page uses the shared theme and follows the prototype's two-column form/list layout on wider screens, stacking on narrow screens.
- Title, subject, due date, due time, and urgency are required. The subject choices match the prototype: ฟิสิกส์, คณิตศาสตร์, เคมี, ชีววิทยา, and อื่นๆ.
- On successful save, the new task appears immediately in due-date order and the form is reset. Failed saves leave the list unchanged and show a useful error.
- The default filter is `ทั้งหมด`; changing filters updates only the visible list. A filter with no matching tasks shows an empty state while preserving the selected filter.
- Marking complete changes only the selected task and immediately updates its badge and list placement/state. If the API update fails, restore the prior state and announce the error.
- Deleting requires confirmation. On confirmation, delete only the selected task; if the request fails, keep it visible and report the failure. Cancelling leaves it unchanged.
- The seven-day overview reflects actual tasks due in the current week; it never contains demonstration tasks.

## Data model and storage

Add a `Deadline` entity with:

- `id`: integer primary key.
- `user_id`: required foreign key to `users.id`, cascading on user deletion and indexed.
- `title`: trimmed string, 1–160 characters.
- `subject`: one of the five prototype subject values.
- `due_at`: required UTC timestamp. The browser combines the user's local date and time, sends an ISO timestamp with timezone, and renders the stored value in the browser's local timezone.
- `priority`: one of `high`, `medium`, or `low`.
- `is_completed`: required boolean, initially false.
- `created_at` and `updated_at`: UTC timestamps.

Register the model through the existing SQLAlchemy model registry and startup `Base.metadata.create_all` path. This adds a new table and does not alter existing user or application records.

## API and application behavior

Provide authenticated operations under `/api/deadlines`:

- `GET /api/deadlines`: list the current user's tasks in ascending `due_at` order; use a stable ID tie-breaker.
- `POST /api/deadlines`: validate and create a task for the current user; return the persisted task.
- `PATCH /api/deadlines/{deadline_id}`: update the completion boolean for a task owned by the current user.
- `DELETE /api/deadlines/{deadline_id}`: delete a task owned by the current user and return no content.

All reads and mutations must filter by authenticated `user_id`. State-changing requests use the existing same-origin protection. Missing or another user's task returns not found; invalid title, subject, priority, date, or completion payload returns a user-safe validation error.

The frontend API client exposes corresponding deadline functions. `main.js` wires them to the page; the router protects `/deadlines`; the navbar displays the link only when authenticated.

## Acceptance criteria

1. When a learner submits a task with title, subject, due date, and time, it is saved and appears in the list.
2. Each saved task shows its title, subject, due date/time, and urgency level; tasks are ordered by nearest deadline first.
3. Selecting high, medium, or low urgency shows the corresponding badge on the saved task.
4. Selecting all, incomplete, or completed filters shows only matching tasks. An empty list or a filter with no matches shows an appropriate empty state.
5. Marking a task complete or deleting it changes only the selected task and updates the list promptly. Deletion requires confirmation; cancellation preserves the task.
6. Tasks remain available after page refresh and API restart, and one user cannot read or change another user's tasks.
7. The weekly overview uses saved tasks only. No placeholder or seeded task cards appear for a user with no tasks.
8. The page follows the Shuwichada prototype's structure while working with all shared themes and keyboard-accessible controls.

## Validation and testing

- API tests cover task creation, list ordering, completion updates, deletion, validation, authentication, same-origin protection, and cross-user isolation.
- Web tests cover required form fields, task creation and displayed metadata, urgency badges, sorting, all three filters and empty states, selected-task completion/deletion, cancellation, API failure recovery, authenticated routing, and the navbar link.
- Run the API and WebApp test suites relevant to the feature, then the full WebApp test suite and production build before claiming completion.

## Implementation constraints

- Work only in the existing isolated worktree `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`.
- Do not inspect or modify the protected main folder `D:\Project SE Sce 2\se-sec2-team-06`.
- Do not commit or push unless the user explicitly requests it.
