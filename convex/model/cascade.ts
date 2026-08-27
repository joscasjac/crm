import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { trackDealDelete } from "../aggregates";

// Cascades are code. Convex has no onDelete: Cascade, so each parent table
// gets one idempotent function that walks children by index and deletes them.

export async function deleteFieldValuesFor(
  ctx: MutationCtx,
  entityId: string,
): Promise<void> {
  const values = await ctx.db
    .query("fieldValues")
    .withIndex("by_entityId", (q) => q.eq("entityId", entityId))
    .collect();
  for (const value of values) {
    await ctx.db.delete("fieldValues", value._id);
  }
}

export async function deleteFactsFor(
  ctx: MutationCtx,
  entityId: string,
): Promise<void> {
  const facts = await ctx.db
    .query("facts")
    .withIndex("by_entityId", (q) => q.eq("entityId", entityId))
    .collect();
  for (const fact of facts) {
    await ctx.db.delete("facts", fact._id);
  }
}

export async function deleteDealCascade(
  ctx: MutationCtx,
  dealId: Id<"deals">,
): Promise<void> {
  const deal = await ctx.db.get("deals", dealId);
  if (!deal) return;
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_deal", (q) => q.eq("dealId", dealId))
    .collect();
  for (const activity of activities) {
    await ctx.db.delete("activities", activity._id);
  }
  await deleteFieldValuesFor(ctx, dealId);
  await deleteFactsFor(ctx, dealId);
  await trackDealDelete(ctx, deal);
  await ctx.db.delete("deals", dealId);
}

export async function deleteContactCascade(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
): Promise<void> {
  const contact = await ctx.db.get("contacts", contactId);
  if (!contact) return;
  const companies = await ctx.db
    .query("companies")
    .withIndex("by_primaryContactId", (q) => q.eq("primaryContactId", contactId))
    .collect();
  for (const company of companies) {
    await ctx.db.patch("companies", company._id, {
      primaryContactId: undefined,
    });
  }
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_primaryContactId", (q) => q.eq("primaryContactId", contactId))
    .collect();
  for (const deal of deals) {
    await ctx.db.patch("deals", deal._id, {
      primaryContactId: undefined,
    });
  }
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const activity of activities) {
    await ctx.db.delete("activities", activity._id);
  }
  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const task of tasks) {
    await ctx.db.delete("agentTasks", task._id);
  }
  await deleteFieldValuesFor(ctx, contactId);
  await deleteFactsFor(ctx, contactId);
  await ctx.db.delete("contacts", contactId);
}

export async function deleteCompanyCascade(
  ctx: MutationCtx,
  companyId: Id<"companies">,
): Promise<void> {
  const company = await ctx.db.get("companies", companyId);
  if (!company) return;

  const deals = await ctx.db
    .query("deals")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const deal of deals) {
    await deleteDealCascade(ctx, deal._id);
  }

  // Contacts are unassigned, not deleted, matching upstream behaviour.
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const contact of contacts) {
    await ctx.db.patch("contacts", contact._id, { companyId: undefined });
  }

  const activities = await ctx.db
    .query("activities")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const activity of activities) {
    await ctx.db.delete("activities", activity._id);
  }

  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const task of tasks) {
    await ctx.db.delete("agentTasks", task._id);
  }

  const runs = await ctx.db
    .query("agentRuns")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const run of runs) {
    await ctx.db.delete("agentRuns", run._id);
  }

  const threads = await ctx.db
    .query("chatThreads")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();
  for (const thread of threads) {
    await ctx.db.delete("chatThreads", thread._id);
  }

  await deleteFieldValuesFor(ctx, companyId);
  await deleteFactsFor(ctx, companyId);
  await ctx.db.delete("companies", companyId);
}
