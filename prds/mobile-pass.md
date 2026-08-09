# Mobile pass for the marketing site and demo app

Created: 2026-08-09 11:30 UTC
Last Updated: 2026-08-09 11:30 UTC
Status: In progress

## Problem

The app and marketing pages were built desktop first. At phone width
(375px) several layouts break or become unusable:

1. AppLayout has no mobile navigation. The sidebar either takes most of
   the screen or is hidden entirely with no way to reach nav items.
2. Data tables (Companies, Contacts, Activity, Deals list view,
   Compare) overflow the viewport with no horizontal scroll container.
3. ComposeEmail is a draggable desktop window with a fixed 560px width
   that spawns partly off screen on phones.
4. CommandK and ShortcutsModal sit at pt-[15vh] with no side padding,
   so they touch the screen edges.
5. Ask has a fixed 224px conversation sidebar that leaves almost no
   room for the chat on a phone.
6. Detail pages (Company, Contact) use three column stat grids and
   header rows with buttons that overflow at 375px.
7. Landing header nav shows all links plus buttons and wraps badly.
8. Page headers with search inputs and filters (Companies, Contacts,
   Activity, Deals) put fixed width inputs in one row.
9. Settings custom fields form uses fixed widths (w-48, w-80) that
   overflow.
10. Dashboard metric grid uses grid-cols-2 which is fine, but the
    lower panels and page paddings need checks.

## Proposed solution

Keep the desktop experience unchanged. All fixes are additive
responsive classes plus a small amount of mobile only UI.

- AppLayout: below md, hide the desktop sidebar and add a fixed top
  bar (logo, search button, menu button) with a slide-over drawer that
  reuses the nav content. Drawer closes on navigation. Main content
  padding drops to p-4 on mobile.
- Tables: wrap each table in overflow-x-auto and hide lower priority
  columns below md where sensible (hide via hidden md:table-cell).
- ComposeEmail: below sm, render as a full width bottom sheet
  (inset-x-0 bottom-0) instead of the draggable window; keep drag and
  resize on desktop only.
- CommandK and ShortcutsModal: add px-4 to the overlay and lower top
  padding on small screens (pt-[10vh]).
- Ask: conversation sidebar becomes a horizontal strip or collapsible
  section above the chat below md.
- Detail pages: stat grids go grid-cols-1 sm:grid-cols-3, header rows
  wrap with flex-wrap, tab bars get overflow-x-auto.
- Landing header: hide Compare and Docs links behind nothing fancy;
  they simply hide below sm since GitHub, theme, and the demo button
  matter most. Hero paddings tighten.
- PageHeader action rows: flex-wrap so buttons and inputs stack.
- Settings fields form: fixed widths become w-full sm:w-48 etc.
- index.css: no global changes expected beyond what exists.

## Files to change

- src/app/AppLayout.tsx (mobile top bar plus drawer)
- src/app/Companies.tsx, Contacts.tsx, Activity.tsx, Deals.tsx
  (table scroll wrappers, column hiding, filter row wrapping)
- src/app/Dashboard.tsx (grid and spacing checks)
- src/app/Ask.tsx (sidebar behavior below md)
- src/app/CompanyDetail.tsx, ContactDetail.tsx (headers, stat grids,
  tab overflow)
- src/app/Settings.tsx (fields form widths)
- src/app/Agents.tsx (form row wrapping)
- src/components/ComposeEmail.tsx (bottom sheet below sm)
- src/components/CommandK.tsx, ShortcutsModal.tsx (overlay padding)
- src/pages/Landing.tsx, Compare.tsx, Docs.tsx (header nav, table
  scroll, spacing)
- task.md, CHANGELOG.md, files.md

## Edge cases

- Drawer must close when a nav link is tapped and on Escape.
- Drag to reorder nav items stays desktop only; the drawer renders
  plain links.
- ComposeEmail pointer handlers must not run in sheet mode.
- Kanban board already scrolls horizontally; keep column width fixed
  so cards stay readable.
- Docs page already has a mobile "on this page" block; keep it.

## Verification

- npm run lint and tsc typecheck
- Browser pass at 375px across: Landing, Compare, Docs, Dashboard,
  Companies, Contacts, Deals (board and list), Ask, Activity, Agents,
  Company detail, Contact detail, Settings, CommandK, ShortcutsModal,
  ComposeEmail.

## Task completion log

- 2026-08-09 11:30 UTC: PRD written after full code audit.
