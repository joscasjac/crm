# Convex port of trycompai/crm

Created: 2026-08-09 05:05 UTC
Last Updated: 2026-08-09 05:50 UTC
Status: Done

## Problem

The upstream CRM (trycompai/crm) needs three deployments, a Postgres, an
optional Redis, Better Auth, and eve on Vercel. The goal from
docs/try-crm-instructions/orig-prompt.md: run the whole product on one Convex
deployment using official Convex components, with the frontend served by the
static hosting component, Convex Auth instead of Better Auth, and no Vercel.

## Proposed solution

Single package repo, npm only (no bun, no turbo):

- convex/ holds the whole backend: schema, CRM functions, agent queue,
  enrichment, crons, static hosting routes.
- src/ is a Vite + React + React Router frontend served by
  @convex-dev/static-hosting.
- Demo mode: no auth, no email sends. A banner says so. A built-in cron
  resets all content every 10 minutes from a seed.
- Components: static-hosting, agent, workflow, workpool (x3 pools), crons,
  action-retrier, action-cache, rate-limiter, aggregate (x2), migrations,
  resend, and the @context-dot-dev/convex partner component.
- Landing page rebuilt from the upstream design: Convex logo instead of
  Vercel, Try the demo button in the header instead of the GitHub star
  button, eve removed, Resend called out as not configured on the demo.
- /compare page: upstream stack vs this port.

## Files to change

- Remove: apps/, packages/, turbo.json, bun.lock, docker-compose.yml,
  biome.jsonc, .githooks, .github/workflows, .env.example (done)
- Add: convex/, src/, public/, index.html, vite.config.ts, tsconfig files
- Rewrite: README.md, AGENTS.md scripts section
- Add docs: docs/deploy.md, files.md, changelog.md, task.md

## Edge cases

- Zero keys set: agent chat and enrichment degrade to a clear
  "not configured" state, never a fake answer.
- Demo reset during an open session: reactive queries update in place.
- Context.dev component requires its env var binding at install; wire it
  through an optional app env and verify push works unset.
- Money is integer minor units; round once at input boundaries.

## Verification steps

1. npx convex dev --once clean, zero type errors
2. npm run build clean
3. CRUD on companies/contacts/deals updates in a second tab
4. Stage change writes a STAGE_CHANGE activity and dashboard updates
5. Demo reset cron wipes and reseeds
6. Landing, compare, and app routes render

## Task completion log

- 2026-08-09 05:00 UTC Cloned fork into repo root, upstream docs moved to
  docs/upstream, removed non-Convex stack files, npm deps installed
- 2026-08-09 05:25 UTC Backend complete and deploying to an anonymous local
  Convex deployment: schema, all CRM functions, agent queue with workpools,
  Context.dev enrichment behind action cache and rate limiter, record chat on
  the agent component, Resend stub, crons. Note: the Context.dev component
  declares its env var required, so CONTEXT_DEV_API_KEY is required at the app
  level; "unset" is the documented sentinel for keyless installs.
- 2026-08-09 05:40 UTC Frontend complete: landing, compare, dashboard,
  companies, contacts, deals board, agents, settings, demo banner. tsc and
  vite build pass.
- 2026-08-09 05:50 UTC Verified end to end in the browser against the local
  deployment: live stats, demo banner countdown, seeded companies, record
  chat honest no-key reply, kanban stage moves, agent builder drafts,
  settings integrations. README rewritten with the deploy guide; changelog,
  files.md, task.md updated. Paused before Convex cloud setup per request.
