/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agentTasks from "../agentTasks.js";
import type * as agents from "../agents.js";
import type * as aggregates from "../aggregates.js";
import type * as chat from "../chat.js";
import type * as companies from "../companies.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deals from "../deals.js";
import type * as demo from "../demo.js";
import type * as email from "../email.js";
import type * as enrichment from "../enrichment.js";
import type * as fields from "../fields.js";
import type * as http from "../http.js";
import type * as model_access from "../model/access.js";
import type * as model_cascade from "../model/cascade.js";
import type * as model_functions from "../model/functions.js";
import type * as model_seed from "../model/seed.js";
import type * as staticHosting from "../staticHosting.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agentTasks: typeof agentTasks;
  agents: typeof agents;
  aggregates: typeof aggregates;
  chat: typeof chat;
  companies: typeof companies;
  contacts: typeof contacts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deals: typeof deals;
  demo: typeof demo;
  email: typeof email;
  enrichment: typeof enrichment;
  fields: typeof fields;
  http: typeof http;
  "model/access": typeof model_access;
  "model/cascade": typeof model_cascade;
  "model/functions": typeof model_functions;
  "model/seed": typeof model_seed;
  staticHosting: typeof staticHosting;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  agentPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"agentPool">;
  enrichmentPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"enrichmentPool">;
  mailboxPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"mailboxPool">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  contextDev: import("@context-dot-dev/convex/_generated/component.js").ComponentApi<"contextDev">;
  dealsByStage: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dealsByStage">;
  dealsByOwner: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dealsByOwner">;
};
