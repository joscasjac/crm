import { ActionCache } from "@convex-dev/action-cache";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { ContextDev } from "@context-dot-dev/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const MINUTE = 60 * 1000;

const contextDev = new ContextDev(components.contextDev);

// The research budget. Enrichment is metered so a runaway loop cannot spend
// the vendor quota.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  enrichment: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },
});

// A distilled brand payload. Context.dev responses are large; we keep only
// what the CRM writes to the record.
type BrandSummary = {
  name: string | null;
  industry: string | null;
  description: string | null;
  logoUrl: string | null;
};

// The raw vendor call, cached for seven days. Same domain twice costs one
// API call. This replaces the upstream Redis cache.
export const fetchBrand = internalAction({
  args: { domain: v.string() },
  handler: async (ctx, args): Promise<BrandSummary> => {
    const brand = (await contextDev.retrieveBrand(ctx, {
      params: { domain: args.domain },
    })) as Record<string, unknown>;
    return summarizeBrand(brand);
  },
});

const brandCache = new ActionCache(components.actionCache, {
  action: internal.enrichment.fetchBrand,
  name: "brand-v1",
  ttl: 7 * 24 * 60 * MINUTE,
});

// Pull the fields the CRM cares about out of a loosely shaped vendor payload.
function summarizeBrand(brand: Record<string, unknown>): BrandSummary {
  const str = (value: unknown): string | null =>
    typeof value === "string" && value.length > 0 ? value : null;

  let logoUrl: string | null = null;
  const logos = brand.logos;
  if (Array.isArray(logos)) {
    for (const logo of logos) {
      if (logo && typeof logo === "object") {
        const formats = (logo as Record<string, unknown>).formats;
        if (Array.isArray(formats)) {
          for (const format of formats) {
            if (format && typeof format === "object") {
              const src = (format as Record<string, unknown>).src;
              if (typeof src === "string") {
                logoUrl = src;
                break;
              }
            }
          }
        }
      }
      if (logoUrl) break;
    }
  }

  const company =
    brand.company && typeof brand.company === "object"
      ? (brand.company as Record<string, unknown>)
      : {};

  return {
    name: str(brand.name),
    industry: str(company.industry) ?? str(brand.industry),
    description: str(brand.description) ?? str(company.description),
    logoUrl,
  };
}

// Enrich one company. Called from the work queue (agentTasks.execute), never
// from the client directly.
export const enrichCompany = internalAction({
  args: {
    companyId: v.id("companies"),
    taskId: v.optional(v.id("agentTasks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.runQuery(internal.enrichment.getCompany, {
      companyId: args.companyId,
    });
    if (!company || !company.domain) {
      await finish(ctx, args, "failed", "Company has no domain to research.");
      return null;
    }

    // Every outside key is optional. The component requires the env var to
    // exist, so "unset" is the documented sentinel for a keyless install.
    // Without a real key we say so rather than shipping something that looks
    // like enrichment.
    const key = process.env.CONTEXT_DEV_API_KEY;
    if (!key || key === "unset") {
      await finish(
        ctx,
        args,
        "done",
        "Brand data key not configured on this install. Set CONTEXT_DEV_API_KEY to enable Context.dev enrichment.",
      );
      return null;
    }

    const budget = await rateLimiter.limit(ctx, "enrichment");
    if (!budget.ok) {
      await finish(
        ctx,
        args,
        "failed",
        "Research budget exhausted for this minute. The task will be retried.",
      );
      return null;
    }

    try {
      const brand = await brandCache.fetch(ctx, { domain: company.domain });
      await ctx.runMutation(internal.enrichment.writeBrand, {
        companyId: args.companyId,
        taskId: args.taskId,
        name: brand.name ?? undefined,
        industry: brand.industry ?? undefined,
        description: brand.description ?? undefined,
        logoUrl: brand.logoUrl ?? undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Brand lookup failed";
      console.error("Enrichment failed", { domain: company.domain, message });
      await finish(ctx, args, "failed", `Brand lookup failed: ${message}`);
    }
    return null;
  },
});

async function finish(
  ctx: ActionCtx,
  args: { companyId: Id<"companies">; taskId?: Id<"agentTasks"> },
  state: "done" | "failed",
  result: string,
): Promise<void> {
  await ctx.runMutation(internal.enrichment.recordOutcome, {
    companyId: args.companyId,
    taskId: args.taskId,
    state,
    result,
  });
}

export const getCompany = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get("companies", args.companyId);
  },
});

// Writes observed brand data to the record and the timeline in one
// transaction.
export const writeBrand = internalMutation({
  args: {
    companyId: v.id("companies"),
    taskId: v.optional(v.id("agentTasks")),
    name: v.optional(v.string()),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { enrichmentStatus: "ENRICHED" };
    if (args.industry) patch.industry = args.industry;
    if (args.description) patch.description = args.description;
    if (args.logoUrl) patch.logoUrl = args.logoUrl;
    await ctx.db.patch("companies", args.companyId, patch);

    const observed = [
      args.industry && `industry ${args.industry}`,
      args.logoUrl && "logo",
      args.description && "description",
    ]
      .filter(Boolean)
      .join(", ");
    await ctx.db.insert("activities", {
      type: "ENRICHMENT",
      body: `Brand data refreshed from Context.dev: ${observed || "no new fields"}.`,
      companyId: args.companyId,
    });
    if (args.industry) {
      await ctx.db.insert("facts", {
        entityType: "company",
        entityId: args.companyId,
        field: "industry",
        value: args.industry,
        evidenceKind: "context.brand-data",
        band: "CONFIRMED",
        settled: "written",
      });
    }
    if (args.taskId) {
      const task = await ctx.db.get("agentTasks", args.taskId);
      if (task && task.state === "open") {
        await ctx.db.patch("agentTasks", args.taskId, {
          state: "done",
          finishedAt: Date.now(),
          result: `Enriched: ${observed || "no new fields"}`,
          leasedUntil: undefined,
        });
      }
    }
    return null;
  },
});

export const recordOutcome = internalMutation({
  args: {
    companyId: v.id("companies"),
    taskId: v.optional(v.id("agentTasks")),
    state: v.union(v.literal("done"), v.literal("failed")),
    result: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (company && company.enrichmentStatus === "RESEARCHING") {
      await ctx.db.patch("companies", args.companyId, {
        enrichmentStatus: args.state === "done" ? "NONE" : "FAILED",
      });
    }
    if (args.taskId) {
      const task = await ctx.db.get("agentTasks", args.taskId);
      if (task && task.state === "open") {
        await ctx.db.patch("agentTasks", args.taskId, {
          state: args.state,
          finishedAt: Date.now(),
          result: args.result,
          leasedUntil: undefined,
        });
      }
    }
    return null;
  },
});
