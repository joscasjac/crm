import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { dealsByOwner, dealsByStage } from "./aggregates";
import { logEvent } from "./logs";
import { seedAll } from "./model/seed";

const TABLES = [
  "workspace",
  "users",
  "companies",
  "contacts",
  "deals",
  "activities",
  "fieldDefinitions",
  "fieldValues",
  "agentTasks",
  "agentDefinitions",
  "agentVersions",
  "agentRuns",
  "facts",
  "chatThreads",
  "askThreads",
  "logEvents",
] as const;

// Wipe everything and reseed. Runs on a cron every ten minutes in demo mode,
// and can be run by hand with: npx convex run demo:reset
export const reset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(table, row._id);
      }
    }
    await dealsByStage.clearAll(ctx);
    await dealsByOwner.clearAll(ctx);
    await seedAll(ctx, Date.now());
    await logEvent(ctx, {
      kind: "C",
      fn: "demo:reset",
      status: "success",
      message: "Demo content wiped and reseeded",
    });
    return null;
  },
});

// First-boot seed. Idempotent: does nothing when a workspace already exists.
// Run with: npx convex run demo:seedPublic
export const seedPublic = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("workspace").first();
    if (existing) return false;
    await seedAll(ctx, Date.now());
    return true;
  },
});

// Drives the demo banner: when the last reset happened, so the client can
// count down to the next one. The ten minute interval is in convex/crons.ts.
export const info = query({
  args: {},
  returns: v.union(
    v.object({
      demoMode: v.boolean(),
      lastResetAt: v.number(),
      resetIntervalMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace) return null;
    return {
      demoMode: workspace.demoMode,
      lastResetAt: workspace.lastResetAt,
      resetIntervalMs: 10 * 60 * 1000,
    };
  },
});

// Kick a reset from the dashboard button in demo mode.
export const requestReset = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace || !workspace.demoMode) {
      throw new Error("Reset is only available in demo mode");
    }
    await ctx.scheduler.runAfter(0, internal.demo.reset, {});
    return null;
  },
});
