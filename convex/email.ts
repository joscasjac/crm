import { AgentMail } from "@agentmail/convex";
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { insertActivity, clip } from "./model/activities";
import { writeMutation } from "./model/functions";

// Two email providers, both installed, doing different jobs.
//
// Resend sends outbound notifications. AgentMail gives agents a persistent
// inbox: it can send too, and it can receive, with threads and labels synced
// into Convex tables. The workspace emailProvider setting picks which one
// carries notifications; receiving is AgentMail-only and turns on whenever
// its key and webhook are configured.
//
// Neither is configured on the demo. The landing page and settings screen
// both say so.
const resend = new Resend(components.resend, {
  testMode: true,
});

const agentmail = new AgentMail(components.agentmail);

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

export const resendConfigured = (): boolean =>
  realKey(process.env.RESEND_API_KEY);

// AgentMail needs a key for the component and an inbox to send from.
export const agentmailConfigured = (): boolean =>
  realKey(process.env.AGENTMAIL_API_KEY) &&
  !!process.env.AGENTMAIL_INBOX_ID;

export type EmailProvider = "resend" | "agentmail";

// The active provider, for the settings screen.
export const provider = query({
  args: {},
  returns: v.union(v.literal("resend"), v.literal("agentmail")),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return workspace?.emailProvider ?? "resend";
  },
});

// Flip the provider from settings. Goes through the write access wrapper
// like every other mutation.
export const setProvider = writeMutation({
  args: {
    provider: v.union(v.literal("resend"), v.literal("agentmail")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace) throw new Error("Workspace is not seeded yet");
    await ctx.db.patch("workspace", workspace._id, {
      emailProvider: args.provider,
    });
    return null;
  },
});

// Compose configuration: the from identity and default signature, edited
// on the Settings email page. All optional with safe fallbacks.
export const settings = query({
  args: {},
  returns: v.object({
    fromName: v.union(v.string(), v.null()),
    fromAddress: v.union(v.string(), v.null()),
    signature: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return {
      fromName: workspace?.emailFromName ?? null,
      fromAddress: workspace?.emailFromAddress ?? null,
      signature: workspace?.emailSignature ?? null,
    };
  },
});

export const setSettings = writeMutation({
  args: {
    fromName: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    signature: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace) throw new Error("Workspace is not seeded yet");
    await ctx.db.patch("workspace", workspace._id, {
      emailFromName: args.fromName,
      emailFromAddress: args.fromAddress,
      emailSignature: args.signature,
    });
    return null;
  },
});

// Attachments live in Convex file storage; the client uploads first and
// passes the storage ids to compose.
export const generateUploadUrl = writeMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
});

// Compose from a company or contact record. Always writes the EMAIL
// activity (timeline plus the Activity page) so the CRM history is
// complete even on keyless installs; the actual vendor send happens in
// the scheduled action and is skipped with a logged reason when the
// selected provider has no key.
export const compose = writeMutation({
  args: {
    to: v.string(),
    cc: v.optional(v.string()),
    bcc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    attachments: v.array(attachmentValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.to.trim().length === 0) throw new Error("Add a recipient");
    if (args.subject.trim().length === 0) throw new Error("Add a subject");
    if (args.body.trim().length === 0) throw new Error("Write a message");

    const copies = [
      args.cc ? `cc ${args.cc}` : null,
      args.bcc ? `bcc ${args.bcc}` : null,
    ].filter(Boolean);
    const summary = [
      `Email to ${args.to}${copies.length > 0 ? ` (${copies.join(", ")})` : ""}: ${args.subject}`,
      clip(args.body, 200),
      args.attachments.length > 0
        ? `${args.attachments.length} attachment${args.attachments.length === 1 ? "" : "s"}: ${args.attachments.map((a) => a.name).join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    await insertActivity(ctx, {
      type: "EMAIL",
      body: summary,
      companyId: args.companyId,
      contactId: args.contactId,
    });

    await ctx.scheduler.runAfter(0, internal.email.sendComposed, {
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      body: args.body,
      attachments: args.attachments,
    });
    return null;
  },
});

export const getComposeConfigInternal = internalQuery({
  args: {},
  returns: v.object({
    provider: v.union(v.literal("resend"), v.literal("agentmail")),
    fromName: v.union(v.string(), v.null()),
    fromAddress: v.union(v.string(), v.null()),
    signature: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return {
      provider: workspace?.emailProvider ?? "resend",
      fromName: workspace?.emailFromName ?? null,
      fromAddress: workspace?.emailFromAddress ?? null,
      signature: workspace?.emailSignature ?? null,
    };
  },
});

// Deliver a composed email through the selected provider. Attachments
// are appended as signed storage links, which behaves the same on both
// providers and never fails a send over file size.
export const sendComposed = internalAction({
  args: {
    to: v.string(),
    cc: v.optional(v.string()),
    bcc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    attachments: v.array(attachmentValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(
      internal.email.getComposeConfigInternal,
      {},
    );

    const links: Array<string> = [];
    for (const attachment of args.attachments) {
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (url) links.push(`${attachment.name}: ${url}`);
    }
    const text = [
      args.body,
      links.length > 0 ? `Attachments:\n${links.join("\n")}` : null,
      config.signature,
    ]
      .filter(Boolean)
      .join("\n\n");

    const recipients = [
      args.to,
      ...(args.cc ? [args.cc] : []),
      ...(args.bcc ? [args.bcc] : []),
    ];

    if (config.provider === "agentmail") {
      if (!agentmailConfigured()) {
        await ctx.runMutation(internal.logs.record, {
          kind: "A",
          fn: "email:sendComposed",
          status: "info",
          message: `AgentMail not configured; "${args.subject}" to ${args.to} was logged but not sent`,
        });
        return null;
      }
      await ctx.runMutation(internal.email.sendComposedViaAgentMail, {
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        body: text,
      });
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "email:sendComposed",
        status: "success",
        message: `Queued "${args.subject}" to ${recipients.join(", ")} via AgentMail`,
      });
      return null;
    }

    if (!resendConfigured()) {
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "email:sendComposed",
        status: "info",
        message: `Resend not configured; "${args.subject}" to ${args.to} was logged but not sent`,
      });
      return null;
    }
    const from = config.fromAddress
      ? `${config.fromName ?? "CRM"} <${config.fromAddress}>`
      : "CRM Agent <crm@updates.example.com>";
    for (const recipient of recipients) {
      await resend.sendEmail(ctx, {
        from,
        to: recipient,
        subject: args.subject,
        text,
      });
    }
    await ctx.runMutation(internal.logs.record, {
      kind: "A",
      fn: "email:sendComposed",
      status: "success",
      message: `Sent "${args.subject}" to ${recipients.join(", ")} via Resend`,
    });
    return null;
  },
});

// AgentMail sends are enqueued from a mutation; the component workpool
// handles retries and delivery tracking.
export const sendComposedViaAgentMail = internalMutation({
  args: {
    to: v.string(),
    cc: v.optional(v.string()),
    bcc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!inboxId) return null;
    await agentmail.sendMessage(ctx, inboxId, {
      to: args.to,
      ...(args.cc ? { cc: args.cc } : {}),
      ...(args.bcc ? { bcc: args.bcc } : {}),
      subject: args.subject,
      text: args.body,
      labels: ["crm-compose"],
    });
    return null;
  },
});

export const getProviderInternal = internalQuery({
  args: {},
  returns: v.union(v.literal("resend"), v.literal("agentmail")),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return workspace?.emailProvider ?? "resend";
  },
});

// AgentMail enqueues sends from a mutation; the component's workpool talks
// to the vendor with retries and tracks delivery status reactively.
export const sendViaAgentMail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!inboxId) return null;
    await agentmail.sendMessage(ctx, inboxId, {
      to: args.to,
      subject: args.subject,
      text: args.body,
      labels: ["crm-notification"],
    });
    return null;
  },
});

// Send a plain notification email through whichever provider the workspace
// selected. Called by agents when email is configured; records a no-op
// result when it is not.
export const sendNotification = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const selected: EmailProvider = await ctx.runQuery(
      internal.email.getProviderInternal,
      {},
    );

    if (selected === "agentmail") {
      if (!agentmailConfigured()) {
        await ctx.runMutation(internal.logs.record, {
          kind: "A",
          fn: "email:sendNotification",
          status: "info",
          message: `AgentMail not configured; skipped "${args.subject}" to ${args.to}`,
        });
        return null;
      }
      await ctx.runMutation(internal.email.sendViaAgentMail, {
        to: args.to,
        subject: args.subject,
        body: args.body,
      });
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "email:sendNotification",
        status: "success",
        message: `Queued "${args.subject}" to ${args.to} via AgentMail`,
      });
      return "agentmail";
    }

    if (!resendConfigured()) {
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "email:sendNotification",
        status: "info",
        message: `Resend not configured; skipped "${args.subject}" to ${args.to}`,
      });
      return null;
    }
    const id = await resend.sendEmail(ctx, {
      from: "CRM Agent <crm@updates.example.com>",
      to: args.to,
      subject: args.subject,
      text: args.body,
    });
    await ctx.runMutation(internal.logs.record, {
      kind: "A",
      fn: "email:sendNotification",
      status: "success",
      message: `Sent "${args.subject}" to ${args.to} via Resend`,
    });
    return id;
  },
});
