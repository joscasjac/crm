<h1 align="center">CRM on Convex</h1>

<p align="center">
  <strong>The open source agentic CRM, ported to run entirely on Convex.</strong><br>
  One deployment is the database, the agent runtime, the work queue, the cron scheduler, the file store, and the web host.
</p>

<p align="center">
  <a href="#what-this-is"><strong>What this is</strong></a> ·
  <a href="#the-stack"><strong>Stack</strong></a> ·
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#deploying-to-convex-cloud"><strong>Deploying</strong></a> ·
  <a href="#how-it-compares-to-upstream"><strong>Compare</strong></a>
</p>

## What this is

This is a port of [trycompai/crm](https://github.com/trycompai/crm) that replaces the entire infrastructure with a single [Convex](https://convex.dev) deployment. The product carried over intact: durable research agents that enrich companies and contacts, an evidence ledger where nothing about a person is guessed, rechecks that require a stated reason, agents that build agents, and record chat that reads your own history and shows its working.

What changed is everything underneath. No Vercel, no Postgres, no Prisma, no Redis, no separate API server, no Better Auth. The frontend is a Vite React app served by the Convex static hosting component from the same deployment that runs the backend.

The demo runs in demo mode: everything works in real time, content resets every 10 minutes with a Convex cron job, and auth and email are intentionally not configured.

## The stack

| Layer | Technology |
| --- | --- |
| Backend | Convex functions, TypeScript end to end |
| Database | Convex database with typed schema and indexes |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4 |
| Hosting | [`@convex-dev/static-hosting`](https://www.convex.dev/components/static-hosting) serving the built app |
| Agent runtime | [`@convex-dev/agent`](https://www.convex.dev/components/agent) with tools, threads, and message history |
| Work queues | [`@convex-dev/workpool`](https://www.convex.dev/components/workpool), three pools so slow work cannot starve the dispatcher |
| Brand enrichment | [`@context-dot-dev/convex`](https://www.convex.dev/components/context-dot-dev/convex), the same Context.dev data the upstream uses |
| Caching | [`@convex-dev/action-cache`](https://www.convex.dev/components/action-cache), 7 day TTL on brand lookups, replaces Redis |
| Rate limiting | [`@convex-dev/rate-limiter`](https://www.convex.dev/components/rate-limiter) on the enrichment budget |
| Rollups | [`@convex-dev/aggregate`](https://www.convex.dev/components/aggregate) for pipeline value by stage and owner |
| Email | [`@convex-dev/resend`](https://www.convex.dev/components/resend), wired but unconfigured on the demo |
| Scheduling | Convex cron jobs plus [`@convex-dev/crons`](https://www.convex.dev/components/crons) |
| Durability | [`@convex-dev/workflow`](https://www.convex.dev/components/workflow) and [`@convex-dev/action-retrier`](https://www.convex.dev/components/retrier) |
| Migrations | [`@convex-dev/migrations`](https://www.convex.dev/components/migrations) |

Package manager is npm. There is no monorepo; `convex/` is the backend, `src/` is the frontend.

## Quick start

```bash
git clone https://github.com/waynesutton/trycrm-convex.git
cd trycrm-convex
npm install
npx convex dev
```

The first `npx convex dev` walks you through creating a free Convex project. It will ask for one required environment variable before the first push:

```bash
npx convex env set CONTEXT_DEV_API_KEY unset
```

The literal string `unset` is the documented sentinel for running without a Context.dev key. Enrichment reports that it is not configured instead of failing. Put a real key there whenever you have one.

Then, in a second terminal:

```bash
npm run dev:frontend
```

Open the printed localhost URL. The app seeds itself with demo data on first visit. Or run both together:

```bash
npm run dev
```

## Configuration

Every outside key is optional. The app degrades honestly: features that need a key say so instead of pretending.

| Variable | What it enables | Without it |
| --- | --- | --- |
| `CONTEXT_DEV_API_KEY` | Company enrichment from Context.dev brand data | Enrichment tasks complete with a "not configured" note. Set to `unset` to run keyless. |
| `OPENAI_API_KEY` | Record chat and agent reasoning | Chat replies explain that no model key is configured |
| `RESEND_API_KEY` | Outbound email through the Resend component | Email sends are logged as no-ops |

Set any of them with:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

Demo mode is a flag on the workspace row, set by the seed. While it is on, writes are open, sign-in is disabled, and the reset cron wipes and reseeds all tables every 10 minutes. The banner in the app counts down to the next reset.

## Linting and helpers

The repo uses the [Convex ESLint plugin](https://docs.convex.dev/eslint) with type aware linting. It enforces argument validators, explicit table names in `db.get`, `db.patch`, `db.replace`, and `db.delete`, warns on `.filter()` in queries, and keeps cron jobs off the top of the hour.

```bash
npm run lint
```

Write access runs through one wrapper built on [`convex-helpers`](https://github.com/get-convex/convex-helpers): `writeMutation` in `convex/model/functions.ts` calls the access check before every mutation handler. That is the Convex pattern for row level security. When you wire real auth, `convex/model/access.ts` is the only file that changes.

## Deploying to Convex cloud

One deployment serves the backend and the site. From a configured project:

```bash
npm run deploy
```

That runs `npx @convex-dev/static-hosting deploy`, which does the whole thing in one shot: builds the frontend with the production Convex URL, deploys the Convex backend, and uploads the built files to Convex storage.

Before the first production deploy, set the env vars on production:

```bash
npx convex env set CONTEXT_DEV_API_KEY unset --prod
```

Your site is then live at your deployment's `.convex.site` URL, which the Convex dashboard shows under Settings. The static hosting component handles SPA routing, hashed asset caching, and garbage collection of old builds. Deploys are atomic; clients subscribed through the deployment query can offer a refresh when a new build ships.

To seed production data once:

```bash
npx convex run demo:seedPublic --prod
```

Note on the reset cron: `convex/crons.ts` resets all content every 10 minutes because this repo powers a public demo. Remove the `demo reset` cron before using this as a real CRM.

## What works in the demo

- Companies, contacts, deals board, dashboard rollups, custom fields, timelines, all real time
- Agent task queue with leasing, workpools, and scheduled rechecks that require a reason
- Agents that build agents: describe a process, get a versioned draft definition
- Record chat, which answers honestly about missing model keys
- Demo reset every 10 minutes via cron

What is intentionally off in the demo: sign-in (the code is structured for Convex Auth; the demo keeps writes open on seeded data) and outbound email (the Resend component is installed but no key is set).

## How it compares to upstream

The app has a live comparison page at `/compare`. Short version:

| Area | trycompai/crm | This version |
| --- | --- | --- |
| Hosting | Vercel plus a separate API | Convex static hosting |
| Database | Postgres with Prisma | Convex database |
| Realtime | Polling and invalidation | Reactive queries |
| Queue | Redis backed workers | Workpool components, queue as a table |
| Auth | Better Auth | Convex Auth ready, off in demo |
| Services to run | Frontend, API, Postgres, Redis, workers | One Convex deployment |
| Package manager | bun, Turborepo | npm, single package |

## Project layout

```
convex/            Backend: schema, functions, components config, crons
convex/model/      Shared logic: access control, cascade deletes, seed data
src/app/           CRM screens: dashboard, companies, contacts, deals, agents, settings
src/pages/         Landing and compare pages
src/components/    Shared UI primitives and the demo banner
public/            Static assets served with the app
docs/              Upstream docs and port instructions
```

`files.md` has a description of every file. `changelog.md` tracks changes.

## Credits

The product design, agent philosophy, and seed content come from [Comp AI's CRM](https://github.com/trycompai/crm). This port swaps the infrastructure for Convex and its [components](https://www.convex.dev/components). MIT licensed, same as upstream.
