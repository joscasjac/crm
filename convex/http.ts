import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";

const http = httpRouter();

// The built Vite app is served straight from Convex storage. Exact app routes
// registered above this call always win; everything else falls through to the
// static files with an index.html SPA fallback.
registerStaticRoutes(http, components.staticHosting, { spaFallback: true });

export default http;
