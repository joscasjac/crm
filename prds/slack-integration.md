# Slack integration and agent bot for CRM on Convex

Created: 2026-08-09 11:38 UTC
Last Updated: 2026-08-09 12:10 UTC
Status: Done

## Task completion log

- 2026-08-09 12:10 UTC: Phases 1 and 2 shipped. Outbound notifications (convex/slack.ts) with per-event toggles, two connection modes, retrier delivery, capping, deep links, and demo mode guard; Settings Slack page with channel search picker and test button; the /crm bot (convex/slackBot.ts) behind its own toggle with signed routes, identity matching via the new slackIdentities table, and find, deal, note, task, activity commands reusing model helpers. Docs, README, and landing updated. Lint and typechecks clean; dev push succeeded. Deferred to a later phase: Block Kit message formatting, interactive disambiguation buttons, and the conversational assistant (ambiguous /crm find results reply with a text list instead).

This PRD is a handoff spec for the open source [trycrm-convex](https://github.com/waynesutton/trycrm-convex) repo. It describes two features to build there: outbound Slack notifications for CRM events, and an optional two way Slack agent bot behind a Settings toggle. It carries the full Slack and Convex setup guide that belongs in that app's docs section, plus the README and homepage updates. Nothing in this document references private systems; the spec stands on its own for an open source codebase.

## The prompt

Paste this into a Cursor session opened on the trycrm-convex repo, with this PRD file attached or pasted below it.

```text
Add Slack integration to this CRM. The full spec is in the attached PRD. Save the PRD as prds/slack-integration.md in this repo first, then build it phase by phase in the order the PRD gives. Rules for this repo:

- Backend is convex/, frontend is src/. Package manager is npm. Run npm run lint and fix what it reports.
- Every write from Slack goes through the same model functions the UI calls, wrapped by writeMutation in convex/model/functions.ts, so access control stays in one file. The bot never gets its own business logic.
- Every outside key degrades honestly like the rest of this app: with no Slack env vars set, sends are logged as no ops and the Settings page says what is missing. Support the literal string "unset" as the documented sentinel.
- Demo mode never posts to Slack and never accepts inbound Slack writes. Seeds, imports, and the demo reset cron never trigger notifications.
- All Convex functions use the new function syntax with args and returns validators. No v.any() on public functions. Index every new table query, no .filter().
- Slack sends run through the action retrier pattern: throw on 429 and 5xx so retries back off, return an error string for config mistakes so they never retry. Log every send outcome to the Activity page.
- Inbound Slack routes verify the v0 signing signature over the raw body, reject timestamps older than five minutes, compare in constant time, and ack inside three seconds. Real work runs through ctx.scheduler.runAfter and replies go through response_url or chat.update.
- Docs: add a Slack section to the in app /docs page following the existing docs layout, with live env var status badges, the setup walkthrough from the PRD, the slash command reference, and the troubleshooting table. Update README.md (stack table, configuration table, a Slack section) and the landing page feature list to mention Slack notifications and the optional agent bot. Sync files.md, changelog.md, and task.md at the end of each phase.
- No placeholder text or images anywhere. No emojis in the app or docs.

Ship phase 1 (outbound notifications) end to end with docs before starting phase 2 (agent bot). Verify each phase with the steps in the PRD before moving on.
```

## Problem

The CRM has no Slack presence. Deals move, tasks come due, agent runs finish, and the only way to find out is to open the app. Teams that would run this CRM live in Slack all day, so events should land in a channel the moment they happen, and the person reading the channel should be able to act without switching apps.

Two features, shipped in order:

1. Outbound notifications. New companies, contacts, and deals, deal stage changes, task completions, and agent run summaries post to a chosen channel.
2. An agent bot, off by default, behind a Settings toggle. A slash command and interactive buttons on the notification messages let a verified teammate move a deal stage, complete a task, add a note or task to a record, and look up records, all from Slack.

## Architecture

```mermaid
flowchart LR
    crm[CRM mutations] -->|schedule notify| slackOut[convex/slack.ts outbound]
    slackOut -->|chat.postMessage or webhook| slack[Slack]
    slackUser[Teammate in Slack] -->|slash command or button| slack
    slack -->|signed POST| routes["convex/http.ts /webhooks/slack/*"]
    routes -->|verify v0 signature, ack under 3s| sched[Convex scheduler]
    sched --> bot[convex/slackBot.ts]
    bot -->|resolve Slack user| identity[(slackIdentities)]
    bot -->|writes| model[convex/model functions via writeMutation]
    model --> activity[(Activity page)]
    bot -->|response_url or chat.update| slack
```

The rule that keeps the design safe: the bot parses, authorizes, and then calls the exact model functions the UI calls. Activity entries, aggregates, and reactive queries behave identically no matter where the action came from.

## Phase 1, outbound notifications

### Connection modes

Two modes, both configured with Convex env vars. Bot token wins when both are set.

1. `SLACK_WEBHOOK_URL`: a Slack incoming webhook. Simplest setup, channel baked into the URL, the channel picker in Settings is ignored and the UI says so.
2. `SLACK_BOT_TOKEN`: a Slack app bot token with `chat:write`, posting to the channel picked in Settings. Required for phase 2, so the docs steer people here.

Optional deep links: derive the record URL from the deployment site URL (the static hosting component serves the app from the same `.convex.site` origin), with an `APP_URL` env var override for custom domains. Every message ends with an Open in CRM link when a base URL is known.

### What posts and when

| Event | Fires when | Contains |
| --- | --- | --- |
| New company | A company is created from the UI or by an agent | Name, domain link, owner |
| New contact | A contact is created | Name, email, company |
| New deal | A deal is created | Deal name, company, stage, value |
| Deal stage change | A deal moves stage (board drag or list edit) | Deal, old and new stage, who moved it |
| Task completed | A task is marked done | Task title, record, who completed it |
| Agent run finished | An agent task completes or fails | Agent name, record, outcome summary |

Seeds, CSV style imports, the demo reset cron, and demo mode never post. Bulk operations must not flood a channel.

### Sending behavior

New file `convex/slack.ts`:

- `postToSlack(text, channel)` helper: bot token path calls `chat.postMessage` with a Bearer header and treats `ok: false` in the body as an error even on HTTP 200; webhook path POSTs `{ text }`. Throws on 429 and 5xx so the action retrier backs off; returns an error string for config mistakes (missing channel, `not_in_channel`, nothing configured) so they never retry.
- `notify` internalAction: loads the record snapshot and the Settings toggles, builds the message, posts, and records the outcome on the Activity page. Runs through the action retrier.
- `sendTest` action for the Settings test button: throws so the toast shows the exact Slack error.
- `status` query: which env vars are set, feeding live badges on Settings and the docs page.

Message text stays plain in phase 1 (Block Kit arrives with the bot). Cap any long field at 300 characters per line and 30 lines per message so a huge record cannot blow up the payload.

### Settings additions

New optional fields on the workspace settings, edited in Settings, Integrations, Slack:

| Field | Default | Purpose |
| --- | --- | --- |
| `slackEnabled` | `false` | Master switch, nothing posts when off |
| `slackNotifyRecords` | `true` | New companies, contacts, deals |
| `slackNotifyDeals` | `true` | Stage changes |
| `slackNotifyTasks` | `false` | Task completions |
| `slackNotifyAgent` | `false` | Agent run summaries |
| `slackChannel` | empty | Channel ID or #name, bot token mode only |

The Slack card shows live env var badges (`SLACK_WEBHOOK_URL`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`), the toggles, the channel input, and a Send test button, following the existing email provider card pattern.

## Phase 2, the agent bot

### The toggle

`slackBotEnabled`, off by default, on the same Slack card. Flipping it on reveals the bot setup checklist with the two request URLs to paste into the Slack app config and the live status of `SLACK_SIGNING_SECRET`. Inbound routes return 503 with a clear body when the toggle is off or the secret is missing.

### Inbound surfaces

Three HTTP routes in `convex/http.ts`, served from the deployment's `.convex.site` origin:

| Slack feature | Route |
| --- | --- |
| Slash command `/crm` | `/webhooks/slack/commands` |
| Interactivity (buttons) | `/webhooks/slack/interactivity` |
| Events API (optional assistant phase) | `/webhooks/slack/events` |

### Request verification

Every inbound route follows Slack's v0 signing scheme:

1. Read the raw body text before any parsing. Slash commands arrive form encoded; interactivity arrives as a form field named `payload` holding JSON. The signature covers the raw bytes, so verify first, parse after.
2. Read `X-Slack-Request-Timestamp` and `X-Slack-Signature`, reject timestamps older than five minutes.
3. Compute `v0=` plus the hex HMAC SHA256 of `v0:{timestamp}:{rawBody}` keyed with `SLACK_SIGNING_SECRET`, compare in constant time.
4. Return 200 inside three seconds. Anything slower shows the Slack user an error and repeated failures get the endpoint disabled. All real work goes through `ctx.scheduler.runAfter(0, ...)`, replies land through `response_url` or `chat.update`.
5. Honor `X-Slack-Retry-Num`: ack event retries without reprocessing, and keep every write path idempotent anyway.

### Identity and authorization

Slack requests carry a Slack user ID, not an app identity. The bot maps one to the other:

1. On first action from a Slack user, call `users.info` with the bot token and read `profile.email`.
2. Match that email against the workspace team members in Settings, Team. A new optional setting `slackAllowedEmailDomain` widens the match to a whole domain for teams that prefer it.
3. On a match, cache the mapping in a new `slackIdentities` table: `slackUserId`, `email`, `name`, `verifiedAt`, indexed `by_slackUserId`. Re verify rows older than 30 days so departed teammates age out.
4. No match: reply ephemerally with "This bot only takes actions from workspace members" and log the attempt to the Activity page.

The actor recorded on every write is `{name} (Slack)`, so the Activity page reads naturally next to UI actions. When real auth is wired through `convex/model/access.ts`, that file is where this check tightens, same as every other write.

### The /crm slash command

Case insensitive subcommands. Record lookup uses the existing full text search indexes; when several records match, the bot replies with a pick list of buttons capped at five instead of guessing.

| Command | What it does |
| --- | --- |
| `/crm find acme` | Card with company, owner, open deals, recent activity, deep link |
| `/crm deal acme won` | Moves the deal to the named stage through the deals model function |
| `/crm stages` | Lists the valid deal stages |
| `/crm task acme "Follow up Friday"` | Creates a task on the record |
| `/crm note acme "Spoke at the meetup"` | Adds a note to the record |
| `/crm activity acme` | Last ten activity entries for the record |
| `/crm help` | Command reference |

Errors reply ephemerally with the exact problem and the valid options; an unknown stage echoes the stage list. Nothing noisy lands in the channel except completed actions.

### Buttons on outbound notices

A second toggle, `slackInteractiveMessages`, upgrades outbound messages from plain text to Block Kit (keeping `text` as the notification fallback string):

- New deal and stage change notices gain stage buttons plus an Open in CRM link button.
- Task reminder and task notices gain a Complete button.
- Agent run notices gain an Open in CRM link, and an approve button wherever the CRM already has a human approval step.

Button `action_id` values are namespaced and the `value` is JSON, for example `{"kind":"set_stage","dealId":"...","stage":"won"}`. After a successful action the bot edits the message with `chat.update`, replacing buttons with a confirmation line ("Moved to Won by Jane Doe (Slack) at 2:41 PM"), so a second click cannot double fire and the channel sees the outcome.

### Optional later phase, conversational assistant

Slack's AI apps surface gives the bot a split view chat panel. Wire `assistant_thread_started` and `message.im` events to a `@convex-dev/agent` agent (already installed in this repo) with read tools over companies, contacts, deals, and activity, and write tools that reuse the command handlers above. Ship this only after the command surface proves out; nothing earlier depends on it.

## Slack app setup guide

This whole section goes into the app's /docs page as the Slack section, written for someone who has never made a Slack app.

### Path one, incoming webhook, notifications only

1. Open [api.slack.com/apps](https://api.slack.com/apps), Create New App, From scratch, pick your workspace.
2. Open Incoming Webhooks, toggle on, Add New Webhook to Workspace, pick the channel.
3. Copy the URL and set it on the Convex deployment:

```bash
npx convex env set SLACK_WEBHOOK_URL https://hooks.slack.com/services/T000/B000/xxxx
```

The channel picker in Settings is ignored in this mode. This path cannot power the agent bot.

### Path two, bot token, notifications plus the bot

1. In the same Slack app, open OAuth and Permissions. Add bot scopes: `chat:write`, and for the bot, `commands`, `users:read`, `users:read.email`.
2. Bot only: open Slash Commands, Create New Command. Command `/crm`, Request URL `https://<your-deployment>.convex.site/webhooks/slack/commands`. Your deployment name is in the Convex dashboard, or take `VITE_CONVEX_URL` and swap `.convex.cloud` for `.convex.site`.
3. Bot only: open Interactivity and Shortcuts, turn it on, Request URL `https://<your-deployment>.convex.site/webhooks/slack/interactivity`.
4. Open Install App, Install to Workspace (Reinstall after scope changes). Copy the Bot User OAuth Token, it starts with `xoxb-`.
5. Bot only: open Basic Information, App Credentials, copy the Signing Secret.
6. Set the values on the Convex deployment:

```bash
npx convex env set SLACK_BOT_TOKEN xoxb-your-token
npx convex env set SLACK_SIGNING_SECRET your-signing-secret
```

7. In Slack, invite the bot to the channel: `/invite @YourBotName`. Skipping this makes `chat.postMessage` fail with `not_in_channel`.
8. In the CRM open Settings, Integrations, Slack, pick the channel, flip the toggles, click Send test.

### The checklist for people who have done this before

- One app, scopes `chat:write commands users:read users:read.email`
- Two request URLs on the deployment's `.convex.site` origin under `/webhooks/slack/`
- Reinstall, set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` with `npx convex env set`
- Invite the bot, pick the channel in Settings, send the test
- One Slack app per deployment: request URLs are single valued, so run a dev app pointing at dev and a prod app pointing at prod, each with its own token and secret

### Convex notes

- `npx convex env set` targets the dev deployment by default. Add `--prod` for production.
- HTTP routes serve from `.convex.site`, not `.convex.cloud`.
- Slack shows request URL verification errors until the routes deploy. Expected; save the URLs anyway.
- Keep `npx convex dev` running as you build. Slack reaches the dev deployment's `.convex.site` URL directly, no tunnel needed.
- Running keyless: set any Slack variable to the literal string `unset` and the feature reports not configured instead of failing, matching the rest of the app.

### Environment variables

| Variable | Required for | Purpose |
| --- | --- | --- |
| `SLACK_WEBHOOK_URL` | Notifications (webhook mode) | One way posting, channel baked in |
| `SLACK_BOT_TOKEN` | Notifications (bot mode) and the bot | Web API calls and `users.info` lookups |
| `SLACK_SIGNING_SECRET` | The bot | Verify inbound requests |
| `APP_URL` | Optional | Deep link base for custom domains |

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `not_in_channel` | Invite the bot: `/invite @YourBotName` in the target channel |
| `channel_not_found` | Use the channel ID from the channel details pane, or check the #name spelling |
| `invalid_auth` | Token wrong or revoked. Reinstall the app, set the new token |
| Slack says the app did not respond in time | The route took over three seconds. Check that heavy work is scheduled, not inline |
| Signature verification fails | Wrong `SLACK_SIGNING_SECRET`, or the body was parsed before verifying. Verify raw bytes first |
| Nothing posts, no errors | Master toggle off in Settings, or demo mode is on |

## Docs, README, and homepage updates

- /docs page: new Slack section with everything under "Slack app setup guide" above, the event table, the `/crm` command reference, live env var badges, and the troubleshooting table. Follow the layout of the existing docs sections.
- README.md: a Slack row in the stack table, the four env vars in the Configuration table with their honest degradation notes, and a short Slack section covering both connection modes and the bot toggle, matching the tone of the Email section.
- Landing page: add Slack to the feature list, one line, notifications plus an optional agent bot that acts on records from Slack.
- files.md, changelog.md, task.md: sync at the end of each phase, real dates from `git log --date=short -n 10`.

## Files to change in trycrm-convex

Locate the repo's equivalents; names below are the expected shape.

| File | Change |
| --- | --- |
| `convex/slack.ts` | New. Outbound posting, message builders, notify, sendTest, env status |
| `convex/slackBot.ts` | New. Payload parsing, identity resolution, command dispatch, reply formatting |
| `convex/http.ts` | Three routes under `/webhooks/slack/` with v0 verification and fast ack |
| `convex/schema.ts` | `slackIdentities` table, Slack fields on workspace settings |
| `convex/model/` | Actor aware wrappers where needed so Slack writes carry `{name} (Slack)` |
| Companies, contacts, deals, tasks, agent modules | Schedule `internal.slack.notify` after the relevant writes, gated on the toggles and never from seeds or demo reset |
| Settings Integrations page in `src/app/` | Slack card: toggles, channel, test button, env badges, bot checklist |
| Docs page in `src/pages/` | Slack section |
| Landing page in `src/pages/` | Feature list line |
| `README.md`, `files.md`, `changelog.md`, `task.md` | Per the docs sync section |

## Edge cases

- Demo mode on: outbound sends log as no ops, inbound routes refuse writes with a clear message. The public demo must stay read only for Slack.
- Neither env var set: notify logs the miss once, no retry loop. Settings and docs badges show what is missing.
- Bot token mode without a channel: clear error on the test button and in the activity log.
- 429 and 5xx: throw so the retrier backs off. Config mistakes return strings and never retry.
- Three second budget: no Web API calls and no table scans before the ack.
- Unknown record or several matches: never guess, reply with a disambiguation pick list capped at five.
- Unknown deal stage: reply with the valid stage list, which is workspace editable.
- Slack retries and double clicks: `chat.update` removes buttons after success and every write checks current state before acting.
- Non member Slack user: ephemeral refusal plus an activity entry so attempts are visible.
- Missing `SLACK_SIGNING_SECRET` or bot toggle off: routes return 503 with a body naming the fix.
- Bulk anything (seed, import, reset cron): silent, by source check.

## Build order and verification

### Phase 1, outbound notifications

Build `convex/slack.ts`, the settings fields, the event hooks, the Settings card, and the docs, README, and homepage updates for notifications.
Verify: with `SLACK_WEBHOOK_URL` set, the test button posts, creating a deal posts, moving a stage posts, seeding does not post, demo mode does not post, and every send outcome shows on the Activity page. `npm run lint` clean.

### Phase 2, signed endpoints and identity

Routes with v0 verification, `slackIdentities`, `/crm help` responding end to end.
Verify: a valid signature passes, a tampered body fails, a non member email is refused with an activity entry, help renders in under a second.

### Phase 3, reads and the safest writes

`/crm find`, `/crm stages`, `/crm activity`, then `/crm note` and `/crm task`, then `/crm deal`.
Verify: a stage change from Slack produces the identical activity entry and board move as the same change from the UI, actor reading `Name (Slack)`.

### Phase 4, interactive notices

Block Kit builders behind `slackInteractiveMessages`, stage buttons, task complete buttons, `chat.update` after actions.
Verify: click a stage button, watch the message rewrite itself and the board move. Double click does nothing.

### Phase 5, optional assistant

Events route plus the `@convex-dev/agent` assistant reusing phases 3 and 4.
Verify: asking "what deals moved this week" answers from real data, and writes still walk through the command handlers.

## Task completion log

| Date (UTC) | Item | Status |
| --- | --- | --- |
| 2026-08-09 11:38 | PRD drafted as a handoff spec for the trycrm-convex repo, prompt included | Done |

## Reference links

Slack platform

- Quickstart: https://docs.slack.dev/quickstart
- App dashboard: https://api.slack.com/apps
- Verifying requests (v0 signing): https://docs.slack.dev/authentication/verifying-requests-from-slack
- Slash commands: https://docs.slack.dev/interactivity/implementing-slash-commands
- Handling interaction (block_actions, response_url): https://docs.slack.dev/interactivity/handling-user-interaction
- Block Kit: https://docs.slack.dev/block-kit
- Block Kit Builder: https://app.slack.com/block-kit-builder
- Events API: https://docs.slack.dev/apis/events-api
- App manifests: https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests
- Scopes reference: https://docs.slack.dev/reference/scopes
- chat.postMessage: https://docs.slack.dev/reference/methods/chat.postmessage
- chat.update: https://docs.slack.dev/reference/methods/chat.update
- users.info: https://docs.slack.dev/reference/methods/users.info
- Rate limits: https://docs.slack.dev/apis/web-api/rate-limits
- AI apps (assistant phase): https://docs.slack.dev/ai

Convex

- HTTP actions: https://docs.convex.dev/functions/http-actions
- Scheduled functions: https://docs.convex.dev/scheduling/scheduled-functions
- Agent component: https://www.convex.dev/components/agent
- Action retrier component: https://www.convex.dev/components/retrier
- Static hosting component: https://www.convex.dev/components/static-hosting
