# Files

Brief description of what each file does. Updated 2026-08-09 06:43 UTC.

## Root

| File | Description |
| --- | --- |
| `package.json` | Single npm package: scripts for dev, build, typecheck, deploy, seed |
| `vite.config.ts` | Vite with React and Tailwind 4 plugins |
| `tsconfig.json` | Project references to the app and convex tsconfigs |
| `tsconfig.app.json` | Frontend TypeScript config, strict mode |
| `index.html` | Vite entry HTML |
| `README.md` | Project overview, quick start, configuration, deploy guide |
| `CHANGELOG.md` | Convex port entries (2.0.0 through 2.2.0) on top of the upstream history |
| `task.md` | Work tracking for this port |
| `files.md` | This file |
| `eslint.config.js` | ESLint 9 flat config with the Convex plugin and type aware typescript-eslint |

## convex/ (backend)

| File | Description |
| --- | --- |
| `convex.config.ts` | Installs all components; declares the required `CONTEXT_DEV_API_KEY` env var |
| `schema.ts` | All tables: workspace, users, companies, contacts, deals, activities, custom fields, agent tasks, agent definitions and versions, runs, facts, chat threads |
| `http.ts` | App-owned root routing; static hosting registered as the catch-all |
| `staticHosting.ts` | Exposes the deployment query for live reload on deploy |
| `crons.ts` | Demo reset every 10 minutes, agent queue tick every minute |
| `aggregates.ts` | Deal rollups by stage and owner, with insert/replace/delete tracking helpers |
| `demo.ts` | Reset, first-boot seed, demo info for the banner, manual reset request |
| `companies.ts` | Company list, detail, create (queues enrichment), update, delete, re-enrich, names picker |
| `contacts.ts` | Contact list, detail with facts, create, update, delete |
| `deals.ts` | Board grouped by stage, create, update, stage change with activity log, delete |
| `activities.ts` | Timelines per record, open tasks, note creation, task completion |
| `fields.ts` | Custom field definitions and values, agent briefs, archiving |
| `dashboard.ts` | Pipeline summary from aggregates, recent activity feed |
| `agentTasks.ts` | The work queue: claim with leases, tick, execute through the workpool, rechecks with required reasons |
| `agents.ts` | Agent builder: draft from a sentence, versioned instructions, deploy and pause |
| `enrichment.ts` | Context.dev brand lookup with action cache and rate limiter, writes facts and timeline entries |
| `chat.ts` | Record chat on the agent component, with a read_crm_history tool and honest no-key replies |
| `email.ts` | Resend component wrapper; logs a no-op when no key is configured |
| `users.ts` | Team member list for pickers and avatars |
| `model/access.ts` | Write access checks; demo mode keeps writes open |
| `model/functions.ts` | `writeMutation` custom mutation from convex-helpers; runs the access check before every write |
| `model/cascade.ts` | Manual cascading deletes for companies, contacts, deals |
| `model/seed.ts` | Demo seed content: workspace, team, companies, contacts, deals, activities, agents |

## src/ (frontend)

| File | Description |
| --- | --- |
| `main.tsx` | Convex client and router setup; derives the backend URL when served from convex.site |
| `App.tsx` | Routes: landing, compare, and the /app CRM shell |
| `index.css` | Tailwind theme tokens: ink, panel, edge, accent |
| `vite-env.d.ts` | Vite client types |
| `lib/format.ts` | Money, relative time, stage labels, initials |
| `components/ui.tsx` | Panel, buttons, inputs, avatars, badges, empty states |
| `components/DemoBanner.tsx` | Demo banner with live countdown to the next reset |
| `app/AppLayout.tsx` | Sidebar shell; seeds the workspace on first visit |
| `app/Dashboard.tsx` | Stat cards, pipeline by stage, agent follow-ups, recent activity |
| `app/Companies.tsx` | Company table with search, pagination, and a create form |
| `app/CompanyDetail.tsx` | Tabs: overview, contacts, deals, activity, and the agent tab with record chat |
| `app/Contacts.tsx` | Contact table with search and pagination |
| `app/ContactDetail.tsx` | Facts with evidence bands, recheck scheduling, timeline |
| `app/Deals.tsx` | Kanban board with stage moves and a create form |
| `app/Agents.tsx` | Agent builder: describe a process, manage drafts, deploy, pause |
| `app/Settings.tsx` | Team, integration status, custom company fields |
| `pages/Landing.tsx` | Marketing page: hero, built-with, agent sections, demo notes, copy prompt |
| `pages/Compare.tsx` | Upstream vs Convex comparison table |

## public/

| File | Description |
| --- | --- |
| `convex-logo-white.png` | White Convex logo used in the Built with section, footer, and favicon |
| `logos/react-white.svg` | White React mark for the Built with section |
| `logos/vite-white.svg` | White Vite mark for the Built with section |
| `landing/` | Avatars and company logos carried over from upstream for seed data |

## docs/

Upstream documentation and the port instructions in `docs/try-crm-instructions/`. The PRD for this port is `prds/convex-port.md`.
