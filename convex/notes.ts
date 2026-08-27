import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { logEvent } from "./logs";
import { clip, insertActivity } from "./model/activities";
import { authedQuery, writeMutation } from "./model/functions";

function splitNoteBody(body: string) {
  const lines = body.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first === -1) return { title: "Untitled", body: "" };
  const title = lines[first]?.trim() || "Untitled";
  const rest = lines.slice(first + 1).join("\n").trim();
  return { title, body: rest };
}

function composeNoteBody(title: string, body?: string) {
  const cleanTitle = title.trim() || "Untitled";
  const cleanBody = body?.trim();
  return cleanBody ? `${cleanTitle}\n\n${cleanBody}` : cleanTitle;
}

async function fallbackAuthor(ctx: QueryCtx) {
  const users = await ctx.db.query("users").take(10);
  const owner = users.find((user) => user.role === "owner") ?? users[0];
  return owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : null;
}

async function enrichNote(ctx: QueryCtx, note: Doc<"activities">) {
  const author = note.authorId ? await ctx.db.get("users", note.authorId) : null;
  const company = note.companyId ? await ctx.db.get("companies", note.companyId) : null;
  const contact = note.contactId ? await ctx.db.get("contacts", note.contactId) : null;
  const deal = note.dealId ? await ctx.db.get("deals", note.dealId) : null;
  const parsed = splitNoteBody(note.body);
  return {
    ...note,
    title: parsed.title,
    noteBody: parsed.body,
    author: author
      ? { name: author.name, avatarUrl: author.avatarUrl }
      : await fallbackAuthor(ctx),
    company: company && !company.deletedAt
      ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
      : null,
    contact: contact && !contact.deletedAt
      ? { _id: contact._id, name: contact.name }
      : null,
    deal: deal && !deal.deletedAt ? { _id: deal._id, name: deal.name } : null,
  };
}

export const list = authedQuery({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_type", (q) => q.eq("type", "NOTE"))
      .order("desc")
      .collect();
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? rows.filter((row) => row.body.toLowerCase().includes(term))
      : rows;
    const result = [];
    for (const row of filtered) {
      result.push(await enrichNote(ctx, row));
    }
    return result;
  },
});

export const get = authedQuery({
  args: { noteId: v.id("activities") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get("activities", args.noteId);
    if (!note || note.type !== "NOTE") return null;
    return await enrichNote(ctx, note);
  },
});

export const create = writeMutation({
  args: {
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    const { id } = await insertActivity(ctx, {
      type: "NOTE",
      body: composeNoteBody(args.title ?? "Untitled", args.body),
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
    });
    return id;
  },
});

export const update = writeMutation({
  args: {
    noteId: v.id("activities"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    companyId: v.optional(v.union(v.id("companies"), v.null())),
    contactId: v.optional(v.union(v.id("contacts"), v.null())),
    dealId: v.optional(v.union(v.id("deals"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get("activities", args.noteId);
    if (!note || note.type !== "NOTE") throw new Error("Note not found");
    const parsed = splitNoteBody(note.body);
    const patch: Partial<Doc<"activities">> = {};
    if (args.title !== undefined || args.body !== undefined) {
      patch.body = composeNoteBody(
        args.title ?? parsed.title,
        args.body ?? parsed.body,
      );
    }
    if (args.companyId !== undefined) patch.companyId = args.companyId ?? undefined;
    if (args.contactId !== undefined) patch.contactId = args.contactId ?? undefined;
    if (args.dealId !== undefined) patch.dealId = args.dealId ?? undefined;
    await ctx.db.patch("activities", args.noteId, patch);
    await logEvent(ctx, {
      kind: "M",
      fn: "notes:update",
      status: "success",
      message: `Updated note: ${clip(patch.body ?? note.body)}`,
    });
    return null;
  },
});

export const remove = writeMutation({
  args: { noteId: v.id("activities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get("activities", args.noteId);
    if (!note || note.type !== "NOTE") throw new Error("Note not found");
    await ctx.db.delete("activities", args.noteId);
    await logEvent(ctx, {
      kind: "M",
      fn: "notes:remove",
      status: "success",
      message: `Deleted note: ${clip(note.body)}`,
    });
    return null;
  },
});
