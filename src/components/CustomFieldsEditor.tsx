import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { formatCustomFieldValue } from "../lib/customFields";
import { DateInput, EmptyState, Input, Panel, Select } from "./ui";

export type CustomFieldEntity = "company" | "contact" | "deal" | "project" | "task";

type FieldRow = FunctionReturnType<typeof api.fields.forEntity>[number];

export function CustomFieldsEditor({
  entity,
  entityId,
  title = "Custom fields",
  variant = "panel",
}: {
  entity: CustomFieldEntity;
  entityId: string;
  title?: string;
  variant?: "panel" | "inline";
}) {
  const rows = useQuery(api.fields.forEntity, { entity, entityId });

  const content =
    rows === undefined ? (
      <p className="text-sm text-neutral-500">Loading fields...</p>
    ) : rows.length === 0 ? (
      variant === "panel" ? (
        <EmptyState message="No custom fields configured" />
      ) : null
    ) : (
      <div className="grid gap-3">
        {rows.map((row) => (
          <CustomFieldControl key={row.definition._id} row={row} entityId={entityId} />
        ))}
      </div>
    );

  if (variant === "inline") return content;

  return (
    <Panel className="p-4">
      <h3 className="mb-3 text-sm font-medium text-white">{title}</h3>
      {content}
    </Panel>
  );
}

function CustomFieldControl({
  row,
  entityId,
}: {
  row: FieldRow;
  entityId: string;
}) {
  const setValue = useMutation(api.fields.setValue);
  const [draft, setDraft] = useState(row.value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next = draft) => {
    if (next === (row.value ?? "")) return;
    setSaving(true);
    try {
      setError(null);
      await setValue({
        fieldId: row.definition._id,
        entityId,
        value: next,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save field");
    } finally {
      setSaving(false);
    }
  };

  const control =
    row.definition.type === "select" ? (
      <Select
        ariaLabel={row.definition.label}
        value={row.value ?? ""}
        onChange={(next) => void commit(next)}
        options={[
          { value: "", label: "Not set" },
          ...(row.definition.options ?? []).map((option) => ({
            value: option,
            label: option,
          })),
        ]}
      />
    ) : row.definition.type === "date" ? (
      <DateInput
        ariaLabel={row.definition.label}
        value={row.value ?? ""}
        onChange={(next) => void commit(next)}
      />
    ) : row.definition.type === "dateTime" ? (
      <Input
        type="datetime-local"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(row.value ?? "");
        }}
      />
    ) : row.definition.type === "boolean" ? (
      <Select
        ariaLabel={row.definition.label}
        value={row.value ?? ""}
        onChange={(next) => void commit(next)}
        options={[
          { value: "", label: "Not set" },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
    ) : row.definition.type === "multiSelect" ? (
      <MultiSelectField
        value={row.value ?? ""}
        options={row.definition.options ?? []}
        onChange={(next) => void commit(next)}
      />
    ) : row.definition.type === "richText" || row.definition.type === "address" ? (
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDraft(row.value ?? "");
        }}
        className="min-h-24 rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none"
      />
    ) : (
      <Input
        type={
          row.definition.type === "number" ||
          row.definition.type === "currency" ||
          row.definition.type === "rating"
            ? "number"
            : row.definition.type === "email"
              ? "email"
              : row.definition.type === "phone"
                ? "tel"
                : row.definition.type === "link"
                  ? "url"
                  : "text"
        }
        min={row.definition.type === "rating" ? 1 : undefined}
        max={row.definition.type === "rating" ? 5 : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(row.value ?? "");
        }}
      />
    );

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-neutral-500">{row.definition.label}</label>
        {saving ? <span className="text-[11px] text-neutral-600">Saving</span> : null}
      </div>
      {control}
      {!saving && row.value ? (
        <p className="text-[11px] text-neutral-600">
          {formatCustomFieldValue(row.definition.type, row.value)}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function MultiSelectField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<string>;
  onChange: (value: string) => void;
}) {
  const selected = new Set(value.split(",").filter(Boolean));
  return (
    <div className="rounded-md border border-edge bg-ink p-2">
      {options.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-neutral-300 hover:bg-raised"
        >
          <input
            type="checkbox"
            checked={selected.has(option)}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.target.checked) next.add(option);
              else next.delete(option);
              onChange([...next].join(","));
            }}
          />
          {option}
        </label>
      ))}
    </div>
  );
}
