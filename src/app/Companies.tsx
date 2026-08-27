import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
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
  MissingKanbanGroup,
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
  Badge,
  Button,
  Checkbox,
  CompanyLogo,
  Input,
  Panel,
  Select,
} from "../components/ui";
import { COMPANY_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import { downloadCsv, parseCsv } from "../lib/csv";
import {
  customFieldKanbanOption,
  customFieldSummaryType,
  isCustomFieldKanbanOption,
} from "../lib/customFields";
import { timeAgo } from "../lib/format";
import { isInteractiveClick } from "../lib/interaction";
import {
  TableFilters,
  applyTableFilters,
  decodeFilters,
  encodeFilters,
} from "../lib/tableFilters";

type CompanyRow = Doc<"companies"> & {
  contactCount: number;
  dealCount: number;
  logoUrl?: string | null;
};

type CompanyCreateDefaults = {
  industry?: string;
  customField?: {
    fieldId: Id<"fieldDefinitions">;
    value: string;
  };
};

const ENRICHMENT_FILTERS = [
  "ALL",
  "ENRICHED",
  "RESEARCHING",
  "NONE",
  "FAILED",
] as const;

export function Companies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [showNew, setShowNew] = useState(() => searchParams.get("new") === "1");
  const [newCompanyDefaults, setNewCompanyDefaults] =
    useState<CompanyCreateDefaults | null>(null);
  const [enrichmentFilter, setEnrichmentFilter] =
    useState<(typeof ENRICHMENT_FILTERS)[number]>(
      () =>
        (searchParams.get("enrichment") as (typeof ENRICHMENT_FILTERS)[number]) ??
        "ALL",
    );
  const [editingId, setEditingId] = useState<Id<"companies"> | null>(null);
  const [panelId, setPanelId] = useState<Id<"companies"> | null>(null);
  const [filters, setFilters] = useState(() => decodeFilters(searchParams.get("f")));
  const [view, setView] = useState<ObjectViewType>(() => {
    const value = searchParams.get("view");
    return value === "kanban" || value === "calendar" ? value : "table";
  });
  const [kanbanGroup, setKanbanGroup] = useState(
    () => searchParams.get("group") ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const removeCompany = useMutation(api.companies.remove);
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  const table = useEntityTable(
    "company",
    COMPANY_COLUMNS,
    results.map((c) => c._id),
  );
  const sticky = useStickyColumns(table.visible);
  const currentParams = new URLSearchParams({
    ...(view !== "table" ? { view } : {}),
    ...(view === "kanban" && kanbanGroup ? { group: kanbanGroup } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(enrichmentFilter !== "ALL" ? { enrichment: enrichmentFilter } : {}),
    ...(filters.length > 0 ? { f: encodeFilters(filters) } : {}),
  }).toString();
  const currentHref = currentParams
    ? `/app/companies?${currentParams}`
    : "/app/companies";

  useEffect(() => {
    const next = new URLSearchParams();
    if (view !== "table") next.set("view", view);
    if (view === "kanban" && kanbanGroup) next.set("group", kanbanGroup);
    if (search.trim()) next.set("q", search.trim());
    if (enrichmentFilter !== "ALL") next.set("enrichment", enrichmentFilter);
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    setSearchParams(next, { replace: true });
  }, [enrichmentFilter, filters, kanbanGroup, search, setSearchParams, view]);

  const companyKanbanGroupOptions: Array<ObjectGroupOption> = [
    {
      value: "enrichmentStatus",
      label: "Enrichment",
      values: ENRICHMENT_FILTERS.filter((item) => item !== "ALL").map((item) => ({
        value: item,
        label: item.toLowerCase(),
      })),
    },
    { value: "industry", label: "Industry" },
    ...[...table.definitionByColumn.values()]
      .map(customFieldKanbanOption)
      .filter(isCustomFieldKanbanOption),
  ];
  const companySummaryFields: Array<KanbanSummaryField<CompanyRow>> = [
    { key: "name", label: "Name", type: "field" },
    { key: "domain", label: "Domain", type: "field" },
    { key: "industry", label: "Industry", type: "field" },
    { key: "contactCount", label: "Contacts", type: "number" },
    { key: "dealCount", label: "Deals", type: "number" },
    { key: "lastActivityAt", label: "Last activity", type: "date" },
    ...[...table.definitionByColumn.values()].map((definition) => ({
      key: `field:${definition.key}`,
      label: definition.label,
      type: customFieldSummaryType(definition.type),
      getValue: (company: CompanyRow) => table.fieldValue(definition, company._id),
    })),
  ];

  const hrefForViewType = (
    type: ObjectViewType,
    config?: { kanbanGroup?: string },
  ) => {
    const next = new URLSearchParams();
    if (type !== "table") next.set("view", type);
    if (type === "kanban" && config?.kanbanGroup) {
      next.set("group", config.kanbanGroup);
    }
    if (search.trim()) next.set("q", search.trim());
    if (enrichmentFilter !== "ALL") next.set("enrichment", enrichmentFilter);
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    const query = next.toString();
    return query ? `/app/companies?${query}` : "/app/companies";
  };

  const openSavedView = (href: string) => {
    const next = new URL(href, window.location.origin).searchParams;
    const nextView = next.get("view");
    setView(
      nextView === "kanban" || nextView === "calendar" ? nextView : "table",
    );
    setKanbanGroup(next.get("group") ?? "");
    setSearch(next.get("q") ?? "");
    const nextEnrichment = next.get("enrichment");
    setEnrichmentFilter(
      ENRICHMENT_FILTERS.includes(
        nextEnrichment as (typeof ENRICHMENT_FILTERS)[number],
      )
        ? (nextEnrichment as (typeof ENRICHMENT_FILTERS)[number])
        : "ALL",
    );
    setFilters(decodeFilters(next.get("f")));
  };

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

  const deleteCompany = async (company: CompanyRow) => {
    if (!window.confirm(`Move ${company.name} to trash? Its contacts and deals will be hidden until restored.`)) {
      return;
    }
    await removeCompany({ companyId: company._id });
  };

  const filteredByPreset =
    enrichmentFilter === "ALL"
      ? results
      : results.filter((c) => c.enrichmentStatus === enrichmentFilter);
  const filtered = applyTableFilters(filteredByPreset, filters, (company, key) => {
    const definition = table.definitionByColumn.get(key);
    if (definition) return table.fieldValue(definition, company._id);
    if (key === "contactCount") return company.contactCount;
    if (key === "dealCount") return company.dealCount;
    if (key === "lastActivityAt") return company.lastActivityAt ?? "";
    return String(company[key as keyof CompanyRow] ?? "");
  });

  const numericKeys = new Set(["contactCount", "dealCount", "lastActivityAt"]);
  const sortDefinition = table.definitionByColumn.get(sortKey);
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortDefinition) {
      const av = table.fieldValue(sortDefinition, a._id) ?? "";
      const bv = table.fieldValue(sortDefinition, b._id) ?? "";
      if (sortDefinition.type === "number") {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      return av.localeCompare(bv) * dir;
    }
    const key = sortKey as keyof CompanyRow;
    if (numericKeys.has(sortKey)) {
      return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * dir;
    }
    return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir;
  });
  const visibleIds = sorted.map((company) => company._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const liveIds = new Set<string>(results.map((company) => company._id));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [results]);

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

  const toggleRow = (id: Id<"companies">, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const renderCell = (company: CompanyRow, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={company._id}
          value={table.fieldValue(definition, company._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <button
            type="button"
            onClick={() => setPanelId(company._id)}
            className="flex items-center gap-2 text-white hover:text-accent"
          >
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
            {company.name}
          </button>
        );
      case "domain":
        return <span className="text-neutral-400">{company.domain ?? ""}</span>;
      case "industry":
        return (
          <span className="text-neutral-400">{company.industry ?? ""}</span>
        );
      case "enrichmentStatus":
        return <EnrichmentBadge status={company.enrichmentStatus} />;
      case "contactCount":
        return <span className="text-neutral-400">{company.contactCount}</span>;
      case "dealCount":
        return <span className="text-neutral-400">{company.dealCount}</span>;
      case "lastActivityAt":
        return (
          <span className="text-neutral-500">
            {company.lastActivityAt ? timeAgo(company.lastActivityAt) : ""}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ObjectTableHeader
        icon={OBJECT_ICONS.company}
        title="Companies"
        selectedCount={selectedIds.size}
        primaryLabel="New Company"
        onPrimary={() => {
          setNewCompanyDefaults(null);
          setShowNew(true);
        }}
        updateSlot={
          <CompanyBulkToolbar
            selectedIds={[...selectedIds] as Array<Id<"companies">>}
            onClear={() => setSelectedIds(new Set())}
          />
        }
        options={
          <CompanyOptionsPanel
            table={table}
            rows={sorted}
            selectedIds={selectedIds}
            currentHref={currentHref}
            defaultName={
              search || enrichmentFilter !== "ALL"
                ? "Filtered companies"
                : "All companies"
            }
          />
        }
      />

      <ViewBar
        label="All Companies"
        count={sorted.length}
        viewControl={
          <SavedViewsDropdown
            entity="company"
            currentName="All Companies"
            count={sorted.length}
            href={currentHref}
            defaultName={
              search || enrichmentFilter !== "ALL"
                ? "Filtered companies"
                : "All companies"
            }
            viewTypes={["table", "kanban", "calendar"]}
            currentType={view}
            onTypeChange={setView}
            hrefForType={hrefForViewType}
            onOpenView={openSavedView}
            kanbanGroupOptions={companyKanbanGroupOptions}
            currentKanbanGroup={kanbanGroup}
          />
        }
      >
        <div className="hidden w-56 md:block">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-transparent bg-transparent px-0 py-1 focus:border-transparent"
          />
        </div>
        <TableFilters
          columns={table.visible}
          filters={filters}
          onChange={setFilters}
        />
        <Select
          ariaLabel="Enrichment filter"
          size="sm"
          value={enrichmentFilter}
          onChange={(value) =>
            setEnrichmentFilter(value as (typeof ENRICHMENT_FILTERS)[number])
          }
          options={ENRICHMENT_FILTERS.map((f) => ({
            value: f,
            label: f === "ALL" ? "Status" : f.toLowerCase(),
          }))}
          className="w-28"
        />
      </ViewBar>
      <div className="mb-4 md:hidden">
        <Input
          placeholder="Search companies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <SlideOver
        open={showNew}
        title="New company"
        subtitle="Created now"
        icon={
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
            {OBJECT_ICONS.company}
          </span>
        }
        onClose={() => setShowNew(false)}
        widthClass="max-w-[460px] sm:w-[420px]"
      >
        <NewCompanyForm
          defaults={newCompanyDefaults ?? undefined}
          onDone={() => setShowNew(false)}
        />
      </SlideOver>

      {view === "table" ? (
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                <th className="w-10 px-4 py-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    ariaLabel="Select all visible companies"
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
              {sorted.map((company) =>
                editingId === company._id ? (
                  <EditableCompanyRow
                    key={company._id}
                    company={company}
                    columns={table.visible}
                    sticky={sticky}
                    selected={selectedIds.has(company._id)}
                    onSelect={(checked) => toggleRow(company._id, checked)}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={company._id}
                    onClick={(event) => {
                      if (!isInteractiveClick(event)) setPanelId(company._id);
                    }}
                    className="cursor-pointer border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(company._id)}
                        ariaLabel={`Select ${company.name}`}
                        onChange={(checked) => toggleRow(company._id, checked)}
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
                          {renderCell(company, column)}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3" />
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <RecordActionMenu
                        onOpenPanel={() => setPanelId(company._id)}
                        onEdit={() => setEditingId(company._id)}
                        onDelete={() => void deleteCompany(company)}
                      />
                    </td>
                  </tr>
                ),
              )}
              <InlineAddRow columns={table.visible} sticky={sticky} />
            </tbody>
          </table>
        </div>
        {status === "CanLoadMore" ? (
          <div className="border-t border-edge p-3 text-center">
            <Button onClick={() => loadMore(25)}>Load more</Button>
          </div>
        ) : null}
      </Panel>
      ) : view === "kanban" ? (
        kanbanGroup ? (
          <CompanyKanban
            companies={sorted}
            groupBy={kanbanGroup}
            groupOptions={companyKanbanGroupOptions}
            summaryFields={companySummaryFields}
            table={table}
            selectedIds={selectedIds}
            onSelect={toggleRow}
            onOpen={setPanelId}
            onCreate={(defaults) => {
              setNewCompanyDefaults(defaults);
              setShowNew(true);
            }}
          />
        ) : (
          <MissingKanbanGroup
            options={companyKanbanGroupOptions}
            value={kanbanGroup}
            onChange={setKanbanGroup}
          />
        )
      ) : (
        <ObjectCalendar
          items={sorted}
          getDate={(company) => company.lastActivityAt ?? company._creationTime}
          renderItem={(company) => (
            <CompanyMiniCard
              key={company._id}
              company={company}
              onOpen={() => setPanelId(company._id)}
            />
          )}
        />
      )}
      <RecordSidePanel
        record={panelId ? { type: "company", id: panelId } : null}
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

function CompanyOptionsPanel({
  table,
  rows,
  selectedIds,
  currentHref,
  defaultName,
}: {
  table: EntityTable;
  rows: Array<CompanyRow>;
  selectedIds: Set<string>;
  currentHref: string;
  defaultName: string;
}) {
  const importRows = useMutation(api.companies.importRows);
  const saveView = useMutation(api.savedViews.save);
  const [message, setMessage] = useState<string | null>(null);

  const exportRows = (selectedOnly = false) => {
    const source = selectedOnly
      ? rows.filter((company) => selectedIds.has(company._id))
      : rows;
    downloadCsv(
      selectedOnly ? "selected-companies.csv" : "companies.csv",
      source.map((company) => {
        const row: Record<string, string | number | null | undefined> = {
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          description: company.description,
          enrichmentStatus: company.enrichmentStatus,
          contactCount: company.contactCount,
          dealCount: company.dealCount,
          lastActivityAt: company.lastActivityAt
            ? new Date(company.lastActivityAt).toISOString()
            : "",
        };
        for (const column of table.visible) {
          const definition = table.definitionByColumn.get(column.key);
          if (definition) {
            row[column.label] = table.fieldValue(definition, company._id);
          }
        }
        return row;
      }),
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text()).map((row) => ({
      name: pickCsv(row, ["name", "Name", "company", "Company"]) ?? "",
      domain: pickCsv(row, ["domain", "Domain", "website", "Website"]),
      industry: pickCsv(row, ["industry", "Industry"]),
      description: pickCsv(row, ["description", "Description", "notes", "Notes"]),
    }));
    const result = await importRows({ rows: parsed });
    setMessage(
      `Imported ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    );
  };

  const createView = async () => {
    await saveView({ entity: "company", href: currentHref, name: defaultName });
    setMessage("View saved");
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Other
        </p>
        <label className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="import" />
          </span>
          Import Companies
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
        <OptionRow onClick={() => exportRows()}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="export" />
          </span>
          <span className="ml-3">Export View</span>
        </OptionRow>
        {selectedIds.size > 0 ? (
          <OptionRow onClick={() => exportRows(true)}>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
              <CommandIcon type="export" />
            </span>
            <span className="ml-3">Export Selected</span>
          </OptionRow>
        ) : null}
        <Link
          to="/app/trash"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="trash" />
          </span>
          See deleted Companies
        </Link>
        <OptionRow onClick={() => void createView()}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="view" />
          </span>
          <span className="ml-3">Create View</span>
        </OptionRow>
      </div>

      <div className="border-t border-edge pt-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Table
        </p>
        <div className="flex flex-wrap gap-2 px-2">
          <AddCustomFieldButton entity="company" menuAlign="left" />
          <ColumnsButton table={table} menuAlign="left" />
        </div>
      </div>

      <div className="border-t border-edge pt-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Shortcuts
        </p>
        <OptionRow>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="search" />
          </span>
          <span className="ml-3">Search</span>
          <span className="ml-auto rounded border border-edge px-1.5 py-0.5 text-xs text-neutral-600">
            /
          </span>
        </OptionRow>
        <OptionRow>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="email" />
          </span>
          <span className="ml-3">Compose Email</span>
        </OptionRow>
        <Link
          to="/app/settings"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-neutral-500">
            <CommandIcon type="settings" />
          </span>
          Go to Settings
        </Link>
      </div>

      {message ? <p className="px-2 text-xs text-neutral-500">{message}</p> : null}
    </div>
  );
}

function CompanyBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: Array<Id<"companies">>;
  onClear: () => void;
}) {
  const users = useQuery(api.users.list);
  const bulkUpdate = useMutation(api.companies.bulkUpdate);
  const bulkRemove = useMutation(api.companies.bulkRemove);
  const [industry, setIndustry] = useState("");
  const [ownerId, setOwnerId] = useState("UNCHANGED");
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const applyBulkUpdate = async () => {
    const updates: {
      industry?: string | null;
      ownerId?: Id<"users"> | null;
    } = {};
    if (industry.trim()) updates.industry = industry.trim();
    if (ownerId !== "UNCHANGED") {
      updates.ownerId = ownerId ? (ownerId as Id<"users">) : null;
    }
    if (Object.keys(updates).length === 0 || selectedIds.length === 0) return;
    const count = await bulkUpdate({ companyIds: selectedIds, updates });
    setMessage(`Updated ${count} companies`);
    setIndustry("");
    setOwnerId("UNCHANGED");
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Move ${selectedIds.length} companies to trash?`)) return;
    const count = await bulkRemove({ companyIds: selectedIds });
    onClear();
    setMessage(`Moved ${count} companies to trash`);
  };

  return (
    <div className="relative">
      <Button onClick={() => setShowUpdate((value) => !value)}>Update</Button>
      {showUpdate ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="grid gap-2">
            <Input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="Set industry"
              className="py-1.5"
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

function EditableCompanyRow({
  company,
  columns,
  sticky,
  selected,
  onSelect,
  onDone,
}: {
  company: CompanyRow;
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onDone: () => void;
}) {
  const update = useMutation(api.companies.update);
  const remove = useMutation(api.companies.remove);
  const [name, setName] = useState(company.name);
  const [domain, setDomain] = useState(company.domain ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    try {
      setError(null);
      await update({
        companyId: company._id,
        name: trimmedName,
        domain: domain.trim() || null,
        industry: industry.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const deleteCompany = async () => {
    if (!window.confirm(`Move ${company.name} to trash? Its contacts and deals will be hidden until restored.`)) {
      return;
    }
    try {
      setError(null);
      await remove({ companyId: company._id });
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
          ariaLabel={`Select ${company.name}`}
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
        } else if (column.key === "domain") {
          content = (
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void save()}
              placeholder="Domain"
              className="w-full rounded-md border border-edge bg-ink px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
            />
          );
        } else if (column.key === "industry") {
          content = (
            <input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void save()}
              placeholder="Industry"
              className="w-full rounded-md border border-edge bg-ink px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
            />
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
          <Button variant="danger" onClick={() => void deleteCompany()}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

// The last table row is a composer: type a name, optionally a domain, and
// Enter creates the company through the same mutation the form uses, so a
// domain still queues enrichment. Cells follow whatever columns are visible.
function InlineAddRow({
  columns,
  sticky,
}: {
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
}) {
  const create = useMutation(api.companies.create);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setError(null);
      await create({ name: name.trim(), domain: domain.trim() || undefined });
      setName("");
      setDomain("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  const addButton = name.trim() ? (
    <Button variant="primary" onClick={() => void submit()}>
      Add
    </Button>
  ) : null;

  return (
    <tr className="bg-white/[0.01]">
      <td className="px-4 py-2" />
      {columns.map((column) => {
        const pin = sticky.pinProps(column, "body");
        let content = null;
        if (column.key === "name") {
          content = (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder="+ Add company"
                  className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                />
                {columns.length === 1 ? addButton : null}
              </div>
              {error ? (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              ) : null}
            </>
          );
        } else if (column.key === "domain") {
          content = (
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="domain (optional)"
              className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
            />
          );
        }
        return (
          <td
            key={column.key}
            style={pin.style}
            className={`px-4 py-2 ${pin.className}`}
          >
            {content}
          </td>
        );
      })}
      <td className="px-2 py-2" />
      <td className="px-4 py-2 text-right">
        {columns.length > 1 ? addButton : null}
      </td>
    </tr>
  );
}

export function EnrichmentBadge({ status }: { status: string }) {
  if (status === "ENRICHED") return <Badge tone="green">Enriched</Badge>;
  if (status === "RESEARCHING") return <Badge tone="yellow">Researching</Badge>;
  if (status === "FAILED") return <Badge tone="red">Failed</Badge>;
  return <Badge>None</Badge>;
}

function companyEnrichmentTone(status: string) {
  const tones: Record<string, string> = {
    ENRICHED: "bg-emerald-500/15 text-emerald-300",
    RESEARCHING: "bg-amber-500/15 text-amber-300",
    NONE: "bg-neutral-500/15 text-neutral-400",
    FAILED: "bg-rose-500/15 text-rose-300",
  };
  return tones[status] ?? "bg-white/10 text-neutral-300";
}

function CompanyKanban({
  companies,
  groupBy,
  groupOptions,
  summaryFields,
  table,
  selectedIds,
  onSelect,
  onOpen,
  onCreate,
}: {
  companies: Array<CompanyRow>;
  groupBy: string;
  groupOptions: Array<ObjectGroupOption>;
  summaryFields: Array<KanbanSummaryField<CompanyRow>>;
  table: EntityTable;
  selectedIds: Set<string>;
  onSelect: (id: Id<"companies">, checked: boolean) => void;
  onOpen: (id: Id<"companies">) => void;
  onCreate: (defaults: CompanyCreateDefaults | null) => void;
}) {
  const updateCompany = useMutation(api.companies.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const definition = table.definitionByColumn.get(groupBy);
  const moveCompany = (company: CompanyRow, columnKey: string) => {
    const nextValue = columnKey === "Unspecified" ? "" : columnKey;
    if (definition) {
      void setFieldValue({
        fieldId: definition._id,
        entityId: company._id,
        value: nextValue,
      });
      return;
    }
    if (groupBy === "industry") {
      void updateCompany({
        companyId: company._id,
        industry: nextValue ? nextValue : null,
      });
      return;
    }
    if (groupBy === "enrichmentStatus" && nextValue) {
      void updateCompany({
        companyId: company._id,
        enrichmentStatus: nextValue as CompanyRow["enrichmentStatus"],
      });
    }
  };

  return (
    <ObjectKanban<CompanyRow>
      columns={groupedKanbanColumns({
        items: companies,
        groupBy,
        options: groupOptions,
        getValue: (company, field) => companyGroupValue(company, field, table),
        renderItem: (company) => (
          <CompanyMiniCard
            key={company._id}
            company={company}
            selected={selectedIds.has(company._id)}
            onSelect={(checked) => onSelect(company._id, checked)}
            onOpen={() => onOpen(company._id)}
          />
        ),
      }).map((column, index) => ({
        ...column,
        tone:
          groupBy === "enrichmentStatus"
            ? companyEnrichmentTone(column.key)
            : kanbanLaneTone(index),
        onAdd: () => {
          const nextValue = column.key === "Unspecified" ? "" : column.key;
          if (definition && nextValue) {
            onCreate({ customField: { fieldId: definition._id, value: nextValue } });
            return;
          }
          if (groupBy === "industry") {
            onCreate(nextValue ? { industry: nextValue } : null);
            return;
          }
          onCreate(null);
        },
      }))}
      getItemKey={(company) => company._id}
      summaryFields={summaryFields}
      onMove={moveCompany}
    />
  );
}

function companyGroupValue(
  company: CompanyRow,
  groupBy: string,
  table: EntityTable,
) {
  const definition = table.definitionByColumn.get(groupBy);
  if (definition) {
    const value = table.fieldValue(definition, company._id);
    if (definition.type === "multiSelect" && typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  }
  if (groupBy === "enrichmentStatus") return company.enrichmentStatus;
  if (groupBy === "industry") return company.industry;
  return undefined;
}

function CompanyMiniCard({
  company,
  selected,
  onSelect,
  onOpen,
}: {
  company: CompanyRow;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`rounded-md border bg-panel p-3 text-left shadow-sm transition-colors hover:border-edge-strong ${
        selected ? "border-accent/50 bg-accent/10" : "border-edge"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 text-left text-sm font-medium text-white hover:text-accent"
        >
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={18} />
          <span className="truncate">{company.name}</span>
        </button>
        {onSelect ? (
          <Checkbox
            checked={Boolean(selected)}
            ariaLabel={`Select ${company.name}`}
            onChange={onSelect}
          />
        ) : null}
      </div>
      {company.domain ? (
        <span className="mt-2 block truncate text-xs text-neutral-500">
          {company.domain}
        </span>
      ) : null}
      <span className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{company.contactCount} contacts</span>
        <span>{company.dealCount} deals</span>
      </span>
    </article>
  );
}

function NewCompanyForm({
  defaults,
  onDone,
}: {
  defaults?: CompanyCreateDefaults;
  onDone: () => void;
}) {
  const create = useMutation(api.companies.create);
  const setFieldValue = useMutation(api.fields.setValue);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState(defaults?.industry ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setError(null);
      const companyId = await create({
        name: name.trim(),
        domain: domain.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      if (defaults?.customField) {
        await setFieldValue({
          fieldId: defaults.customField.fieldId,
          entityId: companyId,
          value: defaults.customField.value,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-6">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void submit()}
            placeholder="Name"
            className="border-transparent bg-transparent px-0 text-lg font-medium focus:border-transparent"
          />
        </div>

        <section className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-medium text-white">Fields</h3>
            <FieldEditorRow
              icon={<CommandIcon type="link" />}
              label="Domain Name"
            >
              <Input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void submit()}
                placeholder="Domain Name"
                className="border-transparent bg-transparent px-0 focus:border-transparent"
              />
            </FieldEditorRow>
            <FieldEditorRow
              icon={<CommandIcon type="industry" />}
              label="Industry"
            >
              <Input
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void submit()}
                placeholder="Industry"
                className="border-transparent bg-transparent px-0 focus:border-transparent"
              />
            </FieldEditorRow>
            <FieldEditorRow
              icon={<CommandIcon type="owner" />}
              label="Account Owner"
            >
              <span className="text-sm text-neutral-500">Unassigned</span>
            </FieldEditorRow>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-white">System</h3>
            <FieldEditorRow
              icon={<CommandIcon type="calendar" />}
              label="Creation date"
            >
              <span className="text-sm text-neutral-300">Created now</span>
            </FieldEditorRow>
            <FieldEditorRow
              icon={<CommandIcon type="status" />}
              label="Client status"
            >
              <span className="text-sm text-neutral-500">Client status</span>
            </FieldEditorRow>
          </div>
        </section>
        {error ? <p className="mt-4 text-xs text-red-400">{error}</p> : null}
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-3">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={!name.trim()}
        >
          Create company
        </Button>
      </footer>
    </div>
  );
}

function FieldEditorRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-4 border-b border-edge/50 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2 text-sm text-neutral-500">
        <span className="text-neutral-500">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CommandIcon({
  type,
}: {
  type:
    | "import"
    | "export"
    | "trash"
    | "view"
    | "search"
    | "email"
    | "settings"
    | "link"
    | "industry"
    | "owner"
    | "calendar"
    | "status";
}) {
  const paths = {
    import: (
      <>
        <path d="M12 3v10" />
        <path d="m8 9 4 4 4-4" />
        <path d="M5 19h14" />
      </>
    ),
    export: (
      <>
        <path d="M12 21V11" />
        <path d="m8 15 4-4 4 4" />
        <path d="M5 5h14" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2" />
        <path d="M10 11v6M14 11v6M5 6l1 15h12l1-15" />
      </>
    ),
    view: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5h-6l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h6l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.2-1.5Z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </>
    ),
    industry: (
      <>
        <path d="M4 20V9l5 3V9l5 3V6h6v14" />
        <path d="M7 17h.01M11 17h.01M15 17h.01" />
      </>
    ),
    owner: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </>
    ),
    status: (
      <>
        <path d="M7 12a5 5 0 0 1 10 0" />
        <path d="M12 12l3 3" />
        <path d="M5 19h14" />
      </>
    ),
  }[type];

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths}
    </svg>
  );
}
