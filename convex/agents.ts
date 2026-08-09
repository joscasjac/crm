import { v } from "convex/values";
import { query } from "./_generated/server";
import { writeMutation } from "./model/functions";

// Agent definitions are data, versions are rows, deploying is a pointer move.
// No build step, no redeploy.

export const list = query({
  args: {},
  handler: async (ctx) => {
    const defs = await ctx.db.query("agentDefinitions").collect();
    return await Promise.all(
      defs.map(async (def) => {
        const current = def.currentVersionId
          ? await ctx.db.get("agentVersions", def.currentVersionId)
          : null;
        const runs = await ctx.db
          .query("agentRuns")
          .withIndex("by_agent", (q) => q.eq("agentId", def._id))
          .order("desc")
          .take(5);
        return { ...def, currentVersion: current, recentRuns: runs };
      }),
    );
  },
});

export const get = query({
  args: { definitionId: v.id("agentDefinitions") },
  handler: async (ctx, args) => {
    const def = await ctx.db.get("agentDefinitions", args.definitionId);
    if (!def) return null;
    const versions = await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_and_number", (q) => q.eq("agentId", def._id))
      .order("desc")
      .collect();
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", def._id))
      .order("desc")
      .take(20);
    return { ...def, versions, runs };
  },
});

// Turn a plain sentence into a draft agent. Deterministic templating, so it
// works with zero keys; an LLM pass can refine it later when a key exists.
export const createDraft = writeMutation({
  args: { description: v.string() },
  returns: v.id("agentDefinitions"),
  handler: async (ctx, args) => {
    const description = args.description.trim();
    if (description.length === 0) {
      throw new Error("Describe what the agent should do");
    }
    const name =
      description.length > 60 ? description.slice(0, 57) + "..." : description;
    const definitionId = await ctx.db.insert("agentDefinitions", {
      name,
      description,
      status: "draft",
      trigger: { kind: "manual" },
    });
    const versionId = await ctx.db.insert("agentVersions", {
      agentId: definitionId,
      number: 1,
      instructions: [
        `Goal: ${description}`,
        "Rules: never invent facts about people. Record evidence for every field you write.",
        "When done, state what you changed and why you will or will not check back.",
      ].join("\n"),
      toolNames: ["read_crm_history"],
      model: "gpt-5-mini",
    });
    await ctx.db.patch("agentDefinitions", definitionId, { currentVersionId: versionId });
    return definitionId;
  },
});

export const updateInstructions = writeMutation({
  args: {
    definitionId: v.id("agentDefinitions"),
    instructions: v.string(),
  },
  returns: v.id("agentVersions"),
  handler: async (ctx, args) => {
    const def = await ctx.db.get("agentDefinitions", args.definitionId);
    if (!def) throw new Error("Agent not found");
    const latest = await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_and_number", (q) => q.eq("agentId", def._id))
      .order("desc")
      .first();
    const versionId = await ctx.db.insert("agentVersions", {
      agentId: def._id,
      number: (latest?.number ?? 0) + 1,
      instructions: args.instructions,
      toolNames: latest?.toolNames ?? ["read_crm_history"],
      model: latest?.model ?? "gpt-5-mini",
    });
    await ctx.db.patch("agentDefinitions", def._id, { currentVersionId: versionId });
    return versionId;
  },
});

export const setStatus = writeMutation({
  args: {
    definitionId: v.id("agentDefinitions"),
    status: v.union(
      v.literal("draft"),
      v.literal("deployed"),
      v.literal("paused"),
      v.literal("archived"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      status: typeof args.status;
    } = { status: args.status };
    await ctx.db.patch("agentDefinitions", args.definitionId, patch);
    if (args.status === "deployed") {
      const def = await ctx.db.get("agentDefinitions", args.definitionId);
      if (def?.currentVersionId) {
        await ctx.db.patch("agentVersions", def.currentVersionId, { deployedAt: Date.now() });
      }
    }
    return null;
  },
});

export const remove = writeMutation({
  args: { definitionId: v.id("agentDefinitions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_and_number", (q) =>
        q.eq("agentId", args.definitionId),
      )
      .collect();
    for (const version of versions) {
      await ctx.db.delete("agentVersions", version._id);
    }
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", args.definitionId))
      .collect();
    for (const run of runs) {
      await ctx.db.delete("agentRuns", run._id);
    }
    await ctx.db.delete("agentDefinitions", args.definitionId);
    return null;
  },
});
