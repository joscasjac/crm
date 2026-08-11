# Demo reset hits the 1000 scheduled function limit

Created: 2026-08-11 19:57 UTC
Last Updated: 2026-08-11 19:57 UTC
Status: Done

## Problem

The ten minute `demo:reset` cron started throwing and rolling back:

```
[CONVEX M(demo:reset)] Uncaught Error: Too many functions scheduled by this mutation (limit: 1000)
    at async handler (@convex-dev/aggregate/src/component/public.ts:162)
    at async clearAll (@convex-dev/aggregate/src/client/index.ts:553)
    at async handler (convex/demo.ts:58)
```

Because the mutation throws, the whole transaction rolls back and the demo
stops resetting.

## Root cause

`dealsByOwner` was a `TableAggregate` namespaced by `doc.ownerId`. Three facts
compound into the failure:

1. The reseed mints brand new user ids every ten minutes, and each new owner
   id becomes a new aggregate namespace on insert.
2. The aggregate component never deletes a namespace. `clear` deletes the
   btree nodes and immediately recreates an empty tree for that namespace, so
   the namespace count only ever grows.
3. `clearAll` iterates every namespace and each per-namespace `clear`
   schedules one `deleteTreeNodes` job. After weeks of resets the namespace
   count crossed 1000, tripping Convex's per-mutation scheduling limit.

`dealsByStage` is unaffected: its namespaces are the six fixed stage strings.

## Proposed solution

Remove `dealsByOwner` entirely. A repo-wide search found zero readers; only
the write helpers (`trackDealInsert`, `trackDealReplace`, `trackDealDelete`)
and the reset touched it, so it was pure write overhead with an unbounded
namespace. If per-owner rollups are needed later, rebuild with a bounded
design (for example a single tree with a compound `[ownerId, creationTime]`
sort key) instead of a namespace per user id.

Removing `app.use(aggregate, { name: "dealsByOwner" })` unmounts the
component; its leftover data sits inert and can be deleted from the Convex
dashboard. Repeat for production when this deploys.

## Files changed

- `convex/convex.config.ts`: dropped the `dealsByOwner` mount, comment now
  states the bounded-namespace rule for aggregates
- `convex/aggregates.ts`: removed the `dealsByOwner` aggregate, track helpers
  now update `dealsByStage` only
- `convex/demo.ts`: removed the `dealsByOwner.clearAll` call
- `convex/_generated/api.d.ts`: regenerated without the component

## Edge cases

- `dealsByStage.clearAll` stays in the reset: stages are a fixed enum, so it
  schedules about seven jobs, far below the limit
- Existing deployments keep the unmounted `dealsByOwner` data until deleted
  from the dashboard; it is unreachable and harmless in the meantime
- Every deal write path (create, update, stage change, cascade delete, seed)
  already went through the track helpers, so no call sites break

## Verification

- `npx convex dev --once` pushes clean
- `npm run check-types` and `npm run lint` pass
- `npx convex run demo:reset` completes without the scheduling error
- `npx convex run dashboard:summary` returns correct per-stage rollups after
  the reseed

## Task completion log

- 2026-08-11 19:57 UTC: Removed dealsByOwner, verified reset and dashboard on
  the dev deployment, synced docs.
