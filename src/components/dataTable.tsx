import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import type { BuiltinColumn, ColumnPref, ResolvedColumn } from "../lib/columns";
import { fieldColumnKey, resolveColumns, upsertPref } from "../lib/columns";
import { Checkbox, DateInput, Select } from "./ui";

// Shared plumbing for the Companies, Contacts, and Deals tables: one hook
// that merges saved column prefs with active custom fields, sticky offsets
// for pinned columns, a per-column header menu (sort, pin, hide, reset), a
// column chooser for the toolbar, and an inline editor for custom field
// cells. All of it renders with the app's own primitives; no grid library.

export type TableEntity = "company" | "contact" | "deal";

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

  const fieldValue = (definition: FieldDefinition, entityId: string) =>
    values[`${definition._id}:${entityId}`];

  return {
    loading: settings === undefined || fieldData === undefined,
    columns,
    visible,
    definitionByColumn,
    defaults: settings?.defaults,
    setPref,
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
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: ReactNode;
  width?: number;
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
  const top = Math.min(anchor.bottom + 4, window.innerHeight - 60);

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
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:bg-raised hover:text-white"
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
  align = "left",
}: {
  column: ResolvedColumn;
  table: Pick<EntityTable, "setPref" | "reset">;
  sticky: StickyColumns;
  sort?: "asc" | "desc" | null;
  onSort?: (dir: "asc" | "desc") => void;
  align?: "left" | "right";
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const pin = sticky.pinProps(column, "header");
  const close = () => setAnchor(null);

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
        <PortalMenu anchor={anchor} onClose={close}>
          {onSort ? (
            <>
              <MenuItem
                icon={ICONS.asc}
                label="Sort ascending"
                onClick={() => {
                  onSort("asc");
                  close();
                }}
              />
              <MenuItem
                icon={ICONS.desc}
                label="Sort descending"
                onClick={() => {
                  onSort("desc");
                  close();
                }}
              />
              {menuDivider}
            </>
          ) : null}
          <MenuItem
            icon={ICONS.pin}
            label={column.pinned ? "Unpin column" : "Pin column"}
            onClick={() => {
              table.setPref(column.key, { pinned: !column.pinned });
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
          {menuDivider}
          <MenuItem
            icon={ICONS.reset}
            label="Reset columns"
            onClick={() => {
              table.reset();
              close();
            }}
          />
        </PortalMenu>
      ) : null}
    </th>
  );
}

// Toolbar dropdown listing every column with a visibility checkbox and a pin
// toggle, plus a reset action. Hidden custom fields come back from here.
export function ColumnsButton({
  table,
}: {
  table: Pick<EntityTable, "columns" | "setPref" | "reset">;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
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
        <div className="absolute right-0 top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-edge bg-panel p-1 shadow-xl">
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

  if (editing) {
    return (
      <input
        autoFocus
        type={definition.type === "number" ? "number" : "text"}
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
      {value || "—"}
    </button>
  );
}
