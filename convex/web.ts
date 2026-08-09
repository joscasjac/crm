import { ExaClient } from "@exalabs/convex-exa";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Web research for agents. Firecrawl turns a URL into clean markdown; Exa
// runs semantic web search. Both components declare their keys required at
// deploy time, so keyless installs use the literal string "unset" and these
// wrappers refuse to call the vendors, reporting honestly instead.
const firecrawl = new FirecrawlClient(components.firecrawl);
const exa = new ExaClient(components.exa);

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

export const firecrawlConfigured = (): boolean =>
  realKey(process.env.FIRECRAWL_API_KEY);

export const exaConfigured = (): boolean => realKey(process.env.EXA_API_KEY);

const NOT_CONFIGURED_FIRECRAWL =
  "Web scraping is not configured on this install. Set FIRECRAWL_API_KEY to enable it.";
const NOT_CONFIGURED_EXA =
  "Web search is not configured on this install. Set EXA_API_KEY to enable it.";

// One page as markdown, capped so a long page cannot blow up a tool call.
export const scrapePage = internalAction({
  args: { url: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (!firecrawlConfigured()) return NOT_CONFIGURED_FIRECRAWL;
    try {
      const page = (await firecrawl.scrape(ctx, args.url, {
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 60 * 60 * 1000,
      })) as { markdown?: string };
      const markdown = page.markdown ?? "";
      if (!markdown) return "The page returned no readable content.";
      return markdown.length > 8000
        ? `${markdown.slice(0, 8000)}\n\n[truncated]`
        : markdown;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Scrape failed";
      return `Scrape failed: ${message}`;
    }
  },
});

// Semantic web search, flattened to a text block for tool calls.
export const searchWeb = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (!exaConfigured()) return NOT_CONFIGURED_EXA;
    try {
      const response = (await exa.search(ctx, {
        query: args.query,
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Search failed";
      return `Search failed: ${message}`;
    }
  },
});
