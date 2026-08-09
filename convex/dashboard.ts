import { v } from "convex/values";
import { query } from "./_generated/server";
import { dealsByStage } from "./aggregates";
import { STAGES } from "./deals";

// Pipeline rollups come from the aggregate component: O(log n) per stage,
// no table scan, and reactive like everything else.
export const summary = query({
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
    const companies = await ctx.db.query("companies").collect();
    const contacts = await ctx.db.query("contacts").collect();
    return {
      pipelineByStage,
      openPipelineMinor,
      openDealCount,
      wonMinor,
      companyCount: companies.length,
      contactCount: contacts.length,
    };
  },
});

// Recent activity across the workspace for the dashboard feed.
export const recentActivity = query({
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
