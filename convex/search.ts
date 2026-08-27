import { v } from "convex/values";
import { authedQuery } from "./model/functions";

type Result = {
  type: "company" | "contact" | "deal" | "project" | "task";
  id: string;
  label: string;
  sublabel: string;
};

// Command-K search. Full text search indexes on names carry the load at any
// scale; a small bounded scan backs them up for domain and email matches,
// which the name indexes cannot see.
export const global = authedQuery({
  args: { q: v.string() },
  returns: v.array(
    v.object({
      type: v.union(
        v.literal("company"),
        v.literal("contact"),
        v.literal("deal"),
        v.literal("project"),
        v.literal("task"),
      ),
      id: v.string(),
      label: v.string(),
      sublabel: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const term = args.q.trim().toLowerCase();
    if (term.length === 0) return [];
    const results: Array<Result> = [];
    const seen = new Set<string>();
    const push = (row: Result) => {
      if (seen.has(row.id)) return;
      seen.add(row.id);
      results.push(row);
    };

    const companyRow = (company: {
      _id: string;
      name: string;
      domain?: string;
      industry?: string;
    }): Result => ({
      type: "company",
      id: company._id,
      label: company.name,
      sublabel: company.domain ?? company.industry ?? "Company",
    });
    const contactRow = (contact: {
      _id: string;
      name: string;
      title?: string;
      email?: string;
    }): Result => ({
      type: "contact",
      id: contact._id,
      label: contact.name,
      sublabel: contact.title ?? contact.email ?? "Contact",
    });
    const dealRow = (deal: {
      _id: string;
      name: string;
      stage: string;
      amountMinor: number;
      currency: string;
    }): Result => ({
      type: "deal",
      id: deal._id,
      label: deal.name,
      sublabel: `${deal.stage.replace("_", " ").toLowerCase()} · ${(deal.amountMinor / 100).toLocaleString()} ${deal.currency}`,
    });
    const projectRow = (project: {
      _id: string;
      name: string;
      status: string;
    }): Result => ({
      type: "project",
      id: project._id,
      label: project.name,
      sublabel: `Project · ${project.status.replace("_", " ")}`,
    });
    const taskRow = (task: {
      _id: string;
      title: string;
      status: string;
      priority: string;
    }): Result => ({
      type: "task",
      id: task._id,
      label: task.title,
      sublabel: `${task.status.replace("_", " ")} · ${task.priority}`,
    });

    // Indexed name search first: prefix-matches words, scales with the data.
    const companyHits = await ctx.db
      .query("companies")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(6);
    for (const company of companyHits) {
      if (!company.deletedAt) push(companyRow(company));
    }

    const contactHits = await ctx.db
      .query("contacts")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(6);
    for (const contact of contactHits) {
      if (!contact.deletedAt) push(contactRow(contact));
    }

    const dealHits = await ctx.db
      .query("deals")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(6);
    for (const deal of dealHits) {
      if (!deal.deletedAt) push(dealRow(deal));
    }

    const projectHits = await ctx.db
      .query("projects")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(6);
    for (const project of projectHits) push(projectRow(project));

    const taskHits = await ctx.db
      .query("projectTasks")
      .withSearchIndex("search_title", (q) => q.search("title", term))
      .take(6);
    for (const task of taskHits) push(taskRow(task));

    // Bounded fallback scan for substrings, domains, and emails.
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_deletedAt_and_name", (q) => q.eq("deletedAt", undefined))
      .take(200);
    for (const company of companies) {
      if (
        company.name.toLowerCase().includes(term) ||
        (company.domain ?? "").toLowerCase().includes(term)
      ) {
        push(companyRow(company));
      }
    }
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .take(200);
    for (const contact of contacts) {
      if (
        contact.name.toLowerCase().includes(term) ||
        (contact.email ?? "").toLowerCase().includes(term)
      ) {
        push(contactRow(contact));
      }
    }
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .take(200);
    for (const deal of deals) {
      if (deal.name.toLowerCase().includes(term)) push(dealRow(deal));
    }
    for (const status of [
      "planned",
      "active",
      "on_hold",
      "completed",
      "archived",
    ] as const) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(80);
      for (const project of projects) {
        if (project.name.toLowerCase().includes(term)) {
          push(projectRow(project));
        }
      }
    }
    for (const status of [
      "backlog",
      "todo",
      "in_progress",
      "blocked",
      "done",
      "canceled",
    ] as const) {
      const tasks = await ctx.db
        .query("projectTasks")
        .withIndex("by_status_and_dueAt", (q) => q.eq("status", status))
        .take(80);
      for (const task of tasks) {
        if (task.title.toLowerCase().includes(term)) push(taskRow(task));
      }
    }

    return results.slice(0, 12);
  },
});
