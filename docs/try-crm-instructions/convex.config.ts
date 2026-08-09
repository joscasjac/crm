// convex/convex.config.ts
import { defineApp } from "convex/server";

// Official Convex components
import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import crons from "@convex-dev/crons/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import actionCache from "@convex-dev/action-cache/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import resend from "@convex-dev/resend/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// Partner component from the same vendor the upstream repo uses for brand
// data, so the swap is like for like.
import contextDev from "@context-dot-dev/convex/convex.config";

/**
 * App-owned root routing.
 *
 * The static site is not mounted at a prefix here. convex/http.ts registers
 * Convex Auth's routes first and then calls registerStaticRoutes() as the
 * catch-all, so /api/auth/callback/google and /.well-known/jwks.json keep the
 * exact URLs Convex Auth expects and OAuth redirect URIs never move. Exact
 * routes win over the catch-all. See the static-hosting README section
 * "Keep existing HTTP routes at the root".
 */
const app = defineApp();

app.use(staticHosting);

// Agent runtime
app.use(agent);
app.use(workflow);
app.use(crons);
app.use(actionRetrier);
app.use(actionCache);

// Bounded queues. One pool per class of work so a slow vendor cannot starve
// the dispatcher, matching the upstream rule that dispatch decides nothing.
app.use(workpool, { name: "agentPool" });
app.use(workpool, { name: "enrichmentPool" });
app.use(workpool, { name: "mailboxPool" });

app.use(rateLimiter);
app.use(migrations);
app.use(resend);
app.use(contextDev);

// Dashboard rollups: pipeline value by stage, open deals by owner. Keeps
// summary() at O(log n) instead of scanning the deals table.
app.use(aggregate, { name: "dealsByStage" });
app.use(aggregate, { name: "dealsByOwner" });

export default app;
