import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { dealsByStage } from "./aggregates";
import { logEvent } from "./logs";
import { seedAll } from "./model/seed";

const TABLES = [
  "workspace",
  "users",
  "companies",
  "contacts",
  "deals",
  "activities",
  "projects",
  "projectTasks",
  "taskComments",
  "fieldDefinitions",
  "fieldValues",
  "agentTasks",
  "agentDefinitions",
  "agentVersions",
  "agentRuns",
  "facts",
  "codexApiTokens",
  "favorites",
  "savedViews",
  "chatThreads",
  "askThreads",
  "logEvents",
] as const;

const STARTER_DATA_TABLES = [
  "companies",
  "contacts",
  "deals",
  "activities",
  "fieldDefinitions",
  "fieldValues",
  "tableSettings",
  "agentTasks",
  "agentDefinitions",
  "agentVersions",
  "agentRuns",
  "facts",
  "codexApiTokens",
  "favorites",
  "savedViews",
  "chatThreads",
  "askThreads",
  "logEvents",
  "slackIdentities",
] as const;

// Wipe everything and reseed. Runs on a cron every ten minutes in demo mode,
// and can be run by hand with: npx convex run demo:reset
// Safety for forks: a no-op when demo mode is off, so the cron cannot wipe
// real data. Turn demo mode off with: npx convex run demo:disableDemoMode
export const reset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    if (workspace && !workspace.demoMode) {
      await logEvent(ctx, {
        kind: "C",
        fn: "demo:reset",
        status: "info",
        message: "Demo mode is off, reset skipped. Remove the demo reset cron from convex/crons.ts.",
      });
      return null;
    }
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(table, row._id);
      }
    }
    // Stage namespaces are the six fixed stage strings, so this schedules a
    // handful of cleanup jobs, far below the 1000 per mutation limit.
    await dealsByStage.clearAll(ctx);
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

// For forks: turn demo mode off so the reset cron stops wiping data and
// writes require a signed-in user. Internal on purpose so visitors to the
// public demo cannot call it. Run with: npx convex run demo:disableDemoMode
export const disableDemoMode = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace || !workspace.demoMode) {
      return null;
    }
    await ctx.db.patch("workspace", workspace._id, { demoMode: false });
    await logEvent(ctx, {
      kind: "M",
      fn: "demo:disableDemoMode",
      status: "success",
      message:
        "Demo mode is off. The reset cron is now a no-op; remove it from convex/crons.ts when convenient.",
    });
    return null;
  },
});

// One-time setup for a real fork. It keeps the seeded CRM data, stops open
// demo writes, and chooses which email may create an authenticated session.
export const configureRealInstall = internalMutation({
  args: {
    allowedEmail: v.string(),
    workspaceName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const allowedEmail = args.allowedEmail.trim().toLowerCase();
    if (!allowedEmail.includes("@")) {
      throw new Error("Enter a valid allowedEmail.");
    }

    let workspace = await ctx.db.query("workspace").first();
    if (!workspace) {
      await seedAll(ctx, Date.now());
      workspace = await ctx.db.query("workspace").first();
    }
    if (!workspace) {
      throw new Error("Workspace was not created.");
    }

    await ctx.db.patch("workspace", workspace._id, {
      demoMode: false,
      allowedSignIn: [allowedEmail],
      ...(args.workspaceName ? { name: args.workspaceName } : {}),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "demo:configureRealInstall",
      status: "success",
      message: `Real install enabled for ${allowedEmail}.`,
    });
    return null;
  },
});

// Clear the sample CRM records after a fork has been configured for real use.
// Keeps auth tables, workspace settings, and the allowlisted workspace user.
export const clearStarterData = internalMutation({
  args: {
    allowedEmail: v.string(),
  },
  returns: v.object({
    deletedRows: v.number(),
    keptUsers: v.number(),
  }),
  handler: async (ctx, args) => {
    const allowedEmail = args.allowedEmail.trim().toLowerCase();
    if (!allowedEmail.includes("@")) {
      throw new Error("Enter a valid allowedEmail.");
    }

    let deletedRows = 0;
    for (const table of STARTER_DATA_TABLES) {
      const rows = await ctx.db.query(table).take(1000);
      for (const row of rows) {
        await ctx.db.delete(table, row._id);
        deletedRows += 1;
      }
    }

    const authAccounts = await ctx.db.query("authAccounts").take(1000);
    const authUserIds = new Set(authAccounts.map((account) => account.userId));

    let keptUsers = 0;
    const users = await ctx.db.query("users").take(1000);
    for (const user of users) {
      if (
        user.email.trim().toLowerCase() === allowedEmail ||
        authUserIds.has(user._id)
      ) {
        keptUsers += 1;
      } else {
        await ctx.db.delete("users", user._id);
        deletedRows += 1;
      }
    }

    await dealsByStage.clearAll(ctx);
    await logEvent(ctx, {
      kind: "M",
      fn: "demo:clearStarterData",
      status: "success",
      message: `Cleared ${deletedRows} starter rows and kept ${keptUsers} allowed user row(s).`,
    });

    return { deletedRows, keptUsers };
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

// Intentionally public: drives the demo banner before any session exists, so
// it stays on the raw query builder while everything else uses authedQuery
// (convex/model/functions.ts). The projection is three scalars, no table data.
// The ten minute reset interval is in convex/crons.ts.
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
