# Adopt community PRs 1 and 2, plus follow-ups

Created: 2026-08-11 19:20 UTC
Last Updated: 2026-08-11 19:20 UTC
Status: Done

## Problem

Two community pull requests sat open on the fork:

- PR 1 rewrote AGENTS.md. The file still described the pre-port
  Turborepo, Nest, and Prisma stack: every doc path pointed at files that
  moved to docs/upstream/, the design import resolved to nothing, the
  skills line named skills for the deleted stack, and a Median section
  referenced tooling this repo never had.
- PR 2 fixed link hover states. Four inline links in src/pages/Docs.tsx
  copied the Ext class list and dropped hover:decoration-accent, so
  hovering changed nothing. Nine links in src/app/Settings.tsx set no
  underline offset, so the hover underline drew flush on the baseline
  through descenders.

## Root cause

The port commit (fca8a7c) replaced the stack but only appended to
AGENTS.md. The hover bugs came from copying class strings per call site
instead of sharing them, so a dropped variant went unnoticed.

## Solution

Every claim in both PRs was verified against the repo before adoption
(paths, symbols, crons, schema fields, package.json). Both PR commits
were cherry-picked onto release so Fagner Sales stays the author. Four
follow-ups landed on top:

1. convex/model/access.ts pointed at docs/deploy.md, which does not
   exist; the comment now points at the AGENTS.md "Not built yet"
   section.
2. A shared TextLink component in src/components/ui.tsx now owns both
   link treatments (underline for docs, hover for settings). Docs,
   Settings, Landing, and ComposeEmail all render links through it, so
   the class strings cannot drift per call site again. Compare keeps
   its distinct neutral treatment but gains the same 2px offset.
3. Version check across the components in convex/convex.config.ts:
   only @convex-dev/workflow was behind; bumped 0.4.4 to 0.4.5.
   Majors for ai/@ai-sdk, Vite, and TypeScript exist but were left
   alone.
4. Both PRs get a thank-you comment and are closed as adopted.

## Files changed

- AGENTS.md (cherry-pick, PR 1)
- src/pages/Docs.tsx, src/app/Settings.tsx (cherry-pick, PR 2, then
  migrated to TextLink)
- convex/model/access.ts (comment fix)
- src/components/ui.tsx (TextLink)
- src/pages/Landing.tsx, src/components/ComposeEmail.tsx,
  src/pages/Compare.tsx (link normalization)
- package-lock.json (workflow 0.4.5)

## Edge cases

- TextLink renders a router Link when to is set and an anchor when href
  is set, so external, in-app, and same-page anchor links all work.
- The Settings "Setup guide" link keeps whitespace-nowrap through the
  className passthrough.
- npm update needed --legacy-peer-deps because @exalabs/convex-exa
  declares a zod 3 peer while the project uses zod 4; the lockfile was
  already resolved around that conflict.

## Verification

- npm run check-types clean after the refactor and after the bump.
- npm run lint clean.
- rg confirms no remaining text-accent hover:underline or LINK_CLASS
  copies outside TextLink.

## Task completion log

- 2026-08-11 19:20 UTC: cherry-picked both PRs, landed the four
  follow-ups, verified lint and types, synced docs.
