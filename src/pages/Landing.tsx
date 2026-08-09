import { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";

// The setup prompt users paste into their coding agent after forking.
// The three required keys stay "unset" here on purpose: the sentinel keeps
// the deploy working with no keys, and the app degrades honestly without
// them.
const SETUP_PROMPT =
  "Set up waynesutton/trycrm-convex. Install the dependencies with npm, run npx convex dev to create my deployment, set CONTEXT_DEV_API_KEY, FIRECRAWL_API_KEY, and EXA_API_KEY to the literal string unset, and tell me which optional keys I still need.";

export function Landing() {
  return (
    <div className="min-h-screen bg-ink text-neutral-200">
      <SiteHeader />
      <main>
        <Hero />
        <BuiltWith />
        <AgentsSection />
        <WhatItDoes />
        <DemoNotes />
        <ForkIt />
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-sm font-semibold text-white">
          CRM on Convex
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/compare"
            className="text-sm text-neutral-400 transition-colors hover:text-white"
          >
            Compare
          </Link>
          <Link
            to="/docs"
            className="text-sm text-neutral-400 transition-colors hover:text-white"
          >
            Docs
          </Link>
          <a
            href="https://github.com/waynesutton/trycrm-convex/fork"
            className="text-sm text-neutral-400 transition-colors hover:text-white"
          >
            Fork
          </a>
          <ThemeToggle compact />
          <Link
            to="/app"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-ink transition-colors hover:bg-primary-hover"
          >
            Try the demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

function CopyPromptButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={() => void copy()}
      className="rounded-md bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/15"
    >
      {copied ? "Copied" : "Copy the setup prompt"}
    </button>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[480px] bg-[radial-gradient(ellipse_55%_65%_at_50%_0%,var(--color-glow)_0%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-16 text-center">
        <h1 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
          The CRM built for agents on Convex
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-7 text-neutral-400">
          Durable research agents read your pipeline, enrich records, and book
          their own follow-ups. One Convex deployment runs all of it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/app"
            className="rounded-md bg-primary px-5 py-2.5 text-sm text-primary-ink transition-colors hover:bg-primary-hover"
          >
            Try the demo
          </Link>
          <CopyPromptButton />
        </div>
      </div>
    </section>
  );
}

function BuiltWith() {
  return (
    <section className="border-y border-edge py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4">
        <span className="text-xs font-semibold text-neutral-500">
          Built with
        </span>
        <a href="https://convex.dev" aria-label="Convex">
          <img
            src="/convex-logo-white.png"
            alt="Convex"
            className="themed-logo h-11 opacity-90 transition-opacity hover:opacity-100"
          />
        </a>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <a
            href="https://react.dev"
            className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
            aria-label="React"
          >
            <img
              src="/logos/react-white.svg"
              alt=""
              className="themed-logo h-5 w-5"
            />
            <span className="text-sm font-semibold text-white">React</span>
          </a>
          <a
            href="https://vite.dev"
            className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
            aria-label="Vite"
          >
            <img
              src="/logos/vite-white.svg"
              alt=""
              className="themed-logo h-5 w-5"
            />
            <span className="text-sm font-semibold text-white">Vite</span>
          </a>
          <a
            href="https://context.dev"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Context.dev"
          >
            context.dev
          </a>
          <a
            href="https://www.firecrawl.dev"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Firecrawl"
          >
            Firecrawl
          </a>
          <a
            href="https://agentmail.to"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="AgentMail"
          >
            AgentMail
          </a>
          <a
            href="https://exa.ai"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Exa"
          >
            Exa
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <a
            href="https://openai.com"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="OpenAI"
          >
            OpenAI
          </a>
          <a
            href="https://claude.com"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="Claude"
          >
            Claude
          </a>
          <a
            href="https://openrouter.ai"
            className="text-sm font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
            aria-label="OpenRouter"
          >
            OpenRouter
          </a>
          <span className="text-xs text-neutral-600">
            bring your own key for any of these
          </span>
        </div>
      </div>
    </section>
  );
}

function AgentsSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h2 className="text-2xl font-semibold text-white">
        Agents that automate your CRM
      </h2>
      <p className="mt-2 text-neutral-400">
        Describe how your CRM should act. Create agents to automate every
        process. Definitions are data, versions are rows, deploying is a
        pointer move.
      </p>
      <div className="mt-6 rounded-lg border border-edge bg-panel p-6">
        <p className="text-sm font-semibold text-white">
          What should we get done?
        </p>
        <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-400">
          <p className="rounded-md bg-ink px-3 py-2">
            Create a channel and notify the owner when a deal hits Closed won
          </p>
          <p className="rounded-md bg-ink px-3 py-2">
            Brief every deal owner before a renewal call
          </p>
          <p className="rounded-md bg-ink px-3 py-2">
            Every Monday, re-enrich contacts that have not been contacted in 4
            weeks
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatItDoes() {
  const cards = [
    {
      title: "Records fill themselves in",
      body: "A new company with a domain gets its logo, industry, and description from Context.dev brand data, with the observation logged on the timeline and the evidence recorded in the ledger.",
    },
    {
      title: "Agents that build agents",
      body: "Describe a process in a sentence and it becomes a draft agent with versioned instructions, on its own queue, on its own schedule.",
    },
    {
      title: "It books its own follow-ups",
      body: "Rechecks require a stated reason. An agent that cannot say why it will be back in fourteen days does not have a reason, it has a default.",
    },
    {
      title: "Ask any record a question",
      body: "The record chat reads your own history with the company and shows its working. No model key configured? It says so instead of pretending.",
    },
    {
      title: "A workspace chat with tools",
      body: "The Ask page researches across the whole CRM with slash commands for web search and page reading, on OpenAI, Claude, or OpenRouter. Your key, your choice.",
    },
    {
      title: "Watch it work",
      body: "Command-K searches every record. The Activity page streams function outcomes live, like the Convex dashboard logs, with pause and clear.",
    },
  ];
  return (
    <section className="mx-auto max-w-4xl px-4 pb-14">
      <h2 className="text-2xl font-semibold text-white">
        What it actually does
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-edge bg-panel p-6"
          >
            <h3 className="text-base font-semibold text-white">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DemoNotes() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-14">
      <div className="rounded-lg border border-edge bg-panel p-6">
        <h2 className="text-base font-semibold text-white">
          What the demo does and does not do
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-neutral-400">
          <li>
            Everything in the CRM works in real time: companies, contacts, the
            deal board, agents, and the dashboard rollups.
          </li>
          <li>
            Content resets every 10 minutes with a Convex cron job. Edit
            anything; it comes back.
          </li>
          <li>
            Sign-in is disabled. The code ships ready for Convex Auth; the
            demo keeps writes open on seeded data instead.
          </li>
          <li>
            Email is wired through the Resend and AgentMail components but not
            configured on the demo. Set RESEND_API_KEY, or AGENTMAIL_API_KEY
            plus AGENTMAIL_INBOX_ID, on your own deployment to turn it on and
            pick a provider in Settings.
          </li>
          <li>
            Enrichment, web research, and chat degrade honestly: without
            CONTEXT_DEV_API_KEY, FIRECRAWL_API_KEY, EXA_API_KEY, or a model
            key they say so instead of faking results.
          </li>
          <li>
            Chat runs on OpenAI, Claude, or OpenRouter. None of those keys
            ship by default; pick a provider in Settings and set its key on
            your own deployment.
          </li>
        </ul>
      </div>
    </section>
  );
}

function ForkIt() {
  return (
    <section className="border-t border-edge py-14 text-center">
      <h2 className="text-3xl font-semibold text-white">
        Fork it. It's yours.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
        MIT licensed. One npm install, one Convex deployment, no other
        services to stand up.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <CopyPromptButton />
        <a
          href="https://github.com/waynesutton/trycrm-convex"
          className="rounded-md bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/15"
        >
          View on GitHub
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-edge py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center">
        <div className="flex items-center gap-2.5">
          <img
            src="/convex-logo-white.png"
            alt="Convex"
            className="themed-logo h-4"
          />
          <span className="text-sm text-neutral-400">
            The open source agentic CRM, on Convex.
          </span>
        </div>
        <div className="flex gap-4 text-xs text-neutral-500">
          <Link to="/docs" className="hover:text-neutral-300">
            Docs
          </Link>
          <a
            href="https://github.com/waynesutton/trycrm-convex"
            className="hover:text-neutral-300"
          >
            GitHub
          </a>
          <a
            href="https://github.com/trycompai/crm"
            className="hover:text-neutral-300"
          >
            Original by Comp AI
          </a>
          <a href="https://convex.dev" className="hover:text-neutral-300">
            Convex
          </a>
          <a
            href="https://www.convex.dev/components"
            className="hover:text-neutral-300"
          >
            Components
          </a>
        </div>
      </div>
    </footer>
  );
}
