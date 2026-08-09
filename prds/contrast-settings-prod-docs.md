# Text contrast and Settings key guidance

Created: 2026-08-09 08:58 UTC
Last Updated: 2026-08-09 09:10 UTC
Status: Done

## Problem

1. Muted text fails WCAG AA contrast in both themes. Dark neutral-600
   (#5f5f5f on #0f0f0f) is about 2.9:1; light neutral-600 (#99a2ac on
   white) is about 2.5:1 and light neutral-500 (#86909c) is about 3.2:1.
   These tokens carry real copy: integration details, panel intros, docs
   body text.
2. Settings lists every API key but never says how to set one. The docs
   explain `npx convex env set` and `--prod`, but Settings does not link
   to those sections, and the user could not find `--prod` anywhere from
   the app.
3. Section links like /docs#email would not scroll: the docs page has
   anchor ids but no hash handling on client-side navigation.

## Proposed solution

- Raise the muted grays in `src/index.css` to AA for normal text while
  keeping the hierarchy: dark 500 to #9a9a9a and 600 to #808080; light
  500 to #626d7a and 600 to #6d7683 (and 400 nudged darker to #525d6b).
- Add a hash-scroll effect to Docs.tsx so /docs#section lands on the
  section from anywhere in the app.
- Settings: give every IntegrationRow a Setup link into the matching
  docs section (email, web-research, ai-providers, environment-variables).
- Settings: new "Adding API keys" panel with the two commands (dev and
  `--prod`), a plain explanation that every project has two deployments
  with separate variables, and links to the env and deploy docs sections.
- Email and AI provider panels link to their docs sections too.

## Files to change

- src/index.css (contrast tokens)
- src/pages/Docs.tsx (hash scroll)
- src/app/Settings.tsx (setup links, adding-keys panel)
- CHANGELOG.md, files.md, task.md

## Edge cases

- text-neutral-600 on bg-raised sits on a lighter surface; the new values
  still clear 4.5:1 on panel and stay above 4:1 on raised.
- Hash effect must not fight the "On this page" in-page anchors, which
  already work natively; the effect only runs when the hash changes.

## Verification

- npm run lint, both typechecks
- Browser: read Settings and Docs in both themes, follow a Setup link
  from Settings into the email docs section, confirm it scrolls.

## Task completion log

- 2026-08-09 08:58 UTC: PRD written.
- 2026-08-09 09:10 UTC: All changes landed and verified. Lint and app
  typecheck clean. Browser pass confirmed the Adding API keys panel with
  both commands, the Setup guide link scrolling to the email docs
  section, and readable helper text in both themes.
