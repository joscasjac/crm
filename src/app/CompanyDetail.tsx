import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ComposeEmail } from "../components/ComposeEmail";
import { FieldCell } from "../components/dataTable";
import { TimelinePanel } from "../components/Timeline";
import {
  Avatar,
  Badge,
  Button,
  CompanyLogo,
  EmptyState,
  Input,
  Panel,
} from "../components/ui";
import { formatMoney, stageLabel } from "../lib/format";
import { EnrichmentBadge } from "./Companies";

const TABS = ["Overview", "Contacts", "Deals", "Activity", "Agent"] as const;
type Tab = (typeof TABS)[number];

export function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const company = useQuery(
    api.companies.get,
    companyId ? { companyId: companyId as Id<"companies"> } : "skip",
  );
  const reEnrich = useMutation(api.companies.reEnrich);
  const remove = useMutation(api.companies.remove);
  const [tab, setTab] = useState<Tab>("Overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  if (company === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }
  if (company === null) {
    return <EmptyState message="Company not found. It may have been reset." />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={40} />
          <div>
            <h1 className="text-xl font-semibold text-white">
              {company.name}
            </h1>
            <p className="text-sm text-neutral-500">
              {[company.domain, company.industry].filter(Boolean).join(" · ")}
            </p>
          </div>
          <EnrichmentBadge status={company.enrichmentStatus} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setComposeOpen(true)}>Email</Button>
          <Button
            onClick={() =>
              void reEnrich({ companyId: company._id }).catch(() => undefined)
            }
          >
            Re-enrich
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="danger"
                onClick={() =>
                  void remove({ companyId: company._id }).then(() =>
                    navigate("/app/companies"),
                  )
                }
              >
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Panel className="p-4">
          <p className="text-xs text-neutral-500">Open pipeline</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatMoney(company.openPipelineMinor, "USD")}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-neutral-500">Open deals</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {company.openDealCount}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-neutral-500">Owner</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white">
            {company.owner ? (
              <>
                <Avatar
                  name={company.owner.name}
                  src={company.owner.avatarUrl}
                  size={20}
                />
                {company.owner.name}
              </>
            ) : (
              <span className="text-neutral-600">Unassigned</span>
            )}
          </p>
        </Panel>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-edge">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap px-3 py-2 text-sm transition-colors ${
              tab === t
                ? "border-b-2 border-accent text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t}
            {t === "Contacts" ? ` ${company.contacts.length}` : ""}
            {t === "Deals" ? ` ${company.deals.length}` : ""}
          </button>
        ))}
      </div>

      {tab === "Overview" ? <Overview company={company} /> : null}
      {tab === "Contacts" ? <ContactsTab company={company} /> : null}
      {tab === "Deals" ? <DealsTab company={company} /> : null}
      {tab === "Activity" ? <ActivityTab companyId={company._id} /> : null}
      {tab === "Agent" ? <AgentTab companyId={company._id} /> : null}

      <ComposeEmail
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaultTo={
          company.primaryContact?.email ?? company.contacts[0]?.email ?? ""
        }
        companyId={company._id}
      />
    </div>
  );
}

type CompanyData = NonNullable<
  FunctionReturnType<typeof api.companies.get>
>;

function Overview({ company }: { company: CompanyData }) {
  const fields = useQuery(api.fields.forEntity, {
    entity: "company",
    entityId: company._id,
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <h3 className="mb-2 text-sm font-medium text-white">About</h3>
        <p className="text-sm leading-relaxed text-neutral-400">
          {company.description ??
            "No description yet. Enrichment fills this in when a brand data key is configured."}
        </p>
      </Panel>
      <Panel className="p-4">
        <h3 className="mb-2 text-sm font-medium text-white">Custom fields</h3>
        {fields && fields.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No custom fields defined. Add them in Settings under Companies.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {fields?.map((field) => (
              <div
                key={field.definition._id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="shrink-0 text-neutral-500">
                  {field.definition.label}
                  {field.definition.agentFilled ? (
                    <span className="ml-2 text-[10px] text-accent">agent</span>
                  ) : null}
                </span>
                <div className="min-w-0 max-w-56 flex-1 text-right">
                  <FieldCell
                    definition={field.definition}
                    entityId={company._id}
                    value={field.value ?? undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ContactsTab({ company }: { company: CompanyData }) {
  if (company.contacts.length === 0) {
    return <EmptyState message="No contacts at this company yet" />;
  }
  return (
    <Panel>
      {company.contacts.map((contact) => (
        <Link
          key={contact._id}
          to={`/app/contacts/${contact._id}`}
          className="flex items-center justify-between border-b border-edge/60 px-4 py-3 text-sm last:border-0 hover:bg-white/[0.02]"
        >
          <span className="flex items-center gap-2 text-white">
            <Avatar name={contact.name} src={contact.avatarUrl} />
            {contact.name}
          </span>
          <span className="text-neutral-500">
            {[contact.title, contact.email].filter(Boolean).join(" · ")}
          </span>
        </Link>
      ))}
    </Panel>
  );
}

function DealsTab({ company }: { company: CompanyData }) {
  if (company.deals.length === 0) {
    return <EmptyState message="No deals for this company yet" />;
  }
  return (
    <Panel>
      {company.deals.map((deal) => (
        <div
          key={deal._id}
          className="flex items-center justify-between border-b border-edge/60 px-4 py-3 text-sm last:border-0"
        >
          <span className="text-white">{deal.name}</span>
          <span className="flex items-center gap-3">
            <Badge>{stageLabel(deal.stage)}</Badge>
            <span className="text-neutral-300">
              {formatMoney(deal.amountMinor, deal.currency)}
            </span>
          </span>
        </div>
      ))}
    </Panel>
  );
}

// Notes and tasks on this company, shared with contact detail. Tasks take a
// due date and an optional email reminder; everything also lands on the
// Activity page.
function ActivityTab({ companyId }: { companyId: Id<"companies"> }) {
  const activities = useQuery(api.activities.forCompany, { companyId });
  return <TimelinePanel companyId={companyId} activities={activities} />;
}

// The agent tab: chat with the record, see queued work and rechecks.
function AgentTab({ companyId }: { companyId: Id<"companies"> }) {
  const tasks = useQuery(api.agentTasks.forCompany, { companyId });
  const threadId = useQuery(api.chat.threadForCompany, { companyId });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RecordChat companyId={companyId} threadId={threadId ?? null} />
      <Panel className="p-4">
        <h3 className="mb-3 text-sm font-medium text-white">Agent tasks</h3>
        {tasks && tasks.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nothing queued for this record.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks?.map((task) => (
              <div key={task._id} className="text-sm">
                <div className="flex items-center justify-between">
                  <Badge
                    tone={
                      task.state === "done"
                        ? "green"
                        : task.state === "failed"
                          ? "red"
                          : "yellow"
                    }
                  >
                    {task.kind}
                  </Badge>
                  <span className="text-xs text-neutral-600">
                    {task.state}
                  </span>
                </div>
                <p className="mt-1 text-neutral-400">{task.reason}</p>
                {task.result ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    {task.result}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

const SUGGESTIONS = [
  "What do they do?",
  "Who do we know here?",
  "What has changed recently?",
];

function RecordChat({
  companyId,
  threadId,
}: {
  companyId: Id<"companies">;
  threadId: string | null;
}) {
  const ask = useMutation(api.chat.ask);
  const messages = usePaginatedQuery(
    api.chat.messages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 30 },
  );
  const [prompt, setPrompt] = useState("");

  const send = async (text: string) => {
    if (!text.trim()) return;
    setPrompt("");
    await ask({ companyId, prompt: text.trim() });
  };

  return (
    <Panel className="flex flex-col p-4">
      <h3 className="mb-1 text-sm font-medium text-white">
        Ask about this company
      </h3>
      <p className="mb-3 text-xs text-neutral-600">
        It reads our own history with them and shows its working.
      </p>
      <div className="mb-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
        {messages.results?.map((message) => (
          <div
            key={message.key}
            className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
              message.role === "user"
                ? "self-end bg-edge text-white"
                : "self-start bg-ink text-neutral-300"
            }`}
          >
            {message.parts
              .filter((part) => part.type === "text")
              .map((part, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {(part as { text: string }).text}
                </p>
              ))}
          </div>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => void send(suggestion)}
            className="rounded-full border border-edge px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-accent hover:text-accent"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="What do they sell?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send(prompt)}
        />
        <Button variant="primary" onClick={() => void send(prompt)}>
          Ask
        </Button>
      </div>
    </Panel>
  );
}
