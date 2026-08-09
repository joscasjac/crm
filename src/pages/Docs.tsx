import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SiteFooter, SiteHeader } from "./Landing";

// The full setup and usage guide. Written for someone who has never deployed
// a backend before: every command is shown, every key is explained, and every
// optional feature says what happens when its key is missing.

const SECTIONS = [
  { id: "what-this-is", label: "What this is" },
  { id: "using-the-app", label: "Using the app" },
  { id: "fork-and-setup", label: "Fork and set it up" },
  { id: "environment-variables", label: "Environment variables" },
  { id: "email", label: "Email: Resend and AgentMail" },
  { id: "web-research", label: "Web research: Firecrawl and Exa" },
  { id: "ai-providers", label: "AI providers: OpenAI, Claude, OpenRouter" },
  { id: "auth", label: "Turning on sign-in" },
  { id: "deploy", label: "Deploying to production" },
  { id: "coding-agents", label: "Using Cursor, Codex, or other tools" },
  { id: "components", label: "Every component in this app" },
  { id: "resources", label: "Resources" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-edge py-10">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-neutral-400">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-edge bg-panel px-4 py-3 font-mono text-[13px] leading-relaxed text-neutral-200">
      {children}
    </pre>
  );
}

function K({ children }: { children: string }) {
  return (
    <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[12px] text-neutral-200">
      {children}
    </code>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-accent underline decoration-edge underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  );
}

const ENV_ROWS: Array<{
  name: string;
  required: string;
  enables: string;
  where: string;
}> = [
  {
    name: "CONTEXT_DEV_API_KEY",
    required: "Yes, but “unset” works",
    enables: "Brand enrichment: logos, industry, and descriptions on company records",
    where: "context.dev",
  },
  {
    name: "FIRECRAWL_API_KEY",
    required: "Yes, but “unset” works",
    enables: "The chat agent can read any web page as markdown",
    where: "firecrawl.dev",
  },
  {
    name: "EXA_API_KEY",
    required: "Yes, but “unset” works",
    enables: "The chat agent can search the web semantically",
    where: "exa.ai",
  },
  {
    name: "OPENAI_API_KEY",
    required: "No",
    enables: "Chat and agent reasoning when OpenAI is the selected provider",
    where: "platform.openai.com",
  },
  {
    name: "ANTHROPIC_API_KEY",
    required: "No",
    enables: "Chat and agent reasoning when Claude is the selected provider",
    where: "console.anthropic.com",
  },
  {
    name: "OPENROUTER_API_KEY",
    required: "No",
    enables: "Chat and agent reasoning when OpenRouter is the selected provider",
    where: "openrouter.ai",
  },
  {
    name: "RESEND_API_KEY",
    required: "No",
    enables: "Outbound email notifications through Resend",
    where: "resend.com",
  },
  {
    name: "AGENTMAIL_API_KEY",
    required: "No",
    enables: "Outbound email plus a persistent inbox through AgentMail",
    where: "agentmail.to",
  },
  {
    name: "AGENTMAIL_INBOX_ID",
    required: "Only with AgentMail",
    enables: "Tells AgentMail which inbox to send from",
    where: "AgentMail dashboard",
  },
  {
    name: "FIRECRAWL_WEBHOOK_SECRET",
    required: "No",
    enables: "Verifies Firecrawl crawl webhooks in production",
    where: "firecrawl.dev dashboard",
  },
  {
    name: "AGENTMAIL_WEBHOOK_SECRET",
    required: "No",
    enables: "Verifies inbound AgentMail webhooks",
    where: "AgentMail dashboard",
  },
];

export function Docs() {
  // Links like /docs#email arrive via client-side navigation, where the
  // browser does not scroll to the anchor on its own.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  // The sidebar highlights the section under the reading line as you
  // scroll, the way documentation sites do it.
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const section of SECTIONS) {
      const node = document.getElementById(section.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-ink text-neutral-200">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl gap-10 px-4 py-12">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 flex flex-col gap-0.5">
            <p className="mb-2 px-2.5 text-xs font-semibold text-neutral-500">
              Docs
            </p>
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`rounded-md px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                  activeId === section.id
                    ? "bg-raised text-white"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 max-w-3xl flex-1">
        <h1 className="text-3xl font-semibold text-white">Docs</h1>
        <p className="mt-3 max-w-2xl text-neutral-500">
          Everything you need to run this CRM yourself: how the app works, how
          to fork and deploy it on Convex, which API keys do what, and how to
          turn on the optional features. Written for people who have never
          deployed a backend before.
        </p>

        <nav className="mt-8 rounded-lg border border-edge bg-panel p-5 md:hidden">
          <p className="text-xs font-semibold text-neutral-500">
            On this page
          </p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-neutral-400 hover:text-white"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6">
          <Section id="what-this-is" title="What this is">
            <p>
              This is{" "}
              <Ext href="https://github.com/trycompai/crm">trycompai/crm</Ext>,
              the open source agentic CRM by Comp AI, ported to run entirely on{" "}
              <Ext href="https://convex.dev">Convex</Ext>. The original runs on
              Next.js, Postgres, Redis, and Vercel. This version runs on one
              Convex deployment: the database, the agent runtime, the work
              queue, the cron scheduler, file storage, and the website itself
              all live in the same place.
            </p>
            <p>
              The code is MIT licensed and lives at{" "}
              <Ext href="https://github.com/waynesutton/trycrm-convex">
                github.com/waynesutton/trycrm-convex
              </Ext>
              . The live demo resets its content every 10 minutes, so feel free
              to change anything.
            </p>
          </Section>

          <Section id="using-the-app" title="Using the app">
            <p>
              Open <Link to="/app" className="text-accent underline decoration-edge underline-offset-2">the demo</Link>{" "}
              and you land on the dashboard. Here is what each section does.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="text-white">Dashboard.</span> Pipeline totals
                by stage, recent activity, and agent run counts. The numbers
                come from the aggregate component, so they update the moment
                anything changes, in every open browser tab.
              </li>
              <li>
                <span className="text-white">Companies.</span> Add a company
                with a domain and enrichment kicks in: an agent task fetches
                the logo, industry, and description from Context.dev brand
                data and logs the observation on the company timeline.
              </li>
              <li>
                <span className="text-white">Contacts.</span> People, linked
                to companies. Nothing about a person is guessed. Every field
                shows the evidence it came from, like a signature block or a
                thread reply, and blank fields stay blank.
              </li>
              <li>
                <span className="text-white">Deals.</span> A board grouped by
                stage. Drag a card between columns, use the stage menu, or
                switch to the sortable list view. Totals convert to the
                workspace reporting currency.
              </li>
              <li>
                <span className="text-white">Ask.</span> A workspace chat over
                the whole CRM. Replies stream in as they generate. Type{" "}
                <K>/</K> for slash commands: web search, page reading,
                CRM-only answers, and <K>/task</K> or <K>/note</K>, which
                write straight to a record timeline with no AI key needed.
                Mention a company or contact by name and the command links the
                record; add "email me" to a task and a reminder goes through
                the configured email provider at the due time. Past chats live
                in a sub-sidebar with archive and delete.
              </li>
              <li>
                <span className="text-white">Notes and tasks.</span> Every
                company and contact page has a composer that logs notes or
                creates tasks with a due date, an optional email reminder, and
                a Complete button. Timeline writes also land on the Activity
                page, so both views tell one story.
              </li>
              <li>
                <span className="text-white">Compose email.</span> The Email
                button on company and contact pages opens a floating compose
                window: To, Cc, Bcc, markdown with preview, attachments, drag
                and resize. Sending waits for a Resend or AgentMail key; the
                timeline records the email either way. Details in the{" "}
                <a
                  href="#email"
                  className="text-accent underline decoration-edge underline-offset-2"
                >
                  email section
                </a>
                .
              </li>
              <li>
                <span className="text-white">Activity.</span> A live log of
                function outcomes, in the shape of the Convex dashboard logs.
                Pause freezes the view, checkboxes select one row or all of
                them for a targeted clear, Clear wipes everything, and the
                demo reset wipes it every 10 minutes anyway.
              </li>
              <li>
                <span className="text-white">Command-K.</span> Press{" "}
                <K>⌘K</K> (or <K>Ctrl-K</K>) anywhere in the app, or click
                Search in the sidebar, to jump to any company, contact, or
                deal. In the demo it searches only the CRM data.
              </li>
              <li>
                <span className="text-white">Sidebar.</span> Drag items to
                reorder them. Hide items you do not use from Settings. The
                rail icon in the header (or <K>⌘.</K>) collapses the sidebar
                entirely, and that preference sticks per browser. Order and
                visibility store on the workspace and reset with the demo.
              </li>
              <li>
                <span className="text-white">Keyboard shortcuts.</span> Press{" "}
                <K>⌘?</K> or click the keyboard icon in the sidebar footer to
                see every shortcut: search, sidebar toggle, and the Ask
                composer keys.
              </li>
              <li>
                <span className="text-white">Agents.</span> The list of
                research agents, their queues, and their run history. Describe
                a new process in plain language and the agent-builder drafts a
                new agent with versioned instructions.
              </li>
              <li>
                <span className="text-white">Record chat.</span> Open any
                company or contact and ask it a question. The agent reads your
                own CRM history first, and can search the web or read a page
                when Firecrawl and Exa keys are set. Without keys it tells you
                which key enables what instead of making something up.
              </li>
              <li>
                <span className="text-white">Settings.</span> Split into
                pages with its own sub-sidebar: Team, Integrations (with the
                API key how-to), Email (provider, from identity, signature),
                AI provider, Sidebar visibility, and Custom fields.
              </li>
            </ul>
          </Section>

          <Section id="fork-and-setup" title="Fork and set it up">
            <p>
              You need two free accounts:{" "}
              <Ext href="https://github.com">GitHub</Ext> and{" "}
              <Ext href="https://convex.dev">Convex</Ext>. You also need{" "}
              <Ext href="https://nodejs.org">Node.js</Ext> version 20 or newer
              on your computer. That is it. There is no database to create and
              no server to rent.
            </p>
            <p>
              <span className="text-white">Step 1.</span> Fork the repo. On{" "}
              <Ext href="https://github.com/waynesutton/trycrm-convex">
                the GitHub page
              </Ext>{" "}
              click Fork, then clone your fork to your computer:
            </p>
            <Code>{`git clone https://github.com/YOUR-USERNAME/trycrm-convex.git
cd trycrm-convex
npm install`}</Code>
            <p>
              <span className="text-white">Step 2.</span> Create your Convex
              deployment. This one command signs you in, creates a free dev
              deployment, and starts syncing the backend code:
            </p>
            <Code>{`npx convex dev`}</Code>
            <p>
              The first run will pause and ask for three required environment
              variables. Set each one to the literal word{" "}
              <K>unset</K> for now. That is a real value the app understands:
              it means run without this vendor and say so in the UI.
            </p>
            <Code>{`npx convex env set CONTEXT_DEV_API_KEY unset
npx convex env set FIRECRAWL_API_KEY unset
npx convex env set EXA_API_KEY unset`}</Code>
            <p>
              <span className="text-white">Step 3.</span> Run the app locally.
              In a second terminal:
            </p>
            <Code>{`npm run dev`}</Code>
            <p>
              This starts Vite on localhost and keeps <K>convex dev</K>{" "}
              watching your backend files. Open the printed localhost URL. The
              first visit seeds the demo data automatically.
            </p>
            <p>
              Everything works at this point. Enrichment, web research, chat,
              and email will each show a note explaining which key turns them
              on. Add keys whenever you want; no restart needed.
            </p>
          </Section>

          <Section id="environment-variables" title="Environment variables">
            <p>
              Environment variables are how you give the deployment your API
              keys. They live on the Convex deployment, not in a file in the
              repo, so they never end up in git. Set them from the terminal:
            </p>
            <Code>{`npx convex env set OPENAI_API_KEY sk-...`}</Code>
            <p>
              Or in the{" "}
              <Ext href="https://dashboard.convex.dev">Convex dashboard</Ext>:
              open your project, pick the deployment, then Settings, then
              Environment Variables. Dev and production deployments have
              separate variables, so remember to set keys on both. To set a
              variable on production from the terminal, add <K>--prod</K>:
            </p>
            <Code>{`npx convex env set OPENAI_API_KEY sk-... --prod`}</Code>
            <div className="overflow-x-auto rounded-lg border border-edge">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-edge bg-panel text-xs text-neutral-500">
                    <th className="px-3 py-2 font-medium">Variable</th>
                    <th className="px-3 py-2 font-medium">Required</th>
                    <th className="px-3 py-2 font-medium">What it enables</th>
                    <th className="px-3 py-2 font-medium">Get a key at</th>
                  </tr>
                </thead>
                <tbody>
                  {ENV_ROWS.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-edge/60 align-top last:border-0"
                    >
                      <td className="px-3 py-2 font-mono text-[12px] text-neutral-200">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">
                        {row.required}
                      </td>
                      <td className="px-3 py-2 text-neutral-400">
                        {row.enables}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">
                        {row.where}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The three “required” keys accept the sentinel value{" "}
              <K>unset</K>. The deploy needs the variable to exist because the
              components declare it, but the app checks for the sentinel and
              skips the vendor call. Replace <K>unset</K> with a real key any
              time and the feature switches on immediately.
            </p>
          </Section>

          <Section id="email" title="Email: Resend and AgentMail">
            <p>
              Email does two jobs here. Agents send notification emails when
              they finish meaningful work, and you can write your own: every
              company and contact page has an Email button that opens a
              compose window. Two providers are wired in and you pick one in
              Settings. Both are off until you add keys, and the app logs
              what it would have sent instead of failing.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="text-white">Resend</span> is plain outbound
                email. Set <K>RESEND_API_KEY</K> and you are done. The{" "}
                <Ext href="https://www.convex.dev/components/resend">
                  Resend component
                </Ext>{" "}
                handles batching, retries, and delivery status.
              </li>
              <li>
                <span className="text-white">AgentMail</span> gives agents a
                real inbox: sent mail, received mail, threads, and labels all
                sync into your Convex database. Set{" "}
                <K>AGENTMAIL_API_KEY</K> and <K>AGENTMAIL_INBOX_ID</K>. To
                receive inbound mail, register the webhook URL{" "}
                <K>{`https://YOUR-DEPLOYMENT.convex.site/agentmail/webhook`}</K>{" "}
                in the{" "}
                <Ext href="https://agentmail.to">AgentMail dashboard</Ext> and
                set <K>AGENTMAIL_WEBHOOK_SECRET</K>.
              </li>
            </ul>
            <p>
              The toggle lives in Settings under Email. It stores one field
              on the workspace row, so switching is instant and applies to
              every message sent afterward. You can keep keys for both
              configured and flip between them freely.
            </p>
            <p>
              <span className="text-white">Composing.</span> The compose
              window supports To, Cc, Bcc, markdown in the body with a live
              preview, and file attachments. It floats over the page, drags
              by its title bar, and resizes from the corner. Attachments
              upload to Convex file storage and arrive as download links in
              the message, which behaves the same on both providers. Every
              composed email lands on the record timeline and the Activity
              page the moment you hit Send, even on installs with no keys;
              only the actual delivery waits for a configured provider, and
              the Send button explains that instead of failing.
            </p>
            <p>
              <span className="text-white">From identity and signature.</span>{" "}
              Settings, then Email, has a Compose defaults panel: a from
              name, a from address, and a default signature that appends to
              every message. With Resend the from address must belong to a{" "}
              <Ext href="https://resend.com/docs/dashboard/domains/introduction">
                domain you verified in Resend
              </Ext>
              . AgentMail always sends from your inbox address, so the from
              fields apply to Resend only.
            </p>
          </Section>

          <Section id="web-research" title="Web research: Firecrawl and Exa">
            <p>
              Record chat has two research tools beyond your own CRM history.
              Both show up automatically once their keys are real.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="text-white">Firecrawl</span> reads a specific
                web page and returns the main content as markdown. Ask the
                chat to “read their pricing page” and the agent
                fetches it through the{" "}
                <Ext href="https://www.convex.dev/components/firecrawl/firecrawl-convex">
                  Firecrawl component
                </Ext>
                . Results are cached for an hour so repeated questions do not
                spend credits.
              </li>
              <li>
                <span className="text-white">Exa</span> is semantic web
                search. Ask “what has this company shipped lately”
                and the agent searches through the{" "}
                <Ext href="https://www.convex.dev/components/exalabs/convex-exa">
                  Exa component
                </Ext>{" "}
                and cites titles and URLs in its answer.
              </li>
            </ul>
            <p>
              Without keys, the tools return a plain “not configured”
              note and the agent repeats it to you, naming the key that turns
              the feature on. Nothing is faked.
            </p>
          </Section>

          <Section
            id="ai-providers"
            title="AI providers: OpenAI, Claude, OpenRouter"
          >
            <p>
              The Ask page and record chat run on one model provider at a
              time, picked in Settings. None of the three keys ship by
              default: a fresh fork has no AI keys at all, and the chat
              answers with the exact key it needs instead of erroring. Set
              whichever one you use:
            </p>
            <Code>{`npx convex env set OPENAI_API_KEY sk-...
npx convex env set ANTHROPIC_API_KEY sk-ant-...
npx convex env set OPENROUTER_API_KEY sk-or-...`}</Code>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="text-white">OpenAI</span> is the default,
                running <K>gpt-5-mini</K>. Get a key at{" "}
                <Ext href="https://platform.openai.com">
                  platform.openai.com
                </Ext>
                .
              </li>
              <li>
                <span className="text-white">Claude</span> runs{" "}
                <K>claude-sonnet-4-5</K> through Anthropic's API. Get a key at{" "}
                <Ext href="https://console.anthropic.com">
                  console.anthropic.com
                </Ext>
                .
              </li>
              <li>
                <span className="text-white">OpenRouter</span> routes through{" "}
                <Ext href="https://openrouter.ai">openrouter.ai</Ext>, which
                fronts many models with one key. It speaks the OpenAI wire
                format, so no extra dependency was needed.
              </li>
            </ul>
            <p>
              Switching providers in Settings takes effect on the next
              message. You can keep keys for all three set and flip freely.
            </p>
          </Section>

          <Section id="auth" title="Turning on sign-in">
            <p>
              The demo keeps sign-in off on purpose: anyone can try it and a
              cron resets the content every 10 minutes. Your fork will
              probably want real accounts. Start with the{" "}
              <Ext href="https://docs.convex.dev/auth/overview">
                Convex authentication overview
              </Ext>
              : Convex works with most auth providers because it verifies
              standard OpenID Connect JWTs, so you can bring{" "}
              <Ext href="https://docs.convex.dev/auth/clerk">Clerk</Ext>,{" "}
              <Ext href="https://docs.convex.dev/auth/authkit/">
                WorkOS AuthKit
              </Ext>
              , <Ext href="https://docs.convex.dev/auth/auth0">Auth0</Ext>, or
              any{" "}
              <Ext href="https://docs.convex.dev/auth/advanced/custom-auth">
                custom OpenID Connect provider
              </Ext>{" "}
              instead of the library below.
            </p>
            <p>
              The quickest path with no extra service is{" "}
              <Ext href="https://docs.convex.dev/auth/convex-auth">
                Convex Auth
              </Ext>
              , which runs entirely on your deployment. The short version of
              the setup:
            </p>
            <Code>{`npm install @convex-dev/auth @auth/core
npx @convex-dev/auth`}</Code>
            <p>
              The CLI wizard creates <K>convex/auth.ts</K> and the http routes
              for you. Then wrap the app in the auth provider from{" "}
              <K>@convex-dev/auth/react</K>, add a sign-in page, and flip the
              workspace's <K>demoMode</K> to false so the reset cron stops
              running and writes require a signed-in user. The{" "}
              <Ext href="https://labs.convex.dev/auth/setup">
                Convex Auth setup guide
              </Ext>{" "}
              walks through every step, including OAuth providers like GitHub
              and Google.
            </p>
            <p>
              Whichever provider you pick, the only server code that changes
              is <K>requireWriteAccess</K> in{" "}
              <K>convex/model/access.ts</K>: every write in the app already
              flows through that one check.
            </p>
          </Section>

          <Section id="deploy" title="Deploying to production">
            <p>
              Convex gives every project two deployments: dev (yours while you
              build) and production (the one you share). The website itself is
              served by the{" "}
              <Ext href="https://www.convex.dev/components/static-hosting">
                static hosting component
              </Ext>
              , so deploying is two commands and there is no separate web
              host. The component is already mounted in{" "}
              <K>convex/convex.config.ts</K> and the upload script already
              exists as <K>npm run deploy</K>; you do not need to install or
              configure anything for it.
            </p>
            <p>
              <span className="text-white">First,</span> push the backend to
              production. This is the one time you use <K>deploy</K> instead
              of <K>dev</K>:
            </p>
            <Code>{`npx convex deploy`}</Code>
            <p>
              <span className="text-white">Then,</span> set the required
            variables on production (they are separate from dev) and build and
              upload the site:
            </p>
            <Code>{`npx convex env set CONTEXT_DEV_API_KEY unset --prod
npx convex env set FIRECRAWL_API_KEY unset --prod
npx convex env set EXA_API_KEY unset --prod

npm run build
npm run deploy`}</Code>
            <p>
              <K>npm run deploy</K> uploads the built files from{" "}
              <K>dist/</K> into Convex file storage and serves them at your{" "}
              <K>*.convex.site</K> URL with an SPA fallback, so React Router
              paths like <K>/compare</K> and <K>/docs</K> work on refresh. To
              seed the production demo data once:
            </p>
            <Code>{`npx convex run demo:seedPublic --prod`}</Code>
            <p>
              A rule worth remembering: <K>npx convex dev</K> is for daily
              work and syncs to your dev deployment. <K>npx convex deploy</K>{" "}
              and anything with <K>--prod</K> touch production. If you are not
              shipping, you do not need them.
            </p>
          </Section>

          <Section
            id="coding-agents"
            title="Using Cursor, Codex, or other tools"
          >
            <p>
              The fastest path is to let a coding agent do the setup. The Copy
              the setup prompt button on the{" "}
              <Link
                to="/"
                className="text-accent underline decoration-edge underline-offset-2"
              >
                landing page
              </Link>{" "}
              puts this on your clipboard:
            </p>
            <Code>{`Set up waynesutton/trycrm-convex. Install the dependencies with npm, run npx convex dev to create my deployment, set CONTEXT_DEV_API_KEY, FIRECRAWL_API_KEY, and EXA_API_KEY to the literal string unset, and tell me which optional keys I still need.`}</Code>
            <p>
              Paste it into Cursor's agent, Codex, Claude Code, T3 Chat, or
              whatever you use. The repo ships an <K>AGENTS.md</K> file that
              coding agents read automatically, so they know the project
              conventions before they start. A few tool-specific notes:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="text-white">Cursor.</span> Open the cloned
                folder, paste the prompt into Agent mode. The Convex plugin
                gives it dashboard access if you have it installed.
              </li>
              <li>
                <span className="text-white">Codex or Claude Code.</span> Run
                it inside the repo folder. Both read <K>AGENTS.md</K> /{" "}
                <K>CLAUDE.md</K> on their own.
              </li>
              <li>
                <span className="text-white">Cloud-based agents.</span> If the
                agent runs on someone else's machine and cannot log in to
                Convex, have it set <K>CONVEX_AGENT_MODE=anonymous</K> before{" "}
                <K>npx convex dev</K> so it gets an isolated deployment
                instead of touching yours.
              </li>
            </ul>
          </Section>

          <Section id="components" title="Every component in this app">
            <p>
              Convex components are installable building blocks that run
              inside your deployment with their own tables and functions. This
              app uses fifteen. Each link goes to the component's directory
              page.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <Ext href="https://www.convex.dev/components/static-hosting">
                  Static hosting
                </Ext>{" "}
                serves this website from Convex file storage.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/agent">Agent</Ext>{" "}
                runs the research agents and record chat with per-thread
                memory.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/workflow">
                  Workflow
                </Ext>{" "}
                keeps multi-step agent runs durable across restarts.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/workpool">
                  Workpool
                </Ext>{" "}
                gives each agent a bounded queue so no one floods the system.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/crons">Crons</Ext>{" "}
                schedules recurring work, including the 10 minute demo reset.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/action-retrier">
                  Action retrier
                </Ext>{" "}
                retries flaky external calls with backoff.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/action-cache">
                  Action cache
                </Ext>{" "}
                caches enrichment lookups for 7 days.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/rate-limiter">
                  Rate limiter
                </Ext>{" "}
                keeps chat and enrichment within per-user budgets.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/aggregate">
                  Aggregate
                </Ext>{" "}
                powers the dashboard rollups without table scans.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/migrations">
                  Migrations
                </Ext>{" "}
                handles schema backfills as the data model evolves.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/resend">
                  Resend
                </Ext>{" "}
                sends outbound notification email.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/agentmail/convex">
                  AgentMail
                </Ext>{" "}
                gives agents a persistent inbox with reactive threads.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/context-dot-dev/convex">
                  Context.dev
                </Ext>{" "}
                supplies brand data for company enrichment.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/firecrawl/firecrawl-convex">
                  Firecrawl
                </Ext>{" "}
                scrapes web pages for the chat agent.
              </li>
              <li>
                <Ext href="https://www.convex.dev/components/exalabs/convex-exa">
                  Exa
                </Ext>{" "}
                runs semantic web search for the chat agent.
              </li>
            </ul>
          </Section>

          <Section id="resources" title="Resources">
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <Ext href="https://docs.convex.dev/home">Convex docs</Ext>,
                the main reference for everything below.
              </li>
              <li>
                <Ext href="https://docs.convex.dev/components/using">
                  Using components
                </Ext>{" "}
                explains how components mount into a deployment.
              </li>
              <li>
                <Ext href="https://docs.convex.dev/scheduling/cron-jobs">
                  Cron jobs
                </Ext>{" "}
                covers the scheduler behind the demo reset.
              </li>
              <li>
                <Ext href="https://docs.convex.dev/auth/overview">
                  Auth overview
                </Ext>{" "}
                and <Ext href="https://labs.convex.dev/auth">Convex Auth</Ext>{" "}
                for adding sign-in to your fork with Convex Auth, Clerk,
                WorkOS AuthKit, Auth0, or any OpenID Connect provider.
              </li>
              <li>
                <Ext href="https://docs.convex.dev/production">
                  Production guide
                </Ext>{" "}
                for deploy keys, custom domains, and environments.
              </li>
              <li>
                <Ext href="https://github.com/waynesutton/trycrm-convex">
                  This repo
                </Ext>{" "}
                and the{" "}
                <Ext href="https://github.com/trycompai/crm">
                  original by Comp AI
                </Ext>
                , both MIT licensed.
              </li>
            </ul>
          </Section>
        </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
