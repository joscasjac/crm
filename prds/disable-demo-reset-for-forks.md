# Disable the demo reset cron for forks

Created: 2026-08-09 11:28 UTC
Last Updated: 2026-08-09 11:35 UTC
Status: Done

## Problem

`convex/crons.ts` registers a `demo reset` cron that runs `internal.demo.reset` every 10 minutes. The handler wipes all 16 tables and reseeds them with demo data, unconditionally. Anyone who forks the repo and deploys it as a real CRM inherits a cron that destroys their data every 10 minutes. The only warning is one sentence near the bottom of the README.

## Root cause

The reset handler never checks `workspace.demoMode`, and there is no documented one-command way to turn demo mode off. The flag exists in the schema and gates write access in `convex/model/access.ts`, but nothing gates the wipe itself.

## Proposed solution

Three layers, so a fork is safe even when its owner reads nothing:

1. Runtime guard. `internal.demo.reset` returns early when the workspace exists and `demoMode` is false. The cron becomes a no-op the moment demo mode is off, even if the cron line is never removed.
2. One command to flip the flag. A new `demo:disableDemoMode` internal mutation, run with `npx convex run demo:disableDemoMode` (add `--prod` for production). Internal, so visitors to the public demo cannot call it.
3. Docs and a copy-paste agent prompt. A README section explains the cron, gives the command, and provides a prompt a forker can paste into their coding agent to do the whole cleanup. The `/docs` page gets the same command and prompt.

## Files to change

- `convex/demo.ts`: guard in `reset`, new `disableDemoMode` internal mutation
- `convex/crons.ts`: comment points at the guard and the disable command
- `README.md`: new "Turning off the demo reset" section with the agent prompt, pointer from Quick start
- `src/pages/Docs.tsx`: auth section references the command, coding-agents section gets the prompt
- `task.md`, `changelog.md`, `files.md`: docs sync

## Edge cases

- No workspace row yet: `reset` still seeds, which the public demo relies on when booting from empty. The guard only skips when a workspace exists with `demoMode` false.
- Re-enabling demo mode: not supported by a command on purpose; a fork owner can patch the row from the dashboard if they ever want it back.
- `requestReset` (the dashboard button) already throws when demo mode is off, so no change needed there.

## Verification steps

- `npm run lint` passes
- `npx convex dev` typechecks and pushes the new function
- `npx convex run demo:disableDemoMode` flips the flag, then `npx convex run demo:reset` logs a skip and wipes nothing

## Task completion log

- 2026-08-09 11:28 UTC PRD created
- 2026-08-09 11:35 UTC Guard, disableDemoMode mutation, crons comment, README section with agent prompt, and /docs updates shipped. ESLint clean on the touched files. Repo-wide lint skipped: a parallel session had src/app files mid-edit. Runtime verification (convex run) left for the next dev push.
