import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { trackDealReplace } from "../aggregates";
import { logEvent } from "../logs";
import { notifySlack } from "../slack";

// Shared stage-change write used by deals.changeStage (the UI) and the
// Slack /crm bot, so a stage move behaves the same no matter where it came
// from: patch, aggregate update, STAGE_CHANGE activity, log entry, and the
// Slack notification. The actor label makes bot moves read naturally on the
// Activity page next to UI moves.
export async function changeDealStage(
  ctx: MutationCtx,
  dealId: Id<"deals">,
  stage: Doc<"deals">["stage"],
  actor?: string,
): Promise<string> {
  const oldDoc = await ctx.db.get("deals", dealId);
  if (!oldDoc) throw new Error("Deal not found");
  if (oldDoc.stage === stage) {
    return `${oldDoc.name} is already in ${stage}`;
  }

  const closed = stage === "CLOSED_WON" || stage === "CLOSED_LOST";
  await ctx.db.patch("deals", dealId, {
    stage,
    closedAt: closed ? Date.now() : undefined,
  });
  const newDoc = await ctx.db.get("deals", dealId);
  if (newDoc) await trackDealReplace(ctx, oldDoc, newDoc);

  await ctx.db.insert("activities", {
    type: "STAGE_CHANGE",
    body: `Moved from ${oldDoc.stage} to ${stage}${actor ? ` by ${actor}` : ""}`,
    companyId: oldDoc.companyId,
    dealId,
    meta: { fromStage: oldDoc.stage, toStage: stage },
  });
  await ctx.db.patch("companies", oldDoc.companyId, {
    lastActivityAt: Date.now(),
  });
  const summary = `${oldDoc.name}: ${oldDoc.stage} → ${stage}${actor ? ` (${actor})` : ""}`;
  await logEvent(ctx, {
    kind: "M",
    fn: "deals:changeStage",
    status: "success",
    message: summary,
  });
  await notifySlack(
    ctx,
    "deals",
    `Deal stage: ${summary}`,
    "/app/deals",
  );
  return summary;
}
