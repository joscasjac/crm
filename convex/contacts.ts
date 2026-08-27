import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { logEvent } from "./logs";
import { authedQuery, writeMutation } from "./model/functions";
import { notifySlack } from "./slack";
import { entityDefaults } from "./tableSettings";

export const names = authedQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("contacts"), name: v.string() })),
  handler: async (ctx) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .order("desc")
      .take(200);
    return contacts.map((contact) => ({
      _id: contact._id,
      name: contact.name,
    }));
  },
});

export const list = authedQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("contacts")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .order("desc")
      .paginate(args.paginationOpts);
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? page.page.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.email ?? "").toLowerCase().includes(term),
        )
      : page.page;

    const enriched = [];
    for (const contact of filtered) {
      const company = contact.companyId
        ? await ctx.db.get("companies", contact.companyId)
        : null;
      const owner = contact.ownerId ? await ctx.db.get("users", contact.ownerId) : null;
      enriched.push({
        ...contact,
        company: company && !company.deletedAt
          ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
          : null,
        owner: owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : null,
      });
    }
    return { ...page, page: enriched };
  },
});

export const get = authedQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact || contact.deletedAt) return null;
    const company = contact.companyId
      ? await ctx.db.get("companies", contact.companyId)
      : null;
    const owner = contact.ownerId ? await ctx.db.get("users", contact.ownerId) : null;
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_entityId", (q) => q.eq("entityId", contact._id))
      .collect();
    return { ...contact, company, owner, facts };
  },
});

export const create = writeMutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    if (args.email) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
      if (existing && !existing.deletedAt) {
        throw new Error(`A contact with email ${args.email} already exists`);
      }
    }
    const defaults = await entityDefaults(ctx, "contact");
    const contactId = await ctx.db.insert("contacts", {
      name: args.name,
      email: args.email,
      title: args.title,
      companyId: args.companyId,
      ownerId: defaults.ownerId,
      lastActivityAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "contacts:create",
      status: "success",
      message: `Created ${args.name}`,
    });
    const company = args.companyId
      ? await ctx.db.get("companies", args.companyId)
      : null;
    await notifySlack(
      ctx,
      "records",
      `New contact: ${args.name}${args.email ? ` (${args.email})` : ""}${company ? ` at ${company.name}` : ""}`,
      `/app/contacts/${contactId}`,
    );
    return contactId;
  },
});

export const update = writeMutation({
  args: {
    contactId: v.id("contacts"),
    name: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.null())),
    title: v.optional(v.union(v.string(), v.null())),
    companyId: v.optional(v.union(v.id("companies"), v.null())),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { contactId, ...updates } = args;
    const contact = await ctx.db.get("contacts", contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.deletedAt) throw new Error("Restore the contact before editing it");
    if (typeof updates.email === "string" && updates.email.trim()) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_email", (q) => q.eq("email", updates.email as string))
        .unique();
      if (existing && existing._id !== contactId && !existing.deletedAt) {
        throw new Error(`A contact with email ${updates.email} already exists`);
      }
    }
    const patch: Partial<Doc<"contacts">> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.email !== undefined) patch.email = updates.email ?? undefined;
    if (updates.title !== undefined) patch.title = updates.title ?? undefined;
    if (updates.companyId !== undefined)
      patch.companyId = updates.companyId ?? undefined;
    if (updates.ownerId !== undefined)
      patch.ownerId = updates.ownerId ?? undefined;
    await ctx.db.patch("contacts", contactId, patch);
    return null;
  },
});

export const bulkUpdate = writeMutation({
  args: {
    contactIds: v.array(v.id("contacts")),
    updates: v.object({
      title: v.optional(v.union(v.string(), v.null())),
      companyId: v.optional(v.union(v.id("companies"), v.null())),
      ownerId: v.optional(v.union(v.id("users"), v.null())),
    }),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"contacts">> = {};
    if (args.updates.title !== undefined) {
      patch.title = args.updates.title ?? undefined;
    }
    if (args.updates.companyId !== undefined) {
      patch.companyId = args.updates.companyId ?? undefined;
    }
    if (args.updates.ownerId !== undefined) {
      patch.ownerId = args.updates.ownerId ?? undefined;
    }
    if (Object.keys(patch).length === 0) return 0;

    let updated = 0;
    const now = Date.now();
    for (const contactId of args.contactIds) {
      const contact = await ctx.db.get("contacts", contactId);
      if (!contact || contact.deletedAt) continue;
      await ctx.db.patch("contacts", contactId, {
        ...patch,
        lastActivityAt: now,
      });
      updated += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "contacts:bulkUpdate",
      status: "success",
      message: `Updated ${updated} contacts`,
    });
    return updated;
  },
});

export const bulkRemove = writeMutation({
  args: { contactIds: v.array(v.id("contacts")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let removed = 0;
    const deletedAt = Date.now();
    for (const contactId of args.contactIds) {
      const contact = await ctx.db.get("contacts", contactId);
      if (!contact || contact.deletedAt) continue;
      await ctx.db.patch("contacts", contactId, {
        deletedAt,
        lastActivityAt: deletedAt,
      });
      removed += 1;
    }
    await logEvent(ctx, {
      kind: "M",
      fn: "contacts:bulkRemove",
      status: "success",
      message: `Moved ${removed} contacts to trash`,
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
  if (!domain && !name) return undefined;

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

export const importRows = writeMutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        email: v.optional(v.string()),
        title: v.optional(v.string()),
        companyName: v.optional(v.string()),
        companyDomain: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const defaults = await entityDefaults(ctx, "contact");
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const name = row.name.trim();
      const email = row.email?.trim() || undefined;
      if (!name) {
        skipped += 1;
        continue;
      }
      const companyId = await resolveImportCompany(ctx, row);
      const patch: Partial<Doc<"contacts">> = {
        name,
        email,
        title: row.title?.trim() || undefined,
        companyId,
        ownerId: defaults.ownerId,
        lastActivityAt: Date.now(),
      };

      const existing = email
        ? await ctx.db
            .query("contacts")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
        : null;
      if (existing && !existing.deletedAt) {
        await ctx.db.patch("contacts", existing._id, patch);
        updated += 1;
        continue;
      }

      await ctx.db.insert("contacts", {
        name,
        email,
        title: row.title?.trim() || undefined,
        companyId,
        ownerId: defaults.ownerId,
        lastActivityAt: Date.now(),
      });
      created += 1;
    }

    await logEvent(ctx, {
      kind: "M",
      fn: "contacts:importRows",
      status: "success",
      message: `Imported contacts: ${created} created, ${updated} updated, ${skipped} skipped`,
    });
    return { created, updated, skipped };
  },
});

export const remove = writeMutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact) return null;
    await ctx.db.patch("contacts", args.contactId, {
      deletedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "contacts:remove",
      status: "success",
      message: `Moved ${contact.name} to trash`,
    });
    return null;
  },
});
