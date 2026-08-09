# Tasks

## to do

- Set up the Convex cloud project (paused for user; see the deploy guide in README.md)
- Commit and push to github.com/waynesutton/trycrm-convex
- Optional: set real CONTEXT_DEV_API_KEY and OPENAI_API_KEY on the deployment

## completed

- 2026-08-09 06:43 UTC: Synced project docs (task.md, files.md) ahead of the first push to github.com/waynesutton/trycrm-convex. Verified .gitignore keeps .env.local, node_modules, and dist out of the commit.
- 2026-08-09 06:37 UTC: Restyled the landing page and demo app to the GitHub features design system (Mona Sans, `#0d1117` canvas, cobalt primary buttons, tighter radii). Header now reads "CRM on Convex" with the logo moved to the Built with wall (white Convex, React, Vite, context.dev). Removed the demo banner reset button. Fixed the cloud deploy CONTEXT_DEV_API_KEY error by setting it on the deployment while keeping "unset" in the copy prompt. Lint, typecheck, and browser checks pass.
- 2026-08-09 06:05 UTC: Added the Convex ESLint plugin (flat config, type aware) and fixed all findings, including explicit table names on every db.get/patch/replace/delete. Added writeMutation from convex-helpers customFunctions so the write access check runs in one wrapper. Lint, both typechecks, dev push, and a live create plus cascade delete all pass.
- 2026-08-09 05:45 UTC: Full Convex port verified end to end. PRD: prds/convex-port.md. Typecheck and build pass; browser verification confirmed landing page, compare page, dashboard with live stats, demo banner countdown, companies table with seeded data, record chat with honest no-key reply, kanban stage moves, agent builder, and settings.
- 2026-08-09 05:40 UTC: Frontend built: landing, compare, dashboard, companies, contacts, deals board, agents, settings, demo banner. Files in src/.
- 2026-08-09 05:25 UTC: Backend complete: schema, CRM functions, agent queue with workpools, Context.dev enrichment with action cache and rate limiter, record chat on the agent component, Resend stub, crons (10 minute demo reset, 1 minute agent tick), static hosting routes. Deployed cleanly to an anonymous local deployment.
- 2026-08-09 04:50 UTC: Removed upstream monorepo (apps/, packages/, bun, Turborepo). Single npm package with convex/ and src/.
- 2026-08-09 04:30 UTC: Read all docs in docs/try-crm-instructions, wrote PRD at prds/convex-port.md.
- 2026-08-09 04:15 UTC: Merged upstream trycompai/crm into the fork locally, preserving docs/.

## notes

- CONTEXT_DEV_API_KEY is required by the Context.dev component; the literal value "unset" is the documented sentinel for keyless installs.
- The demo reset cron wipes all tables; remove it in convex/crons.ts for real use.
- Local verification used CONVEX_AGENT_MODE=anonymous so the user's Convex account was untouched.
