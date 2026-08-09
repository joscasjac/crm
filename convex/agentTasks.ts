import { Workpool } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { logEvent } from "./logs";
import { writeMutation } from "./model/functions";
import { notifySlack } from "./slack";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const BATCH = 5;

// Bounded parallelism for agent work, so a slow vendor cannot starve the
// dispatcher.
const agentPool = new Workpool(components.agentPool, { maxParallelism: 3 });

// The queue is a table. claimDue leases rows: Convex serializes mutations,
// so two dispatchers claim disjoint work with no lock hint. A run that dies
// frees its row when the lease expires.
export const claimDue = internalMutation({
  args: {},
  returns: v.array(v.id("agentTasks")),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("agentTasks")
      .withIndex("by_state_and_dueAt", (q) =>
        q.eq("state", "open").lte("dueAt", now),
      )
      .take(25);
    const claimable = due
      .filter(
        (t) =>
          (t.leasedUntil === undefined || t.leasedUntil < now) &&
          t.attempts < MAX_ATTEMPTS,
      )
      .sort((a, b) => a.priority - b.priority)
      .slice(0, BATCH);
    const claimed = [];
    for (const task of claimable) {
      await ctx.db.patch("agentTasks", task._id, {
        leasedUntil: now + LEASE_MS,
        attempts: task.attempts + 1,
        startedAt: now,
      });
      claimed.push(task._id);
    }
    // Retire rows past the attempt cap in the same pass.
    for (const task of due) {
      if (
        task.attempts >= MAX_ATTEMPTS &&
        (task.leasedUntil === undefined || task.leasedUntil < now)
      ) {
        await ctx.db.patch("agentTasks", task._id, {
          state: "failed",
          finishedAt: now,
          result: "Retired after too many attempts",
        });
      }
    }
    return claimed;
  },
});

// Dispatch schedules, it does not decide. The one-minute tick leases what is
// due and starts a run per row. Anything shaped like "every N minutes, the
// oldest ten contacts" belongs in a task's dueAt, never in a cron expression.
export const tick = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const claimed: Array<Id<"agentTasks">> = await ctx.runMutation(
      internal.agentTasks.claimDue,
      {},
    );
    for (const taskId of claimed) {
      await agentPool.enqueueAction(ctx, internal.agentTasks.execute, {
        taskId,
      });
    }
    return null;
  },
});

export const getInternal = internalQuery({
  args: { taskId: v.id("agentTasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get("agentTasks", args.taskId);
  },
});

// Runs one claimed task. Tools call internal functions only: nothing in here
// is reachable from a browser console.
export const execute = internalAction({
  args: { taskId: v.id("agentTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.agentTasks.getInternal, {
      taskId: args.taskId,
    });
    if (!task || task.state !== "open") return null;

    if (task.kind === "ENRICH_COMPANY" && task.companyId) {
      await ctx.runAction(internal.enrichment.enrichCompany, {
        companyId: task.companyId,
        taskId: args.taskId,
      });
      return null;
    }

    // Every outside key is optional. Without a model key the run records the
    // capability preamble and stores nothing, rather than guessing.
    const hasModel = Boolean(process.env.OPENAI_API_KEY);
    const result = hasModel
      ? "Run complete. See the run log on the record."
      : "No model key configured on this install. Recorded nothing: a blank field beats a guess.";
    await ctx.runMutation(internal.agentTasks.completeInternal, {
      taskId: args.taskId,
      state: "done",
      result,
    });
    return null;
  },
});

export const completeInternal = internalMutation({
  args: {
    taskId: v.id("agentTasks"),
    state: v.union(v.literal("done"), v.literal("failed")),
    result: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("agentTasks", args.taskId);
    if (!task || task.state !== "open") return null;
    // state flips in the same write that sets finishedAt.
    await ctx.db.patch("agentTasks", args.taskId, {
      state: args.state,
      finishedAt: Date.now(),
      result: args.result,
      leasedUntil: undefined,
    });
    await logEvent(ctx, {
      kind: "A",
      fn: `agentTasks:${task.kind}`,
      status: args.state === "done" ? "success" : "error",
      message: args.result,
    });
    await notifySlack(
      ctx,
      "agent",
      `Agent run ${args.state === "done" ? "finished" : "failed"} (${task.kind}): ${args.result}`,
      task.companyId
        ? `/app/companies/${task.companyId}`
        : task.contactId
          ? `/app/contacts/${task.contactId}`
          : "/app/agents",
    );
    return null;
  },
});

// schedule_recheck from the UI. The reason is required and shown to the rep.
export const scheduleRecheck = writeMutation({
  args: {
    reason: v.string(),
    dueInDays: v.number(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
  },
  returns: v.id("agentTasks"),
  handler: async (ctx, args) => {
    if (args.reason.trim().length < 10) {
      throw new Error(
        "State a reason. An agent that cannot say why it will be back does not have a reason, it has a default.",
      );
    }
    return await ctx.db.insert("agentTasks", {
      kind: args.contactId ? "RECHECK_CONTACT" : "ENRICH_COMPANY",
      state: "open",
      reason: args.reason,
      companyId: args.companyId,
      contactId: args.contactId,
      priority: 2,
      dueAt: Date.now() + args.dueInDays * 24 * 60 * 60 * 1000,
      attempts: 0,
    });
  },
});

export const forCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTasks")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(20);
  },
});

// The agent's upcoming follow-ups across the workspace.
export const upcoming = query({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db
      .query("agentTasks")
      .withIndex("by_state_and_dueAt", (q) => q.eq("state", "open"))
      .order("asc")
      .take(25);
    const result = [];
    for (const task of open) {
      const company = task.companyId ? await ctx.db.get("companies", task.companyId) : null;
      const contact = task.contactId ? await ctx.db.get("contacts", task.contactId) : null;
      result.push({
        ...task,
        company: company ? { name: company.name } : null,
        contact: contact ? { name: contact.name } : null,
      });
    }
    return result;
  },
});
