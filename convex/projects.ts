import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { logEvent } from "./logs";
import { currentUserId } from "./model/access";
import { authedQuery, writeMutation } from "./model/functions";
import { projectStatus, taskPriority, taskStatus } from "./schema";

const PROJECT_STATUSES = [
  "planned",
  "active",
  "on_hold",
  "completed",
  "archived",
] as const;

const OPEN_TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
] as const;

const userSummary = v.union(
  v.object({
    _id: v.id("users"),
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  }),
  v.null(),
);

const linkedSummary = v.object({
  company: v.union(
    v.object({ _id: v.id("companies"), name: v.string() }),
    v.null(),
  ),
  contact: v.union(
    v.object({ _id: v.id("contacts"), name: v.string() }),
    v.null(),
  ),
  deal: v.union(
    v.object({ _id: v.id("deals"), name: v.string() }),
    v.null(),
  ),
});

const projectFields = {
  _id: v.id("projects"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  status: projectStatus,
  ownerId: v.optional(v.id("users")),
  companyId: v.optional(v.id("companies")),
  contactId: v.optional(v.id("contacts")),
  dealId: v.optional(v.id("deals")),
  startAt: v.optional(v.number()),
  dueAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  owner: userSummary,
  links: linkedSummary,
  taskCount: v.number(),
  openTaskCount: v.number(),
  doneTaskCount: v.number(),
};

const projectCard = v.object(projectFields);

export const names = authedQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("projects"), name: v.string() })),
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(200);
    return projects.map((project) => ({ _id: project._id, name: project.name }));
  },
});

async function enrichProject(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">,
) {
  const owner = project.ownerId ? await ctx.db.get("users", project.ownerId) : null;
  const company = project.companyId
    ? await ctx.db.get("companies", project.companyId)
    : null;
  const contact = project.contactId
    ? await ctx.db.get("contacts", project.contactId)
    : null;
  const deal = project.dealId ? await ctx.db.get("deals", project.dealId) : null;

  let taskCount = 0;
  let openTaskCount = 0;
  let doneTaskCount = 0;
  for (const status of OPEN_TASK_STATUSES) {
    const count = (
      await ctx.db
        .query("projectTasks")
        .withIndex("by_project_and_status", (q) =>
          q.eq("projectId", project._id).eq("status", status),
        )
        .take(100)
    ).length;
    taskCount += count;
    openTaskCount += count;
  }
  const done = await ctx.db
    .query("projectTasks")
    .withIndex("by_project_and_status", (q) =>
      q.eq("projectId", project._id).eq("status", "done"),
    )
    .take(100);
  const canceled = await ctx.db
    .query("projectTasks")
    .withIndex("by_project_and_status", (q) =>
      q.eq("projectId", project._id).eq("status", "canceled"),
    )
    .take(100);
  doneTaskCount = done.length;
  taskCount += done.length + canceled.length;

  return {
    ...project,
    owner: owner
      ? {
          _id: owner._id,
          name: owner.name,
          email: owner.email,
          avatarUrl: owner.avatarUrl,
        }
      : null,
    links: {
      company: company ? { _id: company._id, name: company.name } : null,
      contact: contact ? { _id: contact._id, name: contact.name } : null,
      deal: deal ? { _id: deal._id, name: deal.name } : null,
    },
    taskCount,
    openTaskCount,
    doneTaskCount,
  };
}

export const list = authedQuery({
  args: {
    status: v.optional(v.union(projectStatus, v.literal("all"))),
    search: v.optional(v.string()),
  },
  returns: v.array(projectCard),
  handler: async (ctx, args) => {
    const statuses =
      !args.status || args.status === "all" ? PROJECT_STATUSES : [args.status];
    const rows = [];
    for (const status of statuses) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(80);
      rows.push(...projects);
    }
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? rows.filter((project) =>
          `${project.name} ${project.description ?? ""}`
            .toLowerCase()
            .includes(term),
        )
      : rows;
    const enriched = [];
    for (const project of filtered) {
      enriched.push(await enrichProject(ctx, project));
    }
    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const get = authedQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      ...projectFields,
      tasks: v.array(
        v.object({
          _id: v.id("projectTasks"),
          _creationTime: v.number(),
          title: v.string(),
          description: v.optional(v.string()),
          status: taskStatus,
          priority: taskPriority,
          projectId: v.optional(v.id("projects")),
          parentTaskId: v.optional(v.id("projectTasks")),
          assigneeId: v.optional(v.id("users")),
          companyId: v.optional(v.id("companies")),
          contactId: v.optional(v.id("contacts")),
          dealId: v.optional(v.id("deals")),
          dueAt: v.optional(v.number()),
          completedAt: v.optional(v.number()),
          position: v.number(),
          assignee: userSummary,
          subtaskCount: v.number(),
          commentCount: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (!project) return null;
    const enriched = await enrichProject(ctx, project);
    const tasks = [];
    for (const status of [
      "todo",
      "in_progress",
      "blocked",
      "backlog",
      "done",
      "canceled",
    ] as const) {
      const rows = await ctx.db
        .query("projectTasks")
        .withIndex("by_project_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", status),
        )
        .take(100);
      for (const task of rows) {
        const assignee = task.assigneeId
          ? await ctx.db.get("users", task.assigneeId)
          : null;
        const subtasks = await ctx.db
          .query("projectTasks")
          .withIndex("by_parent", (q) => q.eq("parentTaskId", task._id))
          .take(100);
        const comments = await ctx.db
          .query("taskComments")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .take(100);
        tasks.push({
          ...task,
          assignee: assignee
            ? {
                _id: assignee._id,
                name: assignee.name,
                email: assignee.email,
                avatarUrl: assignee.avatarUrl,
              }
            : null,
          subtaskCount: subtasks.length,
          commentCount: comments.length,
        });
      }
    }
    return {
      ...enriched,
      tasks: tasks.sort((a, b) => a.position - b.position),
    };
  },
});

export const create = writeMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(projectStatus),
    ownerId: v.optional(v.id("users")),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const ownerId = args.ownerId ?? (await currentUserId(ctx));
    const projectId = await ctx.db.insert("projects", {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      status: args.status ?? "active",
      ownerId,
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      startAt: args.startAt,
      dueAt: args.dueAt,
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "projects:create",
      status: "success",
      message: `Created project ${args.name.trim()}`,
    });
    return projectId;
  },
});

function parseImportProjectStatus(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().replaceAll(" ", "_");
  return PROJECT_STATUSES.includes(normalized as (typeof PROJECT_STATUSES)[number])
    ? (normalized as (typeof PROJECT_STATUSES)[number])
    : "active";
}

function parseImportDate(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function userIdByEmail(ctx: MutationCtx, email: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return undefined;
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
  return user?._id;
}

async function companyIdByName(ctx: MutationCtx, name: string | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  const company = await ctx.db
    .query("companies")
    .withIndex("by_name", (q) => q.eq("name", trimmed))
    .first();
  return company && !company.deletedAt ? company._id : undefined;
}

export const importRows = writeMutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        ownerEmail: v.optional(v.string()),
        companyName: v.optional(v.string()),
        contactName: v.optional(v.string()),
        dealName: v.optional(v.string()),
        startAt: v.optional(v.string()),
        dueAt: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const name = row.name.trim();
      if (!name) {
        skipped += 1;
        continue;
      }
      await ctx.db.insert("projects", {
        name,
        description: row.description?.trim() || undefined,
        status: parseImportProjectStatus(row.status),
        ownerId:
          (await userIdByEmail(ctx, row.ownerEmail)) ?? (await currentUserId(ctx)),
        companyId: await companyIdByName(ctx, row.companyName),
        startAt: parseImportDate(row.startAt),
        dueAt: parseImportDate(row.dueAt),
        completedAt:
          parseImportProjectStatus(row.status) === "completed"
            ? Date.now()
            : undefined,
      });
      created += 1;
    }

    await logEvent(ctx, {
      kind: "M",
      fn: "projects:importRows",
      status: "success",
      message: `Imported projects: ${created} created, ${skipped} skipped`,
    });
    return { created, updated: 0, skipped };
  },
});

export const update = writeMutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(projectStatus),
    ownerId: v.optional(v.id("users")),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    startAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    const project = await ctx.db.get("projects", projectId);
    if (!project) throw new Error("Project not found");
    const patch: Partial<Doc<"projects">> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] =
          typeof value === "string" ? value.trim() : value;
      }
    }
    if (args.status === "completed" && !project.completedAt) {
      patch.completedAt = Date.now();
    }
    if (args.status && args.status !== "completed") {
      patch.completedAt = undefined;
    }
    await ctx.db.patch("projects", projectId, patch);
    return null;
  },
});

export const remove = writeMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (!project) return null;
    const tasks = await ctx.db
      .query("projectTasks")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "backlog"),
      )
      .take(200);
    const otherTasks = [];
    for (const status of [
      "todo",
      "in_progress",
      "blocked",
      "done",
      "canceled",
    ] as const) {
      otherTasks.push(
        ...(await ctx.db
          .query("projectTasks")
          .withIndex("by_project_and_status", (q) =>
            q.eq("projectId", args.projectId).eq("status", status),
          )
          .take(200)),
      );
    }
    for (const task of [...tasks, ...otherTasks]) {
      const comments = await ctx.db
        .query("taskComments")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .take(200);
      for (const comment of comments) {
        await ctx.db.delete("taskComments", comment._id);
      }
      await ctx.db.delete("projectTasks", task._id);
    }
    await ctx.db.delete("projects", args.projectId);
    await logEvent(ctx, {
      kind: "M",
      fn: "projects:remove",
      status: "success",
      message: `Deleted project ${project.name}`,
    });
    return null;
  },
});
