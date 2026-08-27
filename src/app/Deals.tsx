import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AddColumnHeaderCell,
  AddCustomFieldButton,
  ColumnsButton,
  FieldCell,
  HeaderCell,
  useEntityTable,
  useStickyColumns,
} from "../components/dataTable";
import type { EntityTable, StickyColumns } from "../components/dataTable";
import {
  OBJECT_ICONS,
  ObjectTableHeader,
  OptionRow,
  ViewBar,
} from "../components/ObjectTableChrome";
import {
  ObjectCalendar,
  ObjectKanban,
  type KanbanSummaryField,
  type ObjectGroupOption,
  type ObjectViewType,
  groupedKanbanColumns,
  kanbanLaneTone,
} from "../components/ObjectViews";
import { RecordActionMenu } from "../components/RecordActionMenu";
import { RecordSidePanel } from "../components/RecordSidePanel";
import { SavedViewsDropdown } from "../components/SavedViewButton";
import { SlideOver } from "../components/SlideOver";
import {
  Avatar,
  Button,
  Checkbox,
  CompanyLogo,
  Input,
  NumberInput,
  Panel,
  Select,
} from "../components/ui";
import { DEAL_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import { downloadCsv, parseCsv } from "../lib/csv";
import {
  customFieldKanbanOption,
  customFieldSummaryType,
  isCustomFieldKanbanOption,
} from "../lib/customFields";
import { formatMoney, stageLabel } from "../lib/format";
import { isInteractiveClick } from "../lib/interaction";
import {
  TableFilters,
  applyTableFilters,
  decodeFilters,
  encodeFilters,
} from "../lib/tableFilters";

const STAGES = [
  "QUALIFIED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

type DealStage = (typeof STAGES)[number];
type BoardDeal = FunctionReturnType<
  typeof api.deals.board
>[number]["deals"][number];

// Kanban board grouped by stage, with native drag and drop between columns
// and a column-driven list view that shares the table infrastructure with
// Companies and Contacts. Stage moves are one mutation and every other
// open client sees the card move in real time.
export function Deals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const board = useQuery(api.deals.board);
  const changeStage = useMutation(api.deals.changeStage);
  const updateDeal = useMutation(api.deals.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const removeDeal = useMutation(api.deals.remove);
  const [showNew, setShowNew] = useState(() => searchParams.get("new") === "1");
  const [view, setView] = useState<"board" | "list" | "calendar">(() => {
    const value = searchParams.get("view");
    return value === "list"
      ? "list"
      : value === "calendar"
        ? "calendar"
        : "board";
  });
  const [kanbanGroup, setKanbanGroup] = useState(
    () => searchParams.get("group") ?? "stage",
  );
  const [editingId, setEditingId] = useState<Id<"deals"> | null>(null);
  const [newDealStage, setNewDealStage] = useState<DealStage | undefined>();
  const [filters, setFilters] = useState(() => decodeFilters(searchParams.get("f")));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [panelId, setPanelId] = useState<Id<"deals"> | null>(() => {
    const dealId = searchParams.get("deal");
    return dealId ? (dealId as Id<"deals">) : null;
  });
  const [sortKey, setSortKey] = useState<string>("amountMinor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const currentViewParams = new URLSearchParams({
    ...(view === "list" ? { view: "list" } : {}),
    ...(view === "calendar" ? { view: "calendar" } : {}),
    ...(view === "board" && kanbanGroup !== "stage" ? { group: kanbanGroup } : {}),
    ...(filters.length > 0 ? { f: encodeFilters(filters) } : {}),
  }).toString();
  const currentHref = currentViewParams
    ? `/app/deals?${currentViewParams}`
    : "/app/deals";
  const hrefForViewType = (
    type: ObjectViewType,
    config?: { kanbanGroup?: string },
  ) => {
    const next = new URLSearchParams();
    if (type === "table") next.set("view", "list");
    if (type === "calendar") next.set("view", "calendar");
    if (type === "kanban" && config?.kanbanGroup !== "stage") {
      next.set("group", config?.kanbanGroup ?? "stage");
    }
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    const query = next.toString();
    return query ? `/app/deals?${query}` : "/app/deals";
  };

  const openSavedView = (href: string) => {
    const next = new URL(href, window.location.origin).searchParams;
    const nextView = next.get("view");
    setView(
      nextView === "list"
        ? "list"
        : nextView === "calendar"
          ? "calendar"
          : "board",
    );
    setKanbanGroup(next.get("group") ?? "stage");
    setFilters(decodeFilters(next.get("f")));
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (view === "list") next.set("view", "list");
    if (view === "calendar") next.set("view", "calendar");
    if (view === "board" && kanbanGroup !== "stage") next.set("group", kanbanGroup);
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    if (panelId) next.set("deal", panelId);
    setSearchParams(next, { replace: true });
  }, [filters, kanbanGroup, panelId, setSearchParams, view]);

  const deleteDeal = async (deal: BoardDeal) => {
    if (!window.confirm(`Delete ${deal.name}? This also removes its timeline and facts.`)) {
      return;
    }
    await removeDeal({ dealId: deal._id });
  };

  const allDeals: Array<BoardDeal> =
    board?.flatMap((column) => column.deals) ?? [];

  const table = useEntityTable(
    "deal",
    DEAL_COLUMNS,
    allDeals.map((d) => d._id),
  );
  const sticky = useStickyColumns(table.visible);
  const dealKanbanGroupOptions: Array<ObjectGroupOption> = [
    {
      value: "stage",
      label: "Stage",
      values: STAGES.map((stage) => ({
        value: stage,
        label: stageLabel(stage),
      })),
    },
    { value: "company", label: "Company" },
    { value: "owner", label: "Owner" },
    ...[...table.definitionByColumn.values()]
      .map(customFieldKanbanOption)
      .filter(isCustomFieldKanbanOption),
  ];
  const dealSummaryFields: Array<KanbanSummaryField<BoardDeal>> = [
    { key: "name", label: "Name", type: "field" },
    { key: "amountMinor", label: "Amount", type: "number" },
    { key: "stage", label: "Stage", type: "field" },
    { key: "company", label: "Company", type: "field" },
    { key: "owner", label: "Owner", type: "field" },
    { key: "expectedCloseAt", label: "Close date", type: "date" },
    { key: "createdAt", label: "Creation date", type: "date" },
    ...[...table.definitionByColumn.values()].map((definition) => ({
      key: `field:${definition.key}`,
      label: definition.label,
      type: customFieldSummaryType(definition.type),
      getValue: (deal: BoardDeal) => table.fieldValue(definition, deal._id),
    })),
  ];

  const setSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
  };

  const addColumnFilter = (columnKey: string) => {
    setFilters((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        columnKey,
        operator: "contains",
        value: "",
      },
    ]);
  };

  const sortDefinition = table.definitionByColumn.get(sortKey);
  const filteredDeals = applyTableFilters(allDeals, filters, (deal, key) => {
    const definition = table.definitionByColumn.get(key);
    if (definition) return table.fieldValue(definition, deal._id);
    if (key === "company") return deal.company?.name ?? "";
    if (key === "owner") return deal.owner?.name ?? "";
    if (key === "amountMinor") return deal.amountMinor / 100;
    return String(deal[key as keyof BoardDeal] ?? "");
  });
  const sorted = [...filteredDeals].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortDefinition) {
      const av = table.fieldValue(sortDefinition, a._id) ?? "";
      const bv = table.fieldValue(sortDefinition, b._id) ?? "";
      if (sortDefinition.type === "number") {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      return av.localeCompare(bv) * dir;
    }
    if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * dir;
    const pick = (deal: BoardDeal) => {
      if (sortKey === "company") return deal.company?.name ?? "";
      if (sortKey === "owner") return deal.owner?.name ?? "";
      if (sortKey === "stage") return deal.stage;
      return deal.name;
    };
    return pick(a).localeCompare(pick(b)) * dir;
  });
  const visibleIds = sorted.map((deal) => deal._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const liveIds = new Set<string>(allDeals.map((deal) => deal._id));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [allDeals]);

  const toggleVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleRow = (id: Id<"deals">, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const renderCell = (deal: BoardDeal, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={deal._id}
          value={table.fieldValue(definition, deal._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <button
            type="button"
            onClick={() => setPanelId(deal._id)}
            className="text-left text-white hover:text-accent"
          >
            {deal.name}
          </button>
        );
      case "company":
        return deal.company ? (
          <Link
            to={`/app/companies/${deal.company._id}`}
            className="flex items-center gap-2 text-neutral-400 hover:text-accent"
          >
            <CompanyLogo
              name={deal.company.name}
              logoUrl={deal.company.logoUrl}
              size={16}
            />
            {deal.company.name}
          </Link>
        ) : null;
      case "stage":
        return (
          <Select
            size="sm"
            ariaLabel="Stage"
            value={deal.stage}
            onChange={(stage) =>
              void changeStage({
                dealId: deal._id,
                stage: stage as (typeof STAGES)[number],
              })
            }
            options={STAGES.map((stage) => ({
              value: stage,
              label: stageLabel(stage),
            }))}
            className="w-36"
          />
        );
      case "amountMinor":
        return (
          <span className="text-neutral-300">
            {formatMoney(deal.amountMinor, deal.currency)}
          </span>
        );
      case "owner":
        return deal.owner ? (
          <span className="flex items-center gap-2 text-neutral-400">
            <Avatar name={deal.owner.name} src={deal.owner.avatarUrl} size={18} />
            {deal.owner.name}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div>
      <ObjectTableHeader
        icon={OBJECT_ICONS.deal}
        title="Deals"
        selectedCount={selectedIds.size}
        primaryLabel="New Deal"
        onPrimary={() => {
          setNewDealStage(undefined);
          setShowNew(true);
        }}
        updateSlot={
          <DealBulkToolbar
            selectedIds={[...selectedIds] as Array<Id<"deals">>}
            onClear={() => setSelectedIds(new Set())}
          />
        }
        options={
          <DealOptionsPanel
            table={table}
            rows={sorted}
            selectedIds={selectedIds}
          />
        }
      />
      <ViewBar
        label={view === "list" ? "All Deals" : view === "calendar" ? "Deal Calendar" : "Pipeline"}
        count={sorted.length}
        viewControl={
          <SavedViewsDropdown
            entity="deal"
            currentName="Deals Kanban"
            count={sorted.length}
            href={currentHref}
            defaultName={view === "list" ? "Deals table" : "Deals kanban"}
            viewTypes={["table", "kanban", "calendar"]}
            currentType={
              view === "list" ? "table" : view === "calendar" ? "calendar" : "kanban"
            }
            lockedType="kanban"
            builtInViews={[{ type: "table", label: "Table" }]}
            onTypeChange={(type) =>
              setView(
                type === "table"
                  ? "list"
                  : type === "calendar"
                    ? "calendar"
                    : "board",
              )
            }
            hrefForType={hrefForViewType}
            onOpenView={openSavedView}
            kanbanGroupOptions={dealKanbanGroupOptions}
            currentKanbanGroup={kanbanGroup}
            defaultKanbanGroup="stage"
          />
        }
      >
        {view === "list" ? (
          <TableFilters
            columns={table.visible}
            filters={filters}
            onChange={setFilters}
          />
        ) : null}
      </ViewBar>
      <SlideOver
        open={showNew}
        title="New deal"
        subtitle="Created now"
        icon={
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
            {OBJECT_ICONS.deal}
          </span>
        }
        onClose={() => setShowNew(false)}
        widthClass="max-w-[460px] sm:w-[420px]"
      >
        <NewDealForm
          initialStage={newDealStage}
          onDone={() => {
            setShowNew(false);
            setNewDealStage(undefined);
          }}
        />
      </SlideOver>

      {view === "list" ? (
        <>
          <Panel>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
                <tr className="border-b border-edge text-xs text-neutral-500">
                  <th className="w-10 px-4 py-2">
                    <Checkbox
                      checked={allVisibleSelected}
                      ariaLabel="Select all visible deals"
                      onChange={toggleVisible}
                    />
                  </th>
                  {table.visible.map((column) => (
                    <HeaderCell
                      key={column.key}
                      column={column}
                      table={table}
                      sticky={sticky}
                      sort={sortKey === column.key ? sortDir : null}
                      onSort={(dir) => setSort(column.key, dir)}
                      onFilter={() => addColumnFilter(column.key)}
                    />
                  ))}
                  <AddColumnHeaderCell table={table} />
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((deal) =>
                  editingId === deal._id ? (
                    <EditableDealRow
                      key={deal._id}
                      deal={deal}
                      columns={table.visible}
                      sticky={sticky}
                      selected={selectedIds.has(deal._id)}
                      onSelect={(checked) => toggleRow(deal._id, checked)}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <tr
                      key={deal._id}
                      onClick={(event) => {
                        if (!isInteractiveClick(event)) setPanelId(deal._id);
                      }}
                      className="cursor-pointer border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(deal._id)}
                          ariaLabel={`Select ${deal.name}`}
                          onChange={(checked) => toggleRow(deal._id, checked)}
                        />
                      </td>
                      {table.visible.map((column) => {
                        const pin = sticky.pinProps(column, "body");
                        return (
                          <td
                            key={column.key}
                            style={pin.style}
                            className={`whitespace-nowrap px-4 py-3 ${pin.className}`}
                          >
                            {renderCell(deal, column)}
                          </td>
                        );
                      })}
                      <td className="px-2 py-3" />
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <RecordActionMenu
                            onOpenPanel={() => setPanelId(deal._id)}
                            onEdit={() => setEditingId(deal._id)}
                            onDelete={() => void deleteDeal(deal)}
                          />
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            </div>
          </Panel>
        </>
      ) : view === "calendar" ? (
        <ObjectCalendar
          items={sorted}
          getDate={(deal) => deal.expectedCloseAt ?? deal._creationTime}
          renderItem={(deal) => (
            <DealCalendarCard
              key={deal._id}
              deal={deal}
              onOpen={() => setPanelId(deal._id)}
            />
          )}
        />
      ) : (
        <ObjectKanban<BoardDeal>
          columns={groupedKanbanColumns({
            items: sorted,
            groupBy: kanbanGroup,
            options: dealKanbanGroupOptions,
            getValue: (deal, field) => dealGroupValue(deal, field, table),
            renderItem: (deal) => (
              <DealMiniKanbanCard
                key={deal._id}
                deal={deal}
                selected={selectedIds.has(deal._id)}
                onOpen={() => setPanelId(deal._id)}
                onSelect={(checked) => toggleRow(deal._id, checked)}
                onDelete={() => void deleteDeal(deal)}
              />
            ),
          }).map((column, index) => ({
            ...column,
            subtitle:
              kanbanGroup === "stage"
                ? compactColumnTotal(column.items)
                : undefined,
            tone:
              kanbanGroup === "stage"
                ? stageTone(column.key)
                : kanbanLaneTone(index),
            onAdd:
              kanbanGroup === "stage" && STAGES.includes(column.key as DealStage)
                ? () => {
                    setNewDealStage(column.key as DealStage);
                    setShowNew(true);
                  }
                : undefined,
          }))}
          getItemKey={(deal) => deal._id}
          summaryFields={dealSummaryFields}
          onMove={(deal, columnKey) => {
            const nextValue = columnKey === "Unspecified" ? "" : columnKey;
            if (kanbanGroup === "stage" && nextValue) {
              void changeStage({
                dealId: deal._id,
                stage: nextValue as DealStage,
              });
              return;
            }
            const definition = table.definitionByColumn.get(kanbanGroup);
            if (definition) {
              void setFieldValue({
                fieldId: definition._id,
                entityId: deal._id,
                value: nextValue,
              });
              return;
            }
            const target = sorted.find((item) => {
              const value = dealGroupValue(item, kanbanGroup, table);
              return Array.isArray(value)
                ? value.includes(columnKey)
                : value === columnKey;
            });
            if (kanbanGroup === "company" && target?.companyId) {
              void updateDeal({ dealId: deal._id, companyId: target.companyId });
            }
            if (kanbanGroup === "owner") {
              void updateDeal({
                dealId: deal._id,
                ownerId: nextValue ? target?.ownerId ?? null : null,
              });
            }
          }}
        />
      )}
      <RecordSidePanel
        record={panelId ? { type: "deal", id: panelId } : null}
        onClose={() => setPanelId(null)}
      />
    </div>
  );
}

function pickCsv(row: Record<string, string>, keys: Array<string>) {
  for (const key of keys) {
    const value = row[key];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function DealOptionsPanel({
  table,
  rows,
  selectedIds,
}: {
  table: EntityTable;
  rows: Array<BoardDeal>;
  selectedIds: Set<string>;
}) {
  const importRows = useMutation(api.deals.importRows);
  const [message, setMessage] = useState<string | null>(null);

  const exportRows = (selectedOnly = false) => {
    const source = selectedOnly
      ? rows.filter((deal) => selectedIds.has(deal._id))
      : rows;
    downloadCsv(
      selectedOnly ? "selected-deals.csv" : "deals.csv",
      source.map((deal) => {
        const row: Record<string, string | number | null | undefined> = {
          name: deal.name,
          companyName: deal.company?.name,
          stage: deal.stage,
          amount: deal.amountMinor / 100,
          currency: deal.currency,
          owner: deal.owner?.name,
        };
        for (const column of table.visible) {
          const definition = table.definitionByColumn.get(column.key);
          if (definition) {
            row[column.label] = table.fieldValue(definition, deal._id);
          }
        }
        return row;
      }),
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text()).map((row) => ({
      name: pickCsv(row, ["name", "Name", "deal", "Deal"]) ?? "",
      companyName: pickCsv(row, ["companyName", "Company Name", "company", "Company"]),
      companyDomain: pickCsv(row, [
        "companyDomain",
        "Company Domain",
        "domain",
        "Domain",
      ]),
      amount: pickCsv(row, ["amount", "Amount", "value", "Value"]),
      currency: pickCsv(row, ["currency", "Currency"]),
      stage: pickCsv(row, ["stage", "Stage"]),
    }));
    const result = await importRows({ rows: parsed });
    setMessage(
      `Imported ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    );
  };

  return (
    <div className="grid gap-1">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Other
      </p>
      <label className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white">
        Import Deals
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <OptionRow onClick={() => exportRows()}>Export View</OptionRow>
      {selectedIds.size > 0 ? (
        <OptionRow onClick={() => exportRows(true)}>Export Selected</OptionRow>
      ) : null}
      <div className="my-2 h-px bg-edge" />
      <div className="flex items-center gap-2 px-2">
        <AddCustomFieldButton entity="deal" menuAlign="left" />
        <ColumnsButton table={table} menuAlign="left" />
      </div>
      {message ? <p className="px-2 text-xs text-neutral-500">{message}</p> : null}
    </div>
  );
}

function stageTone(stage: string) {
  const tones: Record<string, string> = {
    QUALIFIED: "bg-red-500/15 text-red-300",
    MEETING: "bg-sky-500/15 text-sky-300",
    PROPOSAL: "bg-emerald-500/15 text-emerald-300",
    NEGOTIATION: "bg-amber-500/15 text-amber-300",
    CLOSED_WON: "bg-lime-500/15 text-lime-300",
    CLOSED_LOST: "bg-neutral-500/15 text-neutral-400",
  };
  return tones[stage] ?? "bg-white/10 text-neutral-300";
}

function compactColumnTotal(deals: Array<BoardDeal>) {
  const total = deals.reduce((sum, deal) => sum + deal.amountMinor, 0);
  if (total >= 100_000_000) return `${Math.round(total / 100_000_000)}m`;
  if (total >= 100_000) return `${Math.round(total / 100_000)}k`;
  return formatMoney(total, deals[0]?.currency ?? "USD");
}

function KanbanCardField({
  icon,
  value,
  avatar,
  muted,
}: {
  icon: string;
  value: ReactNode;
  avatar?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`mt-2 grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-sm ${
        muted ? "text-neutral-600" : "text-neutral-300"
      }`}
    >
      <span className="text-center text-neutral-500">{icon}</span>
      <span className="flex min-w-0 items-center gap-2 truncate">
        {avatar}
        <span className="min-w-0 truncate">{value}</span>
      </span>
    </div>
  );
}

function DealCalendarCard({
  deal,
  onOpen,
}: {
  deal: BoardDeal;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-edge bg-panel px-2 py-1.5 text-left text-xs shadow-sm transition-colors hover:border-edge-strong"
    >
      <span className="block truncate font-medium text-white">{deal.name}</span>
      <span className="mt-1 block truncate text-neutral-500">
        {formatMoney(deal.amountMinor, deal.currency)}
      </span>
    </button>
  );
}

function DealMiniKanbanCard({
  deal,
  selected,
  onOpen,
  onSelect,
  onDelete,
}: {
  deal: BoardDeal;
  selected: boolean;
  onOpen: () => void;
  onSelect: (checked: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <article
      onClick={(event) => {
        if (!isInteractiveClick(event)) onOpen();
      }}
      className={`rounded-md border p-3 shadow-sm transition-colors hover:border-edge-strong ${
        selected ? "border-accent/50 bg-accent/10" : "border-edge bg-panel"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 truncate text-left text-sm font-medium text-white hover:text-accent"
        >
          {deal.name}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Checkbox
            checked={selected}
            ariaLabel={`Select ${deal.name}`}
            onChange={onSelect}
          />
          <RecordActionMenu onOpenPanel={onOpen} onDelete={onDelete} />
        </div>
      </div>
      <KanbanCardField
        icon="$"
        value={formatMoney(deal.amountMinor, deal.currency)}
      />
      <KanbanCardField
        icon="o"
        value={deal.owner?.name ?? "Unassigned"}
        avatar={
          deal.owner ? (
            <Avatar name={deal.owner.name} src={deal.owner.avatarUrl} size={18} />
          ) : null
        }
      />
      {deal.company ? (
        <KanbanCardField
          icon="b"
          value={
            <Link
              to={`/app/companies/${deal.company._id}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded bg-white/5 px-1.5 py-0.5 text-neutral-300 hover:text-accent"
            >
              <CompanyLogo
                name={deal.company.name}
                logoUrl={deal.company.logoUrl}
                size={14}
              />
              <span className="truncate">{deal.company.name}</span>
            </Link>
          }
        />
      ) : null}
    </article>
  );
}

function dealGroupValue(
  deal: BoardDeal,
  groupBy: string,
  table: EntityTable,
) {
  const definition = table.definitionByColumn.get(groupBy);
  if (definition) {
    const value = table.fieldValue(definition, deal._id);
    if (definition.type === "multiSelect" && typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  }
  if (groupBy === "stage") return deal.stage;
  if (groupBy === "company") return deal.company?.name;
  if (groupBy === "owner") return deal.owner?.name;
  return undefined;
}

function DealBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: Array<Id<"deals">>;
  onClear: () => void;
}) {
  const users = useQuery(api.users.list);
  const bulkUpdate = useMutation(api.deals.bulkUpdate);
  const bulkRemove = useMutation(api.deals.bulkRemove);
  const [stage, setStage] = useState("UNCHANGED");
  const [currency, setCurrency] = useState("");
  const [ownerId, setOwnerId] = useState("UNCHANGED");
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const applyBulkUpdate = async () => {
    const updates: {
      stage?: (typeof STAGES)[number];
      currency?: string;
      ownerId?: Id<"users"> | null;
    } = {};
    if (stage !== "UNCHANGED") updates.stage = stage as (typeof STAGES)[number];
    if (currency.trim()) updates.currency = currency.trim().toUpperCase();
    if (ownerId !== "UNCHANGED") {
      updates.ownerId = ownerId ? (ownerId as Id<"users">) : null;
    }
    if (Object.keys(updates).length === 0 || selectedIds.length === 0) return;
    const count = await bulkUpdate({ dealIds: selectedIds, updates });
    setMessage(`Updated ${count} deals`);
    setStage("UNCHANGED");
    setCurrency("");
    setOwnerId("UNCHANGED");
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Move ${selectedIds.length} deals to trash?`)) return;
    const count = await bulkRemove({ dealIds: selectedIds });
    onClear();
    setMessage(`Moved ${count} deals to trash`);
  };

  return (
    <div className="relative">
      <Button onClick={() => setShowUpdate((value) => !value)}>Update</Button>
      {showUpdate ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="grid gap-2">
            <Select
              ariaLabel="Bulk stage"
              value={stage}
              onChange={setStage}
              options={[
                { value: "UNCHANGED", label: "Stage unchanged" },
                ...STAGES.map((item) => ({
                  value: item,
                  label: stageLabel(item),
                })),
              ]}
            />
            <Input
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              placeholder="Set currency"
              className="py-1.5 uppercase"
            />
            <Select
              ariaLabel="Bulk owner"
              value={ownerId}
              onChange={setOwnerId}
              options={[
                { value: "UNCHANGED", label: "Owner unchanged" },
                { value: "", label: "Clear owner" },
                ...(users?.map((user) => ({
                  value: user._id,
                  label: user.name,
                })) ?? []),
              ]}
            />
            <Button
              variant="primary"
              onClick={() => void applyBulkUpdate().then(() => setShowUpdate(false))}
            >
              Apply update
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-edge pt-3">
            <Button
              variant="danger"
              onClick={() => void deleteSelected().then(() => setShowUpdate(false))}
            >
              Delete selected
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
                setShowUpdate(false);
              }}
            >
              Clear
            </Button>
          </div>
          {message ? <p className="mt-2 text-xs text-neutral-500">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function EditableDealRow({
  deal,
  columns,
  sticky,
  selected,
  onSelect,
  onDone,
}: {
  deal: BoardDeal;
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onDone: () => void;
}) {
  const update = useMutation(api.deals.update);
  const changeStage = useMutation(api.deals.changeStage);
  const remove = useMutation(api.deals.remove);
  const companies = useQuery(api.companies.names);
  const [name, setName] = useState(deal.name);
  const [companyId, setCompanyId] = useState(deal.companyId);
  const [stage, setStage] = useState<(typeof STAGES)[number]>(deal.stage);
  const [amount, setAmount] = useState(String(deal.amountMinor / 100));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      setError(null);
      await update({
        dealId: deal._id,
        name: trimmedName,
        companyId: companyId as Id<"companies">,
        amountMinor: Math.round(dollars * 100),
      });
      if (stage !== deal.stage) {
        await changeStage({ dealId: deal._id, stage });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const deleteDeal = async () => {
    if (!window.confirm(`Move ${deal.name} to trash?`)) return;
    try {
      setError(null);
      await remove({ dealId: deal._id });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <tr className="border-b border-edge/60 bg-raised/30">
      <td className="px-4 py-2">
        <Checkbox
          checked={selected}
          ariaLabel={`Select ${deal.name}`}
          onChange={onSelect}
        />
      </td>
      {columns.map((column) => {
        const pin = sticky.pinProps(column, "body");
        let content = null;
        if (column.key === "name") {
          content = (
            <div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
                className="w-full rounded-md border border-edge bg-ink px-2 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
              />
              {error ? (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              ) : null}
            </div>
          );
        } else if (column.key === "company") {
          content = (
            <Select
              size="sm"
              ariaLabel="Company"
              value={companyId}
              onChange={(value) => setCompanyId(value as Id<"companies">)}
              options={
                companies?.map((company) => ({
                  value: company._id,
                  label: company.name,
                })) ?? []
              }
            />
          );
        } else if (column.key === "stage") {
          content = (
            <Select
              size="sm"
              ariaLabel="Stage"
              value={stage}
              onChange={(value) => setStage(value as (typeof STAGES)[number])}
              options={STAGES.map((item) => ({
                value: item,
                label: stageLabel(item),
              }))}
            />
          );
        } else if (column.key === "amountMinor") {
          content = (
            <NumberInput value={amount} onChange={setAmount} min={0} />
          );
        }
        return (
          <td
            key={column.key}
            style={pin.style}
            className={`whitespace-nowrap px-4 py-2 ${pin.className}`}
          >
            {content}
          </td>
        );
      })}
      <td className="px-2 py-2" />
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void deleteDeal()}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

function NewDealForm({
  initialStage,
  onDone,
}: {
  initialStage?: DealStage;
  onDone: () => void;
}) {
  const companies = useQuery(api.companies.names);
  const settings = useQuery(api.tableSettings.get, { entity: "deal" });
  const create = useMutation(api.deals.create);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Workspace defaults from Settings prefill the pieces the form does not ask
  // about: stage and currency.
  const defaultStage = initialStage ?? settings?.defaults.stage ?? "QUALIFIED";
  const defaultCurrency = settings?.defaults.currency ?? "USD";

  const submit = async () => {
    try {
      setError(null);
      const dollars = Number(amount);
      if (!Number.isFinite(dollars) || dollars < 0) {
        throw new Error("Enter a valid amount");
      }
      await create({
        name,
        companyId: companyId as Id<"companies">,
        amountMinor: Math.round(dollars * 100),
        currency: defaultCurrency,
        stage: defaultStage,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <div className="grid gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Deal name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Company
          </label>
          <Select
            ariaLabel="Company"
            value={companyId}
            onChange={setCompanyId}
            options={[
              { value: "", label: "Pick a company" },
              ...(companies?.map((company) => ({
                value: company._id,
                label: company.name,
              })) ?? []),
            ]}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Amount ({defaultCurrency})
          </label>
          <NumberInput value={amount} onChange={setAmount} min={0} />
        </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!name.trim() || !companyId}
          >
            Create
          </Button>
        </div>
      <p className="mt-2 text-xs text-neutral-600">
        New deals start in {stageLabel(defaultStage)}. Change defaults in
        Settings.
      </p>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
