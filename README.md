<h1 align="center">An Open Source Full Featured CRM Using Convex</h1>

<p align="center">
  A full featured CRM built on Convex, with companies, contacts, deals, projects, tasks, notes, custom objects, saved views, timelines, AI agents, email, Slack, and real-time collaboration patterns in one deployment.
</p>

<p align="center">
  <a href="https://convex.link/crmonconvex"><strong>Live demo</strong></a> ·
  <a href="#what-this-repo-is"><strong>Overview</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

## What this repo is

This is an open source CRM where Convex is the backend, database, realtime sync layer, job queue, cron runner, file store, agent runtime, and web host.

The app is designed around one idea: every CRM object should work the same way. Companies, contacts, deals, projects, tasks, notes, and custom objects all move toward the same workspace model:

- a default locked table view
- user-created saved views
- table, kanban, and calendar layouts
- reusable column controls
- custom fields
- multi-select and bulk actions
- CSV import and export
- right-side record panels
- timelines, tasks, notes, emails, and related records

That gives the repo a clear product architecture. Adding a new object should not mean rebuilding table menus, filters, kanban, import/export, side panels, or record activity from scratch.

This project started as a Convex port of [trycompai/crm](https://github.com/trycompai/crm), but the current repo adds a larger object-workspace layer on top of the original sales CRM and agent features.

## Features

### CRM records

- Companies
- Contacts
- Deals and pipeline stages
- Projects
- Tasks
- Notes
- Custom objects
- Custom fields on built-in objects
- Relationship mapping for custom objects
- Favorites and trash flows

### Views

- Locked default table views
- User-created saved views
- Table views
- Kanban views grouped by usable option fields
- Calendar views grouped by usable date fields
- Per-object view selectors
- View configuration stored in Convex

Saved views belong to the object. Creating a kanban view for Tasks should add it under the Tasks view selector, not as a new sidebar item.

### Tables

- Shared table chrome across object pages
- Column hide/show
- Move column left/right
- Header action menus
- Inline editing
- Custom field columns
- Row selection
- Multi-select actions
- Inline add rows
- CSV import
- CSV export

The goal is one reusable table foundation for all objects, rather than separate one-off tables for companies, deals, projects, and tasks.

### Kanban and calendar

- Deals use a stage board by default
- Other objects can create kanban views from option fields
- Calendar views use date fields
- Kanban cards open the same record side panel as table rows
- New records can be created from the relevant column context
- Kanban summaries can calculate counts, percentages, dates, and numeric totals

### Record side panels

Records open in a right-side panel so users can keep their place in the table, board, or calendar.

Panels support:

- Home fields
- Timeline
- Tasks
- Notes
- Emails
- Related records
- Favorite actions
- Record actions

Task creation belongs in the Tasks tab. Note creation belongs in the Notes tab. Timeline is for activity history.

### Agent and AI features

- Company and contact enrichment
- Evidence ledger for facts
- Rechecks with required reasons
- Record chat with CRM context
- Workspace Ask chat
- AI provider picker
- Agent builder
- Agent task queue with leases and workpools
- Optional web search and web page reading tools

AI features are optional. If a provider key is missing, the app reports the missing key instead of crashing.

### Integrations

- Email through Resend or AgentMail
- Compose window with attachments
- Email activity logging
- Slack notifications
- Slack `/crm` command routes
- Firecrawl, Exa, or Context.dev for web research

All external services are optional and configured through Convex environment variables.

## Architecture

This is a single npm project:

```text
convex/   Backend functions, schema, actions, crons, agents, and HTTP routes
src/      React frontend, routes, shared components, object workspaces
public/   Static assets used by the app and landing page
docs/     Product docs, planning notes, and upstream reference material
prds/     Feature specs and design intent
adrs/     Architecture decisions
```

There is no separate API server, no Postgres, no Redis, no Prisma, no Vercel service, and no monorepo. Convex owns the backend and can also host the frontend.

### Backend

The Convex schema contains both records and metadata:

- `companies`, `contacts`, `deals`
- `projects`, `projectTasks`
- `activities`
- `fieldDefinitions`, `fieldValues`
- `savedViews`
- `customObjects`, `customObjectFields`, `customObjectRecords`
- custom object relationship tables
- agent task, run, chat, fact, log, Slack, and workspace settings tables

Queries read indexed data and stream updates to React. Mutations use shared access wrappers before writes. Actions handle slower or external work such as AI calls, enrichment, scraping, search, Slack, and email.

Important backend files:

- `convex/schema.ts` defines the database.
- `convex/model/functions.ts` wraps reads and writes with access checks.
- `convex/model/access.ts` is where auth rules are centralized.
- `convex/companies.ts`, `contacts.ts`, `deals.ts`, `projects.ts`, `tasks.ts`, and `notes.ts` expose object APIs.
- `convex/customObjects.ts` powers user-created objects and relationships.
- `convex/savedViews.ts` stores object view configuration.
- `convex/activities.ts` powers timelines, tasks, notes, reminders, and activity feeds.
- `convex/agentTasks.ts`, `agents.ts`, `chat.ts`, and `ask.ts` power agent workflows.
- `convex/email.ts`, `slack.ts`, and `web.ts` handle optional integrations.

### Frontend

The React app is organized around reusable object UI:

- `src/components/ObjectTableChrome.tsx` renders the object page header, actions, selected state, and options panel.
- `src/components/SavedViewButton.tsx` renders the locked default view, saved view dropdown, and create-view flow.
- `src/components/dataTable.tsx` contains shared table behavior.
- `src/components/ObjectDataTable.tsx` provides a generic selectable object table.
- `src/components/ObjectViews.tsx` renders kanban and calendar views.
- `src/components/RecordSidePanel.tsx` renders shared record details.
- `src/components/Timeline.tsx` renders record activity.
- `src/components/ComposeEmail.tsx` renders the email composer.
- `src/lib/customFields.ts`, `columns.ts`, `csv.ts`, and `tableFilters.tsx` hold shared object utilities.

Object pages live under `src/app/`:

- `Companies.tsx`
- `Contacts.tsx`
- `Deals.tsx`
- `Projects.tsx`
- `Tasks.tsx`
- `Notes.tsx`
- `CustomObjectPage.tsx`
- `WorkspaceTimeline.tsx`
- `Ask.tsx`
- `Activity.tsx`
- `Agents.tsx`
- `Settings.tsx`

## How records flow through the app

1. The user opens an object from the sidebar.
2. The page loads records from Convex.
3. The default locked table view is selected unless a saved view is chosen.
4. The selected view decides whether records render as a table, kanban board, or calendar.
5. The user can create, edit, select, import, export, or open records.
6. Opening a record shows the shared side panel.
7. Field edits, notes, tasks, emails, and timeline events write back through Convex mutations.
8. Convex pushes updates live to every subscribed client.

## Scaling model

The repo is designed so objects with thousands of records can stay usable:

- list queries should be paginated
- filters should be backed by indexes where possible
- table pages should only hydrate visible rows
- custom field values are batched for the visible records
- saved views store configuration, not duplicate record copies
- bulk actions and imports should process records in batches
- slow external work runs through actions, queues, workpools, and retries

Convex handles realtime subscriptions and server-side consistency. The frontend should not try to load an entire large object into memory just to render one table page.

## Quick start

```bash
git clone https://github.com/joscasjac/crm.git
cd crm
npm install
npx convex dev
```

In a second terminal:

```bash
npm run dev:frontend
```

Or run both together:

```bash
npm run dev
```

Open the localhost URL printed by Vite.

The first Convex push asks for required environment variables declared by installed Convex components. You can run the app without vendor keys by setting them to `unset`:

```bash
npx convex env set CONTEXT_DEV_API_KEY unset
npx convex env set FIRECRAWL_API_KEY unset
npx convex env set EXA_API_KEY unset
```

## Configuration

Most integrations are optional. Missing keys disable the related feature cleanly.

| Variable | Enables |
| --- | --- |
| `CONTEXT_DEV_API_KEY` | Context.dev enrichment, search fallback, page reading fallback |
| `FIRECRAWL_API_KEY` | Web page reading |
| `EXA_API_KEY` | Web search |
| `OPENAI_API_KEY` | OpenAI chat and agent reasoning |
| `ANTHROPIC_API_KEY` | Claude chat and agent reasoning |
| `OPENROUTER_API_KEY` | OpenRouter chat and agent reasoning |
| `DEEPSEEK_API_KEY` | DeepSeek chat and agent reasoning |
| `XAI_API_KEY` | Grok chat and agent reasoning |
| `RESEND_API_KEY` | Outbound email through Resend |
| `AGENTMAIL_API_KEY` | Outbound email through AgentMail |
| `AGENTMAIL_INBOX_ID` | AgentMail inbox identity |
| `AGENTMAIL_WEBHOOK_SECRET` | AgentMail inbound webhook verification |
| `SLACK_WEBHOOK_URL` | Slack webhook notifications |
| `SLACK_BOT_TOKEN` | Slack bot notifications and channel picker |
| `SLACK_SIGNING_SECRET` | Slack slash command verification |
| `APP_URL` | Public base URL used in deep links |

Set values with:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

For production, add `--prod`:

```bash
npx convex env set OPENAI_API_KEY sk-... --prod
```

## Demo mode

The public demo runs with demo mode enabled. In demo mode:

- writes are open
- auth is disabled
- seeded demo data resets every 10 minutes
- external services are usually unset

For a real CRM workspace, disable demo mode before entering real data:

```bash
npx convex run demo:disableDemoMode
npx convex run demo:disableDemoMode --prod
```

Then remove the demo reset cron from `convex/crons.ts`. Keep the agent tick cron.

## Deployment

One Convex deployment can serve the backend and frontend.

Before deploying, set required production variables:

```bash
npx convex env set CONTEXT_DEV_API_KEY unset --prod
npx convex env set FIRECRAWL_API_KEY unset --prod
npx convex env set EXA_API_KEY unset --prod
```

Deploy:

```bash
npm run deploy
```

That runs Convex static hosting, builds the frontend, deploys backend functions, and uploads the built site to Convex.

## Development checks

```bash
npx convex dev --once
npm run check-types
npm run lint
npm run build
```

There is not a formal test suite yet. The main safety checks today are Convex validation, TypeScript, ESLint, and the production build.

## Useful docs in this repo

- `files.md` explains what each file does.
- `CONTRIBUTING.md` explains workflow, changelog, and release expectations.
- `prds/` contains feature specs and product intent.
- `adrs/` contains architecture decisions.
- `docs/upstream/` contains context from the original pre-Convex stack.

## Credits

This project builds on the original open source CRM work from [trycompai/crm](https://github.com/trycompai/crm), then ports and extends it around Convex as the single application platform.
