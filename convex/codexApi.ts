import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { logEvent } from "./logs";
import { insertActivity } from "./model/activities";
import { requireWriteAccess } from "./model/access";
import { changeDealStage } from "./model/deals";
import { authedQuery, writeMutation } from "./model/functions";
import { dealStage } from "./schema";

const tokenScope = v.union(
  v.literal("read"),
  v.literal("write_notes"),
  v.literal("write_tasks"),
  v.literal("write_deals"),
);

type Scope = Doc<"codexApiTokens">["scopes"][number];
type ToolName =
  | "crm_search_records"
  | "crm_get_record"
  | "crm_create_note"
  | "crm_create_task"
  | "crm_update_deal_stage";

const TOOL_SCOPES: Record<ToolName, Scope> = {
  crm_search_records: "read",
  crm_get_record: "read",
  crm_create_note: "write_notes",
  crm_create_task: "write_tasks",
  crm_update_deal_stage: "write_deals",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `crm_${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
};

const bearerToken = (req: Request): string | null => {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
};

const isToolName = (value: unknown): value is ToolName =>
  typeof value === "string" && value in TOOL_SCOPES;

const inputObject = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  key: string,
): string => {
  const value = optionalString(input[key]);
  if (!value) throw new Error(`${key} is required`);
  return value;
};

export const listTokens = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("codexApiTokens"),
      name: v.string(),
      lastFour: v.string(),
      scopes: v.array(tokenScope),
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("codexApiTokens").order("desc").take(100);
    return rows.map(
      ({
        _id,
        name,
        lastFour,
        scopes,
        createdAt,
        lastUsedAt,
        revokedAt,
      }) => ({
        _id,
        name,
        lastFour,
        scopes,
        createdAt,
        lastUsedAt,
        revokedAt,
      }),
    );
  },
});

export const createToken = action({
  args: {
    name: v.string(),
    scopes: v.optional(v.array(tokenScope)),
  },
  returns: v.object({
    id: v.id("codexApiTokens"),
    token: v.string(),
    lastFour: v.string(),
  }),
  handler: async (ctx, args) => {
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const scopes = args.scopes?.length
      ? Array.from(new Set(args.scopes))
      : (["read", "write_notes", "write_tasks", "write_deals"] as Scope[]);
    const id: Id<"codexApiTokens"> = await ctx.runMutation(
      internal.codexApi.storeToken,
      {
        name: args.name.trim() || "Codex",
        tokenHash,
        lastFour: token.slice(-4),
        scopes,
      },
    );
    return { id, token, lastFour: token.slice(-4) };
  },
});

export const storeToken = internalMutation({
  args: {
    name: v.string(),
    tokenHash: v.string(),
    lastFour: v.string(),
    scopes: v.array(tokenScope),
  },
  returns: v.id("codexApiTokens"),
  handler: async (ctx, args) => {
    await requireWriteAccess(ctx);
    const id = await ctx.db.insert("codexApiTokens", {
      ...args,
      createdAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "codexApi:createToken",
      status: "success",
      message: `Created Codex API token ${args.name}`,
    });
    return id;
  },
});

export const revokeToken = writeMutation({
  args: { tokenId: v.id("codexApiTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("codexApiTokens", args.tokenId);
    if (!row) throw new Error("Token not found");
    await ctx.db.patch("codexApiTokens", args.tokenId, {
      revokedAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "M",
      fn: "codexApi:revokeToken",
      status: "success",
      message: `Revoked Codex API token ${row.name}`,
    });
    return null;
  },
});

export const validateToken = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      tokenId: v.id("codexApiTokens"),
      name: v.string(),
      scopes: v.array(tokenScope),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("codexApiTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!row || row.revokedAt !== undefined) return null;
    return { tokenId: row._id, name: row.name, scopes: row.scopes };
  },
});

export const markTokenUsed = internalMutation({
  args: { tokenId: v.id("codexApiTokens"), tool: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("codexApiTokens", args.tokenId, {
      lastUsedAt: Date.now(),
    });
    await logEvent(ctx, {
      kind: "A",
      fn: "codexApi:tool",
      status: "success",
      message: `Codex called ${args.tool}`,
    });
    return null;
  },
});

const searchEntity = v.union(
  v.literal("all"),
  v.literal("company"),
  v.literal("contact"),
  v.literal("deal"),
);

const searchResult = v.object({
  type: v.union(v.literal("company"), v.literal("contact"), v.literal("deal")),
  id: v.string(),
  label: v.string(),
  sublabel: v.string(),
  url: v.string(),
});

export const searchRecords = internalQuery({
  args: {
    query: v.string(),
    entity: v.optional(searchEntity),
    limit: v.optional(v.number()),
  },
  returns: v.array(searchResult),
  handler: async (ctx, args) => {
    const term = args.query.trim().toLowerCase();
    if (!term) return [];
    const entity = args.entity ?? "all";
    const limit = Math.max(1, Math.min(args.limit ?? 12, 25));
    const results: Array<{
      type: "company" | "contact" | "deal";
      id: string;
      label: string;
      sublabel: string;
      url: string;
    }> = [];
    const seen = new Set<string>();
    const push = (row: (typeof results)[number]) => {
      const key = `${row.type}:${row.id}`;
      if (seen.has(key) || results.length >= limit) return;
      seen.add(key);
      results.push(row);
    };

    if (entity === "all" || entity === "company") {
      const hits = await ctx.db
        .query("companies")
        .withSearchIndex("search_name", (q) => q.search("name", term))
        .take(limit);
      for (const company of hits) {
        push({
          type: "company",
          id: company._id,
          label: company.name,
          sublabel: company.domain ?? company.industry ?? "Company",
          url: `/app/companies/${company._id}`,
        });
      }
      const rows = await ctx.db
        .query("companies")
        .withIndex("by_name")
        .take(200);
      for (const company of rows) {
        if (
          company.name.toLowerCase().includes(term) ||
          (company.domain ?? "").toLowerCase().includes(term)
        ) {
          push({
            type: "company",
            id: company._id,
            label: company.name,
            sublabel: company.domain ?? company.industry ?? "Company",
            url: `/app/companies/${company._id}`,
          });
        }
      }
    }

    if (entity === "all" || entity === "contact") {
      const hits = await ctx.db
        .query("contacts")
        .withSearchIndex("search_name", (q) => q.search("name", term))
        .take(limit);
      for (const contact of hits) {
        push({
          type: "contact",
          id: contact._id,
          label: contact.name,
          sublabel: contact.title ?? contact.email ?? "Contact",
          url: `/app/contacts/${contact._id}`,
        });
      }
      const rows = await ctx.db.query("contacts").take(200);
      for (const contact of rows) {
        if (
          contact.name.toLowerCase().includes(term) ||
          (contact.email ?? "").toLowerCase().includes(term)
        ) {
          push({
            type: "contact",
            id: contact._id,
            label: contact.name,
            sublabel: contact.title ?? contact.email ?? "Contact",
            url: `/app/contacts/${contact._id}`,
          });
        }
      }
    }

    if (entity === "all" || entity === "deal") {
      const hits = await ctx.db
        .query("deals")
        .withSearchIndex("search_name", (q) => q.search("name", term))
        .take(limit);
      for (const deal of hits) {
        push({
          type: "deal",
          id: deal._id,
          label: deal.name,
          sublabel: `${deal.stage} · ${(deal.amountMinor / 100).toFixed(2)} ${deal.currency}`,
          url: "/app/deals",
        });
      }
      const rows = await ctx.db.query("deals").take(200);
      for (const deal of rows) {
        if (deal.name.toLowerCase().includes(term)) {
          push({
            type: "deal",
            id: deal._id,
            label: deal.name,
            sublabel: `${deal.stage} · ${(deal.amountMinor / 100).toFixed(2)} ${deal.currency}`,
            url: "/app/deals",
          });
        }
      }
    }

    return results;
  },
});

export const getRecord = internalQuery({
  args: {
    type: v.union(v.literal("company"), v.literal("contact"), v.literal("deal")),
    id: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.type === "company") {
      const company = await ctx.db.get("companies", args.id as Id<"companies">);
      if (!company) return null;
      const contacts = await ctx.db
        .query("contacts")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .take(50);
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .take(50);
      const activities = await ctx.db
        .query("activities")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .order("desc")
        .take(25);
      return { company, contacts, deals, activities };
    }
    if (args.type === "contact") {
      const contact = await ctx.db.get("contacts", args.id as Id<"contacts">);
      if (!contact) return null;
      const company = contact.companyId
        ? await ctx.db.get("companies", contact.companyId)
        : null;
      const activities = await ctx.db
        .query("activities")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
        .order("desc")
        .take(25);
      return { contact, company, activities };
    }
    const deal = await ctx.db.get("deals", args.id as Id<"deals">);
    if (!deal) return null;
    const company = await ctx.db.get("companies", deal.companyId);
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_deal", (q) => q.eq("dealId", deal._id))
      .order("desc")
      .take(25);
    return { deal, company, activities };
  },
});

export const createNote = internalMutation({
  args: {
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
  },
  returns: v.object({
    id: v.id("activities"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const row = await insertActivity(ctx, { type: "NOTE", ...args });
    return {
      id: row.id,
      message: `Note created${row.recordName ? ` on ${row.recordName}` : ""}.`,
    };
  },
});

export const createTask = internalMutation({
  args: {
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
    remindMe: v.optional(v.boolean()),
  },
  returns: v.object({
    id: v.id("activities"),
    message: v.string(),
    reminderScheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const row = await insertActivity(ctx, { type: "TASK", ...args });
    return {
      id: row.id,
      message: `Task created${row.recordName ? ` on ${row.recordName}` : ""}.`,
      reminderScheduled: row.reminderScheduled,
    };
  },
});

export const updateDealStage = internalMutation({
  args: {
    dealId: v.id("deals"),
    stage: dealStage,
  },
  returns: v.object({ message: v.string() }),
  handler: async (ctx, args) => {
    const message = await changeDealStage(
      ctx,
      args.dealId,
      args.stage,
      "Codex",
    );
    return { message };
  },
});

export const codexToolsRoute = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const token = bearerToken(req);
  if (!token) return json(401, { ok: false, error: "Missing bearer token" });

  const tokenHash = await sha256Hex(token);
  const auth = await ctx.runQuery(internal.codexApi.validateToken, {
    tokenHash,
  });
  if (!auth) return json(401, { ok: false, error: "Invalid token" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Body must be JSON" });
  }
  const envelope = inputObject(body);
  if (!isToolName(envelope.tool)) {
    return json(400, { ok: false, error: "Unknown tool" });
  }
  const requiredScope = TOOL_SCOPES[envelope.tool];
  if (!auth.scopes.includes(requiredScope)) {
    return json(403, {
      ok: false,
      error: `Token is missing ${requiredScope} scope`,
    });
  }

  const input = inputObject(envelope.input);
  try {
    let result: unknown;
    if (envelope.tool === "crm_search_records") {
      const entity = optionalString(input.entity);
      result = await ctx.runQuery(internal.codexApi.searchRecords, {
        query: requireString(input, "query"),
        entity:
          entity === "company" || entity === "contact" || entity === "deal"
            ? entity
            : "all",
        limit: optionalNumber(input.limit),
      });
    } else if (envelope.tool === "crm_get_record") {
      const type = requireString(input, "type");
      if (type !== "company" && type !== "contact" && type !== "deal") {
        throw new Error("type must be company, contact, or deal");
      }
      result = await ctx.runQuery(internal.codexApi.getRecord, {
        type,
        id: requireString(input, "id"),
      });
    } else if (envelope.tool === "crm_create_note") {
      result = await ctx.runMutation(internal.codexApi.createNote, {
        body: requireString(input, "body"),
        companyId: optionalString(input.companyId) as
          | Id<"companies">
          | undefined,
        contactId: optionalString(input.contactId) as
          | Id<"contacts">
          | undefined,
        dealId: optionalString(input.dealId) as Id<"deals"> | undefined,
      });
    } else if (envelope.tool === "crm_create_task") {
      result = await ctx.runMutation(internal.codexApi.createTask, {
        body: requireString(input, "body"),
        companyId: optionalString(input.companyId) as
          | Id<"companies">
          | undefined,
        contactId: optionalString(input.contactId) as
          | Id<"contacts">
          | undefined,
        dealId: optionalString(input.dealId) as Id<"deals"> | undefined,
        dueAt: optionalNumber(input.dueAt),
        remindMe: input.remindMe === true,
      });
    } else {
      result = await ctx.runMutation(internal.codexApi.updateDealStage, {
        dealId: requireString(input, "dealId") as Id<"deals">,
        stage: requireString(input, "stage") as Doc<"deals">["stage"],
      });
    }

    await ctx.runMutation(internal.codexApi.markTokenUsed, {
      tokenId: auth.tokenId,
      tool: envelope.tool,
    });
    return json(200, { ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed";
    await ctx.runMutation(internal.logs.record, {
      kind: "A",
      fn: `codexApi:${envelope.tool}`,
      status: "error",
      message,
    });
    return json(400, { ok: false, error: message });
  }
});
