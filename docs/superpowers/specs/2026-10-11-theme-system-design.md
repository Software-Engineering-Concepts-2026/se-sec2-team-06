# SynapseSync Theme System — Design

**Status:** Approved  
**Scope:** Add shared, user-selectable visual themes to the existing WebApp.

## Goal

Let users switch the appearance of SynapseSync from the shared navbar. Store all palette values in one reusable theme configuration so current and future pages use the same design tokens instead of duplicating color choices.

## Agreed direction

- Provide three initial themes: the current dark theme, a light theme, and a deeper purple theme.
- Keep the current dark theme as the first-visit default.
- Apply a theme across Home, Login, Register, Profile, the navbar, and shared dialogs.
- Remember the selection in this browser using `localStorage`; do not add an API or database dependency.
- Do not commit or push this work.

## Approaches considered

1. **Theme data in JavaScript + CSS custom properties (recommended):** a single palette configuration is applied to the document root. CSS for every page reads semantic variables. This keeps theme definitions reusable and avoids duplicating colors in each page.
2. **CSS-only theme selectors:** define each palette in CSS and switch a root class. This is simpler at runtime, but the values are not available from a reusable JavaScript configuration file as requested.
3. **Install a UI/theme library:** provides more abstractions, but adds a dependency and is unnecessary for this small vanilla-JavaScript app.

The recommendation is option 1, following the app's current vanilla-JavaScript and CSS-variable structure.

## Architecture and data flow

```text
WebApp/src/theme/theme-config.js
  ├─ theme IDs, display names, color-scheme, and CSS token values
  └─ imported by theme-manager.js
       ├─ reads and validates the saved theme
       ├─ applies tokens and data-theme to document.documentElement
       └─ persists selection in localStorage

Navbar theme selector ── on change ──> theme-manager ──> shared CSS tokens
Pages and components ─────────────────────────────────> var(--token)
```

Proposed files:

- `WebApp/src/theme/theme-config.js` — the single source of truth for the three palettes and their labels.
- `WebApp/src/theme/theme-manager.js` — safe initialization, validation, application, and persistence.
- `WebApp/src/components/Navbar.js` — accessible theme selector available when signed in or signed out.
- `WebApp/src/main.js` — initialize the saved theme before rendering pages and pass the current selection/change handler to the navbar.
- `WebApp/src/styles.css` — replace theme-sensitive hard-coded colors with semantic CSS custom properties and retain a default palette before JavaScript starts.
- `WebApp/tests/theme-manager.test.js` and `WebApp/tests/pages.test.js` — cover palette application, fallback/persistence, and navbar selection.

Page styles should consume shared CSS variables (for example, page background, text, muted text, surfaces, borders, inputs, accents, focus, and feedback colors) rather than importing or redefining a palette. The theme config remains available for future JavaScript components that need palette metadata. The atom illustration's orbital identity can retain its violet/teal brand glow while the surrounding interface changes theme.

## User experience and behavior

- Add a compact, keyboard-accessible selector labeled `ธีม` to the existing shared navbar. It appears in both signed-in and signed-out navigation states and remains usable at mobile widths.
- Selecting a theme updates the interface immediately without a page reload.
- On navigation/re-render, retain the selection; on a later visit in the same browser, restore it from `localStorage`.
- If storage is unavailable or contains an unknown theme ID, use the current dark theme without breaking page rendering.
- The theme changes page/background gradients, navbar, cards, form surfaces, text, borders, buttons, focus indicators, and status feedback. The atom illustration remains a consistent brand element.
- No theme selection is sent to the server and no user profile fields are changed.

## Validation

- Unit tests cover all theme IDs, root token application, invalid saved values, persistence, and safe fallback when storage fails.
- Navbar tests verify the selector is present for both account states, exposes all theme labels, and calls the change handler.
- Run the full WebApp test suite and production build.
- Visually inspect Home, Profile, and an account form in each theme at desktop and narrow widths; confirm text and controls remain legible and the navbar does not overflow.

## Out of scope

- Per-user server-side theme preferences or database migrations.
- Custom user-defined colors, seasonal themes, animations, or a theme editor.
- Redesigning page layouts or changing the current font/typography request.
