import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Button, Checkbox, Input, Panel, Select } from "../components/ui";
import {
  COMPANY_COLUMNS,
  CONTACT_COLUMNS,
  DEAL_COLUMNS,
  fieldColumnKey,
  resolveColumns,
  upsertPref,
} from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import { stageLabel } from "../lib/format";

// One settings page per record type: what new records start with, how the
// table's columns look (rename, show, pin), and the custom fields that add
// entirely new columns. The tables read the same tableSettings row, so a
// rename here shows up in the Companies table immediately.

type Entity = "company" | "contact" | "deal";

const REGISTRY = {
  company: COMPANY_COLUMNS,
  contact: CONTACT_COLUMNS,
  deal: DEAL_COLUMNS,
} as const;

const ENTITY_NOUN: Record<Entity, string> = {
  company: "company",
  contact: "contact",
  deal: "deal",
};

const STAGES = [
  "QUALIFIED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

export function EntitySettingsSection({ entity }: { entity: Entity }) {
  return (
    <div className="flex flex-col gap-4">
      <DefaultsPanel entity={entity} />
      <ColumnsPanel entity={entity} />
      <CustomFieldsPanel entity={entity} />
    </div>
  );
}

// New-record defaults. Every control saves on change; there is no separate
// save button to forget.
function DefaultsPanel({ entity }: { entity: Entity }) {
  const settings = useQuery(api.tableSettings.get, { entity });
  const users = useQuery(api.users.list);
  const saveDefaults = useMutation(api.tableSettings.saveDefaults);
  const [industryDraft, setIndustryDraft] = useState<string | null>(null);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);

  const defaults = settings?.defaults;
  const noun = ENTITY_NOUN[entity];

  return (
    <Panel className="p-4">
      <h3 className="mb-1 text-sm font-medium text-white">
        New {noun} defaults
      </h3>
      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        Applied when a {noun} is created from the table, a form, or by the
        agent. Leave a field empty for no default.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Default owner
          </label>
          <Select
            ariaLabel="Default owner"
            value={defaults?.ownerId ?? ""}
            onChange={(value) =>
              void saveDefaults({
                entity,
                ownerId: value ? (value as Id<"users">) : null,
              })
            }
            options={[
              { value: "", label: "No default owner" },
              ...(users?.map((user: Doc<"users">) => ({
                value: user._id,
                label: user.name,
              })) ?? []),
            ]}
          />
        </div>
        {entity === "company" ? (
          <div>
            <label className="mb-1 block text-xs text-neutral-500">
              Default industry
            </label>
            <Input
              value={industryDraft ?? defaults?.industry ?? ""}
              onChange={(e) => setIndustryDraft(e.target.value)}
              onBlur={() => {
                if (industryDraft === null) return;
                void saveDefaults({
                  entity,
                  industry: industryDraft.trim() || null,
                });
                setIndustryDraft(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="e.g. Software"
            />
          </div>
        ) : null}
        {entity === "deal" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Default stage
              </label>
              <Select
                ariaLabel="Default stage"
                value={defaults?.stage ?? "QUALIFIED"}
                onChange={(stage) =>
                  void saveDefaults({
                    entity,
                    stage: stage as (typeof STAGES)[number],
                  })
                }
                options={STAGES.map((stage) => ({
                  value: stage,
                  label: stageLabel(stage),
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Default currency
              </label>
              <Input
                value={currencyDraft ?? defaults?.currency ?? ""}
                onChange={(e) => setCurrencyDraft(e.target.value)}
                onBlur={() => {
                  if (currencyDraft === null) return;
                  void saveDefaults({
                    entity,
                    currency: currencyDraft.trim() || null,
                  });
                  setCurrencyDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="USD"
              />
            </div>
          </>
        ) : null}
      </div>
      {entity === "company" ? (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <Checkbox
            checked={defaults?.autoEnrich !== false}
            ariaLabel="Auto enrich new companies"
            onChange={(checked) =>
              void saveDefaults({ entity, autoEnrich: checked ? null : false })
            }
          />
          Queue enrichment automatically when a new company has a domain
        </label>
      ) : null}
    </Panel>
  );
}

// Every column the table can show, in display order. Rename in place, toggle
// visibility, pin to the left edge. The same controls live in the table's
// header menus; this is the full list in one view.
function ColumnsPanel({ entity }: { entity: Entity }) {
  const settings = useQuery(api.tableSettings.get, { entity });
  const definitions = useQuery(api.fields.listDefinitions, { entity });
  const saveColumns = useMutation(api.tableSettings.saveColumns);

  const prefs = settings?.columns ?? [];
  const customs =
    definitions
      ?.filter((d) => !d.archived)
      .map((d) => ({ key: fieldColumnKey(d.key), label: d.label })) ?? [];
  const columns = resolveColumns(REGISTRY[entity], customs, prefs);
  const touched = prefs.length > 0;

  const setPref = (
    key: string,
    patch: { label?: string; hidden?: boolean; pinned?: boolean },
  ) => {
    void saveColumns({ entity, columns: upsertPref(prefs, key, patch) });
  };

  return (
    <Panel className="p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">Columns</h3>
        {touched ? (
          <Button
            variant="ghost"
            onClick={() => void saveColumns({ entity, columns: [] })}
          >
            Reset all
          </Button>
        ) : null}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-neutral-500">
        Rename a column, hide it, or pin it to the left edge of the table.
        Changes apply to the {ENTITY_NOUN[entity]} table for everyone.
      </p>
      <div className="flex flex-col">
        {columns.map((column) => (
          <ColumnRow
            key={column.key}
            column={column}
            onRename={(label) => setPref(column.key, { label })}
            onToggleHidden={(hidden) => setPref(column.key, { hidden })}
            onTogglePinned={(pinned) => setPref(column.key, { pinned })}
          />
        ))}
      </div>
    </Panel>
  );
}

function ColumnRow({
  column,
  onRename,
  onToggleHidden,
  onTogglePinned,
}: {
  column: ResolvedColumn;
  onRename: (label: string) => void;
  onToggleHidden: (hidden: boolean) => void;
  onTogglePinned: (pinned: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const renamed = column.label !== column.defaultLabel;

  const commit = () => {
    if (draft === null) return;
    onRename(draft.trim());
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-3 border-b border-edge/60 py-2 last:border-0">
      <Checkbox
        checked={!column.hidden}
        disabled={column.locked}
        ariaLabel={`Show ${column.defaultLabel} column`}
        onChange={(checked) => onToggleHidden(!checked)}
      />
      <div className="min-w-0 flex-1">
        <input
          value={draft ?? column.label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setDraft(null);
          }}
          aria-label={`Rename ${column.defaultLabel} column`}
          className="w-full max-w-52 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-neutral-200 transition-colors hover:border-edge focus:border-accent focus:bg-ink focus:outline-none"
        />
        {renamed ? (
          <p className="px-1.5 text-[10px] text-neutral-600">
            was {column.defaultLabel}
            <button
              type="button"
              onClick={() => onRename("")}
              className="ml-1.5 text-neutral-500 underline-offset-2 hover:text-white hover:underline"
            >
              restore
            </button>
          </p>
        ) : null}
      </div>
      {column.custom ? (
        <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-neutral-500">
          custom
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => onTogglePinned(!column.pinned)}
        className={`rounded px-2 py-1 text-[11px] transition-colors ${
          column.pinned
            ? "bg-raised text-accent"
            : "text-neutral-600 hover:bg-raised hover:text-white"
        }`}
      >
        {column.pinned ? "Pinned" : "Pin"}
      </button>
    </div>
  );
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "date", label: "Date" },
] as const;

type FieldType = (typeof FIELD_TYPES)[number]["value"];

// Custom fields add real columns to the table. Each one appears in every row
// with click-to-edit cells, in the column chooser, and (for companies) can
// carry an agent brief so research fills it automatically.
function CustomFieldsPanel({ entity }: { entity: Entity }) {
  const definitions = useQuery(api.fields.listDefinitions, { entity });
  const createDefinition = useMutation(api.fields.createDefinition);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [agentBrief, setAgentBrief] = useState("");
  const [error, setError] = useState<string | null>(null);

  const noun = ENTITY_NOUN[entity];
  const active = definitions?.filter((d) => !d.archived) ?? [];
  const archived = definitions?.filter((d) => d.archived) ?? [];

  const addField = async () => {
    try {
      setError(null);
      const parsedOptions =
        type === "select"
          ? options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined;
      if (type === "select" && (parsedOptions?.length ?? 0) === 0) {
        throw new Error("Add at least one option, separated by commas");
      }
      await createDefinition({
        entity,
        key: label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_"),
        label: label.trim(),
        type,
        options: parsedOptions,
        agentFilled: entity === "company" && agentBrief.trim().length > 0,
        agentBrief:
          entity === "company" ? agentBrief.trim() || undefined : undefined,
      });
      setLabel("");
      setOptions("");
      setAgentBrief("");
      setType("text");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create field");
    }
  };

  return (
    <Panel className="p-4">
      <h3 className="mb-1 text-sm font-medium text-white">Custom fields</h3>
      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        Each field becomes a new column in the {noun} table. Click any cell in
        that column to fill it in.
        {entity === "company"
          ? " Give a field an agent brief and enrichment fills it during research, with evidence in the ledger."
          : ""}
      </p>

      <div className="mb-2 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs text-neutral-500">Label</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`e.g. ${entity === "deal" ? "Renewal date" : "Tier"}`}
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="mb-1 block text-xs text-neutral-500">Type</label>
          <Select
            ariaLabel="Field type"
            value={type}
            onChange={(value) => setType(value as FieldType)}
            options={[...FIELD_TYPES]}
          />
        </div>
        {type === "select" ? (
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-xs text-neutral-500">
              Options, comma separated
            </label>
            <Input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Bronze, Silver, Gold"
            />
          </div>
        ) : null}
        {entity === "company" ? (
          <div className="w-full sm:w-72">
            <label className="mb-1 block text-xs text-neutral-500">
              Agent brief (optional)
            </label>
            <Input
              value={agentBrief}
              onChange={(e) => setAgentBrief(e.target.value)}
              placeholder="What should the agent put here?"
            />
          </div>
        ) : null}
        <Button
          variant="primary"
          onClick={() => void addField()}
          disabled={!label.trim()}
        >
          Add field
        </Button>
      </div>
      {error ? <p className="mb-3 text-xs text-red-400">{error}</p> : null}

      {active.length > 0 ? (
        <div className="mt-3 flex flex-col">
          {active.map((definition) => (
            <FieldRow key={definition._id} definition={definition} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-600">
          No custom fields yet. Add one above and it shows up as a column.
        </p>
      )}

      {archived.length > 0 ? (
        <div className="mt-4 border-t border-edge pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-neutral-600">
            Archived
          </p>
          {archived.map((definition) => (
            <ArchivedFieldRow key={definition._id} definition={definition} />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function FieldRow({
  definition,
}: {
  definition: Doc<"fieldDefinitions">;
}) {
  const updateDefinition = useMutation(api.fields.updateDefinition);
  const archiveDefinition = useMutation(api.fields.archiveDefinition);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [optionsDraft, setOptionsDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (patch: {
    label?: string;
    options?: Array<string>;
  }) => {
    try {
      setError(null);
      await updateDefinition({ fieldId: definition._id, ...patch });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <div className="border-b border-edge/60 py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={labelDraft ?? definition.label}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => {
            if (labelDraft === null) return;
            if (labelDraft.trim() && labelDraft.trim() !== definition.label) {
              void run({ label: labelDraft.trim() });
            }
            setLabelDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setLabelDraft(null);
          }}
          aria-label={`Rename ${definition.label} field`}
          className="w-40 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-neutral-200 transition-colors hover:border-edge focus:border-accent focus:bg-ink focus:outline-none"
        />
        <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-neutral-500">
          {definition.type}
        </span>
        {definition.agentFilled ? (
          <span className="text-[10px] text-accent">agent</span>
        ) : null}
        <div className="ml-auto">
          <Button
            variant="ghost"
            onClick={() => void archiveDefinition({ fieldId: definition._id })}
          >
            Archive
          </Button>
        </div>
      </div>
      {definition.type === "select" ? (
        <input
          value={optionsDraft ?? (definition.options ?? []).join(", ")}
          onChange={(e) => setOptionsDraft(e.target.value)}
          onBlur={() => {
            if (optionsDraft === null) return;
            const parsed = optionsDraft
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean);
            if (parsed.length > 0) void run({ options: parsed });
            setOptionsDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setOptionsDraft(null);
          }}
          aria-label={`${definition.label} options`}
          className="mt-1 w-full max-w-md rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-neutral-400 transition-colors hover:border-edge focus:border-accent focus:bg-ink focus:outline-none"
        />
      ) : null}
      {definition.agentBrief ? (
        <p className="mt-0.5 px-1.5 text-xs text-neutral-600">
          {definition.agentBrief}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 px-1.5 text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function ArchivedFieldRow({
  definition,
}: {
  definition: Doc<"fieldDefinitions">;
}) {
  const restoreDefinition = useMutation(api.fields.restoreDefinition);
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-neutral-600">{definition.label}</span>
      <Button
        variant="ghost"
        onClick={() => void restoreDefinition({ fieldId: definition._id })}
      >
        Restore
      </Button>
    </div>
  );
}
