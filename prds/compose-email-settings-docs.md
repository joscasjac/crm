# Compose email, Settings sub-sidebar, docs sidebar layout

Created: 2026-08-09 09:30 UTC
Last Updated: 2026-08-09 09:45 UTC
Status: Done

## Problem

1. Email exists only as agent notifications. There is no way for a person
   to write an email from a company or contact record, no from-name or
   signature configuration, and nothing on the timeline when mail goes out.
2. The Settings page is one long scroll of seven panels.
3. The docs page is one long scroll with a table of contents at the top;
   there is no persistent navigation while reading.
4. The landing header link says GitHub; the user wants Fork.

## Proposed solution

### Compose email

- Schema: workspace gains `emailFromName`, `emailFromAddress`,
  `emailSignature` (optional strings).
- convex/email.ts: `settings` query, `setSettings` mutation,
  `generateUploadUrl` for attachments, `compose` writeMutation, and a
  `sendComposed` internal action.
- Compose flow: the mutation validates, writes an EMAIL activity on the
  record (timeline + Activity page via the shared helper pattern), logs
  a logEvent, and schedules the send through the selected provider
  (Resend or AgentMail). Signature appends to the body. Attachments are
  stored in Convex file storage and delivered as signed links in the
  body, which works identically on both providers and keyless demos.
- ComposeEmail window: draggable by its title bar, resizable from the
  corner, To, Cc, Subject, markdown body with a Write/Preview toggle,
  attachment chips, and a Send button that disables with an explanation
  when the selected provider has no key, linking to Settings.
- Buttons on CompanyDetail (prefills the primary contact email) and
  ContactDetail (prefills that contact).

### Settings sub-sidebar

- Nested routes under /app/settings: team, integrations, email, ai,
  sidebar, fields. A left sub-nav like the Ask page; index redirects to
  team. Email section hosts the provider toggle plus the new from and
  signature fields.

### Docs sidebar

- Two-column layout: sticky left sidebar with the section list and
  active-section highlight (IntersectionObserver), content right. The
  top table of contents remains for mobile.

### Copy

- Landing header link text GitHub becomes Fork, pointing at the fork URL.
- Docs email section links to the Resend and AgentMail component pages
  and documents compose, from fields, signature, and attachment links.

## Files to change

- convex/schema.ts, convex/email.ts
- src/components/ComposeEmail.tsx (new)
- src/app/CompanyDetail.tsx, src/app/ContactDetail.tsx
- src/app/Settings.tsx (split into sections), src/App.tsx (nested routes)
- src/pages/Landing.tsx, src/pages/Docs.tsx
- Docs content, CHANGELOG.md, files.md, task.md

## Edge cases

- Send with neither key: button disabled client-side; the mutation still
  guards and logs a skip rather than throwing.
- Attachments on keyless installs: files still upload and the activity
  records them; only the vendor send is skipped.
- Old workspace rows without the new fields: all optional, defaults in
  the query.
- Deep links to old /app/settings keep working via the index redirect.
- Demo reset wipes email settings with the workspace, as expected.

## Verification

- npm run lint, both typechecks, convex dev push
- Browser: compose from a contact, drag and resize, markdown preview,
  attachment chip, disabled send reason, activity + timeline rows,
  settings sub-nav round trip, docs sidebar scroll highlight, header
  says Fork.

## Task completion log

- 2026-08-09 09:30 UTC: PRD written.
- 2026-08-09 09:40 UTC: Schema, email backend, ComposeEmail window, record
  buttons, Settings sub-sidebar, docs sidebar, and copy changes landed.
  Lint and both typechecks clean; convex dev pushed.
- 2026-08-09 09:45 UTC: Browser verification passed all steps (drag could
  not be exercised by automation; pointer handlers confirmed in code).
  Project docs synced. Done.
- 2026-08-09 09:50 UTC: Follow-up: Bcc field added to the compose window
  and threaded through compose, sendComposed, and the AgentMail path
  (native bcc); Resend delivers per-recipient copies so bcc stays private.
  Lint and both typechecks clean.
