# Tutor Chat Workspace Design

## Goal

Make `/tutor` feel like the dark, focused chat workspace in the user's reference: a compact navigation rail, conversation toolbar, collapsible learning-tools rail, provider-first model picker, and composer anchored at the bottom.

## Scope

- Apply the dark workspace only on the Tutor route; other SynapseSync pages retain the current theme and navigation.
- Replace the Tutor page's large title/actions area with a conversation header containing the active conversation title and subject tags.
- Add a narrow left rail for starting a chat, opening searchable conversation history, and navigating to existing app destinations. History opens as a dismissible drawer rather than occupying permanent width.
- Keep the existing right-side learning context (subject/topic tags) behind a compact icon rail that can expand and collapse.
- Keep the message timeline and composer in a viewport-sized center column. The composer remains visible at the bottom without covering messages.
- Open the AI selector from the composer as a dark dialog: provider choices first, then the selected provider's models. Selecting a model updates the existing provider/model selection and closes the dialog.
- Keep image attachment, response-language, tags, disabled states, retry behavior, conversation history/search, and existing API request payloads.
- Adapt layout for narrow viewports: rails become compact controls/drawers, the message column and composer stay usable, and dialogs remain within the viewport.

## Out of scope

- Changes to backend APIs, persistence, AI-provider configuration, or conversation/message formats.
- Restyling other routes or changing the shared theme preference.
- Deploying, merging, or pushing changes.

## Acceptance criteria

1. At desktop size, `/tutor` has a full-height dark chat workspace with left navigation, conversation header, central messages/composer, and a right tool rail.
2. History is hidden until opened; opening it exposes the existing search, tag filter, and conversation list, and choosing a conversation closes the drawer.
3. The right tools rail can be opened and closed while retaining selected context tags.
4. The composer provider control opens a dialog where the user chooses a provider, then one of that provider's available models; the chosen values are used in the next request.
5. Existing image capability checks, response language, tags, retries, and conversation APIs continue to work.
6. The layout works at 2K, 1080p, and narrow/mobile widths, and the global navbar/footer are hidden only while the Tutor route is active.
7. All new interactions have automated tests and the WebApp test suite and production build pass.
