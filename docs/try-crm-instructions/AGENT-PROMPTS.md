# Agent prompts for the Convex CRM port

Fork [trycompai/crm](https://github.com/trycompai/crm), check out `release`,
then drop `PRD.md`, `AGENTS.md`, `convex/schema.ts`, and
`convex/convex.config.ts` into the repo root and `packages/backend/`.

Run the prompts in order. Each one ends with a check. Do not start the next
prompt until the check passes. If a prompt fails twice for the same reason,
stop and fix it by hand rather than letting the agent guess a third time.

Prompts 1 through 14 are the safe path. The one-shot at the bottom is for when
you want to watch a long agent run and have time to review a large diff.

---

## Prompt 1: read everything, plan nothing yet

```
Read these files in this repo and report back before writing any code:

- README.md, AGENTS.md, CLAUDE.md
- docs/agent.md, docs/api.md, docs/design.md, docs/agent-panel.md,
  docs/currency.md, docs/environment.md, docs/telemetry.md
- adrs/ (all of them)
- packages/db/prisma/schema.prisma
- apps/agent/agent/lib/evidence.ts, facts.ts, tasks.ts, capabilities.ts,
  preamble.ts, focus.ts, names.ts
- apps/agent/agent/schedules/dispatch.ts
- apps/agent/agent/skills/*.md
- every file in apps/agent/agent/tools/
- every *.router.ts under apps/api/src/

Then produce a single markdown file at docs/port/INVENTORY.md containing:

1. Every tRPC procedure, grouped by router, with its input shape and whether
   it is a read or a write.
2. Every agent tool, with what it reads, what it writes, and which external
   service it needs.
3. Every external service the repo touches and the env var that gates it.
4. Every place the code depends on Postgres behaviour that Convex does not
   have: raw SQL, SKIP LOCKED, partial indexes, ON DELETE CASCADE, unique
   constraints, Decimal columns.

Do not write any port code yet. Do not modify any existing file.
```

Check: `docs/port/INVENTORY.md` exists, the tool list has 27 entries, and the
Postgres section names `claimDue`, `retireExhausted`, the two partial unique
indexes on `agentConversationShare` and `agentBuilderArtifact`, and the
`Decimal` columns on `deal` and `exchangeRate`.

---

## Prompt 2: scaffold the Convex backend

```
Create packages/backend as a new workspace package.

- packages/backend/package.json with convex as a dependency and scripts
  "dev": "convex dev" and "deploy": "npx @convex-dev/static-hosting deploy"
- packages/backend/convex/ with the schema.ts and convex.config.ts I have
  already placed there. Do not rewrite them.
- Install exactly these: convex, @convex-dev/auth, @auth/core@0.41.1,
  @convex-dev/agent, @convex-dev/workflow, @convex-dev/workpool,
  @convex-dev/crons, @convex-dev/action-retrier, @convex-dev/action-cache,
  @convex-dev/rate-limiter, @convex-dev/aggregate, @convex-dev/migrations,
  @convex-dev/resend, @convex-dev/static-hosting, @context-dot-dev/convex
- Add packages/backend to the Turborepo pipeline and the workspace list.
- Run `npx convex dev --once` and fix every type error until it is clean.

Do not touch apps/api, apps/app, or apps/agent yet.
```

Check: `npx convex dev --once` from `packages/backend` deploys the schema with
no errors, and the Convex dashboard shows the tables.

---

## Prompt 3: Convex Auth, and delete Better Auth

```
Set up Convex Auth in packages/backend/convex/auth.ts.

Providers: Google, Microsoft Entra ID, and Resend magic link. Read
https://labs.convex.dev/auth/config/oauth and
https://labs.convex.dev/auth/config/email first and follow them exactly.

Requirements:
- Export { auth, signIn, signOut, store, isAuthenticated }.
- convex/http.ts: call auth.addHttpRoutes(http) FIRST, then export the router.
  Do not add the static hosting catch-all yet.
- callbacks.beforeSessionCreation must read the workspace document and throw
  if the signing-in user's email is not covered by workspace.allowedSignIn.
  A bare domain like "acme.com" matches any address at that domain. An entry
  with an @ matches that address only. An empty array means nobody signs in.
- On the very first sign-in with an empty workspace, seed allowedSignIn from
  the SEED_ALLOWED_SIGN_IN env var and give that user the "owner" role.
- convex/model/auth.ts with requireUser(ctx) and requireRole(ctx, role)
  helpers that every public function uses.

Then remove Better Auth completely:
- delete packages/auth entirely
- remove @convex-dev/better-auth and better-auth from every package.json
- delete the user, session, account, verification, rateLimit, organization,
  member, invitation and ssoProvider models from the Prisma schema
- remove BETTER_AUTH_SECRET, AUTH_COOKIE_DOMAIN and ALLOWED_SIGN_IN from
  .env.example and every doc that mentions them
- delete the `dev:session` script and its implementation

Grep for "better-auth", "betterAuth", "BETTER_AUTH" and "organizationId"
across the repo and report anything left.
```

Check: the grep comes back empty except for CHANGELOG entries. `npx convex
dev --once` is still clean.

---

## Prompt 4: core CRM reads and writes

```
Write packages/backend/convex/ for companies, contacts and deals.

Structure, and keep to it for every later module:
- convex/model/<entity>.ts holds the logic and takes a ctx. No validators.
- convex/<entity>.ts holds query/mutation wrappers with args validators and
  an auth check, and calls into model/.

Port every procedure from apps/api/src/{companies,contacts,deals}/*.router.ts.
Read the corresponding .service.ts for the real behaviour, not just the
signature.

Rules:
- List queries use paginationOpts and return a paginated result. Never
  collect() a whole table.
- Filtering and sorting go through the indexes already in schema.ts. If a
  filter has no index, add the index rather than filtering in memory.
- Text search uses the searchIndex on each table.
- Uniqueness: check companies.domain and contacts.email by index before
  insert and before an update that changes them. Throw a ConvexError with a
  code the UI can read.
- Deletes call the cascade helpers from Prompt 5. Write the call sites now and
  stub the helpers.
- Money: mutations take amountMinor as an integer and currency as a string.
  Reject fractional amounts at the validator.
- Every write sets updatedAt and, where the entity has one, lastActivityAt.

Write convex/model/cascade.ts stubs that throw "not implemented" so the type
checker keeps you honest.
```

Check: `npx convex dev --once` clean. From the dashboard, create a company and
a contact by hand and confirm the indexes resolve.

---

## Prompt 5: cascades, activities, custom fields

```
Three pieces.

1. convex/model/cascade.ts, replacing the stubs.
   - deleteCompany: deals (each through deleteDeal), contacts set companyId
     to undefined, activities, fieldValues, agentConversations, emailThreads
     and calendarEvents set companyId to undefined, companyEnrichments.
   - deleteContact: contactFacts, contactBriefs, dealContacts, activities,
     fieldValues, agentConversations, calendarAttendees set contactId to
     undefined, emailThreads and calendarEvents set contactId to undefined,
     and clear companies.primaryContactId where it points here.
   - deleteDeal: dealContacts, activities, fieldValues, agentConversations.
   Walk children by index. If a delete would touch more than 500 documents,
   schedule the rest with ctx.scheduler.runAfter(0, ...) and continue in
   batches. Every cascade is idempotent.

2. convex/activities.ts and convex/model/activities.ts, porting
   apps/api/src/activities/. Timeline query, timeline counts, my-tasks,
   create, complete. Timeline reads merge activities, email threads and
   calendar events for a record, sorted by time descending, paginated.

3. convex/fields.ts and convex/model/fields.ts, porting
   apps/api/src/fields/. Definitions, options, values, reorder, archive,
   restore, delete. Setting a value writes exactly one fieldValues row per
   (fieldId, entityId) pair: look it up by the matching by_field_* index and
   patch, never insert a second one.

Add tests under packages/backend/convex/*.test.ts using convex-test for the
cascade functions. A cascade with a missed child is the bug that shows up six
months later.
```

Check: cascade tests pass. Deleting a seeded company in the dashboard leaves
no orphans.

---

## Prompt 6: the evidence ledger and facts

```
Port the agent's judgement layer into Convex, unchanged in behaviour.

convex/model/evidence.ts is a direct port of
apps/agent/agent/lib/evidence.ts. Keep the WEIGHTS table byte for byte:
the same eleven kinds, the same weights, the same primary flags, the same
labels. Keep CEILING at 0.99, CONTRADICTED at 0.45, and BAND_FLOOR at
VERIFIED 0.85, PROBABLE 0.55, POSSIBLE 0.3. Keep the noisy-or combination and
the rationale strings including the "but nothing that identifies them
directly" suffix. This file is pure functions and imports nothing from Convex.

convex/model/facts.ts ports apps/agent/agent/lib/facts.ts. recordFact scores
the evidence, refuses to store anything below the floor with the existing
reason string, supersedes the previous fact for that (contactId, field),
applies to the contact document when the band is VERIFIED, and leaves it as
PROPOSED otherwise. Port names.ts (splitName, isDerivedName) and focus.ts
alongside it.

Port the four skill files from apps/agent/agent/skills/ to
packages/backend/agent-skills/ as markdown, unchanged. They are prose the
agent reads and they are versioned like code.

Write a test file that reproduces every case in
apps/agent/test/evidence.spec.ts. The scores must match to the digit.

No tool accepts a confidence score. If you find yourself adding a `confidence`
parameter anywhere, stop and re-read skills/evidence.md.
```

Check: the evidence tests pass with identical numbers to upstream.

---

## Prompt 7: the work queue and dispatch

```
Build the agent work queue on Convex.

convex/model/tasks.ts:
- claimDue(ctx, {limit, kinds, leaseMs}) as an internalMutation. Query
  agentTasks by by_state_priority_dueAt in descending priority then ascending
  dueAt, filtered to state "open", dueAt <= now, (leasedUntil unset or <
  now), attempts < MAX_ATTEMPTS, and the kind filter. Patch each claimed row
  with leasedUntil = now + leaseMs (default 10 minutes), startedAt if unset,
  and attempts + 1. Return them.
- retireExhausted(ctx) finishes rows at or past MAX_ATTEMPTS whose lease has
  expired, setting state "done", finishedAt, and the retired outcome string.
- completeTask, noteThread, scheduleTask, lastDecision, matching the
  behaviour in apps/agent/agent/lib/tasks.ts. scheduleTask upserts: if an
  open task with the same kind and subject exists, patch its dueAt and
  reason instead of inserting a second one.

convex/agent/dispatch.ts:
- an internalAction `tick` that calls claimDue, then enqueues one job per
  claimed task into the agentPool workpool with the task id as the argument.
- convex/crons.ts registers tick every minute and retireExhausted every five.

Rules:
- Dispatch decides nothing. It leases what is due and starts a run per row.
- Anything shaped like "every N minutes, the oldest ten contacts" belongs in
  a task's dueAt, not in a cron expression.
- Write a test that runs two claimDue calls concurrently and asserts they
  return disjoint sets.
- Write a test that expires a lease and asserts the row becomes claimable.
```

Check: both concurrency tests pass. A task inserted with a past `dueAt` gets
picked up within a minute on a running dev deployment.

---

## Prompt 8: the agent runtime

```
Wire @convex-dev/agent as the research agent. Read
https://www.convex.dev/components/agent/SKILL.md and the component's docs
before writing code.

convex/agent/researchAgent.ts defines the agent: the model from appSettings
with an env fallback, the instructions assembled from
apps/agent/agent/instructions.md plus the four skill markdown files, and the
tool set from Prompt 9.

convex/agent/preamble.ts ports apps/agent/agent/lib/capabilities.ts and
preamble.ts. At the start of every session, build the capability list from
which env vars and settings this install has and put it in the first system
message, in the same on/off format upstream prints:
  [agent] on   LinkedIn (RAPIDAPI_KEY)
  [agent] off  Web research (EXA_API_KEY)
The agent must plan around what it holds rather than discovering gaps one
failed call at a time.

convex/agent/run.ts is the internalAction the workpool calls. It loads the
task, opens or resumes an Agent thread, writes the thread id back onto the
task and onto agentEvents, runs the agent with the task's budget, and calls
completeTask with an outcome string when it stops.

Budget: use @convex-dev/rate-limiter keyed by task id so a session cannot
exceed its research budget in tool calls. When the budget runs out, the agent
stops and says so. It does not degrade into guessing.

Streaming: the Agent component streams deltas over the websocket. Do not add
SSE, do not add a bridge secret, and do not install
@convex-dev/persistent-text-streaming.
```

Check: a manually inserted task runs end to end and writes `agentEvents` rows
you can watch update live in the dashboard.

---

## Prompt 9: the tools

```
Port all 27 tools from apps/agent/agent/tools/ to
packages/backend/convex/agent/tools/, one file per tool, same names.

For each tool:
- Keep the exact name, description and parameter names. The instructions and
  skills refer to them by name.
- Replace every Prisma call with a call to an internal Convex function. Tools
  never call a public function and never take a user's identity.
- Tools that hit an external service go through an action, and the action is
  wrapped in @convex-dev/action-retrier.
- Tools that read the same thing repeatedly (brand lookups, LinkedIn
  profiles) go through @convex-dev/action-cache with a sensible TTL. That
  cache replaces REDIS_URL.

Specific swaps:
- enrich_company and research_company: use @context-dot-dev/convex instead of
  the raw Context REST client. Read the component skill first. Keep the
  behaviour where the key can come from Settings → General as well as env,
  since a self-hoster's admin cannot redeploy to set an env var.
- research_person and any Perplexity call: use the Exa component. Keep
  citations. A cited claim is web.cited-claim evidence, weight 0.4, and it is
  not primary. Do not promote it.
- fetch_contact_photo: download in an action and store with ctx.storage.store,
  then write the storageId. That replaces Vercel Blob.
- The bash, grep and glob sandbox tools: do not port them. The sandbox is off
  in this build. Any tool that assumed a /workspace filesystem now reads and
  writes Convex documents. Say so in a comment at the top of each affected
  file.
- read_crm_history, read_company_history and read_deal_history read threads,
  meetings and signature blocks from Convex. These are the tools that work
  with no API keys at all and they are the best evidence there is, so they
  get ported first and tested hardest.

After each tool, run the type check. Do not batch 27 tools into one commit.
```

Check: with every optional key unset, `read_crm_history` and `record_fact`
work against a seeded thread and produce a `PROBABLE` or better fact.

---

## Prompt 10: agent builder

```
Port the agent builder: apps/api/src/agent/, apps/api/src/conversations/, and
apps/agent/agent/lib/{builder-runtime,builder-delegation,custom-agent-dispatch,
run-runtime,run-state}.ts.

Model it as data, not as a deployment:
- agentVersions holds instructions, manifest, modelId and sandboxPolicy.
- Deploying sets deployedAt and points agentDefinitions.currentVersionId at
  the row. Rollback is a pointer move. There is no build step.
- The manifest names which of the compiled tools a version may call. An agent
  built in the UI cannot invent a tool that does not exist. Validate the
  manifest against the tool registry at deploy time and reject unknown names.

Triggers:
- MANUAL: a mutation that inserts an agentRuns row and enqueues it.
- SCHEDULE: register a cron through @convex-dev/crons and store the returned
  id on the trigger. Deleting or disabling the trigger deletes the cron.
- EVENT: fires from the mutation that causes the event.
- WEBHOOK: an HTTP action that verifies a per-trigger secret.

Runs:
- Use @convex-dev/workflow for anything multi-step, so a run survives a
  restart and resumes at the step it stopped on.
- idempotencyKey and correlationId are unique. Check by index before insert
  and return the existing run rather than creating a duplicate.
- Every action the run takes writes an agentActions row before it runs, with
  its own idempotencyKey.
- WAITING_FOR_APPROVAL pauses the run until a human resolves it.
- Write an agentAuditEvents row for every state change, with before and after.

Conversations: threads live in the Agent component. agentConversations holds
the CRM link, ordering and read state. Share links store a SHA-256 of the
token, never the token. Enforce one active share per conversation inside the
mutation.
```

Check: build an agent from a sentence, deploy it, run it, roll back. Run
history shows both versions and the audit trail has a row per transition.

---

## Prompt 11: mailbox and calendar

```
Port apps/api/src/{google,microsoft,mailbox,sync}/ to Convex.

First, the connection flow, since Convex Auth does not persist OAuth tokens:
- HTTP actions at /api/connections/google/start and
  /api/connections/google/callback, and the Microsoft pair. The start route
  redirects with access_type=offline and prompt=consent and the read-only
  Gmail and Calendar scopes. The callback exchanges the code and writes a
  mailboxConnections row.
- convex/model/mailboxAuth.ts refreshes an expired access token before any
  API call and sets mailboxSyncs.status to NEEDS_RECONNECT when the refresh
  fails.
- Register both routes in convex/http.ts before the static catch-all.

Then the sync:
- An internalAction per source, enqueued into the mailboxPool workpool, run
  by a cron every 15 minutes. There is no CRON_SECRET and no public sync
  route: this is internal to the deployment.
- Forward-only. On the first run, record the current time and import nothing.
  Never backfill history.
- Read-only scopes. The CRM lists and reads. It never sends, replies, moves
  or deletes. If you find yourself writing a send call, stop.
- Dedupe on rfcMessageId for messages and (iCalUid, originalStartTime) for
  events, both by index.
- Match a message to a contact by from and recipient addresses. Respect
  suppressedDomains and suppressedContacts before creating anything.
- autoCreate is per user and off by default.
- Cursor and lastSyncedAt live on mailboxSyncs. A failed run sets lastError
  and retryAfter and does not advance the cursor.
```

Check: connect a real Gmail account, send yourself a mail from a new address,
run the cron, and confirm exactly one thread lands with the contact matched
and nothing older than the connection time imported.

---

## Prompt 12: dashboard, search, settings, currency

```
Four smaller modules.

1. convex/dashboard.ts. Port apps/api/src/dashboard/. Pipeline value by
   stage and open deals by owner come from the two @convex-dev/aggregate
   instances (dealsByStage, dealsByOwner), kept in sync inside the deal
   mutations. Never scan the deals table for a summary.

2. convex/search.ts. Port the quick search from apps/api/src/search/. Fan out
   across the three searchIndexes, merge, and cap results per type.

3. convex/settings.ts and convex/workspace.ts. Port
   apps/api/src/{settings,workspace}/. Agent model, Context key, research key,
   reporting currency, workspace name and website, members list, role
   changes, and the sign-in allow list. Only owner and admin can change the
   allow list or roles.
   Settings → SSO becomes a read-only page listing the providers configured in
   convex/auth.ts and the steps to add one. Do not pretend runtime SSO
   registration exists.

4. convex/currency.ts. Port apps/api/src/currency/. Reporting currency,
   manual rate overrides, and a daily refresh cron. Deal mutations recompute
   baseAmountMinor, baseCurrency, fxRate and fxRateAt whenever the amount,
   the currency or the reporting currency changes. All amounts are integer
   minor units. Round once, at the conversion, never twice.
```

Check: the dashboard totals match a hand count on seeded data, and changing
the reporting currency updates every deal's base amount.

---

## Prompt 13: the frontend

```
Replace apps/app with a Vite + React + React Router SPA. Keep packages/ui as
is: it is shadcn components and a Tailwind theme and neither needs Next.js.

- Vite, React 19, TypeScript, Tailwind, React Router, TanStack Table,
  nuqs with the react-router adapter for URL state.
- ConvexAuthProvider from @convex-dev/auth/react wraps the app.
- Routes: / /companies /companies/:id /contacts /contacts/:id /deals
  /deals/:id /agents /agents/:id /chat /chat/:id /settings
  /settings/connections /settings/members /settings/currencies /sign-in
  /onboarding /grant-access. The [slug] segment is gone with organizations.
- Every list keeps filters, sort and page in the URL so copying the address
  bar reproduces the view. That behaviour is in the upstream README and it
  should survive.
- Every read is useQuery. Every write is useMutation. No fetch calls, no tRPC
  client, no loading spinners where a suspense boundary reads better.
- Port these component groups from apps/app/components as they stand, swapping
  the data layer only: crm/record-sheet, crm/timeline, crm/fields,
  data-table, agent-builder, landing.
- The Agent tab subscribes to the Agent component's thread. Steps, discarded
  leads with reasons, and open questions answered in place. No SSE.
- Add <UpdateBanner /> from @convex-dev/static-hosting/react.

Then delete apps/api and apps/agent, remove nestjs, trpc, prisma, eve and the
Vercel SDKs from every package.json, and delete .vercelignore,
docker-compose.yml and packages/db.
```

Check: `npm run dev` renders the app against `npx convex dev`, sign-in works,
and every list, record sheet and settings page loads with live data.

---

## Prompt 14: deploy, docs, cleanup

```
Finish the port.

1. Static hosting. convex/http.ts order is: auth.addHttpRoutes(http), then the
   connection OAuth routes, then registerStaticRoutes(http,
   components.staticHosting) as the catch-all. Add the deploy script and run
   `npx @convex-dev/static-hosting deploy`. Confirm the app is live at
   https://<deployment>.convex.site and that
   /api/auth/callback/google still resolves to Convex Auth.

2. Seed. Port `bun run db:seed` to convex/seed.ts as an internalMutation run
   with `npx convex run seed:run`. Idempotent, same believable pipeline.

3. Migration script. scripts/import-from-postgres.ts reads through Prisma and
   writes through the Convex HTTP client in dependency order, keeping a
   Map<oldId, newId> per table for foreign keys, and multiplying money by 100
   exactly once.

4. Docs. Rewrite README.md, docs/agent.md, docs/api.md and
   docs/environment.md for the new stack. Delete every mention of Postgres,
   Prisma, NestJS, tRPC, eve, Vercel, Redis, DATABASE_URL, BETTER_AUTH_SECRET,
   API_URL, APP_URL, CRON_SECRET and AGENT_BRIDGE_SECRET.
   Add a "Known gaps" section naming the two things that did not survive:
   the sandbox, and runtime SSO registration.

5. Run every acceptance test in PRD.md and paste the results into
   docs/port/ACCEPTANCE.md with a pass or fail per line and a note on any
   failure.

Then grep the whole repo for: prisma, nestjs, trpc, better-auth, eve,
@vercel, DATABASE_URL, REDIS_URL, AGENT_BRIDGE_SECRET, organizationId. Report
every hit that is not in CHANGELOG.md.
```

Check: all 15 acceptance tests pass, the grep is clean, and a fresh clone gets
to a running app with `bun install`, four env vars, and one deploy command.

---

## The one-shot

Use this when you want the whole port in a single long run. Give the agent
`PRD.md`, `AGENTS.md`, `convex/schema.ts` and `convex/convex.config.ts` first.
Expect a very large diff and budget real review time.

```
Port this repository to run entirely on Convex. Read PRD.md and AGENTS.md
first, then follow them. They are the specification. Where this prompt and the
PRD disagree, the PRD wins.

Target: one Convex deployment that is the database, the agent runtime, the
work queue, the file store, the cron scheduler, and the web host. No Postgres,
no Redis, no NestJS, no tRPC, no eve, no Vercel, no Better Auth.

Read before writing code:
- https://docs.convex.dev/llms.txt
- https://www.convex.dev/components/components.md
- the SKILL.md for every component in convex/convex.config.ts
- https://labs.convex.dev/auth/setup and
  https://labs.convex.dev/auth/config/email
- https://github.com/get-convex/static-hosting README
- https://github.com/michaelshimeles/adam README, for how it maps a durable
  agent runtime onto Convex tables, a leased queue, and scheduler-driven
  ticks. Learn the pattern. Do not vendor an eve bundle: this port replaces
  eve with the Convex Agent component.

Work in this order and run `npx convex dev --once` plus the type check after
every step. Commit after every step.

1.  Inventory the existing tRPC procedures, agent tools and Postgres-specific
    behaviour into docs/port/INVENTORY.md.
2.  Scaffold packages/backend with the schema and component config provided.
3.  Convex Auth with Google, Microsoft Entra and Resend magic link. Delete
    Better Auth, packages/auth, and all nine of its tables. The sign-in allow
    list moves into the workspace document and is enforced in
    callbacks.beforeSessionCreation.
4.  Companies, contacts and deals: every procedure, paginated, index-backed.
5.  Cascade deletes, activities and custom fields.
6.  The evidence ledger and facts, ported byte for byte. Same weights, same
    floors, same rationale strings, same tests.
7.  The agent work queue: a leased claim mutation replacing SKIP LOCKED, plus
    a one-minute dispatch tick that leases what is due and decides nothing.
8.  The agent runtime on @convex-dev/agent, with the capability preamble.
9.  All 27 tools, one commit each. Context.dev and Exa components replace the
    raw REST clients. The sandbox tools are not ported.
10. The agent builder: versions as data, deploy as a row flip, triggers,
    runs, actions, audit.
11. Mailbox and calendar, including the separate OAuth connection flow that
    Convex Auth requires for access tokens. Forward-only, read-only.
12. Dashboard, search, settings, currency.
13. Replace apps/app with a Vite + React Router SPA. Keep packages/ui.
14. Static hosting, seed, migration script, docs, acceptance tests.

Hard rules:
- No tool accepts a confidence score. Tools report what they observed. The
  evidence ledger decides the band.
- Dispatch schedules. It never decides. Recurrence lives in a task's dueAt.
- Agent tools call internal functions only.
- Money is integer minor units. Round once, at the boundary.
- Never collect() a whole table in a query. Paginate and use an index.
- Do not invent a Convex API. If you are unsure whether a function exists,
  read the docs or the component source before writing the call.
- Do not fake the sandbox or runtime SSO registration. Document them as gaps.

Stop and ask me when: a component's API does not match what the PRD assumes,
an upstream behaviour cannot be reproduced on Convex, or a change would alter
what the agent is allowed to write to a record.

Finish by running the 15 acceptance tests in PRD.md and writing the results to
docs/port/ACCEPTANCE.md.
```

---

## If a prompt goes sideways

The three failures worth watching for:

The agent invents a Convex API that reads plausibly and does not exist. Fix
by pasting the component's SKILL.md into the next turn and asking it to
correct every call against it.

The agent "simplifies" the evidence weights, usually by rounding them or
collapsing the primary flag. That silently changes what the CRM will write to
a customer record. Diff `convex/model/evidence.ts` against
`apps/agent/agent/lib/evidence.ts` before you accept prompt 6.

The agent adds a `confidence` parameter to a tool. Reject it. The whole point
of the ledger is that a model asked to grade its own certainty will do it, and
it will be wrong in the direction that makes it look useful.
