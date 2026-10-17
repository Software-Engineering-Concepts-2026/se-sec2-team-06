# Vision-Inspired Home Dashboard Polish

## Status

Draft for user review. This workstream follows file persistence and the PDF reader; it is a presentation pass over existing, approved dashboard behavior.

## Goal

Make the signed-in Home dashboard feel more cohesive, polished, and visually expressive, using the referenced Vision UI Dashboard as inspiration while preserving SynapseSync branding, data, navigation, and themes.

## Approved decisions

- Treat Vision UI Dashboard as visual inspiration only: layered gradient/glass panels, clear hierarchy, concise metric cards, restrained accent color, and a compact dashboard grid. Do not copy its branding or migrate the project to React.
- Reuse the current Home dashboard’s real data and existing chart contracts: quiz attempts by day/week, task status, document distribution by tags, weak quiz topics, progress summary, recent quizzes/documents, upcoming deadlines, and feature shortcuts.
- Keep all existing themes supported by styling from the shared theme tokens. No hard-coded light-only or dark-only surface palette; check theme contrast for cards, chart labels, status colors, focus rings, and empty states.
- Keep the current guest Home/login atom visual and the existing bottom navigation. Do not add chart data, new analytics, or dashboard backend endpoints in this visual pass.
- Center the navbar profile portrait vertically in its existing account control. Remove the current downward translation while preserving the intentional portrait overlap/visual treatment and hover feedback.
- Prefer compact spacing and a responsive grid that uses the available width without making cards feel cramped. On small screens, stack panels and preserve readable chart labels.
- Respect reduced-motion preferences; any entrance/hover motion is short and subtle and must not delay access to dashboard content.

## Visual direction

- Use a clear header/welcome area with a compact current summary, then organize the high-value “what next” information before secondary recent activity.
- Use a deliberate grid: compact KPI/progress cards, the four existing data visualizations, and supporting deadline/recent-item panels. The layout order should remain understandable in a single mobile column.
- Add depth through theme-aware glass/surface layering, soft borders, and restrained gradient accents rather than oversized shadows or decorative filler.
- Establish predictable card headings, consistent internal padding, aligned actions, and clear empty/loading states so real data remains the focus.
- Do not make chart cards excessively tall, create large blank areas when a dataset is empty, or hide essential information in hover-only interactions.

## Acceptance criteria

1. Home retains all currently supported dashboard data, links, filtering, chart values, and empty states; no fabricated metrics appear.
2. The page has a coherent responsive dashboard grid inspired by the reference, not a one-to-one clone.
3. All current themes render legible card surfaces, text, chart marks, and focus states using shared tokens.
4. At tablet/mobile widths, cards reflow without clipping, overlap, or horizontal page scrolling.
5. Guest Home and Login retain the existing atom treatment; authenticated data is not requested for guest users.
6. Bottom navigation remains unchanged and usable; profile portrait is vertically centered within the navbar account control.
7. Motion respects `prefers-reduced-motion` and does not obscure or delay content.
8. Loading, no-data, and populated dashboard states remain visually clear and truthful.

## Out of scope

- New dashboard APIs/metrics, data model changes, new charts, navigation redesign, changing the existing atom, redesigning non-Home feature pages, or adopting Vision UI/React dependencies.

## Dependency

No dependency on file persistence or PDF reader behavior. It is sequenced third to keep the complete implementation and review aligned with the user's approved order.
