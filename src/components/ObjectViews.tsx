import type { ReactNode } from "react";
import { useState } from "react";

export type ObjectViewType = "table" | "kanban" | "calendar";
export type ObjectGroupOption = {
  value: string;
  label: string;
  values?: Array<{ value: string; label: string }>;
};
export type KanbanSummaryField<T = unknown> = {
  key: string;
  label: string;
  type: "field" | "number" | "date";
  getValue?: (item: T) => unknown;
};

type SummaryMode =
  | "value"
  | "countAll"
  | "countEmpty"
  | "countNotEmpty"
  | "countUnique"
  | "percentEmpty"
  | "percentNotEmpty"
  | "latestDate"
  | "min"
  | "max"
  | "average"
  | "sum";

type SummaryPage =
  | "root"
  | "count"
  | "countEmpty"
  | "countNotEmpty"
  | "countUnique"
  | "percent"
  | "latestDate"
  | "min"
  | "max"
  | "average"
  | "sum"
  | "percentEmpty"
  | "percentNotEmpty"
  | "more";

export function ObjectKanban<T>({
  columns,
  getItemKey,
  onMove,
  summaryFields = [],
}: {
  columns: Array<{
    key: string;
    label: string;
    subtitle?: string;
    tone?: string;
    items: Array<T>;
    renderItem: (item: T) => ReactNode;
    onAdd?: () => void;
  }>;
  getItemKey?: (item: T) => string;
  onMove?: (item: T, columnKey: string) => void;
  summaryFields?: Array<KanbanSummaryField<T>>;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [summaryConfig, setSummaryConfig] = useState<{
    mode: SummaryMode;
    field?: KanbanSummaryField<T>;
  }>({ mode: "value" });
  const [summaryOpen, setSummaryOpen] = useState<{
    columnKey: string;
    page: SummaryPage;
  } | null>(null);
  const draggable = Boolean(getItemKey && onMove);
  const draggedItem = draggable
    ? columns.flatMap((column) => column.items).find((item) => getItemKey?.(item) === draggedKey)
    : undefined;
  const fieldValue = (item: T, field: KanbanSummaryField<T>) => {
    if (field.getValue) return field.getValue(item);
    if (item && typeof item === "object" && field.key in item) {
      return (item as Record<string, unknown>)[field.key];
    }
    return undefined;
  };
  const isEmptyValue = (value: unknown) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
  };
  const numericValue = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const summaryFor = (column: (typeof columns)[number]) => {
    const { field, mode } = summaryConfig;
    if (mode === "countAll") return String(column.items.length);
    if (field) {
      const values = column.items.map((item) => fieldValue(item, field));
      const emptyCount = values.filter(isEmptyValue).length;
      const notEmptyCount = values.length - emptyCount;
      const percent = (count: number) =>
        values.length > 0 ? `${Math.round((count / values.length) * 100)}%` : "0%";
      if (mode === "countEmpty") return String(emptyCount);
      if (mode === "countNotEmpty") return String(notEmptyCount);
      if (mode === "countUnique") {
        return String(new Set(values.filter((value) => !isEmptyValue(value)).map(String)).size);
      }
      if (mode === "percentEmpty") return percent(emptyCount);
      if (mode === "percentNotEmpty") return percent(notEmptyCount);
      if (mode === "min" || mode === "max" || mode === "average" || mode === "sum") {
        const numbers = values.map(numericValue).filter((value): value is number => value !== null);
        if (numbers.length === 0) return "0";
        if (mode === "min") return formatSummaryNumber(Math.min(...numbers));
        if (mode === "max") return formatSummaryNumber(Math.max(...numbers));
        const sum = numbers.reduce((total, value) => total + value, 0);
        if (mode === "average") return formatSummaryNumber(sum / numbers.length);
        return formatSummaryNumber(sum);
      }
    }
    if (mode === "countEmpty") return "0";
    if (mode === "countNotEmpty") return String(column.items.length);
    if (mode === "countUnique") return String(column.items.length);
    if (mode === "percentEmpty") return "0%";
    if (mode === "percentNotEmpty") return column.items.length > 0 ? "100%" : "0%";
    if (mode === "latestDate") return "Latest";
    if (mode === "min") return "Min";
    if (mode === "max") return "Max";
    if (mode === "average") return "Avg";
    if (mode === "sum") return column.subtitle ?? String(column.items.length);
    return column.subtitle ?? String(column.items.length);
  };
  const fallbackFields: Array<KanbanSummaryField<T>> = [
    { key: "createdAt", label: "Creation date", type: "date" },
    { key: "updatedAt", label: "Last update", type: "date" },
    { key: "deletedAt", label: "Deleted at", type: "date" },
    { key: "name", label: "Name", type: "field" },
  ];
  const allFields = summaryFields.length > 0 ? summaryFields : fallbackFields;
  const dateFields = allFields.filter((field) => field.type === "date");
  const numberFields = allFields.filter((field) => field.type === "number");
  const chooseSummary = (mode: SummaryMode, field?: KanbanSummaryField<T>) => {
    setSummaryConfig({ mode, field });
    setSummaryOpen(null);
  };
  const summaryPageTitle: Record<SummaryPage, string> = {
    root: "",
    count: "Count",
    countEmpty: "Count empty",
    countNotEmpty: "Count not empty",
    countUnique: "Count unique values",
    percent: "Percent",
    latestDate: "Latest date",
    percentEmpty: "Percent empty",
    percentNotEmpty: "Percent not empty",
    min: "Min",
    max: "Max",
    average: "Average",
    sum: "Sum",
    more: "More options",
  };
  const fieldSummaryMode = (page: SummaryPage): SummaryMode => {
    if (page === "latestDate") return "latestDate";
    if (page === "percentEmpty") return "percentEmpty";
    if (page === "percentNotEmpty") return "percentNotEmpty";
    if (page === "countNotEmpty") return "countNotEmpty";
    if (page === "countUnique") return "countUnique";
    if (page === "min") return "min";
    if (page === "max") return "max";
    if (page === "average") return "average";
    if (page === "sum") return "sum";
    return "countEmpty";
  };
  const fieldsForPage = (page: SummaryPage) => {
    if (page === "latestDate") return dateFields.length > 0 ? dateFields : allFields;
    if (page === "min" || page === "max" || page === "average" || page === "sum") {
      return numberFields;
    }
    return allFields;
  };
  const menuRowClass =
    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white";
  const renderSummaryMenu = (columnKey: string, page: SummaryPage) => (
    <div className="absolute left-0 top-full z-30 mt-2 w-60 rounded-lg border border-edge bg-panel p-1 shadow-2xl">
      {page !== "root" ? (
        <div className="mb-1 flex items-center gap-2 border-b border-edge px-2 py-2 text-sm font-medium text-white">
          <button
            type="button"
            aria-label="Back"
            onClick={() => setSummaryOpen({ columnKey, page: "root" })}
            className="text-neutral-500 hover:text-white"
          >
            &lt;
          </button>
          {summaryPageTitle[page]}
        </div>
      ) : null}
      {page === "root" ? (
        <>
          <SummaryMenuButton
            label="Count"
            onClick={() => setSummaryOpen({ columnKey, page: "count" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Percent"
            onClick={() => setSummaryOpen({ columnKey, page: "percent" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Date"
            onClick={() => setSummaryOpen({ columnKey, page: "latestDate" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="More options"
            onClick={() => setSummaryOpen({ columnKey, page: "more" })}
            hasSubmenu
          />
        </>
      ) : null}
      {page === "count" ? (
        <>
          <SummaryMenuButton label="Count all" onClick={() => chooseSummary("countAll")} />
          <SummaryMenuButton
            label="Count empty"
            onClick={() => setSummaryOpen({ columnKey, page: "countEmpty" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Count not empty"
            onClick={() => setSummaryOpen({ columnKey, page: "countNotEmpty" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Count unique values"
            onClick={() => setSummaryOpen({ columnKey, page: "countUnique" })}
            hasSubmenu
          />
        </>
      ) : null}
      {page === "percent" ? (
        <>
          <SummaryMenuButton
            label="Percent empty"
            onClick={() => setSummaryOpen({ columnKey, page: "percentEmpty" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Percent not empty"
            onClick={() => setSummaryOpen({ columnKey, page: "percentNotEmpty" })}
            hasSubmenu
          />
        </>
      ) : null}
      {page === "more" ? (
        <>
          <SummaryMenuButton
            label="Min"
            onClick={() => setSummaryOpen({ columnKey, page: "min" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Max"
            onClick={() => setSummaryOpen({ columnKey, page: "max" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Average"
            onClick={() => setSummaryOpen({ columnKey, page: "average" })}
            hasSubmenu
          />
          <SummaryMenuButton
            label="Sum"
            onClick={() => setSummaryOpen({ columnKey, page: "sum" })}
            hasSubmenu
          />
        </>
      ) : null}
      {[
        "latestDate",
        "min",
        "max",
        "average",
        "sum",
        "percentEmpty",
        "percentNotEmpty",
        "countEmpty",
        "countNotEmpty",
        "countUnique",
      ].includes(page) ? (
        <div className="max-h-96 overflow-y-auto">
          {fieldsForPage(page).map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => chooseSummary(fieldSummaryMode(page), field)}
              className={menuRowClass}
            >
              <span>{field.label}</span>
            </button>
          ))}
          {fieldsForPage(page).length === 0 ? (
            <p className="px-3 py-4 text-sm text-neutral-500">No number fields available</p>
          ) : (
            null
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="-mx-6 flex min-h-[560px] overflow-x-auto border-t border-edge bg-ink pb-4">
      {columns.map((column) => (
        <div
          key={column.key}
          className={`w-[310px] shrink-0 border-r border-edge px-4 py-4 transition-colors ${
            dropKey === column.key ? "bg-raised/40" : ""
          }`}
          onDragOver={(event) => {
            if (!draggable) return;
            event.preventDefault();
            setDropKey(column.key);
          }}
          onDragLeave={() => setDropKey(null)}
          onDrop={() => {
            if (draggedItem && onMove) onMove(draggedItem, column.key);
            setDraggedKey(null);
            setDropKey(null);
          }}
        >
          <div className="relative mb-4 flex items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 text-sm font-medium ${
                column.tone ?? "bg-white/10 text-neutral-300"
              }`}
            >
              {column.label}
            </span>
            <button
              type="button"
              aria-expanded={summaryOpen?.columnKey === column.key}
              onClick={() =>
                setSummaryOpen((current) =>
                  current?.columnKey === column.key
                    ? null
                    : { columnKey: column.key, page: "root" },
                )
              }
              className="rounded-md px-1.5 py-0.5 text-sm tabular-nums text-neutral-500 transition-colors hover:bg-raised hover:text-white"
            >
              {summaryFor(column)}
            </button>
            {summaryOpen?.columnKey === column.key
              ? renderSummaryMenu(column.key, summaryOpen.page)
              : null}
          </div>
          <div className="flex min-h-24 flex-col gap-3">
            {column.items.map((item, index) => {
              const key = getItemKey?.(item);
              return (
                <div
                  key={key ?? index}
                  draggable={draggable}
                  onDragStart={(event) => {
                    if (!key) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", key);
                    setDraggedKey(key);
                  }}
                  onDragEnd={() => {
                    setDraggedKey(null);
                    setDropKey(null);
                  }}
                  className={draggedKey === key ? "opacity-50" : undefined}
                >
                  {renderWithKey(column.renderItem(item))}
                </div>
              );
            })}
            {column.onAdd ? (
              <button
                type="button"
                onClick={column.onAdd}
                className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-500 transition-colors hover:text-white"
              >
                <span className="text-lg leading-none">+</span>
                New
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ObjectCalendar<T>({
  items,
  getDate,
  renderItem,
}: {
  items: Array<T>;
  getDate: (item: T) => number | undefined;
  renderItem: (item: T) => ReactNode;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay.getDay();
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  const byDay = new Map<number, Array<T>>();
  const unscheduled: Array<T> = [];

  for (const item of items) {
    const raw = getDate(item);
    if (!raw) {
      unscheduled.push(item);
      continue;
    }
    const date = new Date(raw);
    if (date.getFullYear() !== year || date.getMonth() !== month) {
      unscheduled.push(item);
      continue;
    }
    const day = date.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  return (
    <div className="-mx-6 border-t border-edge bg-ink">
      <div className="flex items-center justify-between border-b border-edge px-6 py-3">
        <h2 className="text-sm font-medium text-white">
          {today.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <span className="text-xs text-neutral-500">
          {items.length} visible
        </span>
      </div>
      <div className="grid grid-cols-7 border-b border-edge text-xs text-neutral-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="border-r border-edge px-3 py-2 last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => (
          <div
            key={`${day ?? "blank"}-${index}`}
            className="min-h-32 border-b border-r border-edge p-2 last:border-r-0"
          >
            {day ? (
              <>
                <div className="mb-2 text-xs text-neutral-500">{day}</div>
                <div className="space-y-1.5">
                  {(byDay.get(day) ?? []).map((item) =>
                    renderWithKey(renderItem(item)),
                  )}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
      {unscheduled.length > 0 ? (
        <div className="border-t border-edge px-6 py-4">
          <p className="mb-2 text-xs font-medium text-neutral-500">
            Outside this month or unscheduled
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((item) => renderWithKey(renderItem(item)))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryMenuButton({
  label,
  onClick,
  hasSubmenu,
}: {
  label: string;
  onClick: () => void;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
    >
      <span>{label}</span>
      {hasSubmenu ? <span className="text-neutral-600">&gt;</span> : null}
    </button>
  );
}

export function groupedKanbanColumns<T>({
  items,
  groupBy,
  options,
  getValue,
  renderItem,
}: {
  items: Array<T>;
  groupBy: string | null | undefined;
  options: Array<ObjectGroupOption>;
  getValue: (item: T, groupBy: string) =>
    | string
    | Array<string | null | undefined>
    | null
    | undefined;
  renderItem: (item: T) => ReactNode;
}) {
  const option = options.find((item) => item.value === groupBy);
  if (!option || !groupBy) return [];

  const configured = option.values ?? [];
  const valueLabels = new Map(configured.map((item) => [item.value, item.label]));
  const groups = new Map<string, Array<T>>();
  for (const value of valueLabels.keys()) {
    groups.set(value, []);
  }
  for (const item of items) {
    const raw = getValue(item, groupBy);
    const values = Array.isArray(raw) ? raw : [raw];
    const normalized = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    const groupValues = normalized.length > 0 ? normalized : ["Unspecified"];
    for (const value of groupValues) {
      if (!valueLabels.has(value)) valueLabels.set(value, value);
      groups.set(value, [...(groups.get(value) ?? []), item]);
    }
  }

  return [...groups.entries()].map(([value, grouped]) => ({
    key: value,
    label: valueLabels.get(value) ?? value,
    items: grouped,
    renderItem,
  }));
}

const KANBAN_LANE_TONES = [
  "bg-sky-500/15 text-sky-300",
  "bg-violet-500/15 text-violet-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
  "bg-lime-500/15 text-lime-300",
  "bg-fuchsia-500/15 text-fuchsia-300",
];

export function kanbanLaneTone(index: number) {
  return KANBAN_LANE_TONES[index % KANBAN_LANE_TONES.length];
}

export function MissingKanbanGroup({
  options,
  value,
  onChange,
}: {
  options: Array<ObjectGroupOption>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="-mx-6 border-t border-edge bg-ink px-6 py-6">
      <div className="max-w-sm">
        <label className="mb-2 block text-xs font-medium text-neutral-500">
          Stages
        </label>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-edge bg-panel px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">Select field</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function renderWithKey(node: ReactNode) {
  return node;
}

function formatSummaryNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}
