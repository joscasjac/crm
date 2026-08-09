import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { logEvent } from "./logs";
import { deleteCompanyCascade } from "./model/cascade";
import { writeMutation } from "./model/functions";
import { notifySlack } from "./slack";

// Lightweight picker list for forms.
export const names = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("companies"), name: v.string() })),
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_name")
      .take(200);
    return companies.map((company) => ({
      _id: company._id,
      name: company.name,
    }));
  },
});

// The list view. Search filters by name or domain in memory over one page,
// which is fine at demo scale; the index keeps the read bounded.
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("companies")
      .withIndex("by_name")
      .order("asc")
      .paginate(args.paginationOpts);
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? page.page.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.domain ?? "").toLowerCase().includes(term),
        )
      : page.page;

    const enriched = [];
    for (const company of filtered) {
      const owner = company.ownerId ? await ctx.db.get("users", company.ownerId) : null;
      const contacts = await ctx.db
        .query("contacts")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();
      enriched.push({
        ...company,
        owner: owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : null,
        contactCount: contacts.length,
        dealCount: deals.length,
      });
    }
    return { ...page, page: enriched };
  },
});

export const get = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company) return null;
    const owner = company.ownerId ? await ctx.db.get("users", company.ownerId) : null;
    const primaryContact = company.primaryContactId
      ? await ctx.db.get("contacts", company.primaryContactId)
      : null;
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_company", (q) => q.eq("companyId", company._id))
      .collect();
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_company", (q) => q.eq("companyId", company._id))
      .collect();
    const openDeals = deals.filter(
      (d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST",
    );
    return {
      ...company,
      owner,
      primaryContact,
      contacts,
      deals,
      openPipelineMinor: openDeals.reduce((sum, d) => sum + d.amountMinor, 0),
      openDealCount: openDeals.length,
    };
  },
});

export const create = writeMutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
  },
  returns: v.id("companies"),
  handler: async (ctx, args) => {
    // Uniqueness is checked in the mutation, by index, before the write.
    if (args.domain) {
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain))
        .unique();
      if (existing) {
        throw new Error(`A company with domain ${args.domain} already exists`);
      }
    }
    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      domain: args.domain,
      industry: args.industry,
      enrichmentStatus: "NONE",
      lastActivityAt: Date.now(),
    });
    // A new company with a domain gets enrichment queued automatically.
    if (args.domain) {
      await ctx.db.insert("agentTasks", {
        kind: "ENRICH_COMPANY",
        state: "open",
        reason: "New company created with a domain and no brand data.",
        companyId,
        priority: 2,
        dueAt: Date.now(),
        attempts: 0,
      });
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "companies:create",
      status: "success",
      message: `Created ${args.name}${args.domain ? ` (${args.domain}), enrichment queued` : ""}`,
    });
    await notifySlack(
      ctx,
      "records",
      `New company: ${args.name}${args.domain ? ` (${args.domain})` : ""}`,
      `/app/companies/${companyId}`,
    );
    return companyId;
  },
});

export const update = writeMutation({
  args: {
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    primaryContactId: v.optional(v.id("contacts")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { companyId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch("companies", companyId, patch);
    return null;
  },
});

export const remove = writeMutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    await deleteCompanyCascade(ctx, args.companyId);
    await logEvent(ctx, {
      kind: "M",
      fn: "companies:remove",
      status: "success",
      message: `Deleted ${company?.name ?? "company"} and its related rows`,
    });
    return null;
  },
});

// Queue a re-enrich. The dispatcher picks it up on the next tick.
export const reEnrich = writeMutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company) throw new Error("Company not found");
    if (!company.domain) {
      throw new Error("Add a domain first so the agent knows where to look");
    }
    await ctx.db.patch("companies", args.companyId, { enrichmentStatus: "RESEARCHING" });
    await ctx.db.insert("agentTasks", {
      kind: "ENRICH_COMPANY",
      state: "open",
      reason: "Manual re-enrich requested from the record.",
      companyId: args.companyId,
      priority: 1,
      dueAt: Date.now(),
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.agentTasks.tick, {});
    return null;
  },
});
