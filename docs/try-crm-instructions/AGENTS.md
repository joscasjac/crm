# AGENTS.md

Rules for any agent working in this repo. Read `docs/PRD.md` for the plan.
This file is the short version you keep in context.

## What this is

An agentic CRM on one Convex deployment. Convex is the database, the agent
runtime, the work queue, the file store, the cron scheduler, and the web host.
There is no Postgres, no Redis, no separate API server, no Vercel.

## The three rules from upstream that still hold

**Intelligence never lives in the query layer.** Convex functions report that
something happened. The agent decides what it means. Two copies of an identity
matcher drift, and one ends up matching every employer on earth.

**`packages/ui` is the only source of UI.** No overriding styles at the call
site.

**There are no organizations.** Single tenant, on purpose. An `organizationId`
that is always the same value is a column, an index, and a permission check
that buys nothing and reads like a real one at review time.

## Rules added by the port

**No tool accepts a confidence score.** Tools report what they observed:
`crm.signature-block`, `github.account-identity`, `linkedin.employer-and-name`.
The evidence ledger prices the observation. A model asked to grade its own
certainty will do it, and it will be wrong in the direction that makes it look
useful. A confidently wrong fact about a customer is worse than a blank field,
since nobody can tell it is wrong.

**Dispatch schedules, it never decides.** The one-minute tick leases what is
due and starts a run per row. Anything shaped like "every N minutes, the
oldest ten contacts" belongs in a task's `dueAt`, not in a cron expression.

**Agent tools call internal functions only.** A tool that can reach a public
mutation is a tool that can be reached from a browser console.

**Money is integer minor units.** `amountMinor` plus `currency`. Round once,
at the conversion boundary. Never store a fractional amount.

## Convex conventions

- `convex/model/<thing>.ts` holds logic and takes a `ctx`. No validators.
- `convex/<thing>.ts` holds the `query` / `mutation` / `action` wrappers, with
  args validators and an auth check, calling into `model/`.
- Never `collect()` a whole table in a query. Paginate with `paginationOpts`
  and read through an index.
- Every filter has an index. If it does not, add one to `schema.ts` rather
  than filtering in memory.
- Timestamps are epoch millis. `_creationTime` covers `createdAt`.
- Foreign keys are `v.id("table")`.
- `v.any()` only where the original column was genuinely free-form JSON.
- Uniqueness is checked in the mutation, by index, before the write. Convex
  has no unique constraint.
- Cascades are hand written in `convex/model/cascade.ts` and are idempotent.
- Anything that calls an external service is an action, wrapped in
  `@convex-dev/action-retrier`, cached with `@convex-dev/action-cache` when
  the same lookup repeats.

## Auth

Convex Auth. Not Better Auth. Never Better Auth.

- Providers live in `convex/auth.ts` and are read at deploy time.
- The sign-in allow list is `workspace.allowedSignIn` and is enforced in
  `callbacks.beforeSessionCreation`. Empty means nobody signs in, which is the
  safe direction to fail.
- Convex Auth does not persist OAuth access or refresh tokens. Mailbox access
  has its own connection flow that writes `mailboxConnections`. Do not try to
  read a Gmail token out of `authAccounts`. It is not there.

## Mail

Read-only, forward-only. The CRM lists and reads. It never sends, replies,
moves, or deletes. The first sync records the current time and imports
nothing. If you are writing a send call, stop and re-read this paragraph.

## Two things that do not exist here

**No sandbox.** Upstream gives the model a shell with deny-all egress. Convex
actions have no shell. Tools that assumed a `/workspace` filesystem read and
write Convex documents instead. Do not simulate a shell with an eval loop.

**No runtime SSO registration.** Providers are code, set at deploy time.
Settings → SSO is a read-only page that lists what is configured. Do not build
a form that looks like it registers a provider.

## Before you commit

- `npx convex dev --once` is clean.
- `bun run check-types` passes.
- `bun run test` passes.
- The diff does not add: `prisma`, `nestjs`, `trpc`, `better-auth`, `eve`,
  `@vercel/*`, `DATABASE_URL`, `REDIS_URL`, `AGENT_BRIDGE_SECRET`,
  `organizationId`, or a `confidence` parameter on a tool.

## When to stop and ask

- A component's API does not match what `docs/PRD.md` assumes.
- An upstream behaviour cannot be reproduced on Convex.
- A change would alter what the agent is allowed to write to a customer
  record.

Guessing on any of those three is more expensive than the question.
