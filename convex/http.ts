import { AgentMail } from "@agentmail/convex";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components } from "./_generated/api";

const http = httpRouter();

// Inbound mail for the AgentMail component. Register the URL
// <deployment>.convex.site/agentmail/webhook in the AgentMail dashboard and
// set AGENTMAIL_WEBHOOK_SECRET. Harmless while unconfigured: unverified
// deliveries are rejected and nothing is written.
const agentmail = new AgentMail(components.agentmail);
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) =>
    // The component's bundled types expect a newer runMutation signature
    // than convex 1.43 declares; the shapes are compatible at runtime.
    agentmail.handleWebhook(
      ctx as unknown as Parameters<typeof agentmail.handleWebhook>[0],
      req,
    ),
  ),
});

// The built Vite app is served straight from Convex storage. Exact app routes
// registered above this call always win; everything else falls through to the
// static files with an index.html SPA fallback.
registerStaticRoutes(http, components.staticHosting, { spaFallback: true });

export default http;
