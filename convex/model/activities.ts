import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logEvent } from "../logs";

// Shared timeline write used by activities.create and the Ask slash
// commands, so a note or task behaves the same no matter where it came from:
// one activities row, a logEvents row, and an optional email reminder.

export type NewActivity = {
  type: Doc<"activities">["type"];
  body: string;
  companyId?: Id<"companies">;
  contactId?: Id<"contacts">;
  dealId?: Id<"deals">;
  dueAt?: number;
  remindMe?: boolean;
};

export const clip = (text: string, max = 80): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

// The email a reminder goes to: the workspace owner, or the first seeded
// user. With Convex Auth wired this becomes the signed-in user.
async function ownerEmail(ctx: MutationCtx): Promise<string | null> {
  const users = await ctx.db.query("users").take(10);
  const owner = users.find((user) => user.role === "owner") ?? users[0];
  return owner?.email ?? null;
}

export async function insertActivity(
  ctx: MutationCtx,
  args: NewActivity,
): Promise<{
  id: Id<"activities">;
  recordName: string | null;
  reminderScheduled: boolean;
}> {
  const { remindMe, ...row } = args;
  if (row.body.trim().length === 0) {
    throw new Error("Write something first");
  }
  const id = await ctx.db.insert("activities", row);
  let recordName: string | null = null;
  if (args.companyId) {
    const company = await ctx.db.get("companies", args.companyId);
    recordName = company?.name ?? null;
    await ctx.db.patch("companies", args.companyId, {
      lastActivityAt: Date.now(),
    });
  }
  if (args.contactId) {
    const contact = await ctx.db.get("contacts", args.contactId);
    recordName = recordName ?? contact?.name ?? null;
    await ctx.db.patch("contacts", args.contactId, {
      lastActivityAt: Date.now(),
    });
  }
  if (args.dealId) {
    const deal = await ctx.db.get("deals", args.dealId);
    recordName = recordName ?? deal?.name ?? null;
  }
  await logEvent(ctx, {
    kind: "M",
    fn: "activities:create",
    status: "success",
    message: `${args.type} on ${recordName ?? "the workspace"}: ${clip(row.body)}`,
  });

  // Tasks can ask for an email reminder at the due time. The send routes
  // through the selected provider; when none is configured it logs a skip.
  let reminderScheduled = false;
  if (remindMe && args.type === "TASK") {
    const to = await ownerEmail(ctx);
    if (to) {
      await ctx.scheduler.runAt(
        args.dueAt ?? Date.now(),
        internal.email.sendNotification,
        {
          to,
          subject: `Task reminder: ${clip(row.body, 60)}`,
          body: [
            `A task you set is due: ${row.body}`,
            recordName ? `Record: ${recordName}` : null,
            "Sent by your CRM on Convex.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      );
      reminderScheduled = true;
    }
  }
  return { id, recordName, reminderScheduled };
}
