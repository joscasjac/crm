import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { trackDealDelete } from "./aggregates";
import { logEvent } from "./logs";
import { authedQuery, writeMutation } from "./model/functions";
import { enrichmentStatus } from "./schema";
import { notifySlack } from "./slack";
import { entityDefaults } from "./tableSettings";

// Lightweight picker list for forms.
export const names = authedQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("companies"), name: v.string() })),
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_deletedAt_and_name", (q) => q.eq("deletedAt", undefined))
      .take(200);
    return companies.map((company) => ({
      _id: company._id,
      name: company.name,
    }));
  },
});

// The list view. Search filters by name or domain in memory over one page,
// which is fine at demo scale; the index keeps the read bounded.
export const list = authedQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("companies")
      .withIndex("by_deletedAt_and_name", (q) => q.eq("deletedAt", undefined))
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
        contactCount: contacts.filter((contact) => !contact.deletedAt).length,
        dealCount: deals.filter((deal) => !deal.deletedAt).length,
      });
    }
    return { ...page, page: enriched };
  },
});

export const get = authedQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company || company.deletedAt) return null;
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
    const activeContacts = contacts.filter((contact) => !contact.deletedAt);
    const activeDeals = deals.filter((deal) => !deal.deletedAt);
    const openDeals = deals.filter(
      (d) =>
        !d.deletedAt &&
        d.stage !== "CLOSED_WON" &&
        d.stage !== "CLOSED_LOST",
    );
    return {
      ...company,
      owner,
      primaryContact,
      contacts: activeContacts,
      deals: activeDeals,
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
      if (existing && !existing.deletedAt) {
        throw new Error(`A company with domain ${args.domain} already exists`);
      }
    }
    const defaults = await entityDefaults(ctx, "company");
    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      domain: args.domain,
      industry: args.industry ?? defaults.industry,
      ownerId: defaults.ownerId,
      enrichmentStatus: "NONE",
      lastActivityAt: Date.now(),
    });
    // A new company with a domain gets enrichment queued automatically,
    // unless the workspace turned auto enrich off in settings.
    if (args.domain && defaults.autoEnrich !== false) {
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
      message: `Created ${args.name}${args.domain && defaults.autoEnrich !== false ? ` (${args.domain}), enrichment queued` : args.domain ? ` (${args.domain})` : ""}`,
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
    domain: v.optional(v.union(v.string(), v.null())),
    industry: v.optional(v.union(v.string(), v.null())),
    enrichmentStatus: v.optional(enrichmentStatus),
    description: v.optional(v.union(v.string(), v.null())),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    primaryContactId: v.optional(v.union(v.id("contacts"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { companyId, ...updates } = args;
    const company = await ctx.db.get("companies", companyId);
    if (!company) throw new Error("Company not found");
    if (company.deletedAt) throw new Error("Restore the company before editing it");
    if (typeof updates.domain === "string" && updates.domain.trim()) {
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_domain", (q) => q.eq("domain", updates.domain as string))
        .unique();
      if (existing && existing._id !== companyId && !existing.deletedAt) {
        throw new Error(`A company with domain ${updates.domain} already exists`);
      }
    }
    const patch: Partial<Doc<"companies">> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.domain !== undefined) patch.domain = updates.domain ?? undefined;
    if (updates.industry !== undefined)
      patch.industry = updates.industry ?? undefined;
    if (updates.enrichmentStatus !== undefined)
      patch.enrichmentStatus = updates.enrichmentStatus;
    if (updates.description !== undefined)
      patch.description = updates.description ?? undefined;
    if (updates.ownerId !== undefined) patch.ownerId = updates.ownerId ?? undefined;
    if (updates.primaryContactId !== undefined)
      patch.primaryContactId = updates.primaryContactId ?? undefined;
    await ctx.db.patch("companies", companyId, patch);
    return null;
  },
});

export const bulkUpdate = writeMutation({
  args: {
    companyIds: v.array(v.id("companies")),
    updates: v.object({
      industry: v.optional(v.union(v.string(), v.null())),
      ownerId: v.optional(v.union(v.id("users"), v.null())),
    }),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"companies">> = {};
    if (args.updates.industry !== undefined) {
      patch.industry = args.updates.industry ?? undefined;
    }
    if (args.updates.ownerId !== undefined) {
      patch.ownerId = args.updates.ownerId ?? undefined;
    }
    if (Object.keys(patch).length === 0) return 0;

    let updated = 0;
    const now = Date.now();
    for (const companyId of args.companyIds) {
      const company = await ctx.db.get("companies", companyId);
      if (!company || company.deletedAt) continue;
      await ctx.db.patch("companies", companyId, {
        ...patch,
        lastActivityAt: now,
      });
      updated += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "companies:bulkUpdate",
      status: "success",
      message: `Updated ${updated} companies`,
    });
    return updated;
  },
});

export const bulkRemove = writeMutation({
  args: { companyIds: v.array(v.id("companies")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let removed = 0;
    for (const companyId of args.companyIds) {
      const company = await ctx.db.get("companies", companyId);
      if (!company || company.deletedAt) continue;
      const deletedAt = Date.now();
      const contacts = await ctx.db
        .query("contacts")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect();
      for (const contact of contacts) {
        if (!contact.deletedAt) {
          await ctx.db.patch("contacts", contact._id, {
            deletedAt,
            lastActivityAt: deletedAt,
          });
        }
      }
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect();
      for (const deal of deals) {
        if (!deal.deletedAt) {
          await trackDealDelete(ctx, deal);
          await ctx.db.patch("deals", deal._id, { deletedAt });
        }
      }
      await ctx.db.patch("companies", companyId, {
        deletedAt,
        lastActivityAt: deletedAt,
      });
      removed += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "companies:bulkRemove",
      status: "success",
      message: `Moved ${removed} companies to trash`,
    });
    return removed;
  },
});

export const importRows = writeMutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        domain: v.optional(v.string()),
        industry: v.optional(v.string()),
        description: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const defaults = await entityDefaults(ctx, "company");
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const name = row.name.trim();
      const domain = row.domain?.trim() || undefined;
      if (!name) {
        skipped += 1;
        continue;
      }

      const patch: Partial<Doc<"companies">> = {
        name,
        domain,
        industry: row.industry?.trim() || defaults.industry,
        description: row.description?.trim() || undefined,
        lastActivityAt: Date.now(),
      };

      const existing = domain
        ? await ctx.db
            .query("companies")
            .withIndex("by_domain", (q) => q.eq("domain", domain))
            .unique()
        : null;
      if (existing && !existing.deletedAt) {
        await ctx.db.patch("companies", existing._id, patch);
        updated += 1;
        continue;
      }

      await ctx.db.insert("companies", {
        name,
        domain,
        industry: row.industry?.trim() || defaults.industry,
        description: row.description?.trim() || undefined,
        ownerId: defaults.ownerId,
        enrichmentStatus: "NONE",
        lastActivityAt: Date.now(),
      });
      created += 1;
    }

    await logEvent(ctx, {
      kind: "M",
      fn: "companies:importRows",
      status: "success",
      message: `Imported companies: ${created} created, ${updated} updated, ${skipped} skipped`,
    });
    return { created, updated, skipped };
  },
});

export const remove = writeMutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company) return null;
    const deletedAt = Date.now();
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const contact of contacts) {
      if (!contact.deletedAt) {
        await ctx.db.patch("contacts", contact._id, {
          deletedAt,
          lastActivityAt: deletedAt,
        });
      }
    }
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const deal of deals) {
      if (!deal.deletedAt) {
        await trackDealDelete(ctx, deal);
        await ctx.db.patch("deals", deal._id, { deletedAt });
      }
    }
    await ctx.db.patch("companies", args.companyId, {
      deletedAt,
      lastActivityAt: deletedAt,
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "companies:remove",
      status: "success",
      message: `Moved ${company.name} to trash`,
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
