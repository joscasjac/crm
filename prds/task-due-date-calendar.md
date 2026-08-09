# Task due dates: calendar picker and Ask date phrases

Created: 2026-08-09 17:00 UTC
Last Updated: 2026-08-09 17:10 UTC
Status: Done

## Problem

Tasks can only take a relative due date. The timeline composer offers a single
"due in N days" number field, and the Ask `/task` command only understands
"in N days" and "today". Nobody can say "due on Aug 15" in either place.

## Proposed solution

1. Add a themed `DateInput` calendar popover to `src/components/ui.tsx`,
   following the same pattern as the custom `Select` (outside click and Escape
   close, app palette, no OS popover).
2. In `TimelineComposer`, add a small "in days / on date" toggle for TASK
   mode. "in days" keeps the existing NumberInput; "on date" shows the new
   calendar picker. Both produce the same `dueAt` number for
   `activities.create`, so the backend does not change.
3. In the timeline feed, show the actual date ("due Aug 15") when a task is
   due more than 7 days out, keeping "due in Nd" for near tasks. Shared
   `shortDate` helper in `src/lib/format.ts`.
4. In `convex/ask.ts`, extend `parseDueAt` so `/task` accepts explicit dates:
   `on 2026-08-15`, `on 8/15`, `on 8/15/2026`, `on Aug 15`, `on August 15,
   2026`, plus `tomorrow`. Month-day phrases without a year roll forward to
   next year when the date already passed. Explicit dates land at 16:00 UTC.
   The confirmation message says "Due Aug 15" for explicit dates instead of
   "Due in about N days".
5. Sync copy: the `/task` slash hint in `src/app/Ask.tsx` and the Ask and
   Notes-and-tasks bullets in `src/pages/Docs.tsx` mention date support.

## Files to change

- `src/components/ui.tsx` — new `DateInput` component
- `src/components/Timeline.tsx` — due mode toggle, date-aware feed label
- `src/lib/format.ts` — `shortDate` helper
- `convex/ask.ts` — explicit date parsing, date-aware reply, comment update
- `src/app/Ask.tsx` — `/task` hint copy
- `src/pages/Docs.tsx` — docs copy

## Edge cases

- Empty date selection: submit falls back to the "in days" value.
- Month/day without a year already past this year: roll to next year.
- Invalid month or day in a slash command: ignored, falls through to the
  relative parser and its one-day default.
- Server has no user timezone, so explicit Ask dates pin to 16:00 UTC
  (morning in the US, evening in Europe).
- The composer runs client side, so calendar picks use local midnight plus
  9:00 so "tomorrow" never reads as due today.

## Verification steps

- `npx eslint` on touched files, `tsc --noEmit` for app and convex configs.
- Composer: create a task with "on date" and confirm the feed and Activity
  page show the right due label.
- Ask: `/task follow up with <contact> on Aug 20` links the contact and
  replies with "Due Aug 20".

## Task completion log

- 2026-08-09 17:00 UTC — PRD written, implementation starting.
- 2026-08-09 17:10 UTC — All five changes implemented. eslint clean on the
  six touched files; app and convex tsc both pass. Docs synced in task.md,
  CHANGELOG.md, and files.md.
