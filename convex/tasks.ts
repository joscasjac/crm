import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { logEvent } from "./logs";
import { currentUserId } from "./model/access";
import { authedQuery, writeMutation } from "./model/functions";
import { projectStatus, taskPriority, taskStatus } from "./schema";

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "done",
  "canceled",
] as const;

const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const ACTIVE_STATUSES = [
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

const projectSummary = v.union(
  v.object({
    _id: v.id("projects"),
    name: v.string(),
    status: projectStatus,
  }),
  v.null(),
);

const linkSummary = v.object({
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

const taskFields = {
  _id: v.id("projectTasks"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  status: taskStatus,
  priority: taskPriority,
  projectId: v.optional(v.id("projects")),
  parentTaskId: v.optional(v.id("projectTasks")),
  assigneeId: v.optional(v.id("users")),
  assigneeIds: v.optional(v.array(v.id("users"))),
  companyId: v.optional(v.id("companies")),
  contactId: v.optional(v.id("contacts")),
  dealId: v.optional(v.id("deals")),
  dueAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  position: v.number(),
};

const taskCard = v.object({
  ...taskFields,
  assignee: userSummary,
  assignees: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
    }),
  ),
  project: projectSummary,
  links: linkSummary,
  subtaskCount: v.number(),
  openSubtaskCount: v.number(),
  commentCount: v.number(),
});

async function enrichTask(ctx: QueryCtx | MutationCtx, task: Doc<"projectTasks">) {
  const assigneeIds = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);
  const assignees = [];
  for (const assigneeId of assigneeIds) {
    const user = await ctx.db.get("users", assigneeId);
    if (user) {
      assignees.push({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    }
  }
  const assignee = assignees[0] ?? null;
  const project = task.projectId
    ? await ctx.db.get("projects", task.projectId)
    : null;
  const company = task.companyId
    ? await ctx.db.get("companies", task.companyId)
    : null;
  const contact = task.contactId
    ? await ctx.db.get("contacts", task.contactId)
    : null;
  const deal = task.dealId ? await ctx.db.get("deals", task.dealId) : null;
  const subtasks = await ctx.db
    .query("projectTasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", task._id))
    .take(100);
  const comments = await ctx.db
    .query("taskComments")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .take(100);

  return {
    ...task,
    assignee: assignee
      ? assignee
      : null,
    assignees,
    project: project
      ? { _id: project._id, name: project.name, status: project.status }
      : null,
    links: {
      company: company ? { _id: company._id, name: company.name } : null,
      contact: contact ? { _id: contact._id, name: contact.name } : null,
      deal: deal ? { _id: deal._id, name: deal.name } : null,
    },
    subtaskCount: subtasks.length,
    openSubtaskCount: subtasks.filter(
      (row) => row.status !== "done" && row.status !== "canceled",
    ).length,
    commentCount: comments.length,
  };
}

async function tasksByStatuses(
  ctx: QueryCtx,
  statuses: ReadonlyArray<(typeof TASK_STATUSES)[number]>,
) {
  const rows = [];
  for (const status of statuses) {
    const tasks = await ctx.db
      .query("projectTasks")
      .withIndex("by_status_and_dueAt", (q) => q.eq("status", status))
      .order("asc")
      .take(100);
    rows.push(...tasks);
  }
  return rows;
}

export const overview = authedQuery({
  args: {},
  returns: v.object({
    totalOpen: v.number(),
    overdue: v.number(),
    dueToday: v.number(),
    blocked: v.number(),
    completed: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const active = await tasksByStatuses(ctx, ACTIVE_STATUSES);
    const completed = await ctx.db
      .query("projectTasks")
      .withIndex("by_status_and_dueAt", (q) => q.eq("status", "done"))
      .order("desc")
      .take(100);
    return {
      totalOpen: active.length,
      overdue: active.filter((task) => task.dueAt !== undefined && task.dueAt < now)
        .length,
      dueToday: active.filter(
        (task) =>
          task.dueAt !== undefined &&
          task.dueAt >= start.getTime() &&
          task.dueAt < end.getTime(),
      ).length,
      blocked: active.filter((task) => task.status === "blocked").length,
      completed: completed.length,
    };
  },
});

export const list = authedQuery({
  args: {
    status: v.optional(v.union(taskStatus, v.literal("all"), v.literal("open"))),
    search: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.array(taskCard),
  handler: async (ctx, args) => {
    const statuses =
      args.status === "open"
        ? ACTIVE_STATUSES
        : !args.status || args.status === "all"
          ? TASK_STATUSES
          : [args.status];
    let rows = [];
    if (args.projectId) {
      for (const status of statuses) {
        rows.push(
          ...(await ctx.db
            .query("projectTasks")
            .withIndex("by_project_and_status", (q) =>
              q.eq("projectId", args.projectId).eq("status", status),
            )
            .order("asc")
            .take(100)),
        );
      }
    } else {
      rows = await tasksByStatuses(ctx, statuses);
    }
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? rows.filter((task) =>
          `${task.title} ${task.description ?? ""}`.toLowerCase().includes(term),
        )
      : rows;
    const enriched = [];
    for (const task of filtered) {
      enriched.push(await enrichTask(ctx, task));
    }
    return enriched.sort((a, b) => {
      const ad = a.dueAt ?? Number.MAX_SAFE_INTEGER;
      const bd = b.dueAt ?? Number.MAX_SAFE_INTEGER;
      return ad === bd ? b._creationTime - a._creationTime : ad - bd;
    });
  },
});

export const board = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      status: taskStatus,
      tasks: v.array(taskCard),
    }),
  ),
  handler: async (ctx) => {
    const columns = [];
    for (const status of TASK_STATUSES) {
      const rows = await ctx.db
        .query("projectTasks")
        .withIndex("by_status_and_dueAt", (q) => q.eq("status", status))
        .order("asc")
        .take(100);
      const tasks = [];
      for (const task of rows) tasks.push(await enrichTask(ctx, task));
      columns.push({ status, tasks });
    }
    return columns;
  },
});

export const calendar = authedQuery({
  args: {
    startAt: v.number(),
    endAt: v.number(),
  },
  returns: v.array(taskCard),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("projectTasks")
      .withIndex("by_dueAt", (q) =>
        q.gte("dueAt", args.startAt).lt("dueAt", args.endAt),
      )
      .take(200);
    const active = rows.filter(
      (task) => task.status !== "done" && task.status !== "canceled",
    );
    const enriched = [];
    for (const task of active) enriched.push(await enrichTask(ctx, task));
    return enriched;
  },
});

export const get = authedQuery({
  args: { taskId: v.id("projectTasks") },
  returns: v.union(
    v.object({
      ...taskFields,
      assignee: userSummary,
      assignees: v.array(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          email: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
      ),
      project: projectSummary,
      links: linkSummary,
      subtaskCount: v.number(),
      openSubtaskCount: v.number(),
      commentCount: v.number(),
      subtasks: v.array(taskCard),
      comments: v.array(
        v.object({
          _id: v.id("taskComments"),
          _creationTime: v.number(),
          taskId: v.id("projectTasks"),
          authorId: v.optional(v.id("users")),
          body: v.string(),
          author: userSummary,
        }),
      ),
      attachments: v.array(
        v.object({
          _id: v.id("taskAttachments"),
          _creationTime: v.number(),
          taskId: v.id("projectTasks"),
          storageId: v.id("_storage"),
          name: v.string(),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
          uploadedById: v.optional(v.id("users")),
          uploadedAt: v.number(),
          url: v.union(v.string(), v.null()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("projectTasks", args.taskId);
    if (!task) return null;
    const enriched = await enrichTask(ctx, task);
    const subtaskRows = await ctx.db
      .query("projectTasks")
      .withIndex("by_parent", (q) => q.eq("parentTaskId", args.taskId))
      .order("asc")
      .take(100);
    const subtasks = [];
    for (const subtask of subtaskRows) subtasks.push(await enrichTask(ctx, subtask));
    const commentRows = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .take(100);
    const comments = [];
    for (const comment of commentRows) {
      const author = comment.authorId
        ? await ctx.db.get("users", comment.authorId)
        : null;
      comments.push({
        ...comment,
        author: author
          ? {
              _id: author._id,
              name: author.name,
              email: author.email,
              avatarUrl: author.avatarUrl,
            }
          : null,
      });
    }
    const attachmentRows = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .take(100);
    const attachments = [];
    for (const attachment of attachmentRows) {
      attachments.push({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      });
    }
    return { ...enriched, subtasks, comments, attachments };
  },
});

export const generateUploadUrl = writeMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = writeMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(taskStatus),
    priority: v.optional(taskPriority),
    projectId: v.optional(v.id("projects")),
    parentTaskId: v.optional(v.id("projectTasks")),
    assigneeId: v.optional(v.id("users")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("projectTasks"),
  handler: async (ctx, args) => {
    const fallbackAssigneeId = args.assigneeId ?? (await currentUserId(ctx));
    const assigneeIds =
      args.assigneeIds ??
      (fallbackAssigneeId ? [fallbackAssigneeId] : undefined);
    const taskId = await ctx.db.insert("projectTasks", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      status: args.status ?? "todo",
      priority: args.priority ?? "medium",
      projectId: args.projectId,
      parentTaskId: args.parentTaskId,
      assigneeId: assigneeIds?.[0],
      assigneeIds,
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      dueAt: args.dueAt,
      completedAt: args.status === "done" ? Date.now() : undefined,
      position: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "tasks:create",
      status: "success",
      message: `Created task ${args.title.trim()}`,
    });
    return taskId;
  },
});

function parseImportTaskStatus(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().replaceAll(" ", "_");
  return TASK_STATUSES.includes(normalized as (typeof TASK_STATUSES)[number])
    ? (normalized as (typeof TASK_STATUSES)[number])
    : "todo";
}

function parseImportTaskPriority(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return TASK_PRIORITIES.includes(normalized as (typeof TASK_PRIORITIES)[number])
    ? (normalized as (typeof TASK_PRIORITIES)[number])
    : "medium";
}

function parseImportDate(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function userIdsByEmails(ctx: MutationCtx, emails: string | undefined) {
  const parts =
    emails
      ?.split(/[;,]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const ids = [];
  for (const email of parts) {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (user) ids.push(user._id);
  }
  return ids;
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
        title: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        projectName: v.optional(v.string()),
        assigneeEmails: v.optional(v.string()),
        companyName: v.optional(v.string()),
        contactName: v.optional(v.string()),
        dealName: v.optional(v.string()),
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
      const title = row.title.trim();
      if (!title) {
        skipped += 1;
        continue;
      }
      const assigneeIds = await userIdsByEmails(ctx, row.assigneeEmails);
      const fallbackAssigneeId =
        assigneeIds.length > 0 ? assigneeIds[0] : await currentUserId(ctx);
      const allAssigneeIds =
        assigneeIds.length > 0
          ? assigneeIds
          : fallbackAssigneeId
            ? [fallbackAssigneeId]
            : undefined;
      const status = parseImportTaskStatus(row.status);
      await ctx.db.insert("projectTasks", {
        title,
        description: row.description?.trim() || undefined,
        status,
        priority: parseImportTaskPriority(row.priority),
        assigneeId: allAssigneeIds?.[0],
        assigneeIds: allAssigneeIds,
        companyId: await companyIdByName(ctx, row.companyName),
        dueAt: parseImportDate(row.dueAt),
        completedAt: status === "done" ? Date.now() : undefined,
        position: Date.now(),
      });
      created += 1;
    }

    await logEvent(ctx, {
      kind: "M",
      fn: "tasks:importRows",
      status: "success",
      message: `Imported tasks: ${created} created, ${skipped} skipped`,
    });
    return { created, updated: 0, skipped };
  },
});

export const update = writeMutation({
  args: {
    taskId: v.id("projectTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(taskStatus),
    priority: v.optional(taskPriority),
    projectId: v.optional(v.id("projects")),
    parentTaskId: v.optional(v.id("projectTasks")),
    assigneeId: v.optional(v.id("users")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    const task = await ctx.db.get("projectTasks", taskId);
    if (!task) throw new Error("Task not found");
    const patch: Partial<Doc<"projectTasks">> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] =
          typeof value === "string" ? value.trim() : value;
      }
    }
    if (args.assigneeIds !== undefined) {
      patch.assigneeId = args.assigneeIds[0];
      patch.assigneeIds = args.assigneeIds.length > 0 ? args.assigneeIds : undefined;
    } else if (args.assigneeId !== undefined) {
      patch.assigneeIds = args.assigneeId ? [args.assigneeId] : undefined;
    }
    if (args.status === "done" && !task.completedAt) patch.completedAt = Date.now();
    if (args.status && args.status !== "done") patch.completedAt = undefined;
    await ctx.db.patch("projectTasks", taskId, patch);
    return null;
  },
});

export const move = writeMutation({
  args: {
    taskId: v.id("projectTasks"),
    status: taskStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("projectTasks", args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch("projectTasks", args.taskId, {
      status: args.status,
      completedAt: args.status === "done" ? Date.now() : undefined,
      position: Date.now(),
    });
    return null;
  },
});

export const remove = writeMutation({
  args: { taskId: v.id("projectTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("projectTasks", args.taskId);
    if (!task) return null;
    const subtasks = await ctx.db
      .query("projectTasks")
      .withIndex("by_parent", (q) => q.eq("parentTaskId", args.taskId))
      .take(200);
    for (const subtask of subtasks) {
      const comments = await ctx.db
        .query("taskComments")
        .withIndex("by_task", (q) => q.eq("taskId", subtask._id))
        .take(200);
      for (const comment of comments) {
        await ctx.db.delete("taskComments", comment._id);
      }
      const attachments = await ctx.db
        .query("taskAttachments")
        .withIndex("by_task", (q) => q.eq("taskId", subtask._id))
        .take(200);
      for (const attachment of attachments) {
        await ctx.db.delete("taskAttachments", attachment._id);
      }
      await ctx.db.delete("projectTasks", subtask._id);
    }
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(200);
    for (const comment of comments) {
      await ctx.db.delete("taskComments", comment._id);
    }
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(200);
    for (const attachment of attachments) {
      await ctx.db.delete("taskAttachments", attachment._id);
    }
    await ctx.db.delete("projectTasks", args.taskId);
    await logEvent(ctx, {
      kind: "M",
      fn: "tasks:remove",
      status: "success",
      message: `Deleted task ${task.title}`,
    });
    return null;
  },
});

export const addComment = writeMutation({
  args: {
    taskId: v.id("projectTasks"),
    body: v.string(),
  },
  returns: v.id("taskComments"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("projectTasks", args.taskId);
    if (!task) throw new Error("Task not found");
    const authorId = await currentUserId(ctx);
    return await ctx.db.insert("taskComments", {
      taskId: args.taskId,
      authorId,
      body: args.body.trim(),
    });
  },
});

export const addAttachment = writeMutation({
  args: {
    taskId: v.id("projectTasks"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  returns: v.id("taskAttachments"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("projectTasks", args.taskId);
    if (!task) throw new Error("Task not found");
    return await ctx.db.insert("taskAttachments", {
      taskId: args.taskId,
      storageId: args.storageId,
      name: args.name.trim() || "Untitled file",
      contentType: args.contentType,
      size: args.size,
      uploadedById: await currentUserId(ctx),
      uploadedAt: Date.now(),
    });
  },
});

export const removeAttachment = writeMutation({
  args: { attachmentId: v.id("taskAttachments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("taskAttachments", args.attachmentId);
    return null;
  },
});
