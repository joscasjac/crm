import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AddColumnHeaderCell, HeaderCell, useStickyColumns } from "./dataTable";
import type { EntityTable } from "./dataTable";
import { EmptyState, Checkbox, Panel } from "./ui";
import type { BuiltinColumn, ColumnPref, ResolvedColumn } from "../lib/columns";
import { orderPrefs, resolveColumns, upsertPref } from "../lib/columns";
import { isInteractiveClick } from "../lib/interaction";

export type ObjectTableController = Pick<
  EntityTable,
  "columns" | "visible" | "setPref" | "moveColumn" | "reset"
>;

export type ObjectDataColumn<T> = BuiltinColumn & {
  render: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function useLocalObjectTable(
  storageKey: string,
  builtins: Array<BuiltinColumn>,
): ObjectTableController {
  const [prefs, setPrefs] = useState<Array<ColumnPref>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as Array<ColumnPref>) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [prefs, storageKey]);

  const columns = resolveColumns(builtins, [], prefs);
  const visible = columns.filter((column) => !column.hidden);

  return {
    columns,
    visible,
    setPref: (key, patch) => setPrefs((current) => upsertPref(current, key, patch)),
    moveColumn: (key, direction) =>
      setPrefs((current) => orderPrefs(current, columns, key, direction)),
    reset: () => {
      setPrefs([]);
      return undefined;
    },
  };
}

export function ObjectDataTable<T>({
  rows,
  columns,
  table,
  getRowId,
  selectedIds,
  activeRowId,
  loading,
  emptyMessage,
  selectAllLabel,
  getRowSelectLabel,
  onToggleVisible,
  onSelectRow,
  onRowClick,
  onAddRow,
  addRowLabel = "Add New",
  renderActions,
  minWidth = 920,
  settingsHref,
  sortKey,
  sortDir,
  onSort,
  onFilter,
  footer,
}: {
  rows: Array<T>;
  columns: Array<ObjectDataColumn<T>>;
  table: ObjectTableController;
  getRowId: (row: T) => string;
  selectedIds: Set<string>;
  activeRowId?: string | null;
  loading?: boolean;
  emptyMessage: string;
  selectAllLabel: string;
  getRowSelectLabel: (row: T) => string;
  onToggleVisible: (checked: boolean) => void;
  onSelectRow: (row: T, checked: boolean) => void;
  onRowClick?: (row: T) => void;
  onAddRow?: () => void;
  addRowLabel?: string;
  renderActions?: (row: T) => ReactNode;
  minWidth?: number;
  settingsHref?: string;
  sortKey?: string | null;
  sortDir?: "asc" | "desc" | null;
  onSort?: (key: string, dir: "asc" | "desc") => void;
  onFilter?: (key: string) => void;
  footer?: ReactNode;
}) {
  const sticky = useStickyColumns(table.visible);
  const renderByKey = new Map(columns.map((column) => [column.key, column.render]));
  const alignByKey = new Map(columns.map((column) => [column.key, column.align]));
  const visibleIds = rows.map(getRowId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const colSpan = table.visible.length + (renderActions ? 3 : 2);

  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <th className="w-10 px-4 py-2">
                <Checkbox
                  checked={allVisibleSelected}
                  ariaLabel={selectAllLabel}
                  onChange={onToggleVisible}
                />
              </th>
              {table.visible.map((column) => (
                <HeaderCell
                  key={column.key}
                  column={column}
                  table={table}
                  sticky={sticky}
                  sort={sortKey === column.key ? sortDir ?? null : null}
                  onSort={onSort ? (dir) => onSort(column.key, dir) : undefined}
                  onFilter={onFilter ? () => onFilter(column.key) : undefined}
                  align={alignByKey.get(column.key) ?? "left"}
                />
              ))}
              <AddColumnHeaderCell table={table} settingsHref={settingsHref} />
              {renderActions ? (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-neutral-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8">
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    onClick={(event) => {
                      if (!onRowClick || isInteractiveClick(event)) return;
                      onRowClick(row);
                    }}
                    className={`border-b border-edge/60 last:border-0 hover:bg-white/[0.02] ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${activeRowId === id ? "bg-accent/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(id)}
                        ariaLabel={getRowSelectLabel(row)}
                        onChange={(checked) => onSelectRow(row, checked)}
                      />
                    </td>
                    {table.visible.map((column: ResolvedColumn) => {
                      const pin = sticky.pinProps(column, "body");
                      return (
                        <td
                          key={column.key}
                          style={pin.style}
                          className={`whitespace-nowrap px-4 py-3 ${pin.className}`}
                        >
                          {renderByKey.get(column.key)?.(row)}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3" />
                    {renderActions ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {renderActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {onAddRow ? (
        <button
          type="button"
          onClick={onAddRow}
          className="flex w-full items-center gap-3 border-t border-edge px-4 py-2 text-left text-sm text-neutral-500 transition-colors hover:bg-raised/50 hover:text-white"
        >
          <span className="text-lg leading-none">+</span>
          {addRowLabel}
        </button>
      ) : null}
      {footer}
    </Panel>
  );
}
