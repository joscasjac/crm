import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import { writeMutation } from "./model/functions";

// The activity log the Activity page renders. Mutations call logEvent in the
// same transaction as their write; actions go through the record internal
// mutation. Kinds mirror the Convex dashboard: M mutation, A action, C cron.

export type LogStatus = "success" | "error" | "info";

export async function logEvent(
  ctx: MutationCtx,
  event: {
    kind: "M" | "A" | "C";
    fn: string;
    status: LogStatus;
    message: string;
  },
): Promise<void> {
  await ctx.db.insert("logEvents", event);
}

export const record = internalMutation({
  args: {
    kind: v.union(v.literal("M"), v.literal("A"), v.literal("C")),
    fn: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("info"),
    ),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await logEvent(ctx, args);
    return null;
  },
});

// Newest first, bounded. The demo reset and the Clear button keep the table
// small, so a take is enough here.
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("logEvents"),
      _creationTime: v.number(),
      kind: v.union(v.literal("M"), v.literal("A"), v.literal("C")),
      fn: v.string(),
      status: v.union(
        v.literal("success"),
        v.literal("error"),
        v.literal("info"),
      ),
      message: v.string(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("logEvents").order("desc").take(200);
  },
});

// Delete just the checked rows, for the select one / select all controls.
export const clearMany = writeMutation({
  args: { ids: v.array(v.id("logEvents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const row = await ctx.db.get("logEvents", id);
      if (row) await ctx.db.delete("logEvents", id);
    }
    return null;
  },
});

export const clear = writeMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("logEvents").collect();
    for (const row of rows) {
      await ctx.db.delete("logEvents", row._id);
    }
    return null;
  },
});
