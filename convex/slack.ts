import { ActionRetrier } from "@convex-dev/action-retrier";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { action, internalAction, internalQuery } from "./_generated/server";
import { authedQuery, writeMutation } from "./model/functions";

// Outbound Slack notifications. Two connection modes, both optional:
//
// 1. SLACK_WEBHOOK_URL: an incoming webhook. Channel baked into the URL,
//    the channel picker in Settings is ignored.
// 2. SLACK_BOT_TOKEN: a Slack app bot token with chat:write, posting to the
//    channel picked in Settings. Required for the /crm bot.
//
// Bot token wins when both are set. With neither configured, sends log as
// no-ops on the Activity page, matching how email behaves keyless. Demo
// mode never posts.

const retrier = new ActionRetrier(components.actionRetrier);

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

export const slackWebhookConfigured = (): boolean =>
  realKey(process.env.SLACK_WEBHOOK_URL);

export const slackBotConfigured = (): boolean =>
  realKey(process.env.SLACK_BOT_TOKEN);

export const slackSigningConfigured = (): boolean =>
  realKey(process.env.SLACK_SIGNING_SECRET);

export type SlackEvent = "records" | "deals" | "tasks" | "agent";

const slackEventValidator = v.union(
  v.literal("records"),
  v.literal("deals"),
  v.literal("tasks"),
  v.literal("agent"),
);

// Cap any message so a huge record cannot blow up the payload: 300
// characters per line, 30 lines total.
export function capMessage(text: string): string {
  return text
    .split("\n")
    .slice(0, 30)
    .map((line) => (line.length > 300 ? `${line.slice(0, 300)}…` : line))
    .join("\n");
}

// The deep link base: APP_URL override for custom domains, else the
// deployment's own .convex.site origin where static hosting serves the app.
function deepLinkBase(): string | null {
  const appUrl = process.env.APP_URL;
  if (realKey(appUrl) && appUrl) return appUrl.replace(/\/$/, "");
  const siteUrl = process.env.CONVEX_SITE_URL;
  return siteUrl ? siteUrl.replace(/\/$/, "") : null;
}

// Schedule a notification from inside a mutation. Reads the workspace
// toggles in the same transaction; nothing posts when the master switch is
// off, the per-event toggle is off, or demo mode is on. Seeds and the demo
// reset write tables directly, so they never reach this helper.
export async function notifySlack(
  ctx: MutationCtx,
  event: SlackEvent,
  text: string,
  path?: string,
): Promise<void> {
  const workspace = await ctx.db.query("workspace").first();
  if (!workspace || workspace.demoMode) return;
  if (!workspace.slackEnabled) return;
  const enabled = {
    records: workspace.slackNotifyRecords ?? true,
    deals: workspace.slackNotifyDeals ?? true,
    tasks: workspace.slackNotifyTasks ?? false,
    agent: workspace.slackNotifyAgent ?? false,
  }[event];
  if (!enabled) return;
  await retrier.run(ctx, internal.slack.deliver, {
    event,
    text,
    path,
    channel: workspace.slackChannelId,
  });
}

// Post one message. Throws on 429 and 5xx so the action retrier backs off;
// config mistakes (missing channel, not_in_channel, nothing configured)
// return an error string and never retry. Every outcome lands on the
// Activity page.
async function postToSlack(
  text: string,
  channel: string | undefined,
): Promise<string | null> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (realKey(botToken)) {
    if (!channel) {
      return "No Slack channel selected. Pick one in Settings, Slack.";
    }
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Slack replied ${response.status}; retrying`);
    }
    const body = (await response.json()) as { ok: boolean; error?: string };
    if (!body.ok) {
      if (body.error === "ratelimited") {
        throw new Error("Slack rate limited the request; retrying");
      }
      return `Slack error: ${body.error ?? "unknown"}`;
    }
    return null;
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (realKey(webhookUrl) && webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Slack webhook replied ${response.status}; retrying`);
    }
    if (!response.ok) {
      return `Slack webhook error: ${await response.text()}`;
    }
    return null;
  }

  return "Slack is not configured. Set SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL.";
}

export const deliver = internalAction({
  args: {
    event: slackEventValidator,
    text: v.string(),
    path: v.optional(v.string()),
    channel: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let text = capMessage(args.text);
    const base = deepLinkBase();
    if (args.path && base) {
      text = `${text}\n<${base}${args.path}|Open in CRM>`;
    }
    const configError = await postToSlack(text, args.channel);
    await ctx.runMutation(internal.logs.record, {
      kind: "A",
      fn: "slack:deliver",
      status: configError ? "info" : "success",
      message: configError
        ? `Slack skipped (${args.event}): ${configError}`
        : `Posted to Slack (${args.event}): ${capMessage(args.text).split("\n")[0]}`,
    });
    return null;
  },
});

// Post a message from the /crm bot flow. Same posting code, but errors log
// as errors so failed replies are visible on the Activity page.
export const postInternal = internalAction({
  args: { text: v.string(), channel: v.optional(v.string()) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const configError = await postToSlack(capMessage(args.text), args.channel);
    if (configError) {
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "slack:postInternal",
        status: "error",
        message: configError,
      });
    }
    return configError;
  },
});

// The Send test button in Settings. Throws so the toast shows the exact
// Slack error instead of hiding it in a log.
export const sendTest = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.slack.getConfigInternal, {});
    if (config.demoMode) {
      throw new Error("Demo mode is on; Slack never posts from the demo.");
    }
    // Same rule as authedQuery: outside demo mode this needs a session, so an
    // anonymous caller can never post into the workspace Slack channel.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    let text = "Test message from CRM on Convex. Slack is wired up.";
    const base = deepLinkBase();
    if (base) text = `${text}\n<${base}/app|Open in CRM>`;
    const configError = await postToSlack(text, config.channelId ?? undefined);
    await ctx.runMutation(internal.logs.record, {
      kind: "A",
      fn: "slack:sendTest",
      status: configError ? "error" : "success",
      message: configError ?? "Slack test message posted",
    });
    if (configError) throw new Error(configError);
    return null;
  },
});

// Channel list for the Settings picker, bot token mode only. Pages through
// conversations.list; private channels appear when the token has
// groups:read and the bot is a member.
export const channels = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      isPrivate: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    // Same rule as authedQuery: open while the public demo runs, session
    // required otherwise, so channel names never leak to anonymous callers.
    const config = await ctx.runQuery(internal.slack.getConfigInternal, {});
    if (!config.demoMode) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }
    }
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!realKey(botToken)) {
      throw new Error(
        "Set SLACK_BOT_TOKEN first. The channel picker needs a bot token; webhook mode bakes the channel into the URL.",
      );
    }
    const result: Array<{ id: string; name: string; isPrivate: boolean }> = [];
    let cursor: string | undefined;
    let types = "public_channel,private_channel";
    for (let pageCount = 0; pageCount < 5; pageCount++) {
      const params = new URLSearchParams({
        exclude_archived: "true",
        limit: "200",
        types,
      });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(
        `https://slack.com/api/conversations.list?${params.toString()}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      );
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        channels?: Array<{ id: string; name: string; is_private?: boolean }>;
        response_metadata?: { next_cursor?: string };
      };
      if (!body.ok) {
        // Tokens without groups:read can still list public channels.
        if (body.error === "missing_scope" && types.includes("private")) {
          types = "public_channel";
          cursor = undefined;
          continue;
        }
        throw new Error(`Slack error: ${body.error ?? "unknown"}`);
      }
      for (const channel of body.channels ?? []) {
        result.push({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private ?? false,
        });
      }
      cursor = body.response_metadata?.next_cursor || undefined;
      if (!cursor) break;
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Workspace Slack preferences for the Settings card.
export const settings = authedQuery({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    notifyRecords: v.boolean(),
    notifyDeals: v.boolean(),
    notifyTasks: v.boolean(),
    notifyAgent: v.boolean(),
    channelId: v.union(v.string(), v.null()),
    channelName: v.union(v.string(), v.null()),
    botEnabled: v.boolean(),
    allowedEmailDomain: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return {
      enabled: workspace?.slackEnabled ?? false,
      notifyRecords: workspace?.slackNotifyRecords ?? true,
      notifyDeals: workspace?.slackNotifyDeals ?? true,
      notifyTasks: workspace?.slackNotifyTasks ?? false,
      notifyAgent: workspace?.slackNotifyAgent ?? false,
      channelId: workspace?.slackChannelId ?? null,
      channelName: workspace?.slackChannelName ?? null,
      botEnabled: workspace?.slackBotEnabled ?? false,
      allowedEmailDomain: workspace?.slackAllowedEmailDomain ?? null,
    };
  },
});

export const setSettings = writeMutation({
  args: {
    enabled: v.optional(v.boolean()),
    notifyRecords: v.optional(v.boolean()),
    notifyDeals: v.optional(v.boolean()),
    notifyTasks: v.optional(v.boolean()),
    notifyAgent: v.optional(v.boolean()),
    channelId: v.optional(v.string()),
    channelName: v.optional(v.string()),
    botEnabled: v.optional(v.boolean()),
    allowedEmailDomain: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace) throw new Error("Workspace is not seeded yet");
    const patch: Record<string, unknown> = {};
    if (args.enabled !== undefined) patch.slackEnabled = args.enabled;
    if (args.notifyRecords !== undefined)
      patch.slackNotifyRecords = args.notifyRecords;
    if (args.notifyDeals !== undefined)
      patch.slackNotifyDeals = args.notifyDeals;
    if (args.notifyTasks !== undefined)
      patch.slackNotifyTasks = args.notifyTasks;
    if (args.notifyAgent !== undefined)
      patch.slackNotifyAgent = args.notifyAgent;
    if (args.channelId !== undefined) patch.slackChannelId = args.channelId;
    if (args.channelName !== undefined)
      patch.slackChannelName = args.channelName;
    if (args.botEnabled !== undefined) patch.slackBotEnabled = args.botEnabled;
    if (args.allowedEmailDomain !== undefined)
      patch.slackAllowedEmailDomain = args.allowedEmailDomain;
    await ctx.db.patch("workspace", workspace._id, patch);
    return null;
  },
});

// Config snapshot for actions and the bot: toggles, channel, and demo mode
// in one read.
export const getConfigInternal = internalQuery({
  args: {},
  returns: v.object({
    demoMode: v.boolean(),
    enabled: v.boolean(),
    botEnabled: v.boolean(),
    channelId: v.union(v.string(), v.null()),
    allowedEmailDomain: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspace").first();
    return {
      demoMode: workspace?.demoMode ?? true,
      enabled: workspace?.slackEnabled ?? false,
      botEnabled: workspace?.slackBotEnabled ?? false,
      channelId: workspace?.slackChannelId ?? null,
      allowedEmailDomain: workspace?.slackAllowedEmailDomain ?? null,
    };
  },
});
