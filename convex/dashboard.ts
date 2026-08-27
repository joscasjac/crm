import { v } from "convex/values";
import { authedQuery } from "./model/functions";
import { dealsByStage } from "./aggregates";
import { STAGES } from "./deals";

// Pipeline rollups come from the aggregate component: O(log n) per stage,
// no table scan, and reactive like everything else.
export const summary = authedQuery({
  args: {},
  returns: v.object({
    pipelineByStage: v.array(
      v.object({
        stage: v.string(),
        totalMinor: v.number(),
        count: v.number(),
      }),
    ),
    openPipelineMinor: v.number(),
    openDealCount: v.number(),
    wonMinor: v.number(),
    companyCount: v.number(),
    contactCount: v.number(),
    projectCount: v.number(),
    openTaskCount: v.number(),
    overdueTaskCount: v.number(),
  }),
  handler: async (ctx) => {
    const pipelineByStage = [];
    let openPipelineMinor = 0;
    let openDealCount = 0;
    let wonMinor = 0;
    for (const stage of STAGES) {
      const totalMinor = await dealsByStage.sum(ctx, { namespace: stage });
      const count = await dealsByStage.count(ctx, { namespace: stage });
      pipelineByStage.push({ stage, totalMinor, count });
      if (stage === "CLOSED_WON") {
        wonMinor = totalMinor;
      } else if (stage !== "CLOSED_LOST") {
        openPipelineMinor += totalMinor;
        openDealCount += count;
      }
    }
    // Small tables at demo scale; a large install would use aggregates here
    // too.
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_deletedAt_and_name", (q) => q.eq("deletedAt", undefined))
      .take(200);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .take(200);
    const activeProjects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);
    const openTasks = [];
    for (const status of [
      "backlog",
      "todo",
      "in_progress",
      "blocked",
    ] as const) {
      openTasks.push(
        ...(await ctx.db
          .query("projectTasks")
          .withIndex("by_status_and_dueAt", (q) => q.eq("status", status))
          .take(200)),
      );
    }
    return {
      pipelineByStage,
      openPipelineMinor,
      openDealCount,
      wonMinor,
      companyCount: companies.length,
      contactCount: contacts.length,
      projectCount: activeProjects.length,
      openTaskCount: openTasks.length,
      overdueTaskCount: openTasks.filter(
        (task) => task.dueAt !== undefined && task.dueAt < Date.now(),
      ).length,
    };
  },
});

// Recent activity across the workspace for the dashboard feed.
export const recentActivity = authedQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("activities").order("desc").take(12);
    const result = [];
    for (const row of rows) {
      const company = row.companyId ? await ctx.db.get("companies", row.companyId) : null;
      const author = row.authorId ? await ctx.db.get("users", row.authorId) : null;
      result.push({
        ...row,
        company: company
          ? { _id: company._id, name: company.name, logoUrl: company.logoUrl }
          : null,
        author: author
          ? { name: author.name, avatarUrl: author.avatarUrl }
          : null,
      });
    }
    return result;
  },
});
