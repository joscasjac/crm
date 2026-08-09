import { v } from "convex/values";
import { query } from "./_generated/server";
import { dealStage } from "./schema";
import {
  trackDealInsert,
  trackDealReplace,
} from "./aggregates";
import { logEvent } from "./logs";
import { deleteDealCascade } from "./model/cascade";
import { changeDealStage } from "./model/deals";
import { writeMutation } from "./model/functions";
import { notifySlack } from "./slack";
import { entityDefaults } from "./tableSettings";

export const STAGES = [
  "QUALIFIED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

// Board view: all deals grouped by stage. Demo scale keeps this bounded; a
// larger install would paginate per column.
export const board = query({
  args: {},
  handler: async (ctx) => {
    const result = [];
    for (const stage of STAGES) {
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_stage", (q) => q.eq("stage", stage))
        .order("desc")
        .take(50);
      const withCompany = [];
      for (const deal of deals) {
        const company = await ctx.db.get("companies", deal.companyId);
        const owner = deal.ownerId ? await ctx.db.get("users", deal.ownerId) : null;
        withCompany.push({
          ...deal,
          company: company
            ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
            : null,
          owner: owner
            ? { name: owner.name, avatarUrl: owner.avatarUrl }
            : null,
        });
      }
      result.push({ stage, deals: withCompany });
    }
    return result;
  },
});

export const get = query({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get("deals", args.dealId);
    if (!deal) return null;
    const company = await ctx.db.get("companies", deal.companyId);
    const owner = deal.ownerId ? await ctx.db.get("users", deal.ownerId) : null;
    const primaryContact = deal.primaryContactId
      ? await ctx.db.get("contacts", deal.primaryContactId)
      : null;
    return { ...deal, company, owner, primaryContact };
  },
});

export const create = writeMutation({
  args: {
    name: v.string(),
    companyId: v.id("companies"),
    // Amount arrives in minor units. The UI converts once, at the input.
    amountMinor: v.number(),
    currency: v.string(),
    stage: dealStage,
    expectedCloseAt: v.optional(v.number()),
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.amountMinor) || args.amountMinor < 0) {
      throw new Error("Amount must be a non-negative integer of minor units");
    }
    const defaults = await entityDefaults(ctx, "deal");
    const dealId = await ctx.db.insert("deals", {
      ...args,
      ownerId: defaults.ownerId,
    });
    const doc = await ctx.db.get("deals", dealId);
    if (doc) await trackDealInsert(ctx, doc);
    await ctx.db.patch("companies", args.companyId, { lastActivityAt: Date.now() });
    await logEvent(ctx, {
      kind: "M",
      fn: "deals:create",
      status: "success",
      message: `Created ${args.name} at ${(args.amountMinor / 100).toLocaleString()} ${args.currency}`,
    });
    const company = await ctx.db.get("companies", args.companyId);
    await notifySlack(
      ctx,
      "records",
      `New deal: ${args.name}${company ? ` for ${company.name}` : ""} at ${(args.amountMinor / 100).toLocaleString()} ${args.currency} in ${args.stage}`,
      "/app/deals",
    );
    return dealId;
  },
});

export const update = writeMutation({
  args: {
    dealId: v.id("deals"),
    name: v.optional(v.string()),
    amountMinor: v.optional(v.number()),
    ownerId: v.optional(v.id("users")),
    expectedCloseAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { dealId, ...updates } = args;
    const oldDoc = await ctx.db.get("deals", dealId);
    if (!oldDoc) throw new Error("Deal not found");
    if (
      updates.amountMinor !== undefined &&
      (!Number.isInteger(updates.amountMinor) || updates.amountMinor < 0)
    ) {
      throw new Error("Amount must be a non-negative integer of minor units");
    }
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch("deals", dealId, patch);
    const newDoc = await ctx.db.get("deals", dealId);
    if (newDoc) await trackDealReplace(ctx, oldDoc, newDoc);
    return null;
  },
});

// Stage changes write a STAGE_CHANGE activity in the same transaction, so the
// timeline and the pipeline totals move together. The shared helper in
// model/deals.ts carries the logic; the Slack /crm bot calls the same code.
export const changeStage = writeMutation({
  args: { dealId: v.id("deals"), stage: dealStage },
  returns: v.null(),
  handler: async (ctx, args) => {
    await changeDealStage(ctx, args.dealId, args.stage);
    return null;
  },
});

export const remove = writeMutation({
  args: { dealId: v.id("deals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteDealCascade(ctx, args.dealId);
    return null;
  },
});
