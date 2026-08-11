import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// Pipeline value by stage. Namespaced so a dashboard read is O(log n) per
// stage instead of a table scan. Namespaces here must stay a small fixed set:
// the aggregate component never deletes a namespace, and clearAll schedules
// one deletion job per namespace, so an unbounded namespace (like user ids
// reminted by the demo reseed) eventually trips the 1000 scheduled function
// limit and kills the mutation. That is why there is no dealsByOwner.
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

// Call these from every deal mutation so the rollups never drift.
export async function trackDealInsert(ctx: MutationCtx, doc: Doc<"deals">) {
  await dealsByStage.insert(ctx, doc);
}

export async function trackDealReplace(
  ctx: MutationCtx,
  oldDoc: Doc<"deals">,
  newDoc: Doc<"deals">,
) {
  await dealsByStage.replace(ctx, oldDoc, newDoc);
}

export async function trackDealDelete(ctx: MutationCtx, doc: Doc<"deals">) {
  await dealsByStage.delete(ctx, doc);
}
