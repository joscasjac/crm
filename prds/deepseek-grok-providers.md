# Add DeepSeek and Grok AI providers

Created: 2026-08-14 07:22 UTC
Last Updated: 2026-08-14 07:28 UTC
Status: Completed

## Problem

Community [PR #3](https://github.com/waynesutton/trycrm-convex/pull/3) proposed adding DeepSeek and Grok as chat providers. The chat surfaces only offered OpenAI, Claude, and OpenRouter, and more provider choice is genuinely useful for forks. But the PR could not land as written.

## PR #3 security review

The full 451 line diff was scanned before any decision.

Clean:

- No hidden or bidirectional Unicode anywhere in the diff (byte level scan, pure ASCII). The GitHub banner on the patch view is boilerplate.
- Every URL is an official endpoint: api.deepseek.com/v1, api.x.ai/v1, platform.deepseek.com, console.x.ai.
- No new dependencies, no changes to auth, tools, mutations, or the write path. Keys stay server side and follow the existing `unset` sentinel.

Rejected anyway:

1. It made DeepSeek the default provider in `convex/prefs.ts`, `convex/ask.ts`, `src/app/Settings.tsx`, and all docs copy. The default stays OpenAI.
2. It added `*_API_BASE_URL` and `*_MODEL` env overrides that no other provider here has. Extra config surface, and a settable base URL is not a pattern a distrusted PR gets to introduce.
3. It used xAI's Chat Completions endpoint, which xAI's docs mark deprecated in favor of the Responses API, and the stale `grok-4.5` model id (current is `grok-4.6`).
4. It used the nonstandard `GROK_API_KEY` name; xAI's convention is `XAI_API_KEY`.

## Solution

Implement the feature from the official docs using the official AI SDK provider packages, keeping OpenAI as the default everywhere.

- `@ai-sdk/deepseek` runs `deepseek-v4-flash`, reads `DEEPSEEK_API_KEY`, talks to api.deepseek.com. Verified against the DeepSeek API docs (deepseek-chat and deepseek-reasoner were retired 2026-07-24; v4-flash and v4-pro are current).
- `@ai-sdk/xai` runs `grok-4.6`, reads `XAI_API_KEY`, talks to api.x.ai with the right endpoints. Verified against docs.x.ai.
- No base URL or model override env vars. Same fixed-model pattern as the other providers.
- Every `?? "openai"` fallback is untouched. Docs keep saying OpenAI is the default.

## Files changed

- `convex/ai.ts`: provider type, key names, configured checks, language models
- `convex/schema.ts`: `workspace.aiProvider` union literals
- `convex/prefs.ts`: `aiProviderValidator` literals
- `convex/ask.ts`: `providerInternal` returns validator literals
- `convex/capabilities.ts`: `deepseek` and `grok` booleans
- `src/app/Settings.tsx`: integration rows and provider picker options
- `src/app/Ask.tsx`: `PROVIDER_LABELS`
- `src/pages/Docs.tsx`: nav label, env table rows, ai-providers section
- `src/pages/Landing.tsx`: built-with links, BYOK Chat group, providers note
- `src/pages/Compare.tsx`: AI providers row
- `README.md`: feature table, env table, picker bullet, compare table
- `package.json`: `@ai-sdk/deepseek`, `@ai-sdk/xai`

## Edge cases

- Missing key: `providerConfigured` returns false via the `unset` sentinel and the chat replies with the exact env var name (`DEEPSEEK_API_KEY` or `XAI_API_KEY`), same as the other providers.
- Existing workspaces keep their stored provider; the new literals only widen the union, no migration needed.
- `convex/agentTasks.ts` only checks `OPENAI_API_KEY` before agent runs regardless of the selected provider. Pre-existing gap, out of scope here, queued as a follow-up.

## Verification

- `npx convex dev --once` clean
- `npm run check-types` passes
- `npm run lint` passes
- Diff contains no banned deps, no `confidence` parameter, no `organizationId`

## Task completion log

- 2026-08-14 07:22 UTC: PR #3 reviewed and rejected, backend and frontend changes landed, docs surfaces updated, packages installed.
- 2026-08-14 07:28 UTC: Verification clean (convex dev --once, check-types, lint, banned terms). Note: the latest @ai-sdk/deepseek@3 and @ai-sdk/xai@4 target the LanguageModelV4 spec; this repo's stack is V3, so the pinned versions are @ai-sdk/deepseek@^2.0.55 and @ai-sdk/xai@^3.0.121, which share @ai-sdk/provider@3.0.15 with @ai-sdk/openai@3. PR #3 closed with a thanks comment.
