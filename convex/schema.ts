import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Deal stages carried over from upstream.
export const dealStage = v.union(
  v.literal("QUALIFIED"),
  v.literal("MEETING"),
  v.literal("PROPOSAL"),
  v.literal("NEGOTIATION"),
  v.literal("CLOSED_WON"),
  v.literal("CLOSED_LOST"),
);

export const activityType = v.union(
  v.literal("NOTE"),
  v.literal("CALL"),
  v.literal("EMAIL"),
  v.literal("MEETING"),
  v.literal("TASK"),
  v.literal("STAGE_CHANGE"),
  v.literal("ENRICHMENT"),
);

export const enrichmentStatus = v.union(
  v.literal("NONE"),
  v.literal("RESEARCHING"),
  v.literal("ENRICHED"),
  v.literal("FAILED"),
);

// Evidence bands from the upstream evidence ledger. Strong evidence writes to
// the record, weak evidence becomes a suggestion a human settles.
export const evidenceBand = v.union(
  v.literal("CONFIRMED"),
  v.literal("PROBABLE"),
  v.literal("POSSIBLE"),
  v.literal("WEAK"),
);

export default defineSchema({
  // Single tenant, on purpose. One row.
  workspace: defineTable({
    name: v.string(),
    demoMode: v.boolean(),
    // Sign-in allow list. Empty means nobody signs in, the safe direction to
    // fail. Unused while demoMode is true.
    allowedSignIn: v.array(v.string()),
    reportingCurrency: v.string(),
    agentModel: v.string(),
    lastResetAt: v.number(),
  }),

  // Workspace members. Demo seeds these; with Convex Auth enabled this table
  // maps to authenticated users.
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
    avatarUrl: v.optional(v.string()),
  }).index("by_email", ["email"]),

  companies: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    primaryContactId: v.optional(v.id("contacts")),
    enrichmentStatus: enrichmentStatus,
    lastActivityAt: v.optional(v.number()),
  })
    .index("by_domain", ["domain"])
    .index("by_name", ["name"]),

  contacts: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    ownerId: v.optional(v.id("users")),
    avatarUrl: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_email", ["email"]),

  deals: defineTable({
    name: v.string(),
    companyId: v.id("companies"),
    stage: dealStage,
    // Money is integer minor units. Round once, at the boundary.
    amountMinor: v.number(),
    currency: v.string(),
    ownerId: v.optional(v.id("users")),
    primaryContactId: v.optional(v.id("contacts")),
    expectedCloseAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_stage", ["stage"])
    .index("by_owner", ["ownerId"]),

  // Timeline entries for companies, contacts, and deals.
  activities: defineTable({
    type: activityType,
    body: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    authorId: v.optional(v.id("users")),
    // Tasks
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // Stage changes
    meta: v.optional(
      v.object({
        fromStage: v.optional(v.string()),
        toStage: v.optional(v.string()),
      }),
    ),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_type", ["type"]),

  // Custom fields per entity, with an agentFilled flag and an agentBrief that
  // tells the agent what to put in a field.
  fieldDefinitions: defineTable({
    entity: v.union(
      v.literal("company"),
      v.literal("contact"),
      v.literal("deal"),
    ),
    key: v.string(),
    label: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("select"),
      v.literal("date"),
    ),
    options: v.optional(v.array(v.string())),
    order: v.number(),
    archived: v.boolean(),
    agentFilled: v.boolean(),
    agentBrief: v.optional(v.string()),
  }).index("by_entity_and_key", ["entity", "key"]),

  fieldValues: defineTable({
    fieldId: v.id("fieldDefinitions"),
    // The record this value belongs to, as a string id into companies,
    // contacts, or deals.
    entityId: v.string(),
    value: v.string(),
  })
    .index("by_entityId", ["entityId"])
    .index("by_field_and_entityId", ["fieldId", "entityId"]),

  // The agent work queue. The queue is a table: claimDue is a mutation that
  // reads by index and writes a lease, and Convex serializes mutations so two
  // dispatchers claim disjoint work with no lock hint.
  agentTasks: defineTable({
    kind: v.union(
      v.literal("ENRICH_COMPANY"),
      v.literal("RECHECK_CONTACT"),
      v.literal("BRIEF_OWNER"),
      v.literal("CUSTOM"),
    ),
    // state is denormalized on purpose: indexes cannot express
    // "where finishedAt is null", so state carries that as an indexed value.
    state: v.union(v.literal("open"), v.literal("done"), v.literal("failed")),
    reason: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    priority: v.number(),
    dueAt: v.number(),
    leasedUntil: v.optional(v.number()),
    attempts: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    result: v.optional(v.string()),
  })
    .index("by_state_and_dueAt", ["state", "dueAt"])
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"]),

  // Agent builder: definitions are data, versions are rows, deploying is a
  // pointer move. No build, no redeploy.
  agentDefinitions: defineTable({
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("deployed"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    currentVersionId: v.optional(v.id("agentVersions")),
    trigger: v.object({
      kind: v.union(
        v.literal("manual"),
        v.literal("schedule"),
        v.literal("event"),
      ),
      cronspec: v.optional(v.string()),
      event: v.optional(v.string()),
    }),
  }),

  agentVersions: defineTable({
    agentId: v.id("agentDefinitions"),
    number: v.number(),
    instructions: v.string(),
    // The manifest names which of the compiled tools a version may call, so
    // an agent built in the UI cannot invent a tool that does not exist.
    toolNames: v.array(v.string()),
    model: v.string(),
    deployedAt: v.optional(v.number()),
  }).index("by_agent_and_number", ["agentId", "number"]),

  agentRuns: defineTable({
    agentId: v.optional(v.id("agentDefinitions")),
    taskId: v.optional(v.id("agentTasks")),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    steps: v.array(
      v.object({
        at: v.number(),
        kind: v.union(
          v.literal("plan"),
          v.literal("tool"),
          v.literal("observation"),
          v.literal("discard"),
          v.literal("write"),
          v.literal("question"),
        ),
        text: v.string(),
      }),
    ),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"]),

  // The evidence ledger. Tools report what they observed; the ledger prices
  // the observation and decides the band. No tool accepts a confidence score.
  facts: defineTable({
    entityType: v.union(
      v.literal("company"),
      v.literal("contact"),
      v.literal("deal"),
    ),
    entityId: v.string(),
    field: v.string(),
    value: v.string(),
    evidenceKind: v.string(),
    band: evidenceBand,
    sourceUrl: v.optional(v.string()),
    // Weak evidence becomes a suggestion a human settles.
    settled: v.union(
      v.literal("written"),
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
  }).index("by_entityId", ["entityId"]),

  // Per-record agent chat threads, mapped to Agent component threads.
  chatThreads: defineTable({
    threadId: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_threadId", ["threadId"]),
});
