import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatMoney, shortDate, stageLabel, timeAgo } from "../lib/format";
import { ComposeEmail } from "./ComposeEmail";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { FavoriteButton } from "./FavoriteButton";
import { SlideOver } from "./SlideOver";
import { TimelineComposer, TimelineFeed } from "./Timeline";
import {
  Avatar,
  Badge,
  Button,
  CompanyLogo,
  EmptyState,
  Panel,
} from "./ui";

type RecordRef =
  | { type: "company"; id: Id<"companies"> }
  | { type: "contact"; id: Id<"contacts"> }
  | { type: "deal"; id: Id<"deals"> };

type ActivityRow = FunctionReturnType<typeof api.activities.forCompany>[number];
type Tab = "home" | "timeline" | "tasks" | "notes" | "emails";
type ActiveRecordData = NonNullable<
  | FunctionReturnType<typeof api.companies.get>
  | FunctionReturnType<typeof api.contacts.get>
  | FunctionReturnType<typeof api.deals.get>
>;

export function RecordSidePanel({
  record,
  onClose,
}: {
  record: RecordRef | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [displayRecord, setDisplayRecord] = useState<RecordRef | null>(record);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (record) setDisplayRecord(record);
  }, [record]);

  const activeRecord = record ?? displayRecord;
  const company = useQuery(
    api.companies.get,
    activeRecord?.type === "company" ? { companyId: activeRecord.id } : "skip",
  );
  const contact = useQuery(
    api.contacts.get,
    activeRecord?.type === "contact" ? { contactId: activeRecord.id } : "skip",
  );
  const deal = useQuery(
    api.deals.get,
    activeRecord?.type === "deal" ? { dealId: activeRecord.id } : "skip",
  );
  const companyActivity = useQuery(
    api.activities.forCompany,
    activeRecord?.type === "company" ? { companyId: activeRecord.id } : "skip",
  );
  const contactActivity = useQuery(
    api.activities.forContact,
    activeRecord?.type === "contact" ? { contactId: activeRecord.id } : "skip",
  );
  const dealActivity = useQuery(
    api.activities.forDeal,
    activeRecord?.type === "deal" ? { dealId: activeRecord.id } : "skip",
  );

  useEffect(() => {
    if (record) setTab("home");
  }, [record]);

  if (!activeRecord) return null;

  const active =
    activeRecord.type === "company" ? company : activeRecord.type === "contact" ? contact : deal;
  const activities =
    activeRecord.type === "company"
      ? companyActivity
      : activeRecord.type === "contact"
        ? contactActivity
        : dealActivity;
  const href =
    activeRecord.type === "company"
      ? `/app/companies/${activeRecord.id}`
      : activeRecord.type === "contact"
        ? `/app/contacts/${activeRecord.id}`
        : `/app/deals?deal=${activeRecord.id}`;
  const title =
    active && "name" in active ? active.name : activeRecord.type === "deal" ? "Deal" : "Record";

  const rows = activities as Array<ActivityRow> | undefined;
  const visibleRows =
    tab === "tasks"
      ? rows?.filter((row) => row.type === "TASK")
      : tab === "notes"
        ? rows?.filter((row) => row.type === "NOTE")
        : tab === "emails"
          ? rows?.filter((row) => row.type === "EMAIL")
          : rows;
  const activityLinks =
    active && active !== null
      ? recordActivityLinks(activeRecord, active)
      : recordActivityLinks(activeRecord);
  const defaultEmailTo =
    active && active !== null ? recordEmailTo(activeRecord, active) : "";

  return (
    <>
      <SlideOver
        open={record !== null}
        onClose={onClose}
        title={title}
        subtitle={`${activeRecord.type}${
          active && "_creationTime" in active
            ? ` · created ${timeAgo(active._creationTime)}`
            : ""
        }`}
        icon={<RecordMark record={activeRecord} active={active} />}
        actions={
          <FavoriteButton
            label={title}
            href={href}
            kind="record"
            entityType={activeRecord.type}
            entityId={activeRecord.id}
          />
        }
      >
          <nav className="flex gap-1 overflow-x-auto border-b border-edge px-4">
            {(["home", "timeline", "tasks", "notes", "emails"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`whitespace-nowrap px-3 py-3 text-sm capitalize transition-colors ${
                    tab === item
                      ? "border-b-2 border-accent text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {active === undefined ? (
              <p className="text-sm text-neutral-500">Loading...</p>
            ) : active === null ? (
              <EmptyState message="Record not found" />
            ) : tab === "home" ? (
              <HomeTab record={activeRecord} active={active} />
            ) : tab === "timeline" ? (
              <Panel>
                <TimelineFeed activities={visibleRows} />
              </Panel>
            ) : tab === "tasks" ? (
              <RecordActivityTab
                composer={
                  <TimelineComposer
                    {...activityLinks}
                    defaultMode="TASK"
                    modeLocked
                  />
                }
                activities={visibleRows}
              />
            ) : tab === "notes" ? (
              <RecordActivityTab
                composer={
                  <TimelineComposer
                    {...activityLinks}
                    defaultMode="NOTE"
                    modeLocked
                  />
                }
                activities={visibleRows}
              />
            ) : (
              <RecordActivityTab
                composer={
                  <EmailComposerPrompt
                    defaultTo={defaultEmailTo}
                    onCompose={() => setComposeOpen(true)}
                  />
                }
                activities={visibleRows}
              />
            )}
          </div>
      </SlideOver>
      <ComposeEmail
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaultTo={defaultEmailTo}
        {...activityLinks}
      />
    </>
  );
}

function RecordActivityTab({
  composer,
  activities,
}: {
  composer: ReactNode;
  activities: Array<ActivityRow> | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3">{composer}</Panel>
      <Panel>
        <TimelineFeed activities={activities} />
      </Panel>
    </div>
  );
}

function EmailComposerPrompt({
  defaultTo,
  onCompose,
}: {
  defaultTo: string;
  onCompose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">Send an email</p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {defaultTo ? `To ${defaultTo}` : "Choose recipients in the composer"}
        </p>
      </div>
      <Button variant="primary" onClick={onCompose}>
        Compose
      </Button>
    </div>
  );
}

function recordActivityLinks(record: RecordRef, active?: ActiveRecordData) {
  if (record.type === "company") {
    return { companyId: record.id };
  }
  if (record.type === "contact") {
    const contact = active && "facts" in active ? active : null;
    return {
      companyId: contact?.companyId ?? undefined,
      contactId: record.id,
    };
  }
  const deal = active && "amountMinor" in active ? active : null;
  return {
    companyId: deal?.companyId,
    contactId: deal?.primaryContactId ?? undefined,
    dealId: record.id,
  };
}

function recordEmailTo(record: RecordRef, active: ActiveRecordData) {
  if (record.type === "company" && "contacts" in active) {
    return active.primaryContact?.email ?? active.contacts[0]?.email ?? "";
  }
  if (record.type === "contact" && "email" in active) {
    return active.email ?? "";
  }
  if (record.type === "deal" && "primaryContact" in active) {
    return active.primaryContact?.email ?? "";
  }
  return "";
}

function HomeTab({
  record,
  active,
}: {
  record: RecordRef;
  active: NonNullable<
    | FunctionReturnType<typeof api.companies.get>
    | FunctionReturnType<typeof api.contacts.get>
    | FunctionReturnType<typeof api.deals.get>
  >;
}) {
  if (record.type === "company" && "openPipelineMinor" in active) {
    return (
      <div className="grid gap-4">
        <Panel className="grid grid-cols-2 gap-3 p-4">
          <Metric label="Pipeline" value={formatMoney(active.openPipelineMinor, "USD")} />
          <Metric label="Open deals" value={String(active.openDealCount)} />
          <Metric label="Contacts" value={String(active.contacts.length)} />
          <Metric label="Deals" value={String(active.deals.length)} />
        </Panel>
        <FieldList
          rows={[
            ["Domain", active.domain ?? "Not set"],
            ["Industry", active.industry ?? "Not set"],
            ["Owner", active.owner?.name ?? "Unassigned"],
            ["Description", active.description ?? "Not set"],
          ]}
        >
          <CustomFieldsEditor entity="company" entityId={record.id} variant="inline" />
        </FieldList>
      </div>
    );
  }

  if (record.type === "contact" && "facts" in active) {
    return (
      <div className="grid gap-4">
        <FieldList
          rows={[
            ["Title", active.title ?? "Not set"],
            ["Email", active.email ?? "Not set"],
            ["Company", active.company?.name ?? "Not set"],
            ["Owner", active.owner?.name ?? "Unassigned"],
          ]}
        >
          <CustomFieldsEditor entity="contact" entityId={record.id} variant="inline" />
        </FieldList>
        <Panel className="p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Evidence</h3>
          <div className="flex flex-col gap-2">
            {active.facts.slice(0, 6).map((fact) => (
              <div key={fact._id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">{fact.field}</span>
                  <Badge tone={fact.band === "CONFIRMED" ? "green" : "yellow"}>
                    {fact.band}
                  </Badge>
                </div>
                <p className="truncate text-neutral-200">{fact.value}</p>
              </div>
            ))}
            {active.facts.length === 0 ? (
              <p className="text-sm text-neutral-600">No facts recorded</p>
            ) : null}
          </div>
        </Panel>
      </div>
    );
  }

  if (record.type === "deal" && "amountMinor" in active) {
    return (
      <div className="grid gap-4">
        <Panel className="p-4">
          <h3 className="mb-4 text-sm font-medium text-white">Fields</h3>
          <div className="grid gap-5">
            <FieldGroup
              title="Deal"
              rows={[
                ["Amount", formatMoney(active.amountMinor, active.currency)],
                ["Stage", stageLabel(active.stage)],
                [
                  "Close date",
                  active.expectedCloseAt ? shortDate(active.expectedCloseAt) : "Not set",
                ],
              ]}
            />
            <FieldGroup
              title="Relations"
              rows={[
                ["Company", active.company?.name ?? "Not set"],
                ["Point of contact", active.primaryContact?.name ?? "Not set"],
                ["Owner", active.owner?.name ?? "Unassigned"],
              ]}
            />
            <FieldGroup
              title="System"
              rows={[
                ["Creation date", timeAgo(active._creationTime)],
                ["Created by", active.owner?.name ?? "System"],
              ]}
            />
          </div>
          <div className="mt-4 border-t border-edge pt-4">
          <CustomFieldsEditor entity="deal" entityId={record.id} variant="inline" />
          </div>
        </Panel>
      </div>
    );
  }

  return <EmptyState message="Record not found" />;
}

function FieldGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-neutral-400">{title}</h4>
        <span className="text-neutral-600">^</span>
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-3 text-sm"
        >
          <span className="truncate text-neutral-500">{label}</span>
          <span className="min-w-0 truncate text-neutral-300">{value}</span>
        </div>
      ))}
    </section>
  );
}

function FieldList({
  rows,
  children,
}: {
  rows: Array<[string, string]>;
  children?: ReactNode;
}) {
  return (
    <Panel className="p-4">
      <div className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 text-sm">
            <span className="truncate text-neutral-500">{label}</span>
            <span className="min-w-0 truncate text-neutral-300">{value}</span>
          </div>
        ))}
        {children}
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function RecordMark({
  record,
  active,
}: {
  record: RecordRef;
  active:
    | FunctionReturnType<typeof api.companies.get>
    | FunctionReturnType<typeof api.contacts.get>
    | FunctionReturnType<typeof api.deals.get>
    | undefined;
}) {
  if (active === undefined || active === null) {
    return <span className="h-10 w-10 rounded bg-edge" />;
  }
  if (record.type === "contact" && "avatarUrl" in active) {
    return <Avatar name={active.name} src={active.avatarUrl} size={40} />;
  }
  if (record.type === "company" && "logoUrl" in active) {
    return <CompanyLogo name={active.name} logoUrl={active.logoUrl} size={40} />;
  }
  if (record.type === "deal") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded bg-edge text-xs font-medium text-neutral-300">
        D
      </span>
    );
  }
  return <span className="h-10 w-10 rounded bg-edge" />;
}
