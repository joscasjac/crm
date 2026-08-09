import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// Pipeline value by stage. Namespaced so a dashboard read is O(log n) per
// stage instead of a table scan.
export const dealsByStage = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "deals";
}>(components.dealsByStage, {
  namespace: (doc) => doc.stage,
  sortKey: (doc) => doc._creationTime,
  sumValue: (doc) => doc.amountMinor,
});

// Open deal counts and value by owner.
export const dealsByOwner = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "deals";
}>(components.dealsByOwner, {
  namespace: (doc) => doc.ownerId ?? "unassigned",
  sortKey: (doc) => doc._creationTime,
  sumValue: (doc) => doc.amountMinor,
});

// Call these from every deal mutation so the rollups never drift.
export async function trackDealInsert(ctx: MutationCtx, doc: Doc<"deals">) {
  await dealsByStage.insert(ctx, doc);
  await dealsByOwner.insert(ctx, doc);
}

export async function trackDealReplace(
  ctx: MutationCtx,
  oldDoc: Doc<"deals">,
  newDoc: Doc<"deals">,
) {
  await dealsByStage.replace(ctx, oldDoc, newDoc);
  await dealsByOwner.replace(ctx, oldDoc, newDoc);
}

export async function trackDealDelete(ctx: MutationCtx, doc: Doc<"deals">) {
  await dealsByStage.delete(ctx, doc);
  await dealsByOwner.delete(ctx, doc);
}
