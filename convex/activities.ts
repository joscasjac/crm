import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logEvent } from "./logs";
import { clip, insertActivity } from "./model/activities";
import { activityType } from "./schema";
import { writeMutation } from "./model/functions";

// Attach author display data so the three timeline queries stay identical.
async function withAuthor(ctx: QueryCtx, rows: Array<Doc<"activities">>) {
  const result = [];
  for (const row of rows) {
    const author = row.authorId ? await ctx.db.get("users", row.authorId) : null;
    result.push({
      ...row,
      author: author
        ? { name: author.name, avatarUrl: author.avatarUrl }
        : null,
    });
  }
  return result;
}

export const forCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
    return await withAuthor(ctx, rows);
  },
});

export const forContact = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .order("desc")
      .take(100);
    return await withAuthor(ctx, rows);
  },
});

export const forDeal = query({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_deal", (q) => q.eq("dealId", args.dealId))
      .order("desc")
      .take(100);
    return await withAuthor(ctx, rows);
  },
});

// Open tasks across the workspace, soonest due first.
export const openTasks = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("activities")
      .withIndex("by_type", (q) => q.eq("type", "TASK"))
      .order("asc")
      .take(50);
    const open = tasks.filter((t) => !t.completedAt);
    return await withAuthor(ctx, open);
  },
});

// Create a note or task on a record. Every write also lands in logEvents so
// the record timeline and the Activity page tell the same story. Tasks can
// schedule an email reminder at the due time through whichever provider the
// workspace selected; when none is configured the send logs a skip instead.
export const create = writeMutation({
  args: {
    type: activityType,
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
    remindMe: v.optional(v.boolean()),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    const { id } = await insertActivity(ctx, args);
    return id;
  },
});

export const completeTask = writeMutation({
  args: { activityId: v.id("activities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activity = await ctx.db.get("activities", args.activityId);
    if (!activity || activity.type !== "TASK") {
      throw new Error("Task not found");
    }
    if (activity.completedAt) return null;
    await ctx.db.patch("activities", args.activityId, { completedAt: Date.now() });
    await logEvent(ctx, {
      kind: "M",
      fn: "activities:completeTask",
      status: "success",
      message: `Task completed: ${clip(activity.body)}`,
    });
    return null;
  },
});
