import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authedQuery, writeMutation } from "./model/functions";
import { fieldType } from "./schema";

const targetKind = v.union(
  v.literal("company"),
  v.literal("contact"),
  v.literal("deal"),
  v.literal("project"),
  v.literal("task"),
  v.literal("note"),
  v.literal("custom"),
);

function keyFromLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function pluralize(label: string) {
  const clean = label.trim();
  if (!clean) return "Records";
  return clean.endsWith("s") ? clean : `${clean}s`;
}

async function uniqueObjectKey(
  ctx: MutationCtx,
  base: string,
) {
  let key = base || "custom_object";
  let suffix = 2;
  while (
    await ctx.db
      .query("customObjects")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique()
  ) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("customObjects")
      .withIndex("by_archivedAt_and_position", (q) => q.eq("archivedAt", undefined))
      .order("asc")
      .collect();
  },
});

export const getByKey = authedQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const object = await ctx.db
      .query("customObjects")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!object || object.archivedAt) return null;
    return object;
  },
});

export const create = writeMutation({
  args: {
    singularLabel: v.string(),
    pluralLabel: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.id("customObjects"),
  handler: async (ctx, args) => {
    const singularLabel = args.singularLabel.trim();
    if (!singularLabel) throw new Error("Name the object first");
    const siblings = await ctx.db
      .query("customObjects")
      .withIndex("by_archivedAt_and_position", (q) => q.eq("archivedAt", undefined))
      .collect();
    const key = await uniqueObjectKey(ctx, keyFromLabel(singularLabel));
    const objectId = await ctx.db.insert("customObjects", {
      key,
      singularLabel,
      pluralLabel: args.pluralLabel?.trim() || pluralize(singularLabel),
      description: args.description?.trim() || undefined,
      position: siblings.length + 1,
    });
    await ctx.db.insert("customObjectFields", {
      objectId,
      key: "name",
      label: "Name",
      type: "text",
      order: 1,
    });
    return objectId;
  },
});

export const fields = authedQuery({
  args: { objectId: v.id("customObjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customObjectFields")
      .withIndex("by_object_and_archivedAt_and_order", (q) =>
        q.eq("objectId", args.objectId).eq("archivedAt", undefined),
      )
      .order("asc")
      .collect();
  },
});

export const createField = writeMutation({
  args: {
    objectId: v.id("customObjects"),
    label: v.string(),
    type: fieldType,
    options: v.optional(v.array(v.string())),
  },
  returns: v.id("customObjectFields"),
  handler: async (ctx, args) => {
    const object = await ctx.db.get("customObjects", args.objectId);
    if (!object || object.archivedAt) throw new Error("Custom object not found");
    const label = args.label.trim();
    if (!label) throw new Error("Name the field first");
    const key = keyFromLabel(label);
    const existing = await ctx.db
      .query("customObjectFields")
      .withIndex("by_object_and_key", (q) =>
        q.eq("objectId", args.objectId).eq("key", key),
      )
      .unique();
    if (existing) throw new Error(`Field ${label} already exists`);
    const siblings = await ctx.db
      .query("customObjectFields")
      .withIndex("by_object_and_archivedAt_and_order", (q) =>
        q.eq("objectId", args.objectId).eq("archivedAt", undefined),
      )
      .collect();
    return await ctx.db.insert("customObjectFields", {
      objectId: args.objectId,
      key,
      label,
      type: args.type,
      options: args.options?.map((option) => option.trim()).filter(Boolean),
      order: siblings.length + 1,
    });
  },
});

export const relationships = authedQuery({
  args: { objectId: v.id("customObjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customObjectRelationshipDefinitions")
      .withIndex("by_source_and_archivedAt_and_order", (q) =>
        q.eq("sourceObjectId", args.objectId).eq("archivedAt", undefined),
      )
      .order("asc")
      .collect();
  },
});

export const createRelationship = writeMutation({
  args: {
    sourceObjectId: v.id("customObjects"),
    label: v.string(),
    targetKind,
    targetObjectId: v.optional(v.id("customObjects")),
    many: v.boolean(),
  },
  returns: v.id("customObjectRelationshipDefinitions"),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("customObjects", args.sourceObjectId);
    if (!source || source.archivedAt) throw new Error("Custom object not found");
    if (args.targetKind === "custom" && !args.targetObjectId) {
      throw new Error("Choose the custom object to relate to");
    }
    const label = args.label.trim();
    if (!label) throw new Error("Name the relationship first");
    const key = keyFromLabel(label);
    const existing = await ctx.db
      .query("customObjectRelationshipDefinitions")
      .withIndex("by_source_and_key", (q) =>
        q.eq("sourceObjectId", args.sourceObjectId).eq("key", key),
      )
      .unique();
    if (existing) throw new Error(`Relationship ${label} already exists`);
    const siblings = await ctx.db
      .query("customObjectRelationshipDefinitions")
      .withIndex("by_source_and_archivedAt_and_order", (q) =>
        q.eq("sourceObjectId", args.sourceObjectId).eq("archivedAt", undefined),
      )
      .collect();
    return await ctx.db.insert("customObjectRelationshipDefinitions", {
      sourceObjectId: args.sourceObjectId,
      key,
      label,
      targetKind: args.targetKind,
      targetObjectId: args.targetObjectId,
      many: args.many,
      order: siblings.length + 1,
    });
  },
});

export const listRecords = authedQuery({
  args: {
    objectId: v.id("customObjects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customObjectRecords")
      .withIndex("by_object_and_archivedAt_and_title", (q) =>
        q.eq("objectId", args.objectId).eq("archivedAt", undefined),
      )
      .order("asc")
      .paginate(args.paginationOpts);
  },
});

export const getRecord = authedQuery({
  args: { recordId: v.id("customObjectRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("customObjectRecords", args.recordId);
    if (!record || record.archivedAt) return null;
    const object = await ctx.db.get("customObjects", record.objectId);
    const fields = await ctx.db
      .query("customObjectFields")
      .withIndex("by_object_and_archivedAt_and_order", (q) =>
        q.eq("objectId", record.objectId).eq("archivedAt", undefined),
      )
      .order("asc")
      .collect();
    const relationshipDefinitions = await ctx.db
      .query("customObjectRelationshipDefinitions")
      .withIndex("by_source_and_archivedAt_and_order", (q) =>
        q.eq("sourceObjectId", record.objectId).eq("archivedAt", undefined),
      )
      .order("asc")
      .collect();
    const relationships = [];
    for (const definition of relationshipDefinitions) {
      const links = await ctx.db
        .query("customObjectRelationships")
        .withIndex("by_sourceRecord_and_relationship", (q) =>
          q.eq("sourceRecordId", record._id).eq("relationshipId", definition._id),
        )
        .collect();
      relationships.push({ definition, links });
    }
    return { record, object, fields, relationships };
  },
});

export const createRecord = writeMutation({
  args: {
    objectId: v.id("customObjects"),
    title: v.optional(v.string()),
  },
  returns: v.id("customObjectRecords"),
  handler: async (ctx, args) => {
    const object = await ctx.db.get("customObjects", args.objectId);
    if (!object || object.archivedAt) throw new Error("Custom object not found");
    const title = args.title?.trim() || "Untitled";
    return await ctx.db.insert("customObjectRecords", {
      objectId: args.objectId,
      title,
      values: { name: title },
      updatedAt: Date.now(),
    });
  },
});

export const updateRecord = writeMutation({
  args: {
    recordId: v.id("customObjectRecords"),
    title: v.optional(v.string()),
    values: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get("customObjectRecords", args.recordId);
    if (!record || record.archivedAt) throw new Error("Record not found");
    const patch: Partial<Doc<"customObjectRecords">> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      patch.title = args.title.trim() || "Untitled";
    }
    if (args.values !== undefined) {
      patch.values = args.values;
    }
    await ctx.db.patch("customObjectRecords", args.recordId, patch);
    return null;
  },
});

export const setRelationship = writeMutation({
  args: {
    relationshipId: v.id("customObjectRelationshipDefinitions"),
    sourceRecordId: v.id("customObjectRecords"),
    targetEntityId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const definition = await ctx.db.get(
      "customObjectRelationshipDefinitions",
      args.relationshipId,
    );
    if (!definition || definition.archivedAt) {
      throw new Error("Relationship not found");
    }
    const source = await ctx.db.get("customObjectRecords", args.sourceRecordId);
    if (!source || source.archivedAt) throw new Error("Record not found");
    const existing = await ctx.db
      .query("customObjectRelationships")
      .withIndex("by_sourceRecord_and_relationship", (q) =>
        q
          .eq("sourceRecordId", args.sourceRecordId)
          .eq("relationshipId", args.relationshipId),
      )
      .collect();
    if (!definition.many) {
      for (const row of existing) await ctx.db.delete("customObjectRelationships", row._id);
    }
    if (!args.targetEntityId.trim()) return null;
    await ctx.db.insert("customObjectRelationships", {
      relationshipId: args.relationshipId,
      sourceRecordId: args.sourceRecordId,
      targetKind: definition.targetKind,
      targetObjectId: definition.targetObjectId,
      targetEntityId: args.targetEntityId.trim(),
      createdAt: Date.now(),
    });
    return null;
  },
});
