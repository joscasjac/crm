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
import type * as ai from "../ai.js";
import type * as ask from "../ask.js";
import type * as capabilities from "../capabilities.js";
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
import type * as logs from "../logs.js";
import type * as model_access from "../model/access.js";
import type * as model_activities from "../model/activities.js";
import type * as model_cascade from "../model/cascade.js";
import type * as model_deals from "../model/deals.js";
import type * as model_functions from "../model/functions.js";
import type * as model_seed from "../model/seed.js";
import type * as prefs from "../prefs.js";
import type * as search from "../search.js";
import type * as slack from "../slack.js";
import type * as slackBot from "../slackBot.js";
import type * as staticHosting from "../staticHosting.js";
import type * as tableSettings from "../tableSettings.js";
import type * as users from "../users.js";
import type * as web from "../web.js";

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
  ai: typeof ai;
  ask: typeof ask;
  capabilities: typeof capabilities;
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
  logs: typeof logs;
  "model/access": typeof model_access;
  "model/activities": typeof model_activities;
  "model/cascade": typeof model_cascade;
  "model/deals": typeof model_deals;
  "model/functions": typeof model_functions;
  "model/seed": typeof model_seed;
  prefs: typeof prefs;
  search: typeof search;
  slack: typeof slack;
  slackBot: typeof slackBot;
  staticHosting: typeof staticHosting;
  tableSettings: typeof tableSettings;
  users: typeof users;
  web: typeof web;
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
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  exa: import("@exalabs/convex-exa/_generated/component.js").ComponentApi<"exa">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  dealsByStage: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dealsByStage">;
};
