# Firecrawl, AgentMail, Exa components, docs page, and Composio/Minimax theming

Created: 2026-08-09 07:05 UTC
Last Updated: 2026-08-09 07:25 UTC
Status: Done

## Problem

The app ships with Context.dev enrichment and Resend email only. It has no web
research capability, no agent inbox, one hardcoded dark theme, no docs page,
and the share metadata is minimal.

## Proposed solution

1. Components. Install and mount three partner components:
   - `@firecrawl/firecrawl-convex` (scrape, map, search, durable crawls).
     Requires `FIRECRAWL_API_KEY` at deploy; `unset` sentinel keeps keyless
     installs working.
   - `@exalabs/convex-exa` (semantic web search and content extraction).
     Requires `EXA_API_KEY` at deploy; same sentinel.
   - `@agentmail/convex` (persistent agent email inbox). Key read at runtime,
     nothing required at deploy. Webhook mounted at `/agentmail/webhook`.
   New `convex/web.ts` wraps Firecrawl and Exa with configured checks so every
   call degrades honestly. `convex/capabilities.ts` exposes which keys are
   configured for the Settings screen.

2. Email provider toggle. `workspace.emailProvider` field, `"resend"` default,
   `"agentmail"` optional. `email.sendNotification` routes by provider. Both
   can be installed at once: Resend covers outbound notifications, AgentMail
   adds a persistent inbox agents can receive on. Settings gets a toggle and
   copy explaining what each needs (`RESEND_API_KEY` vs `AGENTMAIL_API_KEY`
   plus `AGENTMAIL_INBOX_ID`).

3. Theming. Dark theme restyled to the Composio pattern (near-black canvas,
   achromatic surface steps, hairline borders, white CTA fill, #51a2ff links).
   Light theme added from the Minimax pattern (white canvas, #181e25 CTA fill,
   #1456f0 links, soft gray surfaces). Implemented by redefining the Tailwind
   theme custom properties under `html.light`, including a remapped neutral
   ramp so existing utility classes flip with the theme. Primary buttons move
   from `text-white` to `text-primary-ink` so the fill and label pair stays
   readable in both themes. Toggle in the site header before Try the demo and
   in the app sidebar footer, persisted in localStorage, initialized by an
   inline script in index.html to avoid flashes.

4. Docs page at `/docs`: fork and setup for non-devs, env vars and API keys,
   every component with links, email providers, Convex Auth wiring, deploy
   with static hosting, when `--prod` applies, IDE notes (Cursor, Codex,
   others), app usage guide. Linked from the header next to Compare, the app
   sidebar below Settings, and the footer.

5. Copy prompt updated to set all three required sentinels. Repo links kept in
   header, footer, fork section, and added to sidebar and docs.

6. Metadata: OG and Twitter large-image tags on index.html pointing at
   `/og.png`, generated from a dark mode screenshot. README rewritten for the
   new components, live links (https://convex.link/crmonconvex and
   https://good-dog-8.convex.site/), and the MIT license statement.

## Files to change

- convex/convex.config.ts, convex/http.ts, convex/schema.ts, convex/email.ts,
  convex/web.ts (new), convex/capabilities.ts (new), convex/workspace.ts or
  demo.ts for the provider mutation
- src/index.css, src/components/ThemeToggle.tsx (new), index.html
- src/pages/Landing.tsx, src/pages/Compare.tsx, src/pages/Docs.tsx (new),
  src/App.tsx, src/app/AppLayout.tsx, src/app/Settings.tsx,
  src/components/ui.tsx
- public/og.png (new), README.md, changelog.md, files.md, task.md

## Edge cases

- Deploys must succeed with all keys `unset` or missing. Firecrawl and Exa
  declare required env; the sentinel keeps pushes green while wrappers refuse
  to call vendors without a real key.
- Exa client peer-depends on zod 3; app has zod 4. Safe because the client
  only needs zod when a Zod schema is passed to deepSearch; wrappers pass raw
  JSON schemas or skip schemas entirely.
- Light mode must not show white logos on white; themed logos invert by CSS.
- AgentMail send needs an inbox id; without `AGENTMAIL_INBOX_ID` the send is a
  logged no-op like the keyless Resend path.

## Verification

- `npm run lint`, `npm run check-types`
- `npx convex dev --once` pushes cleanly with sentinel values
- Browser: landing, compare, docs, and demo in both themes
- Screenshot dark mode, produce public/og.png, verify meta tags

## Task completion log

- 2026-08-09 07:05 UTC. PRD created.
