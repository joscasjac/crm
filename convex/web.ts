import { ContextDev } from "@context-dot-dev/convex";
import { ExaClient } from "@exalabs/convex-exa";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";

// Web research for agents, with two providers per tool. Firecrawl and
// Context.dev both turn a URL into clean markdown; Exa and Context.dev both
// run web search. Any one key is enough: the primary provider is used when
// its key is real, the other fills in otherwise, and a failed call falls
// back to the other configured provider. Keyless installs use the literal
// string "unset" and these wrappers refuse to call the vendors, reporting
// honestly instead.
const firecrawl = new FirecrawlClient(components.firecrawl);
const exa = new ExaClient(components.exa);
const contextDev = new ContextDev(components.contextDev);

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

export const firecrawlConfigured = (): boolean =>
  realKey(process.env.FIRECRAWL_API_KEY);

export const exaConfigured = (): boolean => realKey(process.env.EXA_API_KEY);

export const contextDevConfigured = (): boolean =>
  realKey(process.env.CONTEXT_DEV_API_KEY);

const NOT_CONFIGURED_SCRAPE =
  "Web scraping is not configured on this install. Set FIRECRAWL_API_KEY or CONTEXT_DEV_API_KEY to enable it.";
const NOT_CONFIGURED_SEARCH =
  "Web search is not configured on this install. Set EXA_API_KEY or CONTEXT_DEV_API_KEY to enable it.";

// Long pages are capped so one tool call cannot blow up the context window.
const capMarkdown = (markdown: string): string =>
  markdown.length > 8000
    ? `${markdown.slice(0, 8000)}\n\n[truncated]`
    : markdown;

const scrapeWithFirecrawl = async (
  ctx: ActionCtx,
  url: string,
): Promise<string> => {
  const page = (await firecrawl.scrape(ctx, url, {
    formats: ["markdown"],
    onlyMainContent: true,
    maxAge: 60 * 60 * 1000,
  })) as { markdown?: string };
  const markdown = page.markdown ?? "";
  if (!markdown) return "The page returned no readable content.";
  return capMarkdown(markdown);
};

const scrapeWithContextDev = async (
  ctx: ActionCtx,
  url: string,
): Promise<string> => {
  const page = await contextDev.scrapeMarkdown(ctx, {
    params: { url, useMainContentOnly: true },
  });
  const markdown = page.markdown ?? "";
  if (!markdown) return "The page returned no readable content.";
  return capMarkdown(markdown);
};

const searchWithExa = async (
  ctx: ActionCtx,
  query: string,
): Promise<string> => {
  const response = (await exa.search(ctx, {
    query,
    numResults: 5,
    contents: { highlights: true },
  })) as {
    results?: Array<{
      title?: string | null;
      url?: string;
      highlights?: Array<string>;
    }>;
  };
  const results = response.results ?? [];
  if (results.length === 0) return "No results found.";
  return results
    .map((result) => {
      const highlight = result.highlights?.[0] ?? "";
      return `${result.title ?? "Untitled"} — ${result.url ?? ""}\n${highlight}`.trim();
    })
    .join("\n\n");
};

const searchWithContextDev = async (
  ctx: ActionCtx,
  query: string,
): Promise<string> => {
  const response = await contextDev.search(ctx, {
    body: { query, numResults: 10 },
  });
  const results = (response.results ?? []).slice(0, 5);
  if (results.length === 0) return "No results found.";
  return results
    .map((result) =>
      `${result.title || "Untitled"} — ${result.url}\n${result.description ?? ""}`.trim(),
    )
    .join("\n\n");
};

// Try the primary provider, fall back to the secondary if it is configured.
// The tool result is always a string the agent can repeat to the user.
const withFallback = async (
  primary: (() => Promise<string>) | null,
  secondary: (() => Promise<string>) | null,
  label: string,
): Promise<string> => {
  const attempts = [primary, secondary].filter(
    (attempt): attempt is () => Promise<string> => attempt !== null,
  );
  let lastMessage = "";
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : `${label} failed`;
    }
  }
  return `${label} failed: ${lastMessage}`;
};

// One page as markdown. Firecrawl when its key is real, Context.dev
// otherwise; either key alone is enough.
export const scrapePage = internalAction({
  args: { url: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (!firecrawlConfigured() && !contextDevConfigured()) {
      return NOT_CONFIGURED_SCRAPE;
    }
    return await withFallback(
      firecrawlConfigured() ? () => scrapeWithFirecrawl(ctx, args.url) : null,
      contextDevConfigured()
        ? () => scrapeWithContextDev(ctx, args.url)
        : null,
      "Scrape",
    );
  },
});

// Web search, flattened to a text block for tool calls. Exa when its key is
// real, Context.dev otherwise; either key alone is enough.
export const searchWeb = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (!exaConfigured() && !contextDevConfigured()) {
      return NOT_CONFIGURED_SEARCH;
    }
    return await withFallback(
      exaConfigured() ? () => searchWithExa(ctx, args.query) : null,
      contextDevConfigured()
        ? () => searchWithContextDev(ctx, args.query)
        : null,
      "Search",
    );
  },
});
