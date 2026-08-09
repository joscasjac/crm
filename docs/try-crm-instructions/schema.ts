// convex/schema.ts
//
// Convex port of packages/db/prisma/schema.prisma (trycompai/crm).
//
// Read the conventions before editing:
//
//  1. `_id` replaces every Prisma `id`. `_creationTime` replaces every
//     `createdAt @default(now())`. A second timestamp the original tracked
//     (`updatedAt`, `decidedAt`, `sentAt`) stays as v.number() epoch millis.
//  2. Every Prisma DateTime is v.number() epoch millis. Never a string.
//  3. Money is an integer count of minor units in a `*Minor` field. Prisma
//     Decimal(14,2) of 1250.00 USD becomes amountMinor 125000, currency USD.
//     FX rates stay v.number(). Never store money as a fractional float.
//  4. Prisma @unique has no Convex equivalent. Each one gets an index here
//     and a check inside the mutation that writes it.
//  5. Prisma onDelete: Cascade has no Convex equivalent. Cascades are hand
//     written in convex/model/cascade.ts.
//  6. Convex Auth owns users, authSessions, authAccounts, authRefreshTokens,
//     authVerificationCodes, authVerifiers, authRateLimits. Better Auth's
//     user/session/account/verification/rateLimit tables are gone, and so are
//     organization/member/invitation/ssoProvider. This app is single tenant
//     by design, matching the upstream ADR.
//  7. v.any() appears only where the original column was free-form JSON from
//     a model or a vendor. Everything else is typed.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const dealStage = v.union(
  v.literal("DEMO_BOOKED"),
  v.literal("QUALIFIED_TO_BUY"),
  v.literal("UNQUALIFIED_TO_BUY"),
  v.literal("DECISION_MAKER_BOUGHT_IN"),
  v.literal("CONTRACT_SENT"),
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
  v.literal("PENDING"),
  v.literal("RUNNING"),
  v.literal("COMPLETE"),
  v.literal("FAILED"),
  v.literal("SKIPPED"),
);

export const recordSource = v.union(
  v.literal("MANUAL"),
  v.literal("IMPORT"),
  v.literal("EMAIL"),
  v.literal("CALENDAR"),
);

export const factBand = v.union(
  v.literal("VERIFIED"),
  v.literal("PROBABLE"),
  v.literal("POSSIBLE"),
);

export const factStatus = v.union(
  v.literal("APPLIED"),
  v.literal("PROPOSED"),
  v.literal("DISMISSED"),
  v.literal("SUPERSEDED"),
);

export const conversationKind = v.union(
  v.literal("RECORD"),
  v.literal("BUILDER"),
);

export const agentDefinitionStatus = v.union(
  v.literal("DRAFT"),
  v.literal("DEPLOYING"),
  v.literal("LIVE"),
  v.literal("PAUSED"),
  v.literal("ARCHIVED"),
  v.literal("DELETED"),
);

export const agentVersionStatus = v.union(
  v.literal("DRAFT"),
  v.literal("VALIDATING"),
  v.literal("READY"),
  v.literal("DEPLOYED"),
  v.literal("REJECTED"),
);

export const builderArtifactStatus = v.union(
  v.literal("WRITING"),
  v.literal("READY"),
);

export const agentTriggerType = v.union(
  v.literal("MANUAL"),
  v.literal("SCHEDULE"),
  v.literal("EVENT"),
  v.literal("WEBHOOK"),
);

export const agentRunStatus = v.union(
  v.literal("QUEUED"),
  v.literal("RUNNING"),
  v.literal("WAITING_FOR_APPROVAL"),
  v.literal("SUCCEEDED"),
  v.literal("FAILED"),
  v.literal("CANCELLED"),
);

export const agentActionStatus = v.union(
  v.literal("PLANNED"),
  v.literal("RUNNING"),
  v.literal("SUCCEEDED"),
  v.literal("FAILED"),
  v.literal("CANCELLED"),
);

export const submissionStatus = v.union(
  v.literal("PENDING"),
  v.literal("SENDING"),
  v.literal("ACCEPTED"),
  v.literal("FAILED"),
  v.literal("CANCELLED"),
);

export const commandType = v.union(
  v.literal("CHAT"),
  v.literal("CREATE_AGENT"),
);

export const responseRating = v.union(v.literal("UP"), v.literal("DOWN"));

export const fieldEntity = v.union(
  v.literal("COMPANY"),
  v.literal("CONTACT"),
  v.literal("DEAL"),
);

export const fieldType = v.union(
  v.literal("TEXT"),
  v.literal("LONG_TEXT"),
  v.literal("NUMBER"),
  v.literal("DATE"),
  v.literal("CHECKBOX"),
  v.literal("SELECT"),
  v.literal("URL"),
  v.literal("EMAIL"),
  v.literal("PHONE"),
  v.literal("USER"),
);

export const syncStatus = v.union(
  v.literal("IDLE"),
  v.literal("RUNNING"),
  v.literal("NEEDS_RECONNECT"),
  v.literal("FAILED"),
);

export const emailDirection = v.union(
  v.literal("INBOUND"),
  v.literal("OUTBOUND"),
);

export const mailboxProvider = v.union(
  v.literal("google"),
  v.literal("microsoft"),
);

export const rateSource = v.union(v.literal("FETCHED"), v.literal("MANUAL"));

export const workspaceRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

// ---------------------------------------------------------------------------
// Evidence ledger, ported from apps/agent/agent/lib/evidence.ts
// ---------------------------------------------------------------------------

export const evidenceKind = v.union(
  v.literal("profile.email-match"),
  v.literal("linkedin.employer-and-name"),
  v.literal("crm.thread-reply"),
  v.literal("crm.signature-block"),
  v.literal("github.account-identity"),
  v.literal("crm.meeting-attendance"),
  v.literal("web.cited-claim"),
  v.literal("handle.name-form"),
  v.literal("search.cites-profile"),
  v.literal("employer-only"),
  v.literal("contradiction"),
);

export const evidenceItem = v.object({
  kind: evidenceKind,
  detail: v.string(),
  sourceUrl: v.optional(v.string()),
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export default defineSchema({
  // -------------------------------------------------------------------------
  // Convex Auth tables, inlined so `users` can carry app fields.
  // Every field and index below is required by @convex-dev/auth. Add columns,
  // never remove them. See labs.convex.dev/auth/setup/schema.
  // -------------------------------------------------------------------------
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App fields
    role: v.optional(workspaceRole),
    disabledAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
  }).index("userId", ["userId"]),

  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),

  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id("authRefreshTokens")),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionIdAndParentRefreshTokenId", [
      "sessionId",
      "parentRefreshTokenId",
    ]),

  authVerificationCodes: defineTable({
    accountId: v.id("authAccounts"),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("accountId", ["accountId"])
    .index("code", ["code"]),

  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.optional(v.string()),
  }).index("signature", ["signature"]),

  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsLeft: v.number(),
  }).index("identifier", ["identifier"]),

  // -------------------------------------------------------------------------
  // Core CRM records
  // -------------------------------------------------------------------------

  companies: defineTable({
    name: v.string(),
    domain: v.optional(v.string()), // unique, checked in the mutation
    website: v.optional(v.string()),
    description: v.optional(v.string()),

    // Brand assets. storageId is the Convex file storage mirror that replaces
    // Vercel Blob. The *Url fields keep the remote source for a re-fetch.
    logoStorageId: v.optional(v.id("_storage")),
    logoDarkStorageId: v.optional(v.id("_storage")),
    iconStorageId: v.optional(v.id("_storage")),
    iconDarkStorageId: v.optional(v.id("_storage")),
    logoUrl: v.optional(v.string()),
    logoDarkUrl: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    iconDarkUrl: v.optional(v.string()),
    iconTone: v.optional(v.string()),
    brandColor: v.optional(v.string()),

    industry: v.optional(v.string()),
    subIndustry: v.optional(v.string()),
    city: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),

    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    pricingUrl: v.optional(v.string()),
    careersUrl: v.optional(v.string()),

    ownerId: v.optional(v.id("users")),
    primaryContactId: v.optional(v.id("contacts")),

    enrichmentStatus: enrichmentStatus,
    enrichedAt: v.optional(v.number()),
    enrichmentError: v.optional(v.string()),

    source: recordSource,
    lastActivityAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_domain", ["domain"])
    .index("by_owner", ["ownerId"])
    .index("by_name", ["name"])
    .index("by_lastActivity", ["lastActivityAt"])
    .index("by_enrichmentStatus", ["enrichmentStatus"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId", "industry"],
    }),

  companyEnrichments: defineTable({
    companyId: v.id("companies"),
    source: v.string(), // "context.dev"
    raw: v.any(),
    fetchedAt: v.number(),
  }).index("by_company", ["companyId"]),

  contacts: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    // Denormalized for the search index. Rewrite it on every name change.
    fullName: v.string(),
    email: v.optional(v.string()), // unique, checked in the mutation
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),

    socialsCheckedAt: v.optional(v.number()),

    enrichmentStatus: enrichmentStatus,
    enrichedAt: v.optional(v.number()),
    enrichmentError: v.optional(v.string()),

    companyId: v.optional(v.id("companies")),
    ownerId: v.optional(v.id("users")),

    source: recordSource,
    lastActivityAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_company", ["companyId"])
    .index("by_owner", ["ownerId"])
    .index("by_lastActivity", ["lastActivityAt"])
    .index("by_enrichmentStatus", ["enrichmentStatus"])
    .searchIndex("search_name", {
      searchField: "fullName",
      filterFields: ["companyId", "ownerId"],
    }),

  contactFacts: defineTable({
    contactId: v.id("contacts"),
    // name | title | employer | seniority | function | location | tenure
    // | linkedinUrl | twitterUrl | githubUrl
    field: v.string(),
    value: v.string(),
    score: v.number(),
    band: factBand,
    evidence: v.array(evidenceItem),
    method: v.string(),
    sourceUrl: v.optional(v.string()),
    threadId: v.optional(v.string()), // Agent component thread, was sessionId
    status: factStatus,
    decidedById: v.optional(v.id("users")),
    decidedAt: v.optional(v.number()),
    observedAt: v.number(),
    supersededAt: v.optional(v.number()),
  })
    .index("by_contact_field_status", ["contactId", "field", "status"])
    .index("by_status_observedAt", ["status", "observedAt"])
    .index("by_contact", ["contactId"]),

  contactBriefs: defineTable({
    contactId: v.id("contacts"),
    narrative: v.string(),
    sections: v.any(),
    score: v.number(),
    sourceUrl: v.optional(v.string()),
    threadId: v.optional(v.string()),
    refreshedAt: v.number(),
  }).index("by_contact", ["contactId"]),

  deals: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    companyId: v.id("companies"),
    ownerId: v.id("users"),

    stage: dealStage,
    stageChangedAt: v.number(),

    amountMinor: v.optional(v.number()),
    currency: v.string(),
    expectedCloseDate: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    closedReason: v.optional(v.string()),

    baseAmountMinor: v.optional(v.number()),
    baseCurrency: v.optional(v.string()),
    fxRate: v.optional(v.number()),
    fxRateAt: v.optional(v.number()),

    lastActivityAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_owner", ["ownerId"])
    .index("by_stage", ["stage"])
    .index("by_expectedCloseDate", ["expectedCloseDate"])
    .index("by_lastActivity", ["lastActivityAt"])
    .index("by_currency", ["currency"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId", "stage"],
    }),

  dealContacts: defineTable({
    dealId: v.id("deals"),
    contactId: v.id("contacts"),
    role: v.optional(v.string()),
  })
    .index("by_deal", ["dealId"])
    .index("by_contact", ["contactId"])
    .index("by_deal_contact", ["dealId", "contactId"]),

  exchangeRates: defineTable({
    baseCurrency: v.string(),
    quoteCurrency: v.string(),
    rate: v.number(),
    asOf: v.number(),
    source: rateSource,
    provider: v.optional(v.string()),
  })
    .index("by_pair_source", ["baseCurrency", "quoteCurrency", "source"])
    .index("by_pair", ["baseCurrency", "quoteCurrency"]),

  // -------------------------------------------------------------------------
  // Custom fields
  // -------------------------------------------------------------------------

  fieldDefinitions: defineTable({
    entity: fieldEntity,
    key: v.string(),
    label: v.string(),
    type: fieldType,
    agentFilled: v.boolean(),
    agentBrief: v.optional(v.string()),
    required: v.boolean(),
    showOnSheet: v.boolean(),
    showOnTable: v.boolean(),
    position: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_entity_key", ["entity", "key"])
    .index("by_entity_position", ["entity", "position"]),

  fieldOptions: defineTable({
    fieldId: v.id("fieldDefinitions"),
    label: v.string(),
    position: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_field_position", ["fieldId", "position"]),

  fieldValues: defineTable({
    fieldId: v.id("fieldDefinitions"),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),

    text: v.optional(v.string()),
    number: v.optional(v.number()),
    date: v.optional(v.number()),
    bool: v.optional(v.boolean()),
    optionId: v.optional(v.id("fieldOptions")),
    userId: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_field_company", ["fieldId", "companyId"])
    .index("by_field_contact", ["fieldId", "contactId"])
    .index("by_field_deal", ["fieldId", "dealId"])
    .index("by_field_text", ["fieldId", "text"])
    .index("by_field_number", ["fieldId", "number"])
    .index("by_field_date", ["fieldId", "date"])
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"]),

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  activities: defineTable({
    type: activityType,
    subject: v.optional(v.string()),
    body: v.optional(v.string()),

    occurredAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),

    // Unset when the agent wrote the row. `actor` says which.
    createdById: v.optional(v.id("users")),
    actor: v.union(v.literal("user"), v.literal("agent")),
    meta: v.optional(v.any()),

    emailThreadId: v.optional(v.id("emailThreads")),
    calendarEventId: v.optional(v.id("calendarEvents")),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_dueAt", ["dueAt"])
    .index("by_createdBy_dueAt", ["createdById", "dueAt"])
    .index("by_emailThread", ["emailThreadId"])
    .index("by_calendarEvent", ["calendarEventId"]),

  // -------------------------------------------------------------------------
  // Mailbox and calendar sync
  // -------------------------------------------------------------------------

  // Sign-in identity and mailbox access are separate concerns on Convex Auth.
  // Convex Auth does not persist OAuth access or refresh tokens, so
  // "Connect mailbox" runs its own OAuth code exchange in an HTTP action and
  // writes the result here. Read convex/model/mailboxAuth.ts before touching.
  mailboxConnections: defineTable({
    userId: v.id("users"),
    provider: mailboxProvider,
    externalAccountId: v.string(),
    emailAddress: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user_provider", ["userId", "provider"])
    .index("by_user", ["userId"]),

  mailboxSyncs: defineTable({
    userId: v.id("users"),
    source: v.string(), // gmail | outlook | google-calendar
    status: syncStatus,
    cursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    retryAfter: v.optional(v.number()),
    autoCreate: v.boolean(),
  })
    .index("by_user_source", ["userId", "source"])
    .index("by_status", ["status"]),

  emailThreads: defineTable({
    rootMessageId: v.string(),
    subject: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    firstMessageAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
  })
    .index("by_rootMessageId", ["rootMessageId"])
    .index("by_company_lastMessageAt", ["companyId", "lastMessageAt"])
    .index("by_contact_lastMessageAt", ["contactId", "lastMessageAt"]),

  emailMessages: defineTable({
    threadId: v.id("emailThreads"),
    rfcMessageId: v.string(),
    syncedByUserId: v.optional(v.id("users")),
    gmailMessageId: v.optional(v.string()),
    outlookMessageId: v.optional(v.string()),
    outlookWebLink: v.optional(v.string()),

    direction: emailDirection,
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    recipients: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
        kind: v.union(v.literal("to"), v.literal("cc"), v.literal("bcc")),
      }),
    ),
    subject: v.optional(v.string()),
    snippet: v.optional(v.string()),
    body: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_rfcMessageId", ["rfcMessageId"])
    .index("by_thread_sentAt", ["threadId", "sentAt"])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["threadId", "fromEmail"],
    }),

  calendarEvents: defineTable({
    iCalUid: v.string(),
    originalStartTime: v.number(),
    recurringEventId: v.optional(v.string()),

    title: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    conferenceUrl: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    isAllDay: v.boolean(),
    status: v.string(),
    organizerEmail: v.optional(v.string()),

    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    syncedByUserId: v.optional(v.id("users")),
    googleEventId: v.optional(v.string()),
  })
    .index("by_uid_start", ["iCalUid", "originalStartTime"])
    .index("by_company_startsAt", ["companyId", "startsAt"])
    .index("by_contact_startsAt", ["contactId", "startsAt"]),

  calendarAttendees: defineTable({
    eventId: v.id("calendarEvents"),
    email: v.string(),
    name: v.optional(v.string()),
    responseStatus: v.optional(v.string()),
    isOrganizer: v.boolean(),
    contactId: v.optional(v.id("contacts")),
  })
    .index("by_event_email", ["eventId", "email"])
    .index("by_contact", ["contactId"]),

  suppressedDomains: defineTable({
    domain: v.string(),
    reason: v.optional(v.string()),
  }).index("by_domain", ["domain"]),

  suppressedContacts: defineTable({
    email: v.string(),
    reason: v.optional(v.string()),
  }).index("by_email", ["email"]),

  // -------------------------------------------------------------------------
  // Agent work queue
  // -------------------------------------------------------------------------

  // The Postgres FOR UPDATE SKIP LOCKED lease becomes a Convex mutation that
  // reads by_state_priority_dueAt and writes leasedUntil in one transaction.
  // Convex mutations are serializable, so two dispatchers cannot take the
  // same row and a run that dies frees its row when the lease expires.
  agentTasks: defineTable({
    contactId: v.optional(v.id("contacts")),
    companyId: v.optional(v.id("companies")),
    kind: v.string(),
    reason: v.string(),
    priority: v.number(),
    budget: v.number(),
    attempts: v.number(),
    dueAt: v.number(),
    leasedUntil: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    threadId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
    // Denormalized so one index range finds claimable work.
    state: v.union(v.literal("open"), v.literal("done")),
  })
    .index("by_state_dueAt", ["state", "dueAt"])
    .index("by_state_priority_dueAt", ["state", "priority", "dueAt"])
    .index("by_state_kind_dueAt", ["state", "kind", "dueAt"])
    .index("by_contact", ["contactId"])
    .index("by_company", ["companyId"]),

  agentEvents: defineTable({
    threadId: v.string(),
    contactId: v.optional(v.id("contacts")),
    type: v.string(),
    data: v.any(),
    emittedAt: v.number(),
  })
    .index("by_thread_emittedAt", ["threadId", "emittedAt"])
    .index("by_contact_emittedAt", ["contactId", "emittedAt"]),

  // -------------------------------------------------------------------------
  // Conversations: record chat and the agent builder
  // -------------------------------------------------------------------------

  // Message bodies live in the Agent component, keyed by threadId. This table
  // holds the CRM-side link, ordering, and read state.
  agentConversations: defineTable({
    kind: conversationKind,
    contactId: v.optional(v.id("contacts")),
    companyId: v.optional(v.id("companies")),
    dealId: v.optional(v.id("deals")),
    userId: v.id("users"),
    agentId: v.optional(v.id("agentDefinitions")),

    threadId: v.optional(v.string()),
    streamIndex: v.number(),

    title: v.optional(v.string()),
    messageCount: v.number(),

    lastMessageAt: v.number(),
    lastAssistantAt: v.optional(v.number()),
    lastReadAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_contact_lastMessageAt", ["contactId", "lastMessageAt"])
    .index("by_company_lastMessageAt", ["companyId", "lastMessageAt"])
    .index("by_deal_lastMessageAt", ["dealId", "lastMessageAt"])
    .index("by_user_kind_lastMessageAt", ["userId", "kind", "lastMessageAt"])
    .index("by_agent_lastMessageAt", ["agentId", "lastMessageAt"]),

  agentConversationFeedback: defineTable({
    conversationId: v.id("agentConversations"),
    userId: v.id("users"),
    messageId: v.string(),
    rating: responseRating,
    updatedAt: v.number(),
  })
    .index("by_conversation_user_message", [
      "conversationId",
      "userId",
      "messageId",
    ])
    .index("by_conversation", ["conversationId"]),

  agentConversationShares: defineTable({
    conversationId: v.id("agentConversations"),
    createdById: v.id("users"),
    scope: v.literal("WORKSPACE_LINK"),
    tokenHash: v.string(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    // "One active share per conversation" is guarded in the mutation.
    .index("by_conversation_revokedAt", ["conversationId", "revokedAt"]),

  agentConversationSubmissions: defineTable({
    conversationId: v.id("agentConversations"),
    submittedById: v.id("users"),
    clientRequestId: v.string(),
    inputRequestId: v.optional(v.string()),
    commandType: commandType,
    message: v.any(),
    status: submissionStatus,
    attemptCount: v.number(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_clientRequestId", ["clientRequestId"])
    .index("by_conversation_inputRequestId", [
      "conversationId",
      "inputRequestId",
    ])
    .index("by_conversation", ["conversationId"])
    .index("by_status", ["status"]),

  agentConversationAttachments: defineTable({
    submissionId: v.id("agentConversationSubmissions"),
    name: v.string(),
    mediaType: v.string(),
    size: v.number(),
    // Prisma Bytes becomes Convex file storage.
    storageId: v.id("_storage"),
    position: v.number(),
  }).index("by_submission_position", ["submissionId", "position"]),

  // -------------------------------------------------------------------------
  // Agent builder: definitions, versions, triggers, runs, actions, audit
  // -------------------------------------------------------------------------

  agentDefinitions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: agentDefinitionStatus,
    createdById: v.id("users"),
    currentVersionId: v.optional(v.id("agentVersions")),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdById"]),

  agentVersions: defineTable({
    agentId: v.id("agentDefinitions"),
    number: v.number(),
    status: agentVersionStatus,
    instructions: v.string(),
    manifest: v.any(),
    modelId: v.string(),
    modelContextWindowTokens: v.number(),
    sandboxPolicy: v.any(),
    validation: v.optional(v.any()),
    sourceConversationId: v.optional(v.id("agentConversations")),
    createdById: v.id("users"),
    // Deploying is a row flip, not a code push. The runner reads instructions
    // and manifest from this document at run time.
    approvedAt: v.optional(v.number()),
    deployedAt: v.optional(v.number()),
  })
    .index("by_agent_number", ["agentId", "number"])
    .index("by_agent", ["agentId"])
    .index("by_status", ["status"]),

  agentBuilderArtifacts: defineTable({
    conversationId: v.optional(v.id("agentConversations")),
    versionId: v.optional(v.id("agentVersions")),
    path: v.string(),
    language: v.string(),
    content: v.string(),
    previousContent: v.optional(v.string()),
    revision: v.number(),
    status: builderArtifactStatus,
  })
    .index("by_conversation_path_revision", [
      "conversationId",
      "path",
      "revision",
    ])
    .index("by_version_path", ["versionId", "path"])
    .index("by_conversation", ["conversationId"]),

  agentTriggers: defineTable({
    agentId: v.id("agentDefinitions"),
    versionId: v.id("agentVersions"),
    type: agentTriggerType,
    name: v.string(),
    config: v.any(),
    createdById: v.id("users"),
    enabled: v.boolean(),
    // SCHEDULE triggers store the id returned by @convex-dev/crons.
    cronId: v.optional(v.string()),
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_agent_enabled", ["agentId", "enabled"])
    .index("by_enabled_nextRunAt", ["enabled", "nextRunAt"])
    .index("by_version", ["versionId"]),

  agentRuns: defineTable({
    agentId: v.id("agentDefinitions"),
    versionId: v.id("agentVersions"),
    triggerId: v.optional(v.id("agentTriggers")),
    initiatedById: v.optional(v.id("users")),

    triggerType: agentTriggerType,
    status: agentRunStatus,
    threadId: v.optional(v.string()),
    idempotencyKey: v.string(),
    correlationId: v.string(),
    // Workpool or Workflow handle, used for status and cancel.
    workId: v.optional(v.string()),

    input: v.optional(v.any()),
    result: v.optional(v.any()),
    summary: v.optional(v.string()),

    modelId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsdMicros: v.optional(v.number()), // integer micro-dollars

    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    nextEventSequence: v.number(),

    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_correlationId", ["correlationId"])
    .index("by_agent", ["agentId"])
    .index("by_version", ["versionId"])
    .index("by_status", ["status"])
    .index("by_trigger", ["triggerId"]),

  agentRunEvents: defineTable({
    runId: v.id("agentRuns"),
    sequence: v.number(),
    type: v.string(),
    data: v.any(),
    emittedAt: v.number(),
  }).index("by_run_sequence", ["runId", "sequence"]),

  agentActions: defineTable({
    agentId: v.id("agentDefinitions"),
    runId: v.id("agentRuns"),
    type: v.string(),
    provider: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetLabel: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
    status: agentActionStatus,
    idempotencyKey: v.string(),
    requestHash: v.optional(v.string()),
    externalId: v.optional(v.string()),
    attemptCount: v.number(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    plannedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_agent_plannedAt", ["agentId", "plannedAt"])
    .index("by_run_plannedAt", ["runId", "plannedAt"])
    .index("by_provider_externalId", ["provider", "externalId"])
    .index("by_status_plannedAt", ["status", "plannedAt"]),

  agentAuditEvents: defineTable({
    agentId: v.id("agentDefinitions"),
    versionId: v.optional(v.id("agentVersions")),
    actorUserId: v.optional(v.id("users")),
    type: v.string(),
    actorType: v.string(),
    actorId: v.optional(v.string()),
    summary: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    requestId: v.optional(v.string()),
    emittedAt: v.number(),
  })
    .index("by_agent_type_requestId", ["agentId", "type", "requestId"])
    .index("by_agent_emittedAt", ["agentId", "emittedAt"])
    .index("by_version_emittedAt", ["versionId", "emittedAt"])
    .index("by_actor_emittedAt", ["actorUserId", "emittedAt"])
    .index("by_type_emittedAt", ["type", "emittedAt"]),

  // -------------------------------------------------------------------------
  // Workspace, settings, telemetry
  // -------------------------------------------------------------------------

  // Singleton tables. Read with .first(), write through a get-or-create
  // helper in convex/model/settings.ts. One row each.
  appSettings: defineTable({
    agentModelId: v.optional(v.string()),
    agentModelContextWindow: v.optional(v.number()),
    contextDevApiKey: v.optional(v.string()),
    researchApiKey: v.optional(v.string()),
    reportingCurrency: v.optional(v.string()),
    ratesRefreshedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }),

  workspace: defineTable({
    name: v.string(),
    slug: v.string(),
    website: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    // Sign-in allow list: whole domains, single addresses, or a mix.
    // Empty means nobody signs in, matching upstream ALLOWED_SIGN_IN.
    allowedSignIn: v.array(v.string()),
    onboardedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  workspaceProfiles: defineTable({
    website: v.string(),
    narrative: v.string(),
    sections: v.any(),
    sourceUrl: v.optional(v.string()),
    threadId: v.optional(v.string()),
    refreshedAt: v.number(),
  }),

  install: defineTable({
    uuid: v.string(),
    version: v.string(),
    lastRollupAt: v.optional(v.number()),
  }).index("by_uuid", ["uuid"]),

  telemetryMilestones: defineTable({
    step: v.string(),
    reachedAt: v.number(),
  }).index("by_step", ["step"]),

  telemetryCounters: defineTable({
    name: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),
});
