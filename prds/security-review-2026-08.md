# Security review, August 2026

Created: 2026-08-14 06:40 UTC
Last Updated: 2026-08-14 07:05 UTC
Status: Done

Ran the `sec-check` skill across the whole backend: the public function
surface, the write access layer, HTTP routes and webhooks, component
boundaries, crons, uploads, secret handling, `npm audit`, and an
unauthenticated probe of both deployments.

## Summary

The write path is sound. Every mutation goes through `writeMutation`
(`convex/model/functions.ts`), which runs `requireWriteAccess` before the
handler, and every scheduler and cron target is `internal.*`. Secrets live in
environment variables, not the database. Slack request signing is correct
(HMAC SHA256, constant time compare, five minute skew window).

The read path is the problem. Every `query` in `convex/` imports from
`_generated/server` and none call `ctx.auth`. Reads are completely
unauthenticated, and `requireWriteAccess` gates writes only. Today that is
masked because the app runs in demo mode with fake, ten minute data. The
moment a fork turns demo mode off and loads real customer data, the read
surface stays wide open. That is the public-by-default trap the skill warns
about, and it is the headline finding.

## Findings

### 1. High: entire read surface is unauthenticated, and turning off demo mode does not close it

Every public query returns real table data with no auth check:

- `contacts:list`, `contacts:get` return contact name, email, owner, company
- `companies:list`, `companies:get`, `companies:names`
- `deals:board`, `deals:get` return deal names and `amountMinor`
- `users:list` returns every team member name and email
- `dashboard:summary`, `dashboard:recentActivity` return pipeline value
- `search:global` returns names, domains, and emails in the sublabel
- `logs:list`, `agents:list`, `agents:get`, `ask:threads`, `ask:messages`,
  `chat:messages`, `activities:*`, `agentTasks:*`, `fields:*`, `prefs:*`,
  `email:settings`, `slack:settings`, `tableSettings:get`, `capabilities:status`

`requireWriteAccess` (`convex/model/access.ts`) is the only auth gate, and it
returns early in demo mode and only runs on writes. `disableDemoMode` flips
writes to require a session but does nothing to reads. A forked deployment
with demo mode off and real data still serves every contact email, deal
amount, agent instruction, and activity log to anyone with the deployment URL
and `curl`.

Fix: gate reads too. Add `authedQuery` to `convex/model/functions.ts` built
with `customQuery` from `convex-helpers/server/customFunctions`, running a
read access check that mirrors `requireWriteAccess` (open in demo mode,
require identity otherwise). Codemod the internal-facing queries to it, then
hand-review the short list that must stay public (see finding 2). One
structural change instead of a per-function checklist.

### 2. High: no explicit public read contract, and intentionally public queries return raw documents

The skill requires every public query to either enforce auth or carry an
explicit "intentionally public" comment with a trimmed projection. Two
queries are genuinely public by design and both leak internal fields:

- `demo:info` is fine (three scalar fields, correct).
- `staticHosting:getCurrentDeployment` is fine (component owned).
- `users:list` feeds owner pickers and avatars on public pages but returns
  every member email. On a real deployment this is a team roster with
  addresses, unauthenticated.

Most other queries spread `...doc` and have no `returns` validator, so they
ship whatever columns the schema grows later. Even after finding 1 is fixed,
any query that must remain public needs an explicit projection validator that
maps to a public-safe shape and strips owner ids, emails, `amountMinor`, and
system fields the public page does not render, with the client type derived
via `FunctionReturnType`.

### 3. Medium: `requireWriteAccess` checks identity presence only, not the sign-in allow list

`requireWriteAccess` accepts any non-null `ctx.auth.getUserIdentity()`. The
`workspace.allowedSignIn` list in the schema is read by nothing. This matches
the "Not built yet" note in AGENTS.md, so it is known, but it must be closed
in the same change that wires Convex Auth: enforce the allow list in the
handler, not only at session creation, or a session minted before a policy
change outlives the check.

### 4. Medium: `npm audit` reports 6 vulnerabilities (1 high, 5 moderate)

The `ai` SDK chain (`@ai-sdk/provider-utils` -> `@ai-sdk/anthropic`,
`@ai-sdk/openai`, `@ai-sdk/gateway`, `ai`) depends on a vulnerable `undici`.
Run `npm audit fix`, and if the fix needs a major bump, verify the agent and
ask surfaces still build and typecheck. Re-run until clean.

### 5. Low: `email:generateUploadUrl` is open in demo mode

`generateUploadUrl` is a `writeMutation`, so in demo mode anyone can mint an
upload URL and push bytes into Convex storage. Low impact at demo scale (the
reset does not clear `_storage`, so uploads accumulate). Acceptable for the
demo; note it when demo mode is turned off so uploads sit behind the same read
and write gates as everything else.

## What is already correct, do not change

- All writes flow through `writeMutation`; no public mutation bypasses it.
- Scheduler and cron targets are all `internal.*` (`convex/crons.ts`,
  `convex/demo.ts`, and every `runAfter`).
- `demo:reset` and `demo:disableDemoMode` are `internalMutation`, unreachable
  from a browser.
- Slack signing verification is textbook: HMAC SHA256 over
  `v0:{timestamp}:{rawBody}`, constant time compare, five minute skew reject,
  behind the `slackBotEnabled` toggle (`convex/slackBot.ts`).
- AgentMail and Firecrawl webhooks verify their own secrets; the Firecrawl
  `httpPrefix` is a deliberate, documented HTTP surface.
- Secrets are environment variables only. The `workspace` row stores no tokens
  or webhook URLs (schema comments confirm this).
- Enrichment is rate limited so a runaway agent cannot drain the vendor quota.
- The `deepLinkBase` and Slack `response_url` handling both restrict the host
  before posting.

## Probe results

Source review is the authoritative signal here. Black box probing was
inconclusive on live data:

- Dev (`third-hedgehog-429`): every function returned "Could not find public
  function", so this codebase is not currently pushed to dev.
- Prod (`giant-grouse-674`): every call, with and without type-correct args,
  returned the redacted production `Server Error`, meaning the deployment is
  currently unseeded or the functions throw before returning. No data came
  back, but that only proves prod is empty right now, not that the surface is
  safe. Once prod is seeded, findings 1 and 2 apply directly.

Re-run the probe after the next `npx convex dev`/`deploy` with seeded data:

```bash
curl -s "https://<deployment>.convex.cloud/api/query" \
  -H "Content-Type: application/json" \
  -d '{"path":"users:list","args":{},"format":"json"}'
```

A `{"status":"success","value":[...]}` with emails in it confirms the leak.

## Files to change (when fixing)

- `convex/model/access.ts`: add `requireReadAccess`.
- `convex/model/functions.ts`: add `authedQuery`.
- Every `convex/*.ts` query module: swap `query` for `authedQuery`, except the
  intentionally public ones, which get a projection validator and a comment.
- `package.json` / `package-lock.json`: `npm audit fix`.

## Verification steps

- `npx convex dev --once` clean, `npm run check-types`, `npm run lint`.
- Unauthenticated `curl` on each gated query throws an auth error.
- `curl` on each intentionally public query returns only the projected shape.
- `npm audit` clean.

## Task completion log

- 2026-08-14 06:40 UTC: Review completed, report written. No code changed;
  this is an audit. Fixes tracked as to-do items in task.md.
- 2026-08-14 07:05 UTC: Fixes landed and verified.
  - Finding 1 (High): fixed. `requireReadAccess` added to
    `convex/model/access.ts` (open in demo mode or when unseeded, session
    required otherwise) and `authedQuery` added to
    `convex/model/functions.ts`. All 39 queries across 18 modules moved from
    the raw `query` builder to `authedQuery`. Only `demo:info` and the
    component-owned static hosting query stay public, each with an
    intentionally-public comment.
  - Finding 2 (High): resolved by construction. After gating, the only public
    queries are `demo:info` (three scalars, `returns` validator, no table
    data) and the static hosting deploy query. `users:list` and every other
    PII-bearing query now sit behind the read gate.
  - Finding 3 (Medium): unchanged by design. `workspace.allowedSignIn`
    enforcement lands with the Convex Auth wiring; still tracked in task.md.
  - Finding 4 (Medium): fixed. `npm audit fix` could not resolve (upstream
    zod v3 peer pin in `@exalabs/convex-exa`), so `package.json` pins
    `"overrides": { "undici": "^7.29.0" }`, replacing the vulnerable
    `undici@5.29.0` under `@ai-sdk/provider-utils`, which only lazily pulls
    `Agent` and `fetch` (both stable in undici 7). `npm audit` now reports 0
    vulnerabilities.
  - Finding 5 (Low): no change needed. `email:generateUploadUrl` is a
    `writeMutation`, so turning demo mode off already puts uploads behind the
    write gate.
  - Extra hardening: `slack:sendTest` now requires a session outside demo
    mode (an anonymous caller could previously post into the workspace Slack
    channel on a non-demo fork), and `slack:channels` requires a session
    outside demo mode (channel names leaked to anyone once a bot token was
    set).
  - Verified: `npx convex dev --once`, `npm run check-types`, `npm run lint`,
    and `npm audit` all clean. Live probe on dev (outstanding-deer-221) with
    demo mode temporarily off: `users:list`, `contacts:list`,
    `dashboard:summary`, `logs:list`, `search:global`, and `slack:channels`
    all threw "Not authenticated" unauthenticated; `demo:info` stayed public;
    demo mode restored and reads confirmed open again for the public demo.
