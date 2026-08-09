import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { STAGES } from "./deals";
import { logEvent } from "./logs";
import { clip, insertActivity } from "./model/activities";
import { changeDealStage } from "./model/deals";
import { capMessage, slackSigningConfigured } from "./slack";

// The /crm Slack bot. Three signed HTTP routes ack inside Slack's three
// second budget and schedule the real work; replies go back through
// response_url. Every write walks through the same model helpers the UI
// calls, with the actor recorded as "Name (Slack)". The whole surface sits
// behind the slackBotEnabled toggle, off by default.

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

// ---------------------------------------------------------------------------
// Request verification: Slack's v0 signing scheme. HMAC SHA256 over
// "v0:{timestamp}:{rawBody}" keyed with the signing secret, compared in
// constant time, with timestamps older than five minutes rejected.
// ---------------------------------------------------------------------------

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifySlackRequest(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!realKey(secret) || !secret) return false;
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skewSeconds) || skewSeconds > 60 * 5) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`v0:${timestamp}:${rawBody}`),
  );
  return timingSafeEqual(`v0=${toHex(mac)}`, signature);
}

// Shared gate for all inbound routes: the toggle and the secret both have
// to be on before anything verifies. 503 names the fix.
async function inboundBlocked(ctx: ActionCtx): Promise<Response | null> {
  const config = await ctx.runQuery(internal.slack.getConfigInternal, {});
  if (!config.botEnabled) {
    return new Response(
      "The Slack bot is off. Turn it on in Settings, Slack.",
      { status: 503 },
    );
  }
  if (!slackSigningConfigured()) {
    return new Response(
      "SLACK_SIGNING_SECRET is not set on this deployment.",
      { status: 503 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP routes, registered in convex/http.ts under /webhooks/slack/.
// ---------------------------------------------------------------------------

// Slash commands arrive form encoded. Verify the raw body first, parse
// after, ack immediately, and do the real work through the scheduler.
export const commandsRoute = httpAction(async (ctx, request) => {
  const blocked = await inboundBlocked(ctx);
  if (blocked) return blocked;
  const rawBody = await request.text();
  if (!(await verifySlackRequest(request, rawBody))) {
    return new Response("Signature verification failed", { status: 401 });
  }
  const params = new URLSearchParams(rawBody);
  await ctx.scheduler.runAfter(0, internal.slackBot.handleCommand, {
    text: params.get("text") ?? "",
    slackUserId: params.get("user_id") ?? "",
    responseUrl: params.get("response_url") ?? "",
  });
  return Response.json({
    response_type: "ephemeral",
    text: "Working on it.",
  });
});

// Interactive components post a form field named payload holding JSON.
// Buttons ship in a later phase; for now the route verifies, acks, and
// says so, which keeps the Slack app config valid from day one.
export const interactivityRoute = httpAction(async (ctx, request) => {
  const blocked = await inboundBlocked(ctx);
  if (blocked) return blocked;
  const rawBody = await request.text();
  if (!(await verifySlackRequest(request, rawBody))) {
    return new Response("Signature verification failed", { status: 401 });
  }
  const payloadText = new URLSearchParams(rawBody).get("payload");
  if (payloadText) {
    const payload = JSON.parse(payloadText) as { response_url?: string };
    if (payload.response_url) {
      await ctx.scheduler.runAfter(0, internal.slackBot.respond, {
        responseUrl: payload.response_url,
        text: "Interactive buttons are not enabled yet. Use the /crm command: /crm help lists what it can do.",
        inChannel: false,
      });
    }
  }
  return new Response(null, { status: 200 });
});

// Events API: answer the url_verification challenge during Slack app
// setup, ack everything else. Retries (x-slack-retry-num) ack without
// reprocessing since nothing here writes yet.
export const eventsRoute = httpAction(async (ctx, request) => {
  const blocked = await inboundBlocked(ctx);
  if (blocked) return blocked;
  const rawBody = await request.text();
  if (!(await verifySlackRequest(request, rawBody))) {
    return new Response("Signature verification failed", { status: 401 });
  }
  const body = JSON.parse(rawBody) as { type?: string; challenge?: string };
  if (body.type === "url_verification" && body.challenge) {
    return Response.json({ challenge: body.challenge });
  }
  return new Response(null, { status: 200 });
});

// ---------------------------------------------------------------------------
// Identity: map a Slack user id to a workspace member by email.
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getIdentityInternal = internalQuery({
  args: { slackUserId: v.string() },
  returns: v.union(
    v.object({ name: v.string(), email: v.string(), verifiedAt: v.number() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("slackIdentities")
      .withIndex("by_slackUserId", (q) => q.eq("slackUserId", args.slackUserId))
      .unique();
    if (!row) return null;
    return { name: row.name, email: row.email, verifiedAt: row.verifiedAt };
  },
});

// Match the Slack profile email against the team members (or the optional
// allowed domain) and cache the result. A refusal logs the attempt so it
// shows on the Activity page.
export const verifyIdentity = internalMutation({
  args: {
    slackUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  returns: v.union(v.object({ name: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();
    const member = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    let allowed = !!member;
    if (!allowed) {
      const workspace = await ctx.db.query("workspace").first();
      const domain = workspace?.slackAllowedEmailDomain?.toLowerCase();
      if (domain && email.endsWith(`@${domain.replace(/^@/, "")}`)) {
        allowed = true;
      }
    }
    if (!allowed) {
      await logEvent(ctx, {
        kind: "A",
        fn: "slackBot:verifyIdentity",
        status: "info",
        message: `Slack user ${args.name} (${email}) tried the /crm bot and is not a workspace member`,
      });
      return null;
    }
    const name = member?.name ?? args.name;
    const existing = await ctx.db
      .query("slackIdentities")
      .withIndex("by_slackUserId", (q) => q.eq("slackUserId", args.slackUserId))
      .unique();
    if (existing) {
      await ctx.db.patch("slackIdentities", existing._id, {
        email,
        name,
        verifiedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("slackIdentities", {
        slackUserId: args.slackUserId,
        email,
        name,
        verifiedAt: Date.now(),
      });
    }
    return { name };
  },
});

// ---------------------------------------------------------------------------
// Command dispatch.
// ---------------------------------------------------------------------------

const HELP_TEXT = [
  "/crm commands:",
  "/crm find <name> — look up a company, contact, or deal",
  "/crm stages — list the deal stages",
  "/crm deal <deal name> <stage> — move a deal to a stage",
  '/crm task <record> "text" — add a task to a company or contact',
  '/crm note <record> "text" — add a note to a company or contact',
  "/crm activity <record> — the last ten timeline entries",
  "/crm help — this list",
].join("\n");

// Friendly stage aliases on top of the exact stage names.
function parseStage(input: string): Doc<"deals">["stage"] | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, Doc<"deals">["stage"]> = {
    WON: "CLOSED_WON",
    LOST: "CLOSED_LOST",
  };
  if (aliases[cleaned]) return aliases[cleaned];
  const match = STAGES.find((stage) => stage === cleaned);
  return match ?? null;
}

export const handleCommand = internalAction({
  args: {
    text: v.string(),
    slackUserId: v.string(),
    responseUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reply = async (text: string, inChannel = false) => {
      await ctx.runAction(internal.slackBot.respond, {
        responseUrl: args.responseUrl,
        text,
        inChannel,
      });
    };

    // Resolve who is asking before doing anything. Cached matches re-verify
    // after 30 days so departed teammates age out.
    let identity = await ctx.runQuery(internal.slackBot.getIdentityInternal, {
      slackUserId: args.slackUserId,
    });
    if (!identity || Date.now() - identity.verifiedAt > THIRTY_DAYS_MS) {
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!realKey(botToken)) {
        await reply(
          "SLACK_BOT_TOKEN is not set, so the bot cannot verify who you are. Set it with npx convex env set SLACK_BOT_TOKEN xoxb-...",
        );
        return null;
      }
      const response = await fetch(
        `https://slack.com/api/users.info?user=${encodeURIComponent(args.slackUserId)}`,
        { headers: { Authorization: `Bearer ${botToken}` } },
      );
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        user?: {
          real_name?: string;
          profile?: { email?: string; real_name?: string; display_name?: string };
        };
      };
      const email = body.user?.profile?.email;
      if (!body.ok || !email) {
        await reply(
          `Could not verify your Slack profile${body.error ? ` (${body.error})` : ""}. The bot token needs the users:read and users:read.email scopes.`,
        );
        return null;
      }
      const name =
        body.user?.profile?.real_name ??
        body.user?.real_name ??
        body.user?.profile?.display_name ??
        email;
      const verified = await ctx.runMutation(internal.slackBot.verifyIdentity, {
        slackUserId: args.slackUserId,
        email,
        name,
      });
      if (!verified) {
        await reply(
          "This bot only takes actions from workspace members. Ask an owner to add your email in Settings, Team, or set an allowed email domain in Settings, Slack.",
        );
        return null;
      }
      identity = { name: verified.name, email, verifiedAt: Date.now() };
    }
    const actor = `${identity.name} (Slack)`;

    const trimmed = args.text.trim();
    const [rawCommand, ...restParts] = trimmed.split(/\s+/);
    const command = (rawCommand ?? "").toLowerCase();
    const rest = trimmed.slice(rawCommand?.length ?? 0).trim();

    if (command === "" || command === "help") {
      await reply(HELP_TEXT);
      return null;
    }

    if (command === "stages") {
      await reply(
        `Deal stages: ${STAGES.join(", ")}. Aliases: won → CLOSED_WON, lost → CLOSED_LOST.`,
      );
      return null;
    }

    if (command === "find") {
      if (!rest) {
        await reply("Usage: /crm find <name>");
        return null;
      }
      const text = await ctx.runQuery(internal.slackBot.findInternal, {
        term: rest,
      });
      await reply(text);
      return null;
    }

    if (command === "activity") {
      if (!rest) {
        await reply("Usage: /crm activity <record>");
        return null;
      }
      const text = await ctx.runQuery(internal.slackBot.activityInternal, {
        term: rest,
      });
      await reply(text);
      return null;
    }

    if (command === "note" || command === "task") {
      const match = rest.match(/^(.+?)\s+"([^"]+)"\s*$/);
      if (!match) {
        await reply(
          `Usage: /crm ${command} <record> "text". Put the ${command} text in double quotes.`,
        );
        return null;
      }
      const text = await ctx.runMutation(
        internal.slackBot.addActivityFromSlack,
        {
          kind: command === "note" ? "NOTE" : "TASK",
          term: match[1],
          body: match[2],
          actor,
        },
      );
      await reply(text, !text.startsWith("Demo mode") && !text.includes("No ") && !text.includes("Several"));
      return null;
    }

    if (command === "deal") {
      if (restParts.length < 2) {
        await reply(
          "Usage: /crm deal <deal name> <stage>. /crm stages lists the valid stages.",
        );
        return null;
      }
      const stageInput = restParts[restParts.length - 1];
      const stage = parseStage(stageInput);
      if (!stage) {
        await reply(
          `"${stageInput}" is not a stage. Valid: ${STAGES.join(", ")}, plus won and lost.`,
        );
        return null;
      }
      const term = restParts.slice(0, -1).join(" ");
      const text = await ctx.runMutation(
        internal.slackBot.changeStageFromSlack,
        { term, stage, actor },
      );
      await reply(text, !text.startsWith("Demo mode") && !text.includes("No ") && !text.includes("Several"));
      return null;
    }

    await reply(`Unknown command "${command}".\n${HELP_TEXT}`);
    return null;
  },
});

// Reply through the response_url Slack hands every command and interaction.
// Valid for 30 minutes, no bot token needed.
export const respond = internalAction({
  args: {
    responseUrl: v.string(),
    text: v.string(),
    inChannel: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.responseUrl.startsWith("https://hooks.slack.com/")) return null;
    const response = await fetch(args.responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: args.inChannel ? "in_channel" : "ephemeral",
        text: capMessage(args.text),
      }),
    });
    if (!response.ok) {
      await ctx.runMutation(internal.logs.record, {
        kind: "A",
        fn: "slackBot:respond",
        status: "error",
        message: `Slack response_url replied ${response.status}`,
      });
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Record lookup and the write commands. Search uses the same full text
// indexes as Command-K; ambiguous matches reply with the list instead of
// guessing.
// ---------------------------------------------------------------------------

type Matches = {
  companies: Array<Doc<"companies">>;
  contacts: Array<Doc<"contacts">>;
  deals: Array<Doc<"deals">>;
};

async function searchRecords(
  ctx: QueryCtx | MutationCtx,
  term: string,
): Promise<Matches> {
  const companies = await ctx.db
    .query("companies")
    .withSearchIndex("search_name", (q) => q.search("name", term))
    .take(5);
  const contacts = await ctx.db
    .query("contacts")
    .withSearchIndex("search_name", (q) => q.search("name", term))
    .take(5);
  const deals = await ctx.db
    .query("deals")
    .withSearchIndex("search_name", (q) => q.search("name", term))
    .take(5);
  return { companies, contacts, deals };
}

function money(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toLocaleString()} ${currency}`;
}

function listMatches(matches: Matches): string {
  const lines: Array<string> = [];
  for (const company of matches.companies) {
    lines.push(`Company: ${company.name}${company.domain ? ` (${company.domain})` : ""}`);
  }
  for (const contact of matches.contacts) {
    lines.push(`Contact: ${contact.name}${contact.email ? ` (${contact.email})` : ""}`);
  }
  for (const deal of matches.deals) {
    lines.push(`Deal: ${deal.name} (${deal.stage}, ${money(deal.amountMinor, deal.currency)})`);
  }
  return lines.slice(0, 5).join("\n");
}

export const findInternal = internalQuery({
  args: { term: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const matches = await searchRecords(ctx, args.term);
    const total =
      matches.companies.length + matches.contacts.length + matches.deals.length;
    if (total === 0) return `No records match "${args.term}".`;
    if (total > 1) {
      return `Several matches for "${args.term}". Be more specific:\n${listMatches(matches)}`;
    }

    if (matches.companies.length === 1) {
      const company = matches.companies[0];
      const owner = company.ownerId
        ? await ctx.db.get("users", company.ownerId)
        : null;
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();
      const open = deals.filter(
        (d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST",
      );
      const recent = await ctx.db
        .query("activities")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .order("desc")
        .take(3);
      return [
        `${company.name}${company.domain ? ` (${company.domain})` : ""}`,
        owner ? `Owner: ${owner.name}` : null,
        `Open deals: ${open.length}${open.length > 0 ? ` worth ${money(open.reduce((sum, d) => sum + d.amountMinor, 0), open[0].currency)}` : ""}`,
        recent.length > 0
          ? `Recent: ${recent.map((a) => clip(a.body, 60)).join(" | ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (matches.contacts.length === 1) {
      const contact = matches.contacts[0];
      const company = contact.companyId
        ? await ctx.db.get("companies", contact.companyId)
        : null;
      return [
        `${contact.name}${contact.title ? `, ${contact.title}` : ""}`,
        contact.email ? `Email: ${contact.email}` : null,
        company ? `Company: ${company.name}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    const deal = matches.deals[0];
    const company = await ctx.db.get("companies", deal.companyId);
    return [
      `${deal.name} (${deal.stage})`,
      `Value: ${money(deal.amountMinor, deal.currency)}`,
      company ? `Company: ${company.name}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const activityInternal = internalQuery({
  args: { term: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const matches = await searchRecords(ctx, args.term);
    const total =
      matches.companies.length + matches.contacts.length + matches.deals.length;
    if (total === 0) return `No records match "${args.term}".`;
    if (total > 1) {
      return `Several matches for "${args.term}". Be more specific:\n${listMatches(matches)}`;
    }
    let rows: Array<Doc<"activities">> = [];
    let name = "";
    if (matches.companies.length === 1) {
      name = matches.companies[0].name;
      rows = await ctx.db
        .query("activities")
        .withIndex("by_company", (q) => q.eq("companyId", matches.companies[0]._id))
        .order("desc")
        .take(10);
    } else if (matches.contacts.length === 1) {
      name = matches.contacts[0].name;
      rows = await ctx.db
        .query("activities")
        .withIndex("by_contact", (q) => q.eq("contactId", matches.contacts[0]._id))
        .order("desc")
        .take(10);
    } else {
      name = matches.deals[0].name;
      rows = await ctx.db
        .query("activities")
        .withIndex("by_deal", (q) => q.eq("dealId", matches.deals[0]._id))
        .order("desc")
        .take(10);
    }
    if (rows.length === 0) return `No activity on ${name} yet.`;
    return [
      `Last ${rows.length} entries on ${name}:`,
      ...rows.map(
        (row) =>
          `${new Date(row._creationTime).toLocaleDateString()} ${row.type}: ${clip(row.body, 100)}`,
      ),
    ].join("\n");
  },
});

// Notes and tasks land on companies or contacts through the same
// insertActivity helper the UI and Ask slash commands use.
export const addActivityFromSlack = internalMutation({
  args: {
    kind: v.union(v.literal("NOTE"), v.literal("TASK")),
    term: v.string(),
    body: v.string(),
    actor: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace || workspace.demoMode) {
      return "Demo mode is read only from Slack. Fork the repo and turn demo mode off to write.";
    }
    const matches = await searchRecords(ctx, args.term);
    const recordMatches = [
      ...matches.companies.map((c) => ({ kind: "company" as const, doc: c })),
      ...matches.contacts.map((c) => ({ kind: "contact" as const, doc: c })),
    ];
    if (recordMatches.length === 0) {
      return `No company or contact matches "${args.term}".`;
    }
    if (recordMatches.length > 1) {
      return `Several matches for "${args.term}". Be more specific:\n${listMatches({ ...matches, deals: [] })}`;
    }
    const target = recordMatches[0];
    const { recordName } = await insertActivity(ctx, {
      type: args.kind,
      body: args.body,
      companyId: target.kind === "company" ? target.doc._id : undefined,
      contactId: target.kind === "contact" ? target.doc._id : undefined,
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "slackBot:addActivity",
      status: "success",
      message: `${args.kind} added to ${recordName ?? args.term} by ${args.actor}`,
    });
    return `${args.kind === "NOTE" ? "Note" : "Task"} added to ${recordName ?? args.term} by ${args.actor}: ${clip(args.body, 100)}`;
  },
});

// Stage moves reuse the exact helper deals.changeStage calls, so the board,
// the aggregates, the timeline, and the Activity page all move identically.
export const changeStageFromSlack = internalMutation({
  args: {
    term: v.string(),
    stage: v.union(
      v.literal("QUALIFIED"),
      v.literal("MEETING"),
      v.literal("PROPOSAL"),
      v.literal("NEGOTIATION"),
      v.literal("CLOSED_WON"),
      v.literal("CLOSED_LOST"),
    ),
    actor: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspace").first();
    if (!workspace || workspace.demoMode) {
      return "Demo mode is read only from Slack. Fork the repo and turn demo mode off to write.";
    }
    const deals = await ctx.db
      .query("deals")
      .withSearchIndex("search_name", (q) => q.search("name", args.term))
      .take(5);
    if (deals.length === 0) return `No deal matches "${args.term}".`;
    if (deals.length > 1) {
      return `Several deals match "${args.term}". Be more specific:\n${deals
        .map((d) => `Deal: ${d.name} (${d.stage}, ${money(d.amountMinor, d.currency)})`)
        .join("\n")}`;
    }
    const summary = await changeDealStage(
      ctx,
      deals[0]._id,
      args.stage,
      args.actor,
    );
    return `Deal moved. ${summary}`;
  },
});
