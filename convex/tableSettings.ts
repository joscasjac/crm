import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { dealStage } from "./schema";
import { writeMutation } from "./model/functions";

const entityValidator = v.union(
  v.literal("company"),
  v.literal("contact"),
  v.literal("deal"),
);

const columnPref = v.object({
  key: v.string(),
  label: v.optional(v.string()),
  hidden: v.optional(v.boolean()),
  pinned: v.optional(v.boolean()),
});

async function settingsRow(
  ctx: QueryCtx | MutationCtx,
  entity: "company" | "contact" | "deal",
) {
  return await ctx.db
    .query("tableSettings")
    .withIndex("by_entity", (q) => q.eq("entity", entity))
    .unique();
}

// One read for a table: column prefs plus new-record defaults.
export const get = query({
  args: { entity: entityValidator },
  returns: v.object({
    columns: v.array(columnPref),
    defaults: v.object({
      ownerId: v.optional(v.id("users")),
      industry: v.optional(v.string()),
      stage: v.optional(dealStage),
      currency: v.optional(v.string()),
      autoEnrich: v.optional(v.boolean()),
    }),
  }),
  handler: async (ctx, args) => {
    const row = await settingsRow(ctx, args.entity);
    return {
      columns: row?.columns ?? [],
      defaults: {
        ownerId: row?.defaultOwnerId,
        industry: row?.defaultIndustry,
        stage: row?.defaultStage,
        currency: row?.defaultCurrency,
        autoEnrich: row?.autoEnrich,
      },
    };
  },
});

export const saveColumns = writeMutation({
  args: { entity: entityValidator, columns: v.array(columnPref) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await settingsRow(ctx, args.entity);
    if (row) {
      await ctx.db.patch("tableSettings", row._id, { columns: args.columns });
    } else {
      await ctx.db.insert("tableSettings", {
        entity: args.entity,
        columns: args.columns,
      });
    }
    return null;
  },
});

// Defaults save one field at a time from the settings page. null clears.
export const saveDefaults = writeMutation({
  args: {
    entity: entityValidator,
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    industry: v.optional(v.union(v.string(), v.null())),
    stage: v.optional(v.union(dealStage, v.null())),
    currency: v.optional(v.union(v.string(), v.null())),
    autoEnrich: v.optional(v.union(v.boolean(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.ownerId !== undefined) patch.defaultOwnerId = args.ownerId ?? undefined;
    if (args.industry !== undefined) {
      patch.defaultIndustry = args.industry?.trim() || undefined;
    }
    if (args.stage !== undefined) patch.defaultStage = args.stage ?? undefined;
    if (args.currency !== undefined) {
      patch.defaultCurrency = args.currency?.trim().toUpperCase() || undefined;
    }
    if (args.autoEnrich !== undefined) {
      patch.autoEnrich = args.autoEnrich ?? undefined;
    }
    const row = await settingsRow(ctx, args.entity);
    if (row) {
      await ctx.db.patch("tableSettings", row._id, patch);
    } else {
      await ctx.db.insert("tableSettings", {
        entity: args.entity,
        columns: [],
        ...patch,
      });
    }
    return null;
  },
});

// Shared helper so create mutations can apply workspace defaults without an
// extra round trip from the client.
export async function entityDefaults(
  ctx: QueryCtx | MutationCtx,
  entity: "company" | "contact" | "deal",
) {
  const row = await settingsRow(ctx, entity);
  return {
    ownerId: row?.defaultOwnerId,
    industry: row?.defaultIndustry,
    stage: row?.defaultStage,
    currency: row?.defaultCurrency,
    autoEnrich: row?.autoEnrich,
  };
}
