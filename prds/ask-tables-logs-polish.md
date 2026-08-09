# Ask chat, table upgrades, activity log, sidebar prefs, and polish

Created: 2026-08-09 07:55 UTC
Last Updated: 2026-08-09 08:20 UTC
Status: Done

## Problem

The demo works but several screens are static where users expect interaction,
the AI layer is locked to OpenAI, and the docs skip auth setup. The user asked
for: tighter landing spacing, a smaller create agent button, a demo badge in
the sidebar header, a fork link, sortable/filterable tables with inline add
rows, a drag and drop deals board plus a list view, a reorderable and hideable
sidebar, a Claude-style Ask chat page with OpenAI/Anthropic/OpenRouter support
and slash commands, a command-K search, an activity log page styled like the
Convex dashboard, and docs/README/compare updates including Convex Auth links
and static hosting instructions.

## Proposed solution

Backend (all keyless-safe, demo reset aware):

- schema: workspace gains `aiProvider`, `sidebarOrder`, `sidebarHidden`;
  new tables `askThreads` (threadId, title, archived) and `logEvents`
  (kind, fn, status, message). Both wiped by the demo reset.
- `convex/ai.ts`: pick the language model from workspace.aiProvider plus env
  keys. openai -> gpt-5-mini, anthropic -> claude-sonnet-4-5 via
  @ai-sdk/anthropic, openrouter -> OpenAI-compatible baseURL. Honest
  degradation message names the key that enables the provider.
- `convex/ask.ts`: workspace-wide chat. Threads CRUD (create, rename via
  first prompt, archive, unarchive, delete), send (saves message, schedules
  generate), messages (listUIMessages). Tools: crm_overview (read whole CRM),
  search_the_web (Exa), read_web_page (Firecrawl).
- `convex/logs.ts`: `logEvent` plain helper for mutations + `record`
  internalMutation for actions; `list` query (take 200 desc), `clear`
  writeMutation. Hooks in demo reset/seed, companies, contacts, deals,
  agentTasks, enrichment, email, ask, chat.
- `convex/search.ts`: `global` query over companies, contacts, deals by name
  fragment (bounded take, demo scale).
- `convex/prefs.ts`: sidebar order/hidden query + mutations, aiProvider
  query + setter.
- capabilities: add anthropic + openrouter.
- demo reset TABLES: add askThreads, logEvents.

Frontend:

- Landing: tighten vertical rhythm (hero pb, section py), keep composition.
- ui.tsx Button: whitespace-nowrap so "Create agent" stays one line.
- AppLayout: "CRM on Convex" + small demo badge, search trigger (cmd-K),
  nav driven by prefs (order + hidden) with HTML5 drag reorder, Ask and
  Activity entries, Docs, GitHub + Fork links, theme toggle.
- `components/CommandK.tsx`: global palette, / and cmd-K open, searches CRM.
- `app/Ask.tsx`: Claude-like layout. Sub-sidebar with chats + archived,
  new chat, archive/delete. Main pane: greeting, big composer, slash command
  menu (/search, /read, /crm), provider note from capabilities.
- `app/Activity.tsx`: dashboard-style log table (time, badge, function,
  message) with Pause and Clear logs.
- Deals: native drag and drop between columns + board/list toggle; list is a
  sortable table.
- Companies/Contacts: sortable headers, filter (enrichment status / has
  company), inline add row at the bottom of the table wired to existing
  create mutations (enrichment still queues on domain).
- Settings: AI provider picker with key badges, sidebar visibility
  checkboxes, new integration rows.
- Landing built-with second row: add OpenAI, Claude, OpenRouter names.
- Compare: rows for AI providers, workspace chat, command-K, activity log.
- Docs: auth section links (docs.convex.dev/auth/overview, Convex Auth,
  Clerk/WorkOS/Auth0 note), explicit static hosting component explanation,
  new features, env table rows for ANTHROPIC_API_KEY and OPENROUTER_API_KEY.
- README: new features, env table, unchanged copy prompt (new keys optional).

## Files to change

convex/: schema.ts, ai.ts (new), ask.ts (new), logs.ts (new), search.ts
(new), prefs.ts (new), capabilities.ts, demo.ts, companies.ts, contacts.ts,
deals.ts, agentTasks.ts, enrichment.ts, email.ts, chat.ts
src/: App.tsx, app/AppLayout.tsx, app/Ask.tsx (new), app/Activity.tsx (new),
app/Deals.tsx, app/Companies.tsx, app/Contacts.tsx, app/Agents.tsx,
app/Settings.tsx, components/ui.tsx, components/CommandK.tsx (new),
pages/Landing.tsx, pages/Compare.tsx, pages/Docs.tsx
Docs: README.md, changelog.md, files.md, task.md

## Edge cases

- No AI keys at all: Ask replies with the provider note, never errors.
- Anthropic/OpenRouter selected but key missing: reply names the key.
- Demo reset mid-chat: askThreads row disappears; UI falls back to new chat.
- Sidebar prefs reset every 10 minutes with the workspace row (demo behavior,
  documented).
- Drag and drop uses native HTML5 events; the stage select stays as a
  fallback for keyboard and touch.
- logEvents kept bounded: list takes 200, reset wipes, clear available.

## Verification

npm run lint, npm run check-types, npm run build, convex dev push, browser
pass over ask (no key reply), command-K, deals dnd + list, table sort/filter/
add row, sidebar reorder + hide, activity log pause/clear, both themes.

## Task log

- 2026-08-09 07:55 UTC created.
- 2026-08-09 08:20 UTC done. All backend modules (ai, prefs, logs, search, ask) and frontend surfaces (Ask, Activity, CommandK, AppLayout nav dnd, Deals board dnd + list, Companies/Contacts sort/filter/add, Settings pickers) shipped. Docs, README, changelog, files.md synced. Verified: lint clean, both typechecks clean, convex dev push green, browser pass over Ask (missing-key reply cites OPENAI_API_KEY), search:global returns results, Deals list view sorts, Settings hide/show round-trips sidebarHidden on the workspace row, Activity log streams companies:create / ask:send / ask:generate / demo:reset rows with pause and clear. Fixed during verification: languageModelFor now returns LanguageModelV3 (agent component type), nav drag ids widened to string[], Activity timestamp ms floored.
