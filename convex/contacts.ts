import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { logEvent } from "./logs";
import { deleteContactCascade } from "./model/cascade";
import { writeMutation } from "./model/functions";
import { notifySlack } from "./slack";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("contacts")
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
        company: company
          ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
          : null,
        owner: owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : null,
      });
    }
    return { ...page, page: enriched };
  },
});

export const get = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact) return null;
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
      if (existing) {
        throw new Error(`A contact with email ${args.email} already exists`);
      }
    }
    const contactId = await ctx.db.insert("contacts", {
      name: args.name,
      email: args.email,
      title: args.title,
      companyId: args.companyId,
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
    email: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    ownerId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { contactId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch("contacts", contactId, patch);
    return null;
  },
});

export const remove = writeMutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteContactCascade(ctx, args.contactId);
    return null;
  },
});
