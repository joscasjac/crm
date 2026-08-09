# Keyboard shortcuts modal and landing headline

Created: 2026-08-09 09:15 UTC
Last Updated: 2026-08-09 09:20 UTC
Status: Done

## Problem

1. The demo has keyboard shortcuts (Cmd K search, Ask composer keys)
   but no way to discover them, and no shortcut for the sidebar toggle.
2. The landing headline reads "The CRM built for agents"; the user wants
   "The CRM built for agents on Convex".

## Proposed solution

- New `src/components/ShortcutsModal.tsx`: a modal styled like the
  Command-K palette listing every real shortcut in the app.
- A Phosphor Keyboard icon button next to the theme switcher in the
  sidebar footer that opens the modal.
- Global keys in AppLayout: Cmd ? (Cmd Shift /) opens and closes the
  modal, Cmd . toggles the sidebar. Ctrl works as the modifier on
  non-Mac keyboards.
- Landing h1 becomes "The CRM built for agents on Convex".

## Files to change

- src/components/ShortcutsModal.tsx (new)
- src/app/AppLayout.tsx
- src/pages/Landing.tsx
- Docs.tsx shortcut list if one exists, CHANGELOG.md, files.md, task.md

## Edge cases

- Cmd Shift / reports key "?" on most layouts but "/" with shiftKey on
  some; match either.
- Cmd . must not fire while the shortcuts modal handles Escape; the two
  keys are independent so no conflict.
- Shortcuts should not fire while typing in inputs for Cmd . and Cmd ?
  is fine since the modifier is held; browsers reserve neither.

## Verification

- npm run lint, app typecheck
- Browser: icon opens the modal, Cmd ? toggles it, Cmd . collapses and
  expands the sidebar, Esc and backdrop click close the modal.

## Task completion log

- 2026-08-09 09:15 UTC: PRD written.
- 2026-08-09 09:20 UTC: Shipped and verified. Lint and app typecheck
  clean; browser pass confirmed the headline, the footer icon and modal,
  Cmd ? toggling with Escape closing, and Cmd . collapsing and expanding
  the sidebar.
