import { v } from "convex/values";
import { authedQuery, writeMutation } from "./model/functions";

const favoriteKind = v.union(
  v.literal("route"),
  v.literal("record"),
  v.literal("view"),
);

const favoriteEntity = v.union(
  v.literal("company"),
  v.literal("contact"),
  v.literal("deal"),
  v.literal("project"),
  v.literal("task"),
  v.literal("note"),
);

export const list = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("favorites"),
      _creationTime: v.number(),
      label: v.string(),
      href: v.string(),
      kind: favoriteKind,
      entityType: v.optional(favoriteEntity),
      entityId: v.optional(v.string()),
      position: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_position")
      .order("asc")
      .take(100);
  },
});

export const getByHref = authedQuery({
  args: { href: v.string() },
  returns: v.union(v.null(), v.id("favorites")),
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_href", (q) => q.eq("href", args.href))
      .unique();
    return favorite?._id ?? null;
  },
});

export const toggle = writeMutation({
  args: {
    label: v.string(),
    href: v.string(),
    kind: favoriteKind,
    entityType: v.optional(favoriteEntity),
    entityId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_href", (q) => q.eq("href", args.href))
      .unique();
    if (existing) {
      await ctx.db.delete("favorites", existing._id);
      return false;
    }
    const latest = await ctx.db
      .query("favorites")
      .withIndex("by_position")
      .order("desc")
      .first();
    await ctx.db.insert("favorites", {
      label: args.label.trim() || args.href,
      href: args.href,
      kind: args.kind,
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...(args.entityId ? { entityId: args.entityId } : {}),
      position: (latest?.position ?? 0) + 1,
      createdAt: Date.now(),
    });
    return true;
  },
});
