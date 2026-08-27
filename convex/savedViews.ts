import { authedQuery, writeMutation } from "./model/functions";
import { v } from "convex/values";

const viewEntity = v.string();

export const list = authedQuery({
  args: { entity: v.optional(viewEntity) },
  returns: v.array(
    v.object({
      _id: v.id("savedViews"),
      _creationTime: v.number(),
      entity: v.string(),
      name: v.string(),
      href: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const entity = args.entity;
    if (entity) {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_entity", (q) => q.eq("entity", entity))
        .order("desc")
        .take(50);
    }
    return await ctx.db.query("savedViews").order("desc").take(100);
  },
});

export const save = writeMutation({
  args: {
    entity: viewEntity,
    name: v.string(),
    href: v.string(),
  },
  returns: v.id("savedViews"),
  handler: async (ctx, args) => {
    const href = args.href.trim();
    const name = args.name.trim();
    if (!href) throw new Error("A saved view needs a route");
    if (!name) throw new Error("Name is required");

    const existing = await ctx.db
      .query("savedViews")
      .withIndex("by_href", (q) => q.eq("href", href))
      .unique();
    if (existing) {
      await ctx.db.patch("savedViews", existing._id, {
        entity: args.entity,
        name,
      });
      return existing._id;
    }

    return await ctx.db.insert("savedViews", {
      entity: args.entity,
      name,
      href,
      createdAt: Date.now(),
    });
  },
});

export const remove = writeMutation({
  args: { viewId: v.id("savedViews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("savedViews", args.viewId);
    return null;
  },
});
