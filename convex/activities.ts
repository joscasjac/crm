import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logEvent } from "./logs";
import { clip, insertActivity } from "./model/activities";
import { activityType } from "./schema";
import { authedQuery, writeMutation } from "./model/functions";
import { notifySlack } from "./slack";

const WORKSPACE_TIMELINE_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "MEETING",
  "TASK",
  "STAGE_CHANGE",
  "ENRICHMENT",
] as const;

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

export const forCompany = authedQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect();
    return await withAuthor(ctx, rows);
  },
});

export const forContact = authedQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .order("desc")
      .collect();
    return await withAuthor(ctx, rows);
  },
});

export const forDeal = authedQuery({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_deal", (q) => q.eq("dealId", args.dealId))
      .order("desc")
      .collect();
    return await withAuthor(ctx, rows);
  },
});

// Open tasks across the workspace, soonest due first.
export const openTasks = authedQuery({
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

export const workspaceTimeline = authedQuery({
  args: {
    type: v.optional(v.union(activityType, v.literal("ALL"))),
  },
  returns: v.array(
    v.object({
      _id: v.id("activities"),
      _creationTime: v.number(),
      type: activityType,
      body: v.string(),
      companyId: v.optional(v.id("companies")),
      contactId: v.optional(v.id("contacts")),
      dealId: v.optional(v.id("deals")),
      authorId: v.optional(v.id("users")),
      dueAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      meta: v.optional(
        v.object({
          fromStage: v.optional(v.string()),
          toStage: v.optional(v.string()),
        }),
      ),
      author: v.union(
        v.object({
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
      company: v.union(
        v.object({
          _id: v.id("companies"),
          name: v.string(),
          logoUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
      contact: v.union(
        v.object({
          _id: v.id("contacts"),
          name: v.string(),
        }),
        v.null(),
      ),
      deal: v.union(
        v.object({
          _id: v.id("deals"),
          name: v.string(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const types =
      !args.type || args.type === "ALL"
        ? WORKSPACE_TIMELINE_TYPES
        : [args.type];
    const rows = [];
    for (const type of types) {
      rows.push(
        ...(await ctx.db
          .query("activities")
          .withIndex("by_type", (q) => q.eq("type", type))
          .order("desc")
          .take(80)),
      );
    }
    const enriched = await withAuthor(
      ctx,
      rows.sort((a, b) => b._creationTime - a._creationTime).slice(0, 200),
    );
    const result = [];
    for (const row of enriched) {
      const company = row.companyId
        ? await ctx.db.get("companies", row.companyId)
        : null;
      const contact = row.contactId
        ? await ctx.db.get("contacts", row.contactId)
        : null;
      const deal = row.dealId ? await ctx.db.get("deals", row.dealId) : null;
      result.push({
        ...row,
        company: company
          ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
          : null,
        contact: contact ? { _id: contact._id, name: contact.name } : null,
        deal: deal ? { _id: deal._id, name: deal.name } : null,
      });
    }
    return result;
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
    await notifySlack(
      ctx,
      "tasks",
      `Task completed: ${clip(activity.body, 200)}`,
      activity.companyId
        ? `/app/companies/${activity.companyId}`
        : activity.contactId
          ? `/app/contacts/${activity.contactId}`
          : "/app/activity",
    );
    return null;
  },
});
