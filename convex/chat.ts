import {
  Agent,
  createThread,
  createTool,
  listUIMessages,
  saveMessage,
  stepCountIs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalQuery,
  query,
} from "./_generated/server";
import type { AiProvider } from "./ai";
import {
  languageModelFor,
  missingKeyMessage,
  providerConfigured,
} from "./ai";
import { writeMutation } from "./model/functions";

// The one tool the record chat needs with zero keys: read our own history.
// No data vendor can sell you a reply from the person's own address.
const readCrmHistory = createTool({
  description:
    "Read the CRM's own history for the current record: timeline activities, open agent tasks, and recorded facts with their evidence.",
  inputSchema: z.object({
    companyId: z.string().describe("The company id to read history for"),
  }),
  execute: async (ctx, input): Promise<string> => {
    const history = await ctx.runQuery(internal.chat.recordHistory, {
      companyId: input.companyId as Id<"companies">,
    });
    return history;
  },
});

// Web research through the Firecrawl and Exa components. Both degrade
// honestly: without a real key the tool returns a "not configured" note the
// agent repeats to the user instead of guessing.
const searchTheWeb = createTool({
  description:
    "Search the web for recent information about a company or person. Returns titles, URLs, and highlights.",
  inputSchema: z.object({
    query: z.string().describe("What to search the web for"),
  }),
  execute: async (ctx, input): Promise<string> => {
    return await ctx.runAction(internal.web.searchWeb, {
      query: input.query,
    });
  },
});

const readWebPage = createTool({
  description:
    "Fetch a specific web page and return its main content as markdown.",
  inputSchema: z.object({
    url: z.string().describe("The full URL of the page to read"),
  }),
  execute: async (ctx, input): Promise<string> => {
    return await ctx.runAction(internal.web.scrapePage, { url: input.url });
  },
});

const INSTRUCTIONS = [
  "You are the research agent inside an agentic CRM.",
  "Nothing about a person is guessed. Report what you observed and name the evidence, like crm.signature-block or crm.thread-reply.",
  "If you do not have the data, say so plainly. A blank field beats a confidently wrong one.",
  "You may search the web or read a page when the CRM history is not enough. If a web tool reports it is not configured, tell the user which key enables it.",
  "Answer briefly and show your working.",
].join(" ");

// The model comes from the workspace's AI provider setting, so the agent is
// built per call rather than at module scope.
const makeCrmAgent = (provider: AiProvider) =>
  new Agent(components.agent, {
    name: "CRM Research Agent",
    languageModel: languageModelFor(provider),
    instructions: INSTRUCTIONS,
    tools: {
      read_crm_history: readCrmHistory,
      search_the_web: searchTheWeb,
      read_web_page: readWebPage,
    },
  });

// Everything the agent may read about a record, flattened to text for the
// tool call.
export const recordHistory = internalQuery({
  args: { companyId: v.id("companies") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get("companies", args.companyId);
    if (!company) return "No record found.";
    const lines: Array<string> = [
      `Company: ${company.name} (${company.domain ?? "no domain"}), industry: ${company.industry ?? "unknown"}`,
    ];
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const contact of contacts) {
      lines.push(
        `Contact: ${contact.name}, ${contact.title ?? "title unknown"}, ${contact.email ?? "no email"}`,
      );
    }
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
    for (const deal of deals) {
      lines.push(
        `Deal: ${deal.name}, stage ${deal.stage}, amount ${(deal.amountMinor / 100).toFixed(2)} ${deal.currency}`,
      );
    }
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(25);
    for (const activity of activities) {
      lines.push(`${activity.type}: ${activity.body}`);
    }
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_entityId", (q) => q.eq("entityId", args.companyId))
      .collect();
    for (const fact of facts) {
      lines.push(
        `Fact: ${fact.field} = ${fact.value} (evidence ${fact.evidenceKind}, band ${fact.band})`,
      );
    }
    return lines.join("\n");
  },
});

export const threadForCompany = query({
  args: { companyId: v.id("companies") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatThreads")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .first();
    return row?.threadId ?? null;
  },
});

export const messages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
  },
});

// Ask the record a question. The reply generates asynchronously; the messages
// query streams it in reactively.
export const ask = writeMutation({
  args: { companyId: v.id("companies"), prompt: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (args.prompt.trim().length === 0) {
      throw new Error("Ask something first");
    }
    const row = await ctx.db
      .query("chatThreads")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .first();
    let threadId = row?.threadId;
    if (!threadId) {
      threadId = await createThread(ctx, components.agent, {
        title: "Record chat",
      });
      await ctx.db.insert("chatThreads", {
        threadId,
        companyId: args.companyId,
      });
    }
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: args.prompt,
    });
    await ctx.scheduler.runAfter(0, internal.chat.generate, {
      threadId,
      promptMessageId: messageId,
      companyId: args.companyId,
    });
    return threadId;
  },
});

export const generate = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    companyId: v.id("companies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The capability preamble in one sentence: without a model key the tab
    // says so instead of pretending.
    const provider: AiProvider = await ctx.runQuery(
      internal.ask.providerInternal,
      {},
    );
    if (!providerConfigured(provider)) {
      await saveMessage(ctx, components.agent, {
        threadId: args.threadId,
        agentName: "CRM Research Agent",
        message: {
          role: "assistant",
          content: missingKeyMessage(provider),
        },
      });
      return null;
    }
    const history = await ctx.runQuery(internal.chat.recordHistory, {
      companyId: args.companyId,
    });
    const crmAgent = makeCrmAgent(provider);
    await crmAgent.generateText(
      ctx,
      { threadId: args.threadId },
      {
        promptMessageId: args.promptMessageId,
        system: [INSTRUCTIONS, "Current record context:", history].join(
          "\n\n",
        ),
        stopWhen: stepCountIs(5),
      },
    );
    return null;
  },
});
