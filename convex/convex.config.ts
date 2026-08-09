// Components for the whole app. One Convex deployment is the database, the
// agent runtime, the work queue, the cron scheduler, the file store, and the
// web host.
import { defineApp } from "convex/server";
import { v } from "convex/values";

// Official Convex components
import actionCache from "@convex-dev/action-cache/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import agent from "@convex-dev/agent/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import crons from "@convex-dev/crons/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";

// Partner components. Context.dev is the same brand data vendor the upstream
// repo uses; Firecrawl, Exa, and AgentMail give agents web research and a
// persistent inbox.
import agentmail from "@agentmail/convex/convex.config";
import contextDev from "@context-dot-dev/convex/convex.config";
import exa from "@exalabs/convex-exa/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";

const app = defineApp({
  env: {
    // These three components declare their keys required, so the app does
    // too. Set a real key, or the literal string "unset" to run keyless:
    // npx convex env set CONTEXT_DEV_API_KEY unset
    // npx convex env set FIRECRAWL_API_KEY unset
    // npx convex env set EXA_API_KEY unset
    CONTEXT_DEV_API_KEY: v.string(),
    FIRECRAWL_API_KEY: v.string(),
    EXA_API_KEY: v.string(),
    // Recommended when running Firecrawl crawls in webhook mode.
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

// App-owned root routing. convex/http.ts registers exact routes first and
// then registerStaticRoutes() as the catch-all, so future auth callback URLs
// never move. Exact routes win over the catch-all.
app.use(staticHosting);

// Agent runtime
app.use(agent);
app.use(workflow);
app.use(crons);
app.use(actionRetrier);
app.use(actionCache);

// Bounded queues. One pool per class of work so a slow vendor cannot starve
// the dispatcher.
app.use(workpool, { name: "agentPool" });
app.use(workpool, { name: "enrichmentPool" });
app.use(workpool, { name: "mailboxPool" });

app.use(rateLimiter);
app.use(migrations);
app.use(resend);

// Brand data. Enrichment reports "not configured" when the key is the
// literal string "unset" instead of failing the deploy.
app.use(contextDev, {
  env: { CONTEXT_DEV_API_KEY: app.env.CONTEXT_DEV_API_KEY },
});

// Web research for agents. Firecrawl scrapes and crawls pages; Exa runs
// semantic web search. Both take the "unset" sentinel; the wrappers in
// convex/web.ts refuse to call the vendors without a real key.
app.use(firecrawl, {
  // Mounts the crawl webhook at <deployment>.convex.site/firecrawl/webhook.
  httpPrefix: "/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});
app.use(exa, {
  env: { EXA_API_KEY: app.env.EXA_API_KEY },
});

// Persistent email inbox for agents. Reads AGENTMAIL_API_KEY at runtime, so
// nothing is required at deploy time. The inbound webhook is registered in
// convex/http.ts at /agentmail/webhook.
app.use(agentmail);

// Dashboard rollups: pipeline value by stage, open deals by owner. Keeps the
// dashboard summary at O(log n) instead of scanning the deals table.
app.use(aggregate, { name: "dealsByStage" });
app.use(aggregate, { name: "dealsByOwner" });

export default app;
