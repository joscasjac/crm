<h1 align="center">CRM on Convex</h1>

<p align="center">
  <strong>The open source agentic CRM, ported to run entirely on Convex.</strong><br>
  One deployment is the database, the agent runtime, the work queue, the cron scheduler, the file store, and the web host.
</p>

<p align="center">
  <a href="https://convex.link/crmonconvex"><strong>Live demo</strong></a> ·
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#email-two-providers"><strong>Email</strong></a> ·
  <a href="#deploying-to-convex-cloud"><strong>Deploying</strong></a> ·
  <a href="#how-it-compares-to-upstream"><strong>Compare</strong></a>
</p>

## What this is

This is a port of [trycompai/crm](https://github.com/trycompai/crm) that replaces the entire infrastructure with a single [Convex](https://convex.dev) deployment. The product carried over intact: durable research agents that enrich companies and contacts, an evidence ledger where nothing about a person is guessed, rechecks that require a stated reason, agents that build agents, and record chat that reads your own history and shows its working.

What changed is everything underneath. No Vercel, no Postgres, no Prisma, no Redis, no separate API server, no Better Auth. The frontend is a Vite React app served by the Convex static hosting component from the same deployment that runs the backend.

Try it at [convex.link/crmonconvex](https://convex.link/crmonconvex) (served from [good-dog-8.convex.site](https://good-dog-8.convex.site/)). The demo runs in demo mode: everything works in real time, content resets every 10 minutes with a Convex cron job, and auth and email are intentionally not configured. The site has a full setup and usage guide at `/docs`, written for people who have never deployed a backend.

## The stack

| Layer | Technology |
| --- | --- |
| Backend | Convex functions, TypeScript end to end |
| Database | Convex database with typed schema and indexes |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4 (dark and light themes) |
| Hosting | [`@convex-dev/static-hosting`](https://www.convex.dev/components/static-hosting) serving the built app |
| Agent runtime | [`@convex-dev/agent`](https://www.convex.dev/components/agent) with tools, threads, and message history |
| Work queues | [`@convex-dev/workpool`](https://www.convex.dev/components/workpool), three pools so slow work cannot starve the dispatcher |
| Brand enrichment | [`@context-dot-dev/convex`](https://www.convex.dev/components/context-dot-dev/convex), the same Context.dev data the upstream uses |
| Web scraping | [`@firecrawl/firecrawl-convex`](https://www.convex.dev/components/firecrawl/firecrawl-convex), the chat agent reads pages as markdown |
| Web search | [`@exalabs/convex-exa`](https://www.convex.dev/components/exalabs/convex-exa), semantic search as an agent tool |
| AI providers | OpenAI, Claude (Anthropic), or OpenRouter via the AI SDK, switchable in Settings, no key ships by default |
| Email | [`@convex-dev/resend`](https://www.convex.dev/components/resend) or [`@agentmail/convex`](https://www.convex.dev/components/agentmail/convex), switchable in Settings |
| Caching | [`@convex-dev/action-cache`](https://www.convex.dev/components/action-cache), 7 day TTL on brand lookups, replaces Redis |
| Rate limiting | [`@convex-dev/rate-limiter`](https://www.convex.dev/components/rate-limiter) on the enrichment budget |
| Rollups | [`@convex-dev/aggregate`](https://www.convex.dev/components/aggregate) for pipeline value by stage and owner |
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

The first `npx convex dev` walks you through creating a free Convex project. It will ask for three required environment variables before the first push:

```bash
npx convex env set CONTEXT_DEV_API_KEY unset
npx convex env set FIRECRAWL_API_KEY unset
npx convex env set EXA_API_KEY unset
```

The literal string `unset` is the documented sentinel for running without vendor keys. Each feature reports that it is not configured instead of failing. Put real keys there whenever you have them; the features switch on immediately, no redeploy needed.

Then, in a second terminal:

```bash
npm run dev:frontend
```

Open the printed localhost URL. The app seeds itself with demo data on first visit. Or run both together:

```bash
npm run dev
```

Prefer letting a coding agent do this? The landing page has a "Copy the setup prompt" button that hands the exact instructions to Cursor, Codex, Claude Code, or whatever you use.

## Configuration

Every outside key is optional in practice. The app degrades honestly: features that need a key say so instead of pretending.

| Variable | What it enables | Without it |
| --- | --- | --- |
| `CONTEXT_DEV_API_KEY` | Company enrichment from Context.dev brand data | Enrichment tasks complete with a "not configured" note. Set to `unset` to run keyless. |
| `FIRECRAWL_API_KEY` | Chat agent reads web pages via Firecrawl | The tool tells the agent which key enables it. Set to `unset` to run keyless. |
| `EXA_API_KEY` | Chat agent searches the web via Exa | Same honest degradation. Set to `unset` to run keyless. |
| `OPENAI_API_KEY` | Chat and agent reasoning when OpenAI is the selected provider | Chat replies name the missing key |
| `ANTHROPIC_API_KEY` | Chat and agent reasoning when Claude is the selected provider | Same |
| `OPENROUTER_API_KEY` | Chat and agent reasoning when OpenRouter is the selected provider | Same |
| `RESEND_API_KEY` | Outbound email through the Resend component | Email sends are logged as no-ops |
| `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID` | Outbound email plus a persistent agent inbox through AgentMail | Same, logged as no-ops |
| `FIRECRAWL_WEBHOOK_SECRET` | Verifies Firecrawl crawl webhooks | Optional; only needed for webhook-mode crawls |
| `AGENTMAIL_WEBHOOK_SECRET` | Verifies inbound AgentMail webhooks | Optional; unverified deliveries are rejected |

Set any of them with:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

None of the three AI keys ship by default. A fresh fork has no model keys at all; the Ask page and record chat answer with the exact key they need instead of erroring. Pick which provider the chat uses in Settings.

Demo mode is a flag on the workspace row, set by the seed. While it is on, writes are open, sign-in is disabled, and the reset cron wipes and reseeds all tables every 10 minutes. The banner in the app counts down to the next reset.

## Email: two providers

Notifications route through one of two components, and Settings has a toggle to pick which:

- **Resend** is plain outbound email. One key: `RESEND_API_KEY`.
- **AgentMail** sends too, and also gives agents a persistent inbox: threads, labels, and delivery status sync into Convex tables reactively. Two values: `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`. For inbound mail, register `https://YOUR-DEPLOYMENT.convex.site/agentmail/webhook` in the AgentMail dashboard and set `AGENTMAIL_WEBHOOK_SECRET`.

Both can hold keys at the same time; the toggle decides which one sends. With neither configured, sends are logged instead of failing, which is how the public demo runs.

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

Before the first production deploy, set the env vars on production (they are separate from dev):

```bash
npx convex env set CONTEXT_DEV_API_KEY unset --prod
npx convex env set FIRECRAWL_API_KEY unset --prod
npx convex env set EXA_API_KEY unset --prod
```

Your site is then live at your deployment's `.convex.site` URL, which the Convex dashboard shows under Settings. The static hosting component handles SPA routing, hashed asset caching, and garbage collection of old builds. Deploys are atomic; clients subscribed through the deployment query can offer a refresh when a new build ships.

To seed production data once:

```bash
npx convex run demo:seedPublic --prod
```

Note on the reset cron: `convex/crons.ts` resets all content every 10 minutes because this repo powers a public demo. Remove the `demo reset` cron before using this as a real CRM.

## What works in the demo

- Companies, contacts, deals board, dashboard rollups, custom fields, timelines, all real time
- Notes and tasks on every company and contact: due dates, email reminders through the selected provider, complete buttons, all mirrored to the Activity page
- Compose email from any company or contact: a draggable, resizable window with To, Cc, Bcc, markdown preview, and attachments; the timeline records every send, and delivery waits for a Resend or AgentMail key
- Settings split into pages with a sub-sidebar: Team, Integrations, Email (provider, from identity, signature), AI provider, Sidebar, Custom fields
- Table sorting, filtering, and inline add rows on Companies and Contacts
- Deals as a drag and drop board plus a sortable list view
- Ask: a Claude-style workspace chat with streamed replies, slash commands (including `/task` and `/note`, which need no AI key), a thread sub-sidebar, archive, and delete
- Command-K search backed by Convex full text search indexes on companies, contacts, and deals
- Activity: a live dashboard-style log of function outcomes with pause, select one or all, and clear
- Sidebar items reorder by drag and drop; Settings can hide items; the rail icon collapses the sidebar
- Agent task queue with leasing, workpools, and scheduled rechecks that require a reason
- Agents that build agents: describe a process, get a versioned draft definition
- Record chat with web research tools (Firecrawl and Exa) that answer honestly about missing keys
- AI provider picker: OpenAI, Claude, or OpenRouter, none configured by default
- Dark and light themes with a toggle in the header and the sidebar footer
- Demo reset every 10 minutes via cron (the Activity log resets with it)

What is intentionally off in the demo: sign-in (the code is structured for Convex Auth; the demo keeps writes open on seeded data) and outbound email (Resend and AgentMail are installed but no keys are set).

## How it compares to upstream

The app has a live comparison page at `/compare` and full setup docs at `/docs`. Short version:

| Area | trycompai/crm | This version |
| --- | --- | --- |
| Hosting | Vercel plus a separate API | Convex static hosting |
| Database | Postgres with Prisma | Convex database |
| Realtime | Polling and invalidation | Reactive queries |
| Queue | Redis backed workers | Workpool components, queue as a table |
| Auth | Better Auth | Convex Auth ready, off in demo |
| Email | Resend SDK calls | Resend or AgentMail components, switchable |
| Web research | Not included | Firecrawl scraping and Exa search as agent tools |
| AI providers | OpenAI | OpenAI, Claude, or OpenRouter, switchable in Settings |
| Workspace chat | Per-record chat only | Ask page with streamed replies, slash commands, and thread history |
| Notes and tasks | Notes on records | Notes and tasks with due dates, reminders, and completion |
| Search | Per-table inputs | Command-K palette on full text search indexes |
| Observability | Server logs | Activity page streams function outcomes live |
| Services to run | Frontend, API, Postgres, Redis, workers | One Convex deployment |
| Package manager | bun, Turborepo | npm, single package |

## Project layout

```
convex/            Backend: schema, functions, components config, crons
convex/model/      Shared logic: access control, cascade deletes, seed data
src/app/           CRM screens: dashboard, companies, contacts, deals, ask, activity, agents, settings
src/pages/         Landing, compare, and docs pages
src/components/    Shared UI primitives, demo banner, theme toggle
public/            Static assets served with the app
docs/              Upstream docs and port instructions
```

`files.md` has a description of every file. `changelog.md` tracks changes.

## License and credits

MIT licensed, the same license as the upstream project. The product design, agent philosophy, and seed content come from [Comp AI's CRM](https://github.com/trycompai/crm). This port swaps the infrastructure for Convex and its [components](https://www.convex.dev/components).
