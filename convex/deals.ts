import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { dealStage } from "./schema";
import {
  trackDealDelete,
  trackDealInsert,
  trackDealReplace,
} from "./aggregates";
import { logEvent } from "./logs";
import { changeDealStage } from "./model/deals";
import { authedQuery, writeMutation } from "./model/functions";
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

export const names = authedQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("deals"), name: v.string() })),
  handler: async (ctx) => {
    const deals = [];
    for (const stage of STAGES) {
      deals.push(
        ...(await ctx.db
          .query("deals")
          .withIndex("by_deletedAt_and_stage", (q) =>
            q.eq("deletedAt", undefined).eq("stage", stage),
          )
          .order("desc")
          .take(80)),
      );
    }
    return deals.map((deal) => ({ _id: deal._id, name: deal.name }));
  },
});

// Board view: all deals grouped by stage. Demo scale keeps this bounded; a
// larger install would paginate per column.
export const board = authedQuery({
  args: {},
  handler: async (ctx) => {
    const result = [];
    for (const stage of STAGES) {
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_deletedAt_and_stage", (q) =>
          q.eq("deletedAt", undefined).eq("stage", stage),
        )
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

export const get = authedQuery({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get("deals", args.dealId);
    if (!deal || deal.deletedAt) return null;
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
    companyId: v.optional(v.id("companies")),
    currency: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    primaryContactId: v.optional(v.union(v.id("contacts"), v.null())),
    expectedCloseAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { dealId, ...updates } = args;
    const oldDoc = await ctx.db.get("deals", dealId);
    if (!oldDoc) throw new Error("Deal not found");
    if (oldDoc.deletedAt) throw new Error("Restore the deal before editing it");
    if (
      updates.amountMinor !== undefined &&
      (!Number.isInteger(updates.amountMinor) || updates.amountMinor < 0)
    ) {
      throw new Error("Amount must be a non-negative integer of minor units");
    }
    const patch: Partial<typeof oldDoc> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.amountMinor !== undefined) patch.amountMinor = updates.amountMinor;
    if (updates.companyId !== undefined) patch.companyId = updates.companyId;
    if (updates.currency !== undefined) patch.currency = updates.currency;
    if (updates.ownerId !== undefined) patch.ownerId = updates.ownerId ?? undefined;
    if (updates.primaryContactId !== undefined)
      patch.primaryContactId = updates.primaryContactId ?? undefined;
    if (updates.expectedCloseAt !== undefined)
      patch.expectedCloseAt = updates.expectedCloseAt ?? undefined;
    await ctx.db.patch("deals", dealId, patch);
    const newDoc = await ctx.db.get("deals", dealId);
    if (newDoc) await trackDealReplace(ctx, oldDoc, newDoc);
    return null;
  },
});

export const bulkUpdate = writeMutation({
  args: {
    dealIds: v.array(v.id("deals")),
    updates: v.object({
      stage: v.optional(dealStage),
      currency: v.optional(v.string()),
      ownerId: v.optional(v.union(v.id("users"), v.null())),
    }),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let updated = 0;
    for (const dealId of args.dealIds) {
      const oldDoc = await ctx.db.get("deals", dealId);
      if (!oldDoc || oldDoc.deletedAt) continue;

      if (args.updates.stage !== undefined && args.updates.stage !== oldDoc.stage) {
        await changeDealStage(ctx, dealId, args.updates.stage);
      }

      const current = await ctx.db.get("deals", dealId);
      if (!current || current.deletedAt) continue;
      const patch: Partial<Doc<"deals">> = {};
      if (args.updates.currency !== undefined) patch.currency = args.updates.currency;
      if (args.updates.ownerId !== undefined) {
        patch.ownerId = args.updates.ownerId ?? undefined;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch("deals", dealId, patch);
        const newDoc = await ctx.db.get("deals", dealId);
        if (newDoc) await trackDealReplace(ctx, current, newDoc);
      }
      updated += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "deals:bulkUpdate",
      status: "success",
      message: `Updated ${updated} deals`,
    });
    return updated;
  },
});

export const bulkRemove = writeMutation({
  args: { dealIds: v.array(v.id("deals")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let removed = 0;
    const deletedAt = Date.now();
    for (const dealId of args.dealIds) {
      const deal = await ctx.db.get("deals", dealId);
      if (!deal || deal.deletedAt) continue;
      await trackDealDelete(ctx, deal);
      await ctx.db.patch("deals", dealId, { deletedAt });
      removed += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "deals:bulkRemove",
      status: "success",
      message: `Moved ${removed} deals to trash`,
    });
    return removed;
  },
});

async function resolveImportCompany(
  ctx: MutationCtx,
  row: { companyDomain?: string; companyName?: string },
) {
  const domain = row.companyDomain?.trim() || undefined;
  const name = row.companyName?.trim() || undefined;
  if (!domain && !name) return null;

  const byDomain = domain
    ? await ctx.db
        .query("companies")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .unique()
    : null;
  if (byDomain && !byDomain.deletedAt) return byDomain._id;

  const byName = name
    ? await ctx.db
        .query("companies")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first()
    : null;
  if (byName && !byName.deletedAt) return byName._id;

  const defaults = await entityDefaults(ctx, "company");
  return await ctx.db.insert("companies", {
    name: name ?? domain ?? "Imported company",
    domain,
    industry: defaults.industry,
    ownerId: defaults.ownerId,
    enrichmentStatus: "NONE",
    lastActivityAt: Date.now(),
  });
}

function parseImportAmount(value: string | number | undefined) {
  if (typeof value === "number") return Math.max(0, Math.round(value * 100));
  const cleaned = (value ?? "").replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function parseImportStage(value: string | undefined, fallback: string) {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return STAGES.find((stage) => stage === normalized) ?? fallback;
}

export const importRows = writeMutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        companyName: v.optional(v.string()),
        companyDomain: v.optional(v.string()),
        amount: v.optional(v.union(v.string(), v.number())),
        currency: v.optional(v.string()),
        stage: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const defaults = await entityDefaults(ctx, "deal");
    const defaultCurrency = defaults.currency ?? "USD";
    const defaultStage = defaults.stage ?? "QUALIFIED";
    let created = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const name = row.name.trim();
      const companyId = await resolveImportCompany(ctx, row);
      if (!name || !companyId) {
        skipped += 1;
        continue;
      }
      const dealId = await ctx.db.insert("deals", {
        name,
        companyId,
        amountMinor: parseImportAmount(row.amount),
        currency: row.currency?.trim().toUpperCase() || defaultCurrency,
        stage: parseImportStage(row.stage, defaultStage) as (typeof STAGES)[number],
        ownerId: defaults.ownerId,
      });
      const doc = await ctx.db.get("deals", dealId);
      if (doc) await trackDealInsert(ctx, doc);
      await ctx.db.patch("companies", companyId, { lastActivityAt: Date.now() });
      created += 1;
    }

    await logEvent(ctx, {
      kind: "M",
      fn: "deals:importRows",
      status: "success",
      message: `Imported deals: ${created} created, ${skipped} skipped`,
    });
    return { created, updated: 0, skipped };
  },
});

// Stage changes write a STAGE_CHANGE activity in the same transaction, so the
// timeline and the pipeline totals move together. The shared helper in
// model/deals.ts carries the logic; the Slack /crm bot calls the same code.
export const changeStage = writeMutation({
  args: { dealId: v.id("deals"), stage: dealStage },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deal = await ctx.db.get("deals", args.dealId);
    if (!deal) throw new Error("Deal not found");
    if (deal.deletedAt) throw new Error("Restore the deal before moving it");
    await changeDealStage(ctx, args.dealId, args.stage);
    return null;
  },
});

export const remove = writeMutation({
  args: { dealId: v.id("deals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deal = await ctx.db.get("deals", args.dealId);
    if (!deal || deal.deletedAt) return null;
    await trackDealDelete(ctx, deal);
    await ctx.db.patch("deals", args.dealId, { deletedAt: Date.now() });
    await logEvent(ctx, {
      kind: "M",
      fn: "deals:remove",
      status: "success",
      message: `Moved ${deal.name} to trash`,
    });
    return null;
  },
});
