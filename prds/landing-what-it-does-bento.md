# Landing page: What it actually does as a bento with mock UI blocks

Created: 2026-08-09 23:02 UTC
Last Updated: 2026-08-09 23:20 UTC
Status: Done

## Problem

The "What it actually does" section on the landing page is six identical text cards. The original Comp AI landing sells the same features with screenshot style mock UI blocks (a companies table with enrichment badges, a suggested agents list, a recheck list, a record chat) that show the product instead of describing it. Our section reads flat next to that. The demo video also sits above the section, so visitors watch before they know what they are looking at.

## Proposed solution

Rebuild WhatItDoes as a bento grid of cards where each card pairs a short heading with a mock UI block built in JSX from the app's own design tokens. JSX blocks beat PNG screenshots here: they flip with the light and dark themes, stay crisp on retina, and never go stale when the real UI changes color. All content is real seeded demo data (companies, contacts, deals from convex/model/seed.ts) and real env key names, never invented placeholders.

Grid on lg (3 columns):

- Row 1: Records fill themselves in (span 2) + Ask any record a question (right column, spans rows 1 and 2)
- Row 2: Agents that build agents + It books its own follow-ups
- Row 3: Watch it work (1 col, activity log lines) + Bring your own keys (span 2, BYOK section)

Mock blocks:

- Records: three company rows with real logos from public/landing/logos (Tawkeed, Roo Capital, AuditBot), mono domains, Enriched badges in emerald and a pulsing Researching badge in yellow, matching the app's Pill tones.
- Ask: suggested question chips plus an input row with a send button, mirroring the record chat.
- Agents: three suggested agent rows with arrows, different examples than the AgentsSection above.
- Follow-ups: recheck rows with day chips (Paula Marchetti 14d, Social Good renewal 2d, Roo Capital fund ops 90d) and the WHY note.
- Watch it work: mono log lines like the Activity page stream.
- BYOK: three capability groups (Chat, Research, Email) listing providers with their real env key names as mono pills.

Also move DemoVideo below WhatItDoes in the Landing component order.

## Files to change

- src/pages/Landing.tsx: reorder sections, rebuild WhatItDoes with mock block subcomponents
- task.md, CHANGELOG.md, files.md: docs sync

## Edge cases

- Light mode: every tone used (emerald, yellow, edge, ink, panel) already remaps under html.light; verify with screenshots.
- Mobile: bento collapses to one column; spans only apply at sm and lg.
- Logos: webp files exist in public/landing/logos; alt text empty since names sit beside them.

## Verification steps

- eslint and tsc clean
- Screenshots of the section on localhost:5174 in dark and light mode
- Video section renders below WhatItDoes

## Task completion log

- 2026-08-09 23:02 UTC: PRD created.
- 2026-08-09 23:08 UTC: Implemented and verified. Bento built with six mock blocks, DemoVideo moved below the section, Ask card gained a Q and A exchange to fill the row-span-2 height. eslint and tsc clean; screenshots on localhost:5174 confirmed dark, light, desktop, and narrow layouts.
- 2026-08-09 23:20 UTC: Follow-up: folded the standalone AgentsSection into the bento as MockAgentBuilder (prompt input plus the seeded Renewal briefer and Stale deal flagger agents) and added MockSlack (#deals stage change message plus /crm command), MockWebResearch (search_web and read_page tool rows with a recorded fact), and MockAsk (/task exchange with command chips). Grid rebalanced to fit the nine cards. eslint and tsc clean; dark and light screenshots verified.
