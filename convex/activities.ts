import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
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

export const create = writeMutation({
  args: {
    type: activityType,
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    if (args.body.trim().length === 0) {
      throw new Error("Write something first");
    }
    const id = await ctx.db.insert("activities", args);
    if (args.companyId) {
      await ctx.db.patch("companies", args.companyId, { lastActivityAt: Date.now() });
    }
    if (args.contactId) {
      await ctx.db.patch("contacts", args.contactId, { lastActivityAt: Date.now() });
    }
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
    return null;
  },
});
