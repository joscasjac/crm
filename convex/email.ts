import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

// The Resend component is wired in but intentionally unconfigured on the
// demo. The landing page and settings screen both say so. Set RESEND_API_KEY
// on the deployment to turn it on; nothing else changes.
const resend = new Resend(components.resend, {
  testMode: true,
});

export const emailConfigured = (): boolean => !!process.env.RESEND_API_KEY;

// Send a plain notification email. Called by agents when email is configured;
// records a no-op result when it is not.
export const sendNotification = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!emailConfigured()) {
      console.log(
        `Email not configured on this deployment. Would have sent "${args.subject}" to ${args.to}.`,
      );
      return null;
    }
    const id = await resend.sendEmail(ctx, {
      from: "CRM Agent <crm@updates.example.com>",
      to: args.to,
      subject: args.subject,
      text: args.body,
    });
    return id;
  },
});
