import { v } from "convex/values";
import { trackDealInsert } from "./aggregates";
import { logEvent } from "./logs";
import { authedQuery, writeMutation } from "./model/functions";

export const list = authedQuery({
  args: {},
  returns: v.object({
    companies: v.array(
      v.object({
        _id: v.id("companies"),
        name: v.string(),
        domain: v.optional(v.string()),
        deletedAt: v.number(),
      }),
    ),
    contacts: v.array(
      v.object({
        _id: v.id("contacts"),
        name: v.string(),
        email: v.optional(v.string()),
        deletedAt: v.number(),
      }),
    ),
    deals: v.array(
      v.object({
        _id: v.id("deals"),
        name: v.string(),
        amountMinor: v.number(),
        currency: v.string(),
        stage: v.string(),
        deletedAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const companies = (
      await ctx.db
        .query("companies")
        .withIndex("by_deletedAt_and_name", (q) => q.gt("deletedAt", 0))
        .order("desc")
        .take(200)
    )
      .map((company) => ({
        _id: company._id,
        name: company.name,
        domain: company.domain,
        deletedAt: company.deletedAt ?? 0,
      }));

    const contacts = (
      await ctx.db
        .query("contacts")
        .withIndex("by_deletedAt", (q) => q.gt("deletedAt", 0))
        .order("desc")
        .take(200)
    )
      .map((contact) => ({
        _id: contact._id,
        name: contact.name,
        email: contact.email,
        deletedAt: contact.deletedAt ?? 0,
      }));

    const deals = (
      await ctx.db
        .query("deals")
        .withIndex("by_deletedAt", (q) => q.gt("deletedAt", 0))
        .order("desc")
        .take(200)
    )
      .map((deal) => ({
        _id: deal._id,
        name: deal.name,
        amountMinor: deal.amountMinor,
        currency: deal.currency,
        stage: deal.stage,
        deletedAt: deal.deletedAt ?? 0,
      }));

    return { companies, contacts, deals };
  },
});

export const restoreCompany = writeMutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company) return null;
    const restoredAt = Date.now();
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const contact of contacts) {
      if (contact.deletedAt) {
        await ctx.db.patch("contacts", contact._id, {
          deletedAt: undefined,
          lastActivityAt: restoredAt,
        });
      }
    }
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const deal of deals) {
      if (deal.deletedAt) {
        await ctx.db.patch("deals", deal._id, { deletedAt: undefined });
        const restoredDeal = await ctx.db.get("deals", deal._id);
        if (restoredDeal) await trackDealInsert(ctx, restoredDeal);
      }
    }
    await ctx.db.patch("companies", args.companyId, {
      deletedAt: undefined,
      lastActivityAt: restoredAt,
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "trash:restoreCompany",
      status: "success",
      message: `Restored ${company.name}`,
    });
    return null;
  },
});

export const restoreContact = writeMutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact) return null;
    await ctx.db.patch("contacts", args.contactId, {
      deletedAt: undefined,
      lastActivityAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "trash:restoreContact",
      status: "success",
      message: `Restored ${contact.name}`,
    });
    return null;
  },
});

export const restoreDeal = writeMutation({
  args: { dealId: v.id("deals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deal = await ctx.db.get("deals", args.dealId);
    if (!deal || !deal.deletedAt) return null;
    await ctx.db.patch("deals", args.dealId, { deletedAt: undefined });
    const restored = await ctx.db.get("deals", args.dealId);
    if (restored) await trackDealInsert(ctx, restored);
    await logEvent(ctx, {
      kind: "M",
      fn: "trash:restoreDeal",
      status: "success",
      message: `Restored ${deal.name}`,
    });
    return null;
  },
});
