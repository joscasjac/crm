import { v } from "convex/values";
import { authedQuery, writeMutation } from "./model/functions";
import { fieldType } from "./schema";

const entityValidator = v.union(
  v.literal("company"),
  v.literal("contact"),
  v.literal("deal"),
  v.literal("project"),
  v.literal("task"),
);

// Definitions plus this record's values in one read.
export const forEntity = authedQuery({
  args: { entity: entityValidator, entityId: v.string() },
  handler: async (ctx, args) => {
    const definitions = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_entity_and_key", (q) => q.eq("entity", args.entity))
      .collect();
    const active = definitions
      .filter((d) => !d.archived)
      .sort((a, b) => a.order - b.order);

    const result = [];
    for (const definition of active) {
      const value = await ctx.db
        .query("fieldValues")
        .withIndex("by_field_and_entityId", (q) =>
          q.eq("fieldId", definition._id).eq("entityId", args.entityId),
        )
        .unique();
      result.push({ definition, value: value?.value ?? null });
    }
    return result;
  },
});

export const listDefinitions = authedQuery({
  args: { entity: entityValidator },
  handler: async (ctx, args) => {
    const definitions = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_entity_and_key", (q) => q.eq("entity", args.entity))
      .collect();
    return definitions.sort((a, b) => a.order - b.order);
  },
});

export const createDefinition = writeMutation({
  args: {
    entity: entityValidator,
    key: v.string(),
    label: v.string(),
    type: fieldType,
    options: v.optional(v.array(v.string())),
    agentFilled: v.boolean(),
    agentBrief: v.optional(v.string()),
  },
  returns: v.id("fieldDefinitions"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_entity_and_key", (q) =>
        q.eq("entity", args.entity).eq("key", args.key),
      )
      .unique();
    if (existing) {
      throw new Error(`Field key ${args.key} already exists on ${args.entity}`);
    }
    const siblings = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_entity_and_key", (q) => q.eq("entity", args.entity))
      .collect();
    return await ctx.db.insert("fieldDefinitions", {
      ...args,
      order: siblings.length + 1,
      archived: false,
    });
  },
});

// Rename a field or adjust its select options and agent brief. The key is
// immutable: values join on the definition id, so only the label moves.
export const updateDefinition = writeMutation({
  args: {
    fieldId: v.id("fieldDefinitions"),
    label: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    agentFilled: v.optional(v.boolean()),
    agentBrief: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const definition = await ctx.db.get("fieldDefinitions", args.fieldId);
    if (!definition) throw new Error("Field not found");
    const patch: Record<string, unknown> = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (!label) throw new Error("Label cannot be empty");
      patch.label = label;
    }
    if (args.options !== undefined) {
      if (definition.type !== "select" && definition.type !== "multiSelect") {
        throw new Error("Options only apply to select fields");
      }
      const options = args.options.map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        throw new Error("Select fields need at least one option");
      }
      patch.options = options;
    }
    if (args.agentFilled !== undefined) patch.agentFilled = args.agentFilled;
    if (args.agentBrief !== undefined) {
      patch.agentBrief = args.agentBrief.trim() || undefined;
    }
    await ctx.db.patch("fieldDefinitions", args.fieldId, patch);
    return null;
  },
});

// Archiving keeps the values. The definition disappears from forms but the
// data survives, matching upstream.
export const archiveDefinition = writeMutation({
  args: { fieldId: v.id("fieldDefinitions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("fieldDefinitions", args.fieldId, { archived: true });
    return null;
  },
});

export const restoreDefinition = writeMutation({
  args: { fieldId: v.id("fieldDefinitions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("fieldDefinitions", args.fieldId, { archived: false });
    return null;
  },
});

// Batch read for table views: every active definition for the entity plus
// values for the visible rows, keyed as `${fieldId}:${entityId}`. One
// subscription per table instead of one per row.
export const tableValues = authedQuery({
  args: { entity: entityValidator, entityIds: v.array(v.string()) },
  returns: v.object({
    definitions: v.array(
      v.object({
        _id: v.id("fieldDefinitions"),
        _creationTime: v.number(),
        entity: entityValidator,
        key: v.string(),
        label: v.string(),
        type: fieldType,
        options: v.optional(v.array(v.string())),
        order: v.number(),
        archived: v.boolean(),
        agentFilled: v.boolean(),
        agentBrief: v.optional(v.string()),
      }),
    ),
    values: v.record(v.string(), v.string()),
  }),
  handler: async (ctx, args) => {
    const definitions = await ctx.db
      .query("fieldDefinitions")
      .withIndex("by_entity_and_key", (q) => q.eq("entity", args.entity))
      .collect();
    const active = definitions
      .filter((d) => !d.archived)
      .sort((a, b) => a.order - b.order);

    const values: Record<string, string> = {};
    for (const entityId of args.entityIds) {
      const rows = await ctx.db
        .query("fieldValues")
        .withIndex("by_entityId", (q) => q.eq("entityId", entityId))
        .collect();
      for (const row of rows) {
        values[`${row.fieldId}:${entityId}`] = row.value;
      }
    }
    return { definitions: active, values };
  },
});

export const setValue = writeMutation({
  args: {
    fieldId: v.id("fieldDefinitions"),
    entityId: v.string(),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const definition = await ctx.db.get("fieldDefinitions", args.fieldId);
    if (!definition || definition.archived) {
      throw new Error("Field not found or archived");
    }
    if (definition.type === "select" && definition.options && args.value) {
      if (!definition.options.includes(args.value)) {
        throw new Error(`Value must be one of: ${definition.options.join(", ")}`);
      }
    }
    if (definition.type === "multiSelect" && definition.options && args.value) {
      const values = args.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const invalid = values.filter((value) => !definition.options?.includes(value));
      if (invalid.length > 0) {
        throw new Error(`Value must be one of: ${definition.options.join(", ")}`);
      }
    }
    if (definition.type === "rating" && args.value) {
      const rating = Number(args.value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
    }
    if (
      (definition.type === "number" || definition.type === "currency") &&
      args.value &&
      !Number.isFinite(Number(args.value))
    ) {
      throw new Error("Value must be a number");
    }
    if (
      definition.type === "boolean" &&
      args.value &&
      args.value !== "true" &&
      args.value !== "false"
    ) {
      throw new Error("Value must be true or false");
    }
    const existing = await ctx.db
      .query("fieldValues")
      .withIndex("by_field_and_entityId", (q) =>
        q.eq("fieldId", args.fieldId).eq("entityId", args.entityId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("fieldValues", existing._id, { value: args.value });
    } else {
      await ctx.db.insert("fieldValues", {
        fieldId: args.fieldId,
        entityId: args.entityId,
        value: args.value,
      });
    }
    return null;
  },
});
