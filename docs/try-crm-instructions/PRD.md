# Convex CRM port

An agentic CRM that runs on one Convex deployment. Convex is the database, the
agent runtime, the queue, the file store, the cron scheduler, and the web host.

Source: [trycompai/crm](https://github.com/trycompai/crm) at branch `release`.
Reference for the eve-on-Convex pattern:
[michaelshimeles/adam](https://github.com/michaelshimeles/adam).

---

## Why this port matters

The upstream CRM is good software with an expensive shape. Three deployments,
a Postgres, an optional Redis, and a build that has to keep a committed
generated file in sync with a NestJS router. The agent survives a redeploy
only since eve pays for that durability with its own world backed by Postgres
and Redis.

Convex already has every one of those properties. Mutations are serializable,
so `FOR UPDATE SKIP LOCKED` becomes a plain transaction. The scheduler is
durable, so a task queue is a table plus an index. Queries are reactive, so
the Agent tab streams without SSE. File storage is built in, so profile photos
do not need a blob vendor. Static hosting serves the frontend from the same
deployment, so there is no second deploy target and no `API_URL` / `APP_URL`
pair to keep aligned.

The result: one `npm run deploy`, one URL, one set of credentials, and a
self-hoster who can run the whole product without signing up for anything.

---

## What ships

Feature parity with upstream, minus two things that have no Convex equivalent
and are called out in the gaps section below.

### Records
- Companies, contacts, deals, with owners and a primary contact per company.
- Deal stages, stage change history, expected and actual close dates.
- Multi-currency amounts with a reporting currency and stored FX rates.
- Custom fields per entity, with select options, ordering, archive, and an
  `agentFilled` flag plus an `agentBrief` that tells the agent what to put in
  a field.
- Bulk actions: reassign owner, change stage, delete, re-enrich.
- List state in the URL, so copying the address bar reproduces the view.

### Timeline
- Notes, calls, emails, meetings, tasks, stage changes, enrichment entries.
- Tasks with due dates and a "my tasks" view.
- Email threads and calendar events attached to the right company and contact.

### Mailbox and calendar
- Gmail and Google Calendar sync. Outlook mail sync.
- Forward-only import: the first check records the current time and imports
  nothing, so connecting an old mailbox does not dump years of mail in.
- Read-only scopes. The CRM lists and reads. It never sends, replies, moves,
  or deletes.
- Suppressed domains and suppressed contacts.
- Auto-create contacts from mail, per user, off by default.

### The agent
- Runs on its own schedule against its own work queue. Close the browser and
  it keeps going.
- Nothing about a person is guessed. Tools report what they observed. A
  weighted evidence ledger prices the observation and decides the band.
  Strong evidence writes to the record. Weak evidence becomes a suggestion a
  human settles. No tool accepts a confidence score.
- `schedule_recheck` books its own follow-up and states a reason, and the
  reason is shown to the rep.
- A per-record Agent tab: steps as it takes them, leads it discarded and why,
  and its questions answered in place.
- Every outside key is optional. With no keys at all it still reads your own
  threads, meetings, and signature blocks, which is the best evidence there
  is.
- A capability preamble at the start of every session lists which sources this
  install has, so the agent plans around what it holds.

### Agent builder
- Describe an agent in a sentence, get a draft with instructions, a tool
  manifest, and a model.
- Versions, validation, deploy, pause, archive.
- Triggers: manual, schedule, event, webhook.
- Runs with events, actions, token and cost accounting, and an audit trail.
- Shareable read-only conversation links with revoke.

### Workspace
- Sign-in allow list by domain or address. Unset means nobody signs in.
- Members with roles.
- Settings for the agent model, the Context brand key, the research key, and
  the reporting currency.
- Onboarding that asks for the brand key and researches the workspace website.
- Self-hosted telemetry counters, off with one env var.

---

## Stack

| Layer | Upstream | This port |
| --- | --- | --- |
| Database | Prisma + Postgres (Neon) | Convex tables and indexes |
| API | NestJS + nestjs-trpc | Convex queries, mutations, actions |
| Agent runtime | eve on its own deployment | `@convex-dev/agent` + `@convex-dev/workflow` |
| Work queue | Postgres `SKIP LOCKED` lease | `agentTasks` table + `@convex-dev/workpool` |
| Schedules | eve schedule file + Vercel cron | `convex/crons.ts` + `@convex-dev/crons` |
| Model access | Vercel AI Gateway | AI SDK provider of choice, key in Convex env |
| Auth | Better Auth | Convex Auth |
| Files | Vercel Blob | Convex file storage |
| Cache | Upstash Redis | `@convex-dev/action-cache` |
| Brand data | Context.dev REST | `@context-dot-dev/convex` |
| Web research | Perplexity REST | Exa, Firecrawl, or Tavily component |
| Email out | none | `@convex-dev/resend` |
| Frontend | Next.js App Router on Vercel | Vite + React + React Router, served by `@convex-dev/static-hosting` |
| Streaming | SSE bridge with a shared secret | reactive Convex queries |
| Tooling | Bun, Turborepo, Biome | Bun, Turborepo, Biome, unchanged |

### Components used

Official, from `convex.dev/components`:

- `@convex-dev/static-hosting` 0.2.1 hosts the frontend
- `@convex-dev/agent` 0.6.4 threads, messages, streaming, vector search
- `@convex-dev/workflow` 0.4.4 durable multi-step research runs
- `@convex-dev/workpool` 0.4.9 three bounded pools: agent, enrichment, mailbox
- `@convex-dev/crons` 0.2.2 runtime cron registration for schedule triggers
- `@convex-dev/action-retrier` 0.3.1 retries around flaky vendor calls
- `@convex-dev/action-cache` 0.3.1 replaces Redis for enrichment lookups
- `@convex-dev/rate-limiter` 0.3.2 research budget and vendor quotas
- `@convex-dev/aggregate` 0.2.2 pipeline rollups for the dashboard
- `@convex-dev/migrations` 0.3.6 live data migrations
- `@convex-dev/resend` 0.2.6 magic links and task reminders

Partner:

- `@context-dot-dev/convex` 1.0.1 brand data, same vendor as upstream
- one of `@exalabs/convex-exa`, `@firecrawl/firecrawl-convex`, or
  `@tavily/convex-tavily` for open-web research with citations

Skip `@convex-dev/persistent-text-streaming`. The Agent component already
streams deltas over the websocket, and adding a second streaming path would
give two sources of truth for one message.

---

## Architecture decisions

### One deployment, no bridge

Upstream needs `AGENT_BRIDGE_SECRET` set to the same value in two processes so
a rep can talk to the agent, and it passes the record in a signed token rather
than trusting the message. Here the agent and the app are the same deployment.
The Agent tab calls a mutation, the mutation writes a row, the runner reads it.
Delete the bridge, the token, and the secret.

### The queue is a table

`claimDue` becomes a Convex mutation:

1. Read `agentTasks` by the `by_state_priority_dueAt` index, filtered to
   `state: "open"`, `dueAt <= now`, `leasedUntil` unset or past, `attempts <
   MAX_ATTEMPTS`.
2. Write `leasedUntil = now + 10min`, bump `attempts`, set `startedAt`.
3. Return the claimed rows.

Convex serializes mutations, so two dispatchers claim disjoint work with no
lock hint. A run that dies frees its row when the lease expires. Keep
`retireExhausted` as a second mutation that finishes rows past the attempt cap.

The `state` field is denormalized on purpose. Convex indexes cannot express
"where finishedAt is null", so `state` carries that as an indexed value and
flips to `"done"` in the same write that sets `finishedAt`.

### Dispatch schedules, it does not decide

Upstream runs `dispatch.ts` every minute and its only job is to lease what is
due and start a session per row. Same here: `convex/crons.ts` runs
`internal.agent.dispatch.tick` every minute, which claims a batch and enqueues
each into `agentPool`. The workpool bounds parallelism. Anything shaped like
"every N minutes, the oldest ten contacts" belongs in a task's `dueAt`, never
in a cron expression.

### Deploying an agent is a row flip

Upstream ships an agent version as a deployment. Here `agentVersions` holds
the instructions, the tool manifest, the model id, and the sandbox policy as
data. The runner reads the current version at run time. Deploying sets
`deployedAt` and points `agentDefinitions.currentVersionId` at the row. No
build, no redeploy, and rollback is a pointer move.

Tools stay in code. The manifest names which of the compiled tools a version
may call, so an agent built in the UI cannot invent a tool that does not exist.

### Money is integers

Prisma stored `Decimal(14,2)`. Convex has no decimal type and JavaScript
floats will drift on you. Store `amountMinor` as an integer count of cents
next to `currency`, convert at the edges, and format in the UI. FX rates stay
as numbers since they are ratios, not balances.

### Cascades are code

`onDelete: Cascade` has no Convex equivalent. Write `convex/model/cascade.ts`
with one function per parent table that walks children by index and deletes
them, then call it from the delete mutation. For a company that means deals,
contacts unassigned, activities, field values, conversations, email threads,
and calendar events. Batch with the scheduler if a record is large.

### Unique columns are checked in the mutation

Prisma `@unique` becomes an index plus a lookup before the insert. The columns
that matter: `companies.domain`, `contacts.email`,
`emailThreads.rootMessageId`, `emailMessages.rfcMessageId`,
`agentRuns.idempotencyKey`, `agentRuns.correlationId`,
`agentActions.idempotencyKey`, `agentConversationSubmissions.clientRequestId`,
`(calendarEvents.iCalUid, originalStartTime)`,
`(fieldDefinitions.entity, key)`, `(agentVersions.agentId, number)`.

---

## Auth

Convex Auth, configured in `convex/auth.ts`. Better Auth is removed entirely:
the package, `packages/auth`, the nine Better Auth tables, `BETTER_AUTH_SECRET`,
`AUTH_COOKIE_DOMAIN`, and the `dev:session` cookie printer.

### Providers

- Google, from `@auth/core/providers/google`
- Microsoft Entra, from `@auth/core/providers/microsoft-entra-id`
- Resend magic link, from `@auth/core/providers/resend`, for installs that do
  not want a Google or Microsoft tenant

Callback URLs move to the Convex deployment:
`https://<deployment>.convex.site/api/auth/callback/google`. Locally,
`http://127.0.0.1:3210/api/auth/callback/google`. Set `SITE_URL` to the app
origin.

### The allow list

`ALLOWED_SIGN_IN` becomes `workspace.allowedSignIn`, an array of domains and
addresses stored in the database and editable in Settings. It is enforced in
`callbacks.beforeSessionCreation`, which throws when the email is not covered.
An empty array means nobody signs in, which is the safe direction to fail. The
first sign-in on a fresh install seeds the array from an env var and takes the
`owner` role, then Settings takes over.

### Mailbox tokens are separate from sign-in

This is the one place where the port cannot copy upstream's shape, and getting
it wrong will cost you a day.

Better Auth's `account` table stores `accessToken` and `refreshToken`, so
upstream reads Gmail with the same credential the user signed in with. Convex
Auth's `authAccounts` table stores `userId`, `provider`, `providerAccountId`,
`secret`, `emailVerified`, and `phoneVerified`. No OAuth tokens, and the
`afterUserCreatedOrUpdated` callback receives a profile, not a token set.

So mailbox access gets its own flow:

1. Settings → Connections has a "Connect Gmail" button.
2. It hits an HTTP action at `/api/connections/google/start` that redirects to
   Google with `access_type=offline`, `prompt=consent`, and the Gmail and
   Calendar read scopes.
3. `/api/connections/google/callback` exchanges the code, then writes a
   `mailboxConnections` row with the access token, refresh token, expiry, and
   scope.
4. `convex/model/mailboxAuth.ts` refreshes an expired access token before any
   sync call and flips `mailboxSyncs.status` to `NEEDS_RECONNECT` when the
   refresh fails.

This is more code than upstream needs, and it is better product. Signing in
and granting mailbox access are different decisions, so a rep can sign in with
Google and never hand over their inbox.

---

## Frontend

Vite, React, React Router, TypeScript, Tailwind, shadcn/ui, TanStack Table,
nuqs with the React Router adapter for URL state. `packages/ui` survives close
to intact: it is shadcn components and a Tailwind theme, and neither depends
on Next.js.

Next.js is dropped rather than static-exported. The app uses App Router server
components and server actions against tRPC, and none of that survives a static
export. Rewriting the data layer to Convex hooks removes the reason Next was
there.

Routes map one to one:

```
/                          dashboard
/companies                 /companies/:companyId
/contacts                  /contacts/:contactId
/deals                     /deals/:dealId
/agents                    /agents/:agentId
/chat                      /chat/:chatId
/settings                  /settings/connections
                           /settings/members
                           /settings/currencies
/sign-in  /onboarding  /grant-access
```

The `[slug]` segment goes away with organizations. Keep the workspace slug in
the `workspace` document for display.

Serving mode is app-owned root routing. `convex/http.ts` calls
`auth.addHttpRoutes(http)` first, registers the connection OAuth routes, then
calls `registerStaticRoutes(http, components.staticHosting)` as the catch-all.
Exact routes win, so auth URLs stay put. Deploy with:

```bash
npx @convex-dev/static-hosting deploy
```

Add `<UpdateBanner />` so a rep gets a reload prompt when a new build lands.

---

## Data flow rules

Three rules carried over from upstream, worth keeping:

**Intelligence never lives in the query layer.** Convex functions report that
something happened. The agent decides what it means. Two copies of an identity
matcher drift, and one of them ends up matching every employer on earth.

**`packages/ui` is the only source of UI.** No overriding styles at the call
site.

**There are no organizations.** Single tenant, on purpose. An
`organizationId` that is always the same value is a column, an index, and a
permission check that buys nothing and reads like a real one at review time.

One rule to add:

**Agent tools call `internal` functions only.** A tool that can reach a public
mutation is a tool that can be reached from a browser console. Tools take an
`internalMutation` reference and a run context, never the public API.

---

## Known gaps

Two upstream features do not survive the port. Say so in the README rather
than shipping something that looks like them.

**The sandbox.** Upstream gives the model `bash`, `grep`, `glob`, and a
`/workspace` inside a Vercel Sandbox with deny-all egress, so it can keep a
dossier and diff this month's profile against last month's. Convex actions
have no shell. Upstream already treats the sandbox as optional and works
without it, so the port ships with it off and the tools that assumed a
filesystem rewritten to read and write Convex documents. If you want a real
shell later, the Fystash component gives you sandbox rooms from a Convex
action. Do not fake it with an eval loop.

**Runtime SSO registration.** Better Auth's SSO plugin lets an admin add an
OIDC or SAML provider from Settings and have it work immediately. Convex Auth
reads its provider list from `convex/auth.ts` at deploy time. A self-hoster
can add a generic OIDC provider by setting three env vars and redeploying,
which is a real step down from a form in the UI. Settings → SSO becomes a page
that shows which providers are configured and the exact steps to add one.

Also worth naming: token counting and cost accounting come from your AI SDK
provider, not from a gateway. Set the model key in Convex env
(`npx convex env set OPENAI_API_KEY ...`) and record usage from the SDK
response into `agentRuns`.

---

## Environment

Everything below is a Convex env var, set with `npx convex env set`. There is
no `.env` read by three processes and no `DATABASE_URL`.

Required:

| Variable | What it is |
| --- | --- |
| `SITE_URL` | App origin. `http://localhost:5173` in dev, the `.convex.site` URL in prod |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client, or |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `..._SECRET` | Microsoft app registration, or |
| `AUTH_RESEND_KEY` | Resend key for magic-link sign-in |
| `SEED_ALLOWED_SIGN_IN` | Seeds the allow list on first boot |

Optional, each one opens one more place for the agent to look:

| Variable | What it gives |
| --- | --- |
| `OPENAI_API_KEY` or equivalent | The model. Required for the agent to run at all |
| `EXA_API_KEY` | Open-web research with citations |
| `RAPIDAPI_KEY` | LinkedIn profile reads for identity |
| `CONTEXT_DEV_API_KEY` | Brand data. Also settable in Settings → General, which is where a self-hoster's admin will look |
| `RESEND_API_KEY` | Task reminders and digests |
| `CRM_TELEMETRY_DISABLED` | Set to `1` and this install reports nothing |

Gone: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `AUTH_COOKIE_DOMAIN`, `API_URL`,
`APP_URL`, `REDIS_URL`, `CRON_SECRET`, `AGENT_BRIDGE_SECRET`,
`PERPLEXITY_API_KEY`, `MICROSOFT_TENANT_ID`.

`CRON_SECRET` disappears since the mailbox sync is an internal cron in the
same deployment, not an HTTP route someone could hit.

---

## Acceptance tests

The port is done when all of these pass against a real deployment.

1. `npx convex dev` starts clean with zero type errors.
2. `npx @convex-dev/static-hosting deploy` puts the app at
   `https://<deployment>.convex.site` and the sign-in page renders.
3. Google sign-in completes and lands on the dashboard. An address outside the
   allow list is refused at `beforeSessionCreation`.
4. Create a company, a contact, and a deal. Each appears in another browser
   tab without a refresh.
5. Move a deal to `CLOSED_WON`. A `STAGE_CHANGE` activity appears on the
   timeline and the dashboard pipeline total updates.
6. Add a custom SELECT field on contacts, set it on a record, filter the list
   by it, then archive it and confirm the value survives.
7. Connect Gmail in Settings → Connections. Send yourself a mail from a new
   address, run the sync cron, and confirm a thread lands on the right contact
   and nothing older than the connection time was imported.
8. With no research keys set, ask the agent to identify a contact who has
   replied to a thread. It records a fact with `crm.thread-reply` evidence,
   band `PROBABLE` or better, and the Agent tab shows the steps live.
9. With no keys at all and no threads, the same request stores nothing and
   returns the "below the floor for keeping" reason rather than a guess.
10. `schedule_recheck` writes an `agentTasks` row with a stated reason, and the
    reason is visible in the UI.
11. Kill the deployment mid-run. The lease expires, the next dispatch tick
    re-claims the task, and it finishes.
12. Build an agent in the builder, deploy it, run it manually, then roll back
    to the previous version. The run history shows both versions.
13. Delete a company. Its deals, activities, field values, and conversations
    are gone, and no orphan rows remain.
14. A shared conversation link opens read-only for a signed-in workspace user
    and 404s after revoke.
15. `bun run check-types` and `bun run test` pass.

---

## Migration from an upstream install

Anyone already running the Postgres version needs a path. Write
`scripts/import-from-postgres.ts` that reads through Prisma and writes through
the Convex HTTP client in dependency order: users, companies, contacts,
company enrichments, deals, deal contacts, field definitions, field options,
field values, activities, email threads, email messages, calendar events,
attendees, facts, briefs, agent tasks, agent definitions and versions.

Two things to handle carefully. IDs change from cuid to Convex ids, so keep a
`Map<oldId, newId>` per table and resolve foreign keys through it. Money
changes from decimal to minor units, so multiply by 100 and round once, at the
boundary, never twice.

Sessions do not migrate. Everyone signs in again. That is fine.
