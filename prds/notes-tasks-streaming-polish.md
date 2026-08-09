# Notes, tasks, streaming, themed controls, and activity polish

Created: 2026-08-09 08:25 UTC
Last Updated: 2026-08-09 08:55 UTC
Status: Done

## Problem

Seven gaps, all raised together:

1. Native form controls (selects, number spinners) render OS-styled white
   popovers on the dark theme. Deals stage pickers, Contacts and Companies
   filters, the new deal form, and the recheck day stepper all leak the OS
   look.
2. The Ask greeting covers morning, afternoon, evening but has no late
   night case.
3. No way to collapse the sidebar. Attio has a rail toggle; we have none.
4. The Activity page can only clear everything. No select one, select all.
5. Record timelines write to `activities` but not every write shows on the
   Activity page, so the two features feel disconnected.
6. Notes and tasks are half built: companies have a note composer, contacts
   have none, tasks cannot be created from the UI at all, there are no due
   dates, no email reminders, and Ask has no /task or /note commands.
7. Ask replies arrive all at once. The Agent component supports delta
   streaming. Command-K search is a bounded scan that will not scale.

## Proposed solution

- `src/components/ui.tsx`: add themed `Select` (custom listbox) and
  `NumberInput` (hidden native spinner, custom steppers). Replace all
  native `<select>` and `type="number"` call sites.
- Ask greeting: add a night branch.
- `AppLayout`: Phosphor SidebarSimple icon toggles the sidebar, state in
  localStorage; a floating reopen button when collapsed.
- Activity: checkbox per row, select-all header, `logs.clearMany` mutation.
- `activities.create` and `completeTask` log to `logEvents` so timelines
  and the Activity page stay in sync.
- Tasks and notes: shared `TimelineComposer` and `TimelineFeed` components
  used by company and contact detail. Task extras: due days, email me a
  reminder (routes through the selected provider via
  `internal.email.sendNotification`, scheduled at the due time). Complete
  button on open tasks.
- Ask slash commands: `/task` and `/note` handled deterministically in
  `ask.send` (no model key needed). Body text matches a company or contact
  name to link the record; "email me" schedules a reminder; "in N days" or
  "tomorrow" sets the due date. A confirmation message is saved to the
  thread.
- Streaming: `ask.generate` switches to `streamText` with
  `saveStreamDeltas`; `ask.messages` returns `syncStreams`; the client uses
  `useUIMessages` with `stream: true`.
- Full text search: `search_name` indexes on companies, contacts, and
  deals; `search.global` queries them first, keeps the bounded scan as a
  fallback for domain and email matches, dedupes.

## Files to change

- convex/schema.ts (search indexes)
- convex/search.ts, convex/logs.ts, convex/activities.ts, convex/ask.ts
- src/components/ui.tsx, new src/components/Timeline.tsx
- src/app/AppLayout.tsx, Activity.tsx, Ask.tsx, Deals.tsx, Contacts.tsx,
  Companies.tsx, CompanyDetail.tsx, ContactDetail.tsx
- Docs.tsx, Compare.tsx, README.md, CHANGELOG.md, files.md, task.md

## Edge cases

- Slash command with no matching record: create the activity unlinked and
  say so in the reply.
- "email me" with no provider configured: create the task, reply that no
  reminder will send and which keys enable it.
- Demo reset wipes activities and logEvents mid-session: existing UI
  already tolerates vanished rows.
- Streaming with no AI key: the missing-key path saves a plain message,
  which the stream-aware client renders the same.
- Search terms shorter than a word still hit the scan fallback.

## Verification

- npm run lint, tsc typecheck, convex dev push
- CLI: run ask:send with /task and /note, confirm activities + logEvents
- Browser: selects, collapse toggle, activity select-all, Ask streaming

## Task completion log

- 2026-08-09 08:25 UTC: PRD written, implementation starting.
- 2026-08-09 08:45 UTC: All backend and frontend changes landed. Lint, both
  typechecks, and the convex dev push are green; the search_name indexes
  built on companies, contacts, and deals.
- 2026-08-09 08:55 UTC: Browser verification passed on all seven items:
  themed Stage and filter dropdowns, sidebar collapse round trip, activity
  select one and select all with Clear selected count, note and task added
  from the company timeline with a working Complete button, /note Comp AI
  confirmed in chat and on the timeline, the late-night greeting plus the
  honest missing-key reply, and Command-K finding Comp AI. The missing-key
  reply arrives as one saved message by design; real streaming engages when
  an AI key is set.
