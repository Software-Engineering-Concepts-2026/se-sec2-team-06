# Tutor History Tagging and Deletion

## Goal

Let a user assign or change tags on an existing Tutor conversation and delete an old conversation from history.

## Approved behavior

- Each conversation in Tutor history exposes **แก้ไขแท็ก** and **ลบแชต** actions.
- Editing opens a dialog using the existing tag catalog and picker; saving replaces that conversation's tag set. The history card and active conversation reflect the saved tags.
- Deletion requires confirmation. It removes the user's conversation, messages, tag associations, attachment records, and stored private attachment objects.
- Editing and deletion are unavailable while the conversation is processing; the API also rejects those requests during processing to avoid races.
- Both mutations are owner-scoped and retain the existing same-origin protections.

## Existing-system constraints

- Reuse the existing tag ownership/availability validation and shared tag-picker components.
- Preserve current history search, tag filtering, open-chat behavior, and new-chat tag selection.
- Do not add migrations unless implementation inspection proves they are necessary.

## Validation

- API tests cover tag replacement, invalid/unavailable tags, processing and ownership guards, plus deletion cleanup and ownership isolation.
- Web tests cover editing tags after creation, active/history tag refresh, confirmed deletion, and cancellation.
- Run the focused tests first, then all WebApp and API tests.
