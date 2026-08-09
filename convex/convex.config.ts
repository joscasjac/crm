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

// Partner component. Same brand data vendor the upstream repo uses, so the
// swap is like for like.
import contextDev from "@context-dot-dev/convex/convex.config";

const app = defineApp({
  env: {
    // Brand data enrichment key. The component declares this required, so the
    // app does too. Set a real key, or the literal string "unset" to run the
    // demo without enrichment:
    // npx convex env set CONTEXT_DEV_API_KEY unset
    CONTEXT_DEV_API_KEY: v.string(),
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

// Brand data. The key is optional at the app level; enrichment reports
// "not configured" when it is unset instead of failing the deploy.
app.use(contextDev, {
  env: { CONTEXT_DEV_API_KEY: app.env.CONTEXT_DEV_API_KEY },
});

// Dashboard rollups: pipeline value by stage, open deals by owner. Keeps the
// dashboard summary at O(log n) instead of scanning the deals table.
app.use(aggregate, { name: "dealsByStage" });
app.use(aggregate, { name: "dealsByOwner" });

export default app;
