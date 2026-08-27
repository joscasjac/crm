import { useMemo, useState } from "react";
import { Button, Input, Select } from "../components/ui";
import type { ResolvedColumn } from "./columns";

export type TableFilterOperator =
  | "contains"
  | "equals"
  | "empty"
  | "notEmpty"
  | "greaterThan"
  | "lessThan";

export type TableFilter = {
  id: string;
  columnKey: string;
  operator: TableFilterOperator;
  value: string;
};

const OPERATORS: Array<{ value: TableFilterOperator; label: string }> = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "empty", label: "is empty" },
  { value: "notEmpty", label: "is not empty" },
  { value: "greaterThan", label: ">" },
  { value: "lessThan", label: "<" },
];

export function encodeFilters(filters: Array<TableFilter>) {
  return filters.length > 0 ? btoa(JSON.stringify(filters)) : "";
}

export function decodeFilters(value: string | null): Array<TableFilter> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(atob(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TableFilter =>
        typeof item.id === "string" &&
        typeof item.columnKey === "string" &&
        typeof item.operator === "string" &&
        typeof item.value === "string",
    );
  } catch {
    return [];
  }
}

export function applyTableFilters<T>(
  rows: Array<T>,
  filters: Array<TableFilter>,
  getValue: (row: T, columnKey: string) => string | number | null | undefined,
) {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) => {
      const raw = getValue(row, filter.columnKey);
      const text = raw === null || raw === undefined ? "" : String(raw);
      const haystack = text.toLowerCase();
      const needle = filter.value.toLowerCase();
      if (filter.operator === "empty") return text.trim() === "";
      if (filter.operator === "notEmpty") return text.trim() !== "";
      if (filter.operator === "equals") return haystack === needle;
      if (filter.operator === "greaterThan") {
        return Number(text) > Number(filter.value);
      }
      if (filter.operator === "lessThan") {
        return Number(text) < Number(filter.value);
      }
      return haystack.includes(needle);
    }),
  );
}

export function TableFilters({
  columns,
  filters,
  onChange,
}: {
  columns: Array<ResolvedColumn>;
  filters: Array<TableFilter>;
  onChange: (filters: Array<TableFilter>) => void;
}) {
  const [open, setOpen] = useState(false);
  const columnOptions = useMemo(
    () => columns.map((column) => ({ value: column.key, label: column.label })),
    [columns],
  );

  const addFilter = () => {
    const firstColumn = columnOptions[0]?.value;
    if (!firstColumn) return;
    onChange([
      ...filters,
      {
        id: crypto.randomUUID(),
        columnKey: firstColumn,
        operator: "contains",
        value: "",
      },
    ]);
  };

  const patchFilter = (id: string, patch: Partial<TableFilter>) => {
    onChange(
      filters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter,
      ),
    );
  };

  return (
    <div className="relative flex justify-end">
      <Button onClick={() => setOpen((value) => !value)}>
        Filter{filters.length > 0 ? ` · ${filters.length}` : ""}
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(720px,calc(100vw-2rem))] rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Filters</span>
            {filters.length > 0 ? (
              <Button variant="ghost" onClick={() => onChange([])}>
                Clear
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <div
            key={filter.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-ink p-1.5"
          >
            <Select
              ariaLabel="Filter column"
              value={filter.columnKey}
              onChange={(value) => patchFilter(filter.id, { columnKey: value })}
              options={columnOptions}
              className="w-36"
              size="sm"
            />
            <Select
              ariaLabel="Filter operator"
              value={filter.operator}
              onChange={(value) =>
                patchFilter(filter.id, {
                  operator: value as TableFilterOperator,
                })
              }
              options={OPERATORS}
              className="w-28"
              size="sm"
            />
            {filter.operator === "empty" || filter.operator === "notEmpty" ? null : (
              <Input
                value={filter.value}
                onChange={(event) =>
                  patchFilter(filter.id, { value: event.target.value })
                }
                placeholder="Value"
                className="w-36 py-1"
              />
            )}
            <button
              type="button"
              aria-label="Remove filter"
              onClick={() =>
                onChange(filters.filter((item) => item.id !== filter.id))
              }
              className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-raised hover:text-white"
            >
              Remove
            </button>
          </div>
        ))}
        <Button onClick={addFilter}>Add filter</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
