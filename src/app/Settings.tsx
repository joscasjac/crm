import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  Avatar,
  Badge,
  Button,
  Input,
  PageHeader,
  Panel,
} from "../components/ui";
import { NAV_ITEMS } from "./AppLayout";

// Settings grew past one scroll, so each concern gets its own page under
// /app/settings/:section with a sub-sidebar, the same pattern as Ask.

const SECTIONS = [
  { id: "team", label: "Team" },
  { id: "integrations", label: "Integrations" },
  { id: "email", label: "Email" },
  { id: "ai", label: "AI provider" },
  { id: "sidebar", label: "Sidebar" },
  { id: "fields", label: "Custom fields" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const SUBTITLES: Record<SectionId, string> = {
  team: "Workspace members and sign-in.",
  integrations: "API keys and what each one enables.",
  email: "Provider, from identity, and signature.",
  ai: "Which model provider runs the chat surfaces.",
  sidebar: "Show or hide sidebar items.",
  fields: "Custom company fields the agent can fill.",
};

export function Settings() {
  const { section } = useParams<{ section?: string }>();
  const active: SectionId = SECTIONS.some((s) => s.id === section)
    ? (section as SectionId)
    : "team";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle={SUBTITLES[active]} />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-44 md:flex-col">
          {SECTIONS.map((item) => (
            <Link
              key={item.id}
              to={
                item.id === "team"
                  ? "/app/settings"
                  : `/app/settings/${item.id}`
              }
              className={`rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
                active === item.id
                  ? "bg-raised text-white"
                  : "text-neutral-500 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {active === "team" ? <TeamSection /> : null}
          {active === "integrations" ? <IntegrationsSection /> : null}
          {active === "email" ? <EmailSection /> : null}
          {active === "ai" ? <AiSection /> : null}
          {active === "sidebar" ? <SidebarSection /> : null}
          {active === "fields" ? <FieldsSection /> : null}
        </div>
      </div>
    </div>
  );
}

function TeamSection() {
  const users = useQuery(api.users.list);
  return (
    <Panel className="p-4">
      <h3 className="mb-3 text-sm font-medium text-white">Team</h3>
      <div className="flex flex-col gap-2">
        {users?.map((user) => (
          <div key={user._id} className="flex items-center gap-2 text-sm">
            <Avatar name={user.name} src={user.avatarUrl} />
            <span className="text-neutral-200">{user.name}</span>
            <span className="text-neutral-600">{user.email}</span>
            {user.role ? <Badge>{user.role}</Badge> : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-neutral-600">
        Sign-in is disabled on this demo. In a real install Convex Auth
        handles sign-in and this table maps to authenticated users, with an
        allow list that fails closed.
      </p>
    </Panel>
  );
}

function IntegrationsSection() {
  const capabilities = useQuery(api.capabilities.status);
  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4">
        <h3 className="mb-3 text-sm font-medium text-white">Integrations</h3>
        <div className="flex flex-col gap-3 text-sm">
          <IntegrationRow
            name="Context.dev brand data"
            detail="Set CONTEXT_DEV_API_KEY on the deployment to enable company enrichment."
            configured={capabilities?.contextDev}
            docsId="environment-variables"
          />
          <IntegrationRow
            name="OpenAI"
            detail="Set OPENAI_API_KEY to enable chat and agent reasoning."
            configured={capabilities?.openai}
            docsId="ai-providers"
          />
          <IntegrationRow
            name="Anthropic (Claude)"
            detail="Set ANTHROPIC_API_KEY to run chat on Claude instead."
            configured={capabilities?.anthropic}
            docsId="ai-providers"
          />
          <IntegrationRow
            name="OpenRouter"
            detail="Set OPENROUTER_API_KEY to route chat through OpenRouter."
            configured={capabilities?.openrouter}
            docsId="ai-providers"
          />
          <IntegrationRow
            name="Firecrawl web scraping"
            detail="Set FIRECRAWL_API_KEY so the chat agent can read web pages."
            configured={capabilities?.firecrawl}
            docsId="web-research"
          />
          <IntegrationRow
            name="Exa web search"
            detail="Set EXA_API_KEY so the chat agent can search the web."
            configured={capabilities?.exa}
            docsId="web-research"
          />
          <IntegrationRow
            name="Resend email"
            detail="Set RESEND_API_KEY to enable outbound email."
            configured={capabilities?.resend}
            docsId="email"
          />
          <IntegrationRow
            name="AgentMail inbox"
            detail="Set AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID for a persistent agent inbox."
            configured={capabilities?.agentmail}
            docsId="email"
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-neutral-500">
          Every key is explained in the{" "}
          <Link
            to="/docs#environment-variables"
            className="text-accent hover:underline"
          >
            environment variables guide
          </Link>
          , including where to create each account.
        </p>
      </Panel>

      <Panel className="p-4">
        <h3 className="mb-1 text-sm font-medium text-white">
          Adding API keys
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          API keys live on your Convex deployment, not in this app or in a
          local .env file. Set one from your project folder and the feature
          turns on within seconds, no redeploy needed:
        </p>
        <CommandBlock>{`npx convex env set OPENAI_API_KEY sk-your-key`}</CommandBlock>
        <p className="mt-3 mb-3 text-xs leading-relaxed text-neutral-500">
          Every Convex project has two deployments with separate variables:
          dev, which you use while building, and production, the one you
          share. The command above only sets the key on dev. To set it on
          production, add <Mono>--prod</Mono>:
        </p>
        <CommandBlock>{`npx convex env set OPENAI_API_KEY sk-your-key --prod`}</CommandBlock>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          If a key works on your machine but not on your live site, this
          split is almost always why: it was set on dev only. You can also
          add keys in the{" "}
          <a
            href="https://dashboard.convex.dev"
            className="text-accent hover:underline"
          >
            Convex dashboard
          </a>{" "}
          under Settings, then Environment Variables, picking the deployment
          first. See{" "}
          <Link
            to="/docs#environment-variables"
            className="text-accent hover:underline"
          >
            environment variables
          </Link>{" "}
          for the full key list and{" "}
          <Link to="/docs#deploy" className="text-accent hover:underline">
            deploying to production
          </Link>{" "}
          for when <Mono>--prod</Mono> matters.
        </p>
      </Panel>
    </div>
  );
}

function EmailSection() {
  const capabilities = useQuery(api.capabilities.status);
  const emailProvider = useQuery(api.email.provider);
  const setEmailProvider = useMutation(api.email.setProvider);
  const settings = useQuery(api.email.settings);
  const setSettings = useMutation(api.email.setSettings);

  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [saved, setSaved] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form once when the stored settings arrive; edits after that
  // are local until Save.
  useEffect(() => {
    if (!settings || loadedFor === "email") return;
    setFromName(settings.fromName ?? "");
    setFromAddress(settings.fromAddress ?? "");
    setSignature(settings.signature ?? "");
    setLoadedFor("email");
  }, [settings, loadedFor]);

  const save = async () => {
    await setSettings({
      fromName: fromName.trim() || undefined,
      fromAddress: fromAddress.trim() || undefined,
      signature: signature.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4">
        <h3 className="mb-1 text-sm font-medium text-white">Email provider</h3>
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          Composed emails and agent notifications go out through one
          provider. Resend is plain outbound email; AgentMail also gives
          agents a persistent inbox with threads synced into Convex. The
          switch works even before keys are set; sending stays off until the
          selected provider is configured. Setup steps for both are in{" "}
          <Link to="/docs#email" className="text-accent hover:underline">
            email: Resend and AgentMail
          </Link>
          .
        </p>
        <div className="flex gap-2">
          {(["resend", "agentmail"] as const).map((option) => {
            const active = (emailProvider ?? "resend") === option;
            const configured =
              option === "resend"
                ? capabilities?.resend
                : capabilities?.agentmail;
            return (
              <button
                key={option}
                type="button"
                onClick={() => void setEmailProvider({ provider: option })}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-edge-strong bg-raised text-white"
                    : "border-edge text-neutral-400 hover:text-white"
                }`}
              >
                {option === "resend" ? "Resend" : "AgentMail"}
                <span className="ml-2 text-[10px] text-neutral-500">
                  {configured ? "configured" : "no key"}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-4">
        <h3 className="mb-1 text-sm font-medium text-white">
          Compose defaults
        </h3>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          The Email button on company and contact pages opens a compose
          window. These fields set who the mail comes from and the signature
          that appends to every message. With Resend the from address must
          belong to a domain you verified in Resend; AgentMail sends from
          your inbox address, so the from fields apply to Resend only.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">
              From name
            </label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Ada from CRM"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">
              From address
            </label>
            <Input
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="ada@yourdomain.com"
            />
          </div>
        </div>
        <label className="mb-1 block text-xs text-neutral-500">
          Default signature
        </label>
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={3}
          placeholder={"Best,\nAda"}
          className="mb-4 w-full resize-y rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
          {saved ? (
            <span className="text-xs text-emerald-400">Saved.</span>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function AiSection() {
  const capabilities = useQuery(api.capabilities.status);
  const aiProvider = useQuery(api.prefs.aiProvider);
  const setAiProvider = useMutation(api.prefs.setAiProvider);
  return (
    <Panel className="p-4">
      <h3 className="mb-1 text-sm font-medium text-white">AI provider</h3>
      <p className="mb-3 text-xs leading-relaxed text-neutral-500">
        The Ask page and record chat run on one model provider. None of
        these keys ship by default: pick a provider, set its key on the
        deployment, and the chat starts reasoning. Until then it answers
        with the exact key it needs. See{" "}
        <Link to="/docs#ai-providers" className="text-accent hover:underline">
          AI providers
        </Link>{" "}
        for the setup steps.
      </p>
      <div className="flex gap-2">
        {(
          [
            { id: "openai", label: "OpenAI" },
            { id: "anthropic", label: "Claude" },
            { id: "openrouter", label: "OpenRouter" },
          ] as const
        ).map((option) => {
          const active = (aiProvider ?? "openai") === option.id;
          const configured = capabilities?.[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => void setAiProvider({ provider: option.id })}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-edge-strong bg-raised text-white"
                  : "border-edge text-neutral-400 hover:text-white"
              }`}
            >
              {option.label}
              <span className="ml-2 text-[10px] text-neutral-500">
                {configured ? "configured" : "no key"}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function SidebarSection() {
  const sidebarPrefs = useQuery(api.prefs.sidebar);
  const setSidebarHidden = useMutation(api.prefs.setSidebarHidden);
  return (
    <Panel className="p-4">
      <h3 className="mb-1 text-sm font-medium text-white">Sidebar</h3>
      <p className="mb-3 text-xs leading-relaxed text-neutral-600">
        Choose which items show in the sidebar. Drag items in the sidebar
        itself to reorder them. Settings and Docs always stay visible.
      </p>
      <div className="flex flex-wrap gap-3">
        {NAV_ITEMS.map((item) => {
          const hidden = sidebarPrefs?.hidden.includes(item.id) ?? false;
          return (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300"
            >
              <input
                type="checkbox"
                checked={!hidden}
                onChange={() => {
                  const current = sidebarPrefs?.hidden ?? [];
                  const next = hidden
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id];
                  void setSidebarHidden({ hidden: next });
                }}
                className="accent-current"
              />
              {item.label}
            </label>
          );
        })}
      </div>
    </Panel>
  );
}

function FieldsSection() {
  const definitions = useQuery(api.fields.listDefinitions, {
    entity: "company",
  });
  const createDefinition = useMutation(api.fields.createDefinition);
  const archiveDefinition = useMutation(api.fields.archiveDefinition);
  const [label, setLabel] = useState("");
  const [agentBrief, setAgentBrief] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addField = async () => {
    try {
      setError(null);
      await createDefinition({
        entity: "company",
        key: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label,
        type: "text",
        agentFilled: agentBrief.trim().length > 0,
        agentBrief: agentBrief.trim() || undefined,
      });
      setLabel("");
      setAgentBrief("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create field");
    }
  };

  return (
    <Panel className="p-4">
      <h3 className="mb-1 text-sm font-medium text-white">
        Custom company fields
      </h3>
      <p className="mb-3 text-xs text-neutral-600">
        Give a field an agent brief and the agent fills it during research,
        with evidence recorded in the ledger.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label className="mb-1 block text-xs text-neutral-500">Label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="w-80">
          <label className="mb-1 block text-xs text-neutral-500">
            Agent brief (optional)
          </label>
          <Input
            value={agentBrief}
            onChange={(e) => setAgentBrief(e.target.value)}
            placeholder="What should the agent put here?"
          />
        </div>
        <Button
          variant="primary"
          onClick={() => void addField()}
          disabled={!label.trim()}
        >
          Add field
        </Button>
      </div>
      {error ? <p className="mb-3 text-xs text-red-400">{error}</p> : null}
      <div className="flex flex-col gap-2">
        {definitions?.map((definition) => (
          <div
            key={definition._id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-neutral-200">
              {definition.label}
              {definition.agentFilled ? (
                <span className="ml-2 text-[10px] text-accent">agent</span>
              ) : null}
              {definition.archived ? (
                <span className="ml-2 text-[10px] text-neutral-600">
                  archived
                </span>
              ) : null}
            </span>
            {!definition.archived ? (
              <Button
                variant="ghost"
                onClick={() =>
                  void archiveDefinition({ fieldId: definition._id })
                }
              >
                Archive
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// Each row links straight into the docs section that walks through that
// key: where to create the account, the exact env set command, and what
// the feature does once the key is live.
function IntegrationRow({
  name,
  detail,
  configured,
  docsId,
}: {
  name: string;
  detail: string;
  configured: boolean | undefined;
  docsId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-neutral-200">{name}</p>
        <p className="text-xs text-neutral-500">
          {detail}{" "}
          <Link
            to={`/docs#${docsId}`}
            className="whitespace-nowrap text-accent hover:underline"
          >
            Setup guide
          </Link>
        </p>
      </div>
      {configured === undefined ? null : (
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            configured
              ? "bg-emerald-800/40 text-emerald-400"
              : "bg-raised text-neutral-500"
          }`}
        >
          {configured ? "configured" : "not set"}
        </span>
      )}
    </div>
  );
}

// Copyable command line, styled like the docs page code blocks.
function CommandBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-edge bg-raised px-3 py-2 font-mono text-[12px] leading-relaxed text-neutral-200">
      {children}
    </pre>
  );
}

function Mono({ children }: { children: string }) {
  return (
    <code className="rounded bg-raised px-1 py-0.5 font-mono text-[11px] text-neutral-200">
      {children}
    </code>
  );
}
