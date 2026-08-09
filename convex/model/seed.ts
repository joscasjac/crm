import type { MutationCtx } from "../_generated/server";
import { trackDealInsert } from "../aggregates";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// A believable pipeline to look at. Every asset referenced here ships in
// public/landing, so nothing is a placeholder.
export async function seedAll(ctx: MutationCtx, now: number): Promise<void> {
  await ctx.db.insert("workspace", {
    name: "Comp AI",
    demoMode: true,
    allowedSignIn: [],
    reportingCurrency: "USD",
    agentModel: "gpt-5-mini",
    lastResetAt: now,
  });

  const patrick = await ctx.db.insert("users", {
    name: "Patrick Onusko",
    email: "patrick@trycomp.ai",
    role: "owner",
    avatarUrl: "/landing/avatar-patrick.jpg",
  });
  const dan = await ctx.db.insert("users", {
    name: "Dan Cole",
    email: "dan@trycomp.ai",
    role: "member",
    avatarUrl: "/landing/avatar-dan.png",
  });
  const lewis = await ctx.db.insert("users", {
    name: "Lewis Marsh",
    email: "lewis@trycomp.ai",
    role: "member",
    avatarUrl: "/landing/avatar-user.png",
  });

  // Companies
  const compai = await ctx.db.insert("companies", {
    name: "Comp AI",
    domain: "trycomp.ai",
    industry: "Compliance",
    description:
      "Automated SOC 2, ISO 27001, and GDPR compliance for startups.",
    ownerId: patrick,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 2 * HOUR,
  });
  const tristar = await ctx.db.insert("companies", {
    name: "Tristar Fulfillment",
    domain: "tristarfulfillment.com",
    industry: "Logistics",
    logoUrl: "/landing/logos/tristar-fulfillment.webp",
    ownerId: dan,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 5 * HOUR,
  });
  const auditbot = await ctx.db.insert("companies", {
    name: "AuditBot",
    domain: "auditbot.co",
    industry: "Developer Tools",
    logoUrl: "/landing/logos/auditbot.webp",
    ownerId: lewis,
    enrichmentStatus: "RESEARCHING",
    lastActivityAt: now - DAY,
  });
  const tawkeed = await ctx.db.insert("companies", {
    name: "Tawkeed",
    domain: "tawkeed.ai",
    industry: "AI",
    logoUrl: "/landing/logos/tawkeed.webp",
    ownerId: patrick,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 2 * DAY,
  });
  const piku = await ctx.db.insert("companies", {
    name: "Piku",
    domain: "piku.com",
    industry: "Retail & E-commerce",
    logoUrl: "/landing/logos/piku.webp",
    ownerId: dan,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 3 * DAY,
  });
  const roo = await ctx.db.insert("companies", {
    name: "Roo Capital",
    domain: "roocapital.com",
    industry: "Financial Services",
    logoUrl: "/landing/logos/roo-capital.webp",
    ownerId: lewis,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 4 * DAY,
  });
  const socialgood = await ctx.db.insert("companies", {
    name: "Social Good Software",
    domain: "socialgoodsoftware.com",
    industry: "Nonprofit Tech",
    logoUrl: "/landing/logos/social-good-software.webp",
    ownerId: patrick,
    enrichmentStatus: "ENRICHED",
    lastActivityAt: now - 6 * DAY,
  });
  const ridgetop = await ctx.db.insert("companies", {
    name: "Ridgetop",
    domain: "ridgetoptech.com",
    industry: "IT Services",
    logoUrl: "/landing/logos/ridgetop.webp",
    ownerId: dan,
    enrichmentStatus: "NONE",
    lastActivityAt: now - 9 * DAY,
  });

  // Contacts
  const paula = await ctx.db.insert("contacts", {
    name: "Paula Marchetti",
    email: "paula@tristarfulfillment.com",
    title: "VP Operations",
    companyId: tristar,
    ownerId: dan,
    lastActivityAt: now - 5 * HOUR,
  });
  const omar = await ctx.db.insert("contacts", {
    name: "Omar Haddad",
    email: "omar@tawkeed.ai",
    title: "Co-founder",
    companyId: tawkeed,
    ownerId: patrick,
    lastActivityAt: now - 2 * DAY,
  });
  const grace = await ctx.db.insert("contacts", {
    name: "Grace Lindqvist",
    email: "grace@auditbot.co",
    title: "Head of Security",
    companyId: auditbot,
    ownerId: lewis,
    lastActivityAt: now - DAY,
  });
  const marcus = await ctx.db.insert("contacts", {
    name: "Marcus Bell",
    email: "marcus@piku.com",
    title: "CTO",
    companyId: piku,
    ownerId: dan,
    lastActivityAt: now - 3 * DAY,
  });
  const yuki = await ctx.db.insert("contacts", {
    name: "Yuki Tanaka",
    email: "yuki@roocapital.com",
    title: "Partner",
    companyId: roo,
    ownerId: lewis,
    lastActivityAt: now - 4 * DAY,
  });
  const elena = await ctx.db.insert("contacts", {
    name: "Elena Vasquez",
    email: "elena@socialgoodsoftware.com",
    title: "CEO",
    companyId: socialgood,
    ownerId: patrick,
    lastActivityAt: now - 6 * DAY,
  });
  const sam = await ctx.db.insert("contacts", {
    name: "Sam Whitfield",
    email: "sam@trycomp.ai",
    title: "Head of Partnerships",
    companyId: compai,
    ownerId: patrick,
    lastActivityAt: now - 2 * HOUR,
  });

  await ctx.db.patch("companies", tristar, { primaryContactId: paula });
  await ctx.db.patch("companies", tawkeed, { primaryContactId: omar });
  await ctx.db.patch("companies", auditbot, { primaryContactId: grace });
  await ctx.db.patch("companies", piku, { primaryContactId: marcus });
  await ctx.db.patch("companies", roo, { primaryContactId: yuki });
  await ctx.db.patch("companies", socialgood, { primaryContactId: elena });
  await ctx.db.patch("companies", compai, { primaryContactId: sam });

  // Deals. Money is integer minor units: $48,000.00 is 4800000.
  const deals = [
    {
      name: "Tristar annual platform",
      companyId: tristar,
      stage: "NEGOTIATION" as const,
      amountMinor: 4800000,
      ownerId: dan,
      primaryContactId: paula,
      expectedCloseAt: now + 12 * DAY,
    },
    {
      name: "AuditBot security suite",
      companyId: auditbot,
      stage: "PROPOSAL" as const,
      amountMinor: 2600000,
      ownerId: lewis,
      primaryContactId: grace,
      expectedCloseAt: now + 21 * DAY,
    },
    {
      name: "Tawkeed pilot",
      companyId: tawkeed,
      stage: "MEETING" as const,
      amountMinor: 900000,
      ownerId: patrick,
      primaryContactId: omar,
      expectedCloseAt: now + 30 * DAY,
    },
    {
      name: "Piku enterprise rollout",
      companyId: piku,
      stage: "QUALIFIED" as const,
      amountMinor: 7200000,
      ownerId: dan,
      primaryContactId: marcus,
      expectedCloseAt: now + 45 * DAY,
    },
    {
      name: "Roo Capital fund ops",
      companyId: roo,
      stage: "CLOSED_WON" as const,
      amountMinor: 3600000,
      ownerId: lewis,
      primaryContactId: yuki,
      closedAt: now - 3 * DAY,
    },
    {
      name: "Social Good renewal",
      companyId: socialgood,
      stage: "CLOSED_LOST" as const,
      amountMinor: 1500000,
      ownerId: patrick,
      primaryContactId: elena,
      closedAt: now - 8 * DAY,
    },
  ];
  const dealIds = [];
  for (const deal of deals) {
    const id = await ctx.db.insert("deals", { ...deal, currency: "USD" });
    const doc = await ctx.db.get("deals", id);
    if (doc) await trackDealInsert(ctx, doc);
    dealIds.push(id);
  }

  // Timeline
  await ctx.db.insert("activities", {
    type: "STAGE_CHANGE",
    body: "Moved to Negotiation after pricing call",
    companyId: tristar,
    dealId: dealIds[0],
    authorId: dan,
    meta: { fromStage: "PROPOSAL", toStage: "NEGOTIATION" },
  });
  await ctx.db.insert("activities", {
    type: "NOTE",
    body: "Paula confirmed the security review is the last open item. Legal wants the DPA countersigned before the 15th.",
    companyId: tristar,
    contactId: paula,
    dealId: dealIds[0],
    authorId: dan,
  });
  await ctx.db.insert("activities", {
    type: "MEETING",
    body: "Technical deep dive with Grace and two platform engineers. Asked for a sandbox tenant.",
    companyId: auditbot,
    contactId: grace,
    dealId: dealIds[1],
    authorId: lewis,
  });
  await ctx.db.insert("activities", {
    type: "EMAIL",
    body: "Omar replied from his own address confirming the pilot scope. Signature block lists him as Co-founder.",
    companyId: tawkeed,
    contactId: omar,
    authorId: patrick,
  });
  await ctx.db.insert("activities", {
    type: "ENRICHMENT",
    body: "Brand data refreshed from tristarfulfillment.com: logo, industry Logistics, 240 employees.",
    companyId: tristar,
  });
  await ctx.db.insert("activities", {
    type: "TASK",
    body: "Send Paula the countersigned DPA",
    companyId: tristar,
    contactId: paula,
    dealId: dealIds[0],
    authorId: dan,
    dueAt: now + 2 * DAY,
  });
  await ctx.db.insert("activities", {
    type: "TASK",
    body: "Book the AuditBot sandbox walkthrough",
    companyId: auditbot,
    contactId: grace,
    dealId: dealIds[1],
    authorId: lewis,
    dueAt: now + 4 * DAY,
  });
  await ctx.db.insert("activities", {
    type: "CALL",
    body: "Intro call with Marcus. Piku is consolidating vendors this quarter; wants a single-deployment story.",
    companyId: piku,
    contactId: marcus,
    dealId: dealIds[3],
    authorId: dan,
  });

  // Custom fields
  const tier = await ctx.db.insert("fieldDefinitions", {
    entity: "company",
    key: "tier",
    label: "Tier",
    type: "select",
    options: ["Strategic", "Growth", "Standard"],
    order: 1,
    archived: false,
    agentFilled: false,
  });
  await ctx.db.insert("fieldDefinitions", {
    entity: "company",
    key: "employee_count",
    label: "Employees",
    type: "number",
    order: 2,
    archived: false,
    agentFilled: true,
    agentBrief:
      "Headcount from the company website or their about page. Record the number only.",
  });
  const renewalDate = await ctx.db.insert("fieldDefinitions", {
    entity: "deal",
    key: "renewal_date",
    label: "Renewal date",
    type: "date",
    order: 1,
    archived: false,
    agentFilled: false,
  });
  await ctx.db.insert("fieldValues", {
    fieldId: tier,
    entityId: tristar,
    value: "Strategic",
  });
  await ctx.db.insert("fieldValues", {
    fieldId: tier,
    entityId: piku,
    value: "Growth",
  });
  await ctx.db.insert("fieldValues", {
    fieldId: renewalDate,
    entityId: dealIds[0],
    value: new Date(now + 358 * DAY).toISOString().slice(0, 10),
  });

  // The evidence ledger. Facts record what a tool observed, never a guess.
  await ctx.db.insert("facts", {
    entityType: "contact",
    entityId: omar,
    field: "title",
    value: "Co-founder",
    evidenceKind: "crm.signature-block",
    band: "CONFIRMED",
    settled: "written",
  });
  await ctx.db.insert("facts", {
    entityType: "contact",
    entityId: paula,
    field: "title",
    value: "VP Operations",
    evidenceKind: "crm.thread-reply",
    band: "PROBABLE",
    settled: "written",
  });
  await ctx.db.insert("facts", {
    entityType: "company",
    entityId: auditbot,
    field: "employee_count",
    value: "35",
    evidenceKind: "web.about-page",
    band: "POSSIBLE",
    sourceUrl: "https://auditbot.co/about",
    settled: "pending",
  });

  // The agent's own follow-ups, each with a stated reason. An agent that
  // cannot say why it will be back in fourteen days has a default, not a
  // reason.
  await ctx.db.insert("agentTasks", {
    kind: "RECHECK_CONTACT",
    state: "open",
    reason:
      "Paula mentioned a re-org closing mid-month. Recheck her title once the dust settles.",
    contactId: paula,
    companyId: tristar,
    priority: 2,
    dueAt: now + 14 * DAY,
    attempts: 0,
  });
  await ctx.db.insert("agentTasks", {
    kind: "BRIEF_OWNER",
    state: "open",
    reason: "Renewal call on the calendar in three days. Owner needs a brief.",
    companyId: tristar,
    priority: 1,
    dueAt: now + 2 * DAY,
    attempts: 0,
  });
  await ctx.db.insert("agentTasks", {
    kind: "ENRICH_COMPANY",
    state: "open",
    reason: "Ridgetop has no brand data and no industry on record.",
    companyId: ridgetop,
    priority: 3,
    dueAt: now + 5 * MINUTE,
    attempts: 0,
  });

  // Agent builder: one deployed agent with a version history, two drafts.
  const briefing = await ctx.db.insert("agentDefinitions", {
    name: "Renewal briefer",
    description: "Brief every deal owner before a renewal call",
    status: "deployed",
    trigger: { kind: "schedule", cronspec: "0 13 * * 1-5" },
  });
  const briefingV1 = await ctx.db.insert("agentVersions", {
    agentId: briefing,
    number: 1,
    instructions:
      "Before each renewal call, read the deal timeline, the last five threads, and open tasks. Write a one-page brief: what changed, open risks, and the single question the owner should ask.",
    toolNames: ["read_crm_history", "search_crm", "record_fact"],
    model: "gpt-5-mini",
    deployedAt: now - 6 * DAY,
  });
  await ctx.db.patch("agentDefinitions", briefing, { currentVersionId: briefingV1 });

  await ctx.db.insert("agentDefinitions", {
    name: "Stale deal flagger",
    description: "Flag deals with no activity for 14 days",
    status: "draft",
    trigger: { kind: "schedule", cronspec: "0 9 * * *" },
  });
  await ctx.db.insert("agentDefinitions", {
    name: "Onboarding handoff",
    description: "Hand new customers from Sales to Onboarding",
    status: "paused",
    trigger: { kind: "event", event: "deal.closed_won" },
  });

  // A finished run with visible steps, so the Agent tab shows its working.
  await ctx.db.insert("agentRuns", {
    companyId: tawkeed,
    contactId: omar,
    status: "done",
    startedAt: now - 2 * DAY,
    finishedAt: now - 2 * DAY + 90 * 1000,
    steps: [
      {
        at: now - 2 * DAY,
        kind: "plan",
        text: "Identify Omar Haddad. Start with our own history: threads, meetings, signature blocks.",
      },
      {
        at: now - 2 * DAY + 12 * 1000,
        kind: "tool",
        text: "read_crm_history(contact: Omar Haddad) — 4 threads, 1 meeting",
      },
      {
        at: now - 2 * DAY + 30 * 1000,
        kind: "observation",
        text: "Reply from omar@tawkeed.ai on the pilot thread. Signature: 'Omar Haddad, Co-founder, Tawkeed'. Evidence: crm.signature-block.",
      },
      {
        at: now - 2 * DAY + 41 * 1000,
        kind: "discard",
        text: "Discarded LinkedIn profile 'Omar H., Dubai' — different employer history, no email match. Not the same person.",
      },
      {
        at: now - 2 * DAY + 60 * 1000,
        kind: "write",
        text: "record_fact(title: Co-founder, evidence: crm.signature-block) — band CONFIRMED, written to record.",
      },
      {
        at: now - 2 * DAY + 90 * 1000,
        kind: "plan",
        text: "schedule_recheck(90d): startup titles change fast around fundraises. Tawkeed is raising.",
      },
    ],
    inputTokens: 4820,
    outputTokens: 312,
  });

  await ctx.db.insert("agentRuns", {
    companyId: auditbot,
    status: "running",
    startedAt: now - 4 * MINUTE,
    steps: [
      {
        at: now - 4 * MINUTE,
        kind: "plan",
        text: "Enrich AuditBot. No brand data on record; industry unknown.",
      },
      {
        at: now - 3 * MINUTE,
        kind: "tool",
        text: "enrich_company(domain: auditbot.co) — waiting on brand data",
      },
    ],
  });
}
