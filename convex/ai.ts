import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";

// One place decides which model the chat surfaces run on. The workspace row
// stores the choice; the env decides whether it is usable. None of these keys
// ship by default: a fork answers with the missing key's name instead of
// erroring, same as every other integration here.
export type AiProvider = "openai" | "anthropic" | "openrouter";

const realKey = (value: string | undefined): boolean =>
  !!value && value !== "unset";

export const AI_KEY_NAMES: Record<AiProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export const providerConfigured = (provider: AiProvider): boolean => {
  if (provider === "openai") return realKey(process.env.OPENAI_API_KEY);
  if (provider === "anthropic") return realKey(process.env.ANTHROPIC_API_KEY);
  return realKey(process.env.OPENROUTER_API_KEY);
};

// OpenRouter speaks the OpenAI wire format, so it needs no extra dependency:
// point the OpenAI provider at their base URL.
export const languageModelFor = (provider: AiProvider): LanguageModelV3 => {
  if (provider === "anthropic") {
    return anthropic.chat("claude-sonnet-4-5");
  }
  if (provider === "openrouter") {
    const openrouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return openrouter.chat("openai/gpt-5-mini");
  }
  return openai.chat("gpt-5-mini");
};

export const missingKeyMessage = (provider: AiProvider): string =>
  [
    `The ${provider} provider is selected but ${AI_KEY_NAMES[provider]} is not set on this deployment, so I cannot reason over your data.`,
    `Set it with: npx convex env set ${AI_KEY_NAMES[provider]} <your key>`,
    "You can switch providers on the Settings page. Everything else in the CRM keeps working without a model key.",
  ].join(" ");
