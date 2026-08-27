import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { BuiltinColumn, ColumnPref, ResolvedColumn } from "../lib/columns";
import {
  fieldColumnKey,
  orderPrefs,
  resolveColumns,
  upsertPref,
} from "../lib/columns";
import {
  CUSTOM_FIELD_TYPES,
  customFieldNeedsOptions,
  formatCustomFieldValue,
} from "../lib/customFields";
import type { CustomFieldType } from "../lib/customFields";
import { Checkbox, DateInput, Select } from "./ui";

// Shared plumbing for the Companies, Contacts, and Deals tables: one hook
// that merges saved column prefs with active custom fields, sticky offsets
// for pinned columns, a per-column header menu (filter, sort, move, hide), a
// header plus-menu for hidden fields, a column chooser, and an inline editor for custom field
// cells. All of it renders with the app's own primitives; no grid library.

export type TableEntity = "company" | "contact" | "deal" | "project" | "task";

export type FieldDefinition = FunctionReturnType<
  typeof api.fields.tableValues
>["definitions"][number];

export function useEntityTable(
  entity: TableEntity,
  builtins: Array<BuiltinColumn>,
  entityIds: Array<string>,
) {
  const settings = useQuery(api.tableSettings.get, { entity });
  const fieldData = useQuery(api.fields.tableValues, { entity, entityIds });
  const saveColumns = useMutation(api.tableSettings.saveColumns);

  const prefs: Array<ColumnPref> = settings?.columns ?? [];
  const definitions = fieldData?.definitions ?? [];
  const values = fieldData?.values ?? {};

  const columns = resolveColumns(
    builtins,
    definitions.map((d) => ({ key: fieldColumnKey(d.key), label: d.label })),
    prefs,
  );
  const visible = columns.filter((c) => !c.hidden);
  const definitionByColumn = new Map(
    definitions.map((d) => [fieldColumnKey(d.key), d]),
  );

  const setPref = (
    key: string,
    patch: { label?: string; hidden?: boolean; pinned?: boolean },
  ) => {
    void saveColumns({ entity, columns: upsertPref(prefs, key, patch) });
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    void saveColumns({
      entity,
      columns: orderPrefs(prefs, columns, key, direction),
    });
  };

  const fieldValue = (definition: FieldDefinition, entityId: string) =>
    values[`${definition._id}:${entityId}`];

  return {
    entity,
    loading: settings === undefined || fieldData === undefined,
    columns,
    visible,
    definitionByColumn,
    defaults: settings?.defaults,
    setPref,
    moveColumn,
    reset: () => void saveColumns({ entity, columns: [] }),
    fieldValue,
  };
}

export type EntityTable = ReturnType<typeof useEntityTable>;

// Pinned columns stay visible while the table scrolls horizontally. Each
// pinned cell gets position sticky with a left offset equal to the widths of
// the pinned columns before it, measured from the header row.
export function useStickyColumns(visible: Array<ResolvedColumn>) {
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const [widths, setWidths] = useState<Record<string, number>>({});
  const pinned = visible.filter((c) => c.pinned).map((c) => c.key);
  const pinnedSignature = pinned.join("|");

  useLayoutEffect(() => {
    if (pinned.length === 0) return;
    const measure = () => {
      setWidths((prev) => {
        const next: Record<string, number> = {};
        let changed = Object.keys(prev).length !== pinned.length;
        for (const key of pinned) {
          const width = cellRefs.current.get(key)?.offsetWidth ?? 0;
          next[key] = width;
          if (prev[key] !== width) changed = true;
        }
        return changed ? next : prev;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const key of pinned) {
      const el = cellRefs.current.get(key);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [pinnedSignature]);

  const offsets: Record<string, number> = {};
  let acc = 0;
  for (const key of pinned) {
    offsets[key] = acc;
    acc += widths[key] ?? 0;
  }
  const lastPinned = pinned[pinned.length - 1];

  const headerRef = (key: string) => (el: HTMLTableCellElement | null) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  const pinProps = (
    column: ResolvedColumn,
    layer: "header" | "body",
  ): { className: string; style?: CSSProperties } => {
    if (!column.pinned) return { className: "" };
    const edge =
      column.key === lastPinned
        ? "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-edge"
        : "";
    return {
      className: `sticky bg-panel ${layer === "header" ? "z-20" : "z-10"} ${edge}`,
      style: { left: offsets[column.key] ?? 0 },
    };
  };

  return { headerRef, pinProps };
}

export type StickyColumns = ReturnType<typeof useStickyColumns>;

const glyph = (path: ReactNode) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const ICONS = {
  asc: glyph(<path d="M12 19V5m-6 6 6-6 6 6" />),
  desc: glyph(<path d="M12 5v14m6-6-6 6-6-6" />),
  filter: glyph(
    <>
      <path d="M4 5h16l-6 7v5l-4 2v-7Z" />
    </>,
  ),
  sort: glyph(
    <>
      <path d="M6 8h12M6 12h8M6 16h4" />
      <path d="M18 14v5m0 0 2-2m-2 2-2-2" />
    </>,
  ),
  left: glyph(<path d="M19 12H5m6-6-6 6 6 6" />),
  right: glyph(<path d="M5 12h14m-6-6 6 6-6 6" />),
  pin: glyph(
    <>
      <path d="M12 16v6" />
      <path d="M8 3h8l-1 6 3 4H6l3-4-1-6Z" />
    </>,
  ),
  hide: glyph(
    <>
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.7A10.5 10.5 0 0 1 12 4.5c7 0 10 7.5 10 7.5a17 17 0 0 1-2.3 3.4M6.5 6.5C3.7 8.3 2 12 2 12s3 7.5 10 7.5c1.9 0 3.7-.5 5.2-1.4" />
    </>,
  ),
  reset: glyph(<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5" />),
  columns: glyph(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </>,
  ),
  dots: glyph(
    <>
      <circle cx="12" cy="5" r="0.5" fill="currentColor" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      <circle cx="12" cy="19" r="0.5" fill="currentColor" />
    </>,
  ),
};

// Header menus render in a portal at a fixed position so they escape the
// table's horizontal overflow container instead of being clipped by it.
function PortalMenu({
  anchor,
  onClose,
  children,
  width = 192,
  estimatedHeight = 240,
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  estimatedHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMove = (e: Event) => {
      if (ref.current && e.target instanceof Node) {
        if (ref.current.contains(e.target)) return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top = Math.max(
    8,
    Math.min(anchor.bottom + 4, window.innerHeight - estimatedHeight - 8),
  );

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", top, left, width }}
      className="z-50 rounded-md border border-edge bg-panel p-1 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex w-4 shrink-0 justify-center text-neutral-500">
        {icon}
      </span>
      {label}
    </button>
  );
}

const menuDivider = <div className="mx-1 my-1 h-px bg-edge" />;

export function HeaderCell({
  column,
  table,
  sticky,
  sort,
  onSort,
  onFilter,
  align = "left",
}: {
  column: ResolvedColumn;
  table: Pick<EntityTable, "visible" | "setPref" | "moveColumn" | "reset">;
  sticky: StickyColumns;
  sort?: "asc" | "desc" | null;
  onSort?: (dir: "asc" | "desc") => void;
  onFilter?: () => void;
  align?: "left" | "right";
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const pin = sticky.pinProps(column, "header");
  const close = () => setAnchor(null);
  const visibleIndex = table.visible.findIndex((item) => item.key === column.key);
  const canMoveLeft = visibleIndex > 0;
  const canMoveRight =
    visibleIndex >= 0 && visibleIndex < table.visible.length - 1;

  return (
    <th
      ref={sticky.headerRef(column.key)}
      style={pin.style}
      className={`whitespace-nowrap px-4 py-2 font-normal ${pin.className} ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <div
        className={`group flex items-center gap-0.5 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <button
          type="button"
          onClick={
            onSort
              ? () => onSort(sort === "asc" ? "desc" : "asc")
              : undefined
          }
          className={`flex items-center gap-1 transition-colors ${
            sort ? "text-white" : ""
          } ${onSort ? "hover:text-white" : "cursor-default"}`}
        >
          {column.label}
          {sort ? (
            <span className="text-neutral-400">
              {sort === "asc" ? ICONS.asc : ICONS.desc}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={`${column.label} column options`}
          aria-expanded={anchor !== null}
          onClick={(e) =>
            setAnchor(
              anchor ? null : e.currentTarget.getBoundingClientRect(),
            )
          }
          className={`rounded p-1 transition-all hover:bg-raised hover:text-white ${
            anchor
              ? "bg-raised text-white"
              : "text-neutral-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          }`}
        >
          {ICONS.dots}
        </button>
      </div>
      {anchor ? (
        <PortalMenu anchor={anchor} onClose={close} width={220}>
          <MenuItem
            icon={ICONS.filter}
            label="Filter"
            disabled={!onFilter}
            onClick={() => {
              onFilter?.();
              close();
            }}
          />
          {onSort ? (
            <>
              <MenuItem
                icon={ICONS.sort}
                label={sort === "asc" ? "Sort descending" : "Sort"}
                onClick={() => {
                  onSort(sort === "asc" ? "desc" : "asc");
                  close();
                }}
              />
            </>
          ) : null}
          {menuDivider}
          <MenuItem
            icon={ICONS.left}
            label="Move left"
            disabled={!canMoveLeft}
            onClick={() => {
              table.moveColumn(column.key, -1);
              close();
            }}
          />
          <MenuItem
            icon={ICONS.right}
            label="Move right"
            disabled={!canMoveRight}
            onClick={() => {
              table.moveColumn(column.key, 1);
              close();
            }}
          />
          {!column.locked ? (
            <MenuItem
              icon={ICONS.hide}
              label="Hide column"
              onClick={() => {
                table.setPref(column.key, { hidden: true });
                close();
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
    </th>
  );
}

export function AddColumnHeaderCell({
  table,
  settingsHref = "/app/settings",
}: {
  table: Pick<EntityTable, "columns" | "setPref"> & { entity?: TableEntity };
  settingsHref?: string;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLTableCellElement>(null);
  const hidden = table.columns.filter((column) => column.hidden);
  const filtered = hidden.filter((column) =>
    column.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const close = () => setAnchor(null);

  return (
    <th ref={rootRef} className="w-12 px-2 py-2 font-normal">
      <button
        type="button"
        aria-label="Add or show fields"
        aria-expanded={anchor !== null}
        onClick={(event) =>
          setAnchor(
            anchor ? null : event.currentTarget.getBoundingClientRect(),
          )
        }
        className={`flex h-7 w-7 items-center justify-center rounded text-lg leading-none transition-colors hover:bg-raised hover:text-white ${
          anchor ? "bg-raised text-white" : "text-neutral-500"
        }`}
      >
        +
      </button>
      {anchor ? (
        <PortalMenu anchor={anchor} onClose={close} width={288} estimatedHeight={390}>
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fields"
            className="w-full border-b border-edge bg-transparent px-3 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
          />
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => {
                    table.setPref(column.key, { hidden: false });
                    close();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
                >
                  <span className="flex w-4 justify-center text-neutral-500">
                    {column.custom ? ICONS.columns : ICONS.reset}
                  </span>
                  <span className="truncate">{column.label}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-neutral-500">
                {hidden.length === 0 ? "All fields are visible" : "No fields found"}
              </p>
            )}
          </div>
          <div className="border-t border-edge p-1">
            <Link
              to={settingsHref}
              onClick={close}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
            >
              <span className="flex w-4 justify-center text-neutral-500">
                {ICONS.reset}
              </span>
              Customize fields
            </Link>
          </div>
        </PortalMenu>
      ) : null}
    </th>
  );
}

// Toolbar dropdown listing every column with a visibility checkbox and a pin
// toggle, plus a reset action. Hidden custom fields come back from here.
export function ColumnsButton({
  table,
  menuAlign = "right",
}: {
  table: Pick<EntityTable, "entity" | "columns" | "setPref" | "reset">;
  menuAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest("[data-select-menu]")
      ) {
        return;
      }
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Choose columns"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md border border-edge px-2.5 py-2 text-sm transition-colors hover:border-edge-strong hover:text-white ${
          open ? "text-white" : "text-neutral-400"
        }`}
      >
        {ICONS.columns}
        <span className="hidden sm:inline">Columns</span>
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-edge bg-panel p-1 shadow-xl ${
            menuAlign === "left" ? "left-0" : "right-0"
          }`}
        >
          {table.columns.map((column) => (
            <div
              key={column.key}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-raised"
            >
              <Checkbox
                checked={!column.hidden}
                disabled={column.locked}
                ariaLabel={`Show ${column.label} column`}
                onChange={(checked) =>
                  table.setPref(column.key, { hidden: !checked })
                }
              />
              <span
                className={`flex-1 truncate text-xs ${
                  column.hidden ? "text-neutral-500" : "text-neutral-300"
                }`}
              >
                {column.label}
                {column.custom ? (
                  <span className="ml-1.5 text-[10px] text-neutral-600">
                    custom
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={
                  column.pinned
                    ? `Unpin ${column.label} column`
                    : `Pin ${column.label} column`
                }
                onClick={() =>
                  table.setPref(column.key, { pinned: !column.pinned })
                }
                className={`rounded p-1 transition-colors hover:text-white ${
                  column.pinned ? "text-accent" : "text-neutral-600"
                }`}
              >
                {ICONS.pin}
              </button>
            </div>
          ))}
          <div className="mx-1 my-1 h-px bg-edge" />
          <button
            type="button"
            onClick={() => {
              table.reset();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-400 transition-colors hover:bg-raised hover:text-white"
          >
            <span className="flex w-4 justify-center text-neutral-500">
              {ICONS.reset}
            </span>
            Reset columns
          </button>
        </div>
      ) : null}
    </div>
  );
}

function slugFieldKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function AddCustomFieldButton({
  entity,
  menuAlign = "right",
}: {
  entity: TableEntity;
  menuAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const createDefinition = useMutation(api.fields.createDefinition);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-select-menu]")
      ) {
        return;
      }
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const createField = () => {
    const trimmed = label.trim();
    const parsedOptions =
      customFieldNeedsOptions(type)
        ? options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;
    if (!trimmed) return;
    if (customFieldNeedsOptions(type) && (parsedOptions?.length ?? 0) === 0) {
      setError("Add at least one option");
      return;
    }
    void createDefinition({
      entity,
      key: slugFieldKey(trimmed),
      label: trimmed,
      type,
      options: parsedOptions,
      agentFilled: false,
    })
      .then(() => {
        setOpen(false);
        setLabel("");
        setOptions("");
        setType("text");
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not create field"),
      );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Add custom field"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 w-9 items-center justify-center rounded-md border border-edge text-lg leading-none transition-colors hover:border-edge-strong hover:text-white ${
          open ? "text-white" : "text-neutral-400"
        }`}
      >
        +
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1 w-72 rounded-md border border-edge bg-panel p-3 shadow-xl ${
            menuAlign === "left" ? "left-0" : "right-0"
          }`}
        >
          <h3 className="mb-3 text-sm font-medium text-white">
            Add custom field
          </h3>
          <label className="mb-1 block text-xs text-neutral-500">Label</label>
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && type !== "select") createField();
            }}
            placeholder="e.g. Renewal date"
            className="mb-3 w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
          />
          <label className="mb-1 block text-xs text-neutral-500">Type</label>
          <Select
            ariaLabel="Custom field type"
            value={type}
            onChange={(value) => setType(value as CustomFieldType)}
            options={[...CUSTOM_FIELD_TYPES]}
          />
          {customFieldNeedsOptions(type) ? (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-neutral-500">
                Options, comma separated
              </label>
              <input
                value={options}
                onChange={(event) => setOptions(event.target.value)}
                placeholder="Bronze, Silver, Gold"
                className="w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
              />
            </div>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:bg-raised hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!label.trim()}
              onClick={createField}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-ink disabled:opacity-40"
            >
              Add field
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// One custom-field cell. Click to edit in place; Enter or blur commits, and
// Escape cancels. Select and date fields commit on pick.
export function FieldCell({
  definition,
  entityId,
  value,
}: {
  definition: FieldDefinition;
  entityId: string;
  value: string | undefined;
}) {
  const setValue = useMutation(api.fields.setValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);

  const commit = async (next: string) => {
    setEditing(false);
    if (next === (value ?? "")) return;
    try {
      setError(false);
      await setValue({ fieldId: definition._id, entityId, value: next });
    } catch {
      setError(true);
    }
  };

  if (editing && definition.type === "select") {
    return (
      <Select
        size="sm"
        ariaLabel={definition.label}
        value={value ?? ""}
        options={(definition.options ?? []).map((o) => ({
          value: o,
          label: o,
        }))}
        onChange={(next) => void commit(next)}
        className="min-w-28"
      />
    );
  }

  if (editing && definition.type === "multiSelect") {
    const selected = new Set((value ?? "").split(",").filter(Boolean));
    return (
      <div className="min-w-40 rounded-md border border-edge bg-ink p-1">
        {(definition.options ?? []).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-neutral-300 hover:bg-raised"
          >
            <Checkbox
              checked={selected.has(option)}
              ariaLabel={option}
              onChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(option);
                else next.delete(option);
                void commit([...next].join(","));
              }}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (editing && definition.type === "boolean") {
    return (
      <Select
        size="sm"
        ariaLabel={definition.label}
        value={value ?? ""}
        options={[
          { value: "", label: "Not set" },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        onChange={(next) => void commit(next)}
        className="min-w-28"
      />
    );
  }

  if (editing && definition.type === "date") {
    return (
      <DateInput
        ariaLabel={definition.label}
        value={value ?? ""}
        onChange={(next) => void commit(next)}
        className="min-w-28"
      />
    );
  }

  if (editing && definition.type === "dateTime") {
    return (
      <input
        autoFocus
        type="datetime-local"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit(draft);
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full min-w-40 rounded border border-accent bg-ink px-1.5 py-0.5 text-sm text-white focus:outline-none"
      />
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={
          definition.type === "number" ||
          definition.type === "currency" ||
          definition.type === "rating"
            ? "number"
            : definition.type === "email"
              ? "email"
              : definition.type === "phone"
                ? "tel"
                : definition.type === "link"
                  ? "url"
                  : "text"
        }
        min={definition.type === "rating" ? 1 : undefined}
        max={definition.type === "rating" ? 5 : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit(draft);
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full min-w-24 rounded border border-accent bg-ink px-1.5 py-0.5 text-sm text-white focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className={`block w-full rounded px-1.5 py-0.5 text-left transition-colors hover:bg-raised ${
        error
          ? "text-red-400"
          : value
            ? "text-neutral-300"
            : "text-neutral-700"
      }`}
    >
      {formatCustomFieldValue(definition.type, value) || "—"}
    </button>
  );
}
