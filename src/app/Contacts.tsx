import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  Avatar,
  Button,
  Checkbox,
  Input,
  Panel,
  Select,
} from "../components/ui";
import { CONTACT_COLUMNS } from "../lib/columns";
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

type ContactRow = Doc<"contacts"> & {
  company: {
    _id: Id<"companies">;
    name: string;
    logoUrl?: string | null;
  } | null;
  owner: { name: string; avatarUrl?: string } | null;
};

type ContactCreateDefaults = {
  title?: string;
  companyId?: Id<"companies">;
  customField?: {
    fieldId: Id<"fieldDefinitions">;
    value: string;
  };
};

export function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [companyFilter, setCompanyFilter] = useState<"ALL" | "WITH" | "WITHOUT">(
    () => {
      const value = searchParams.get("company");
      return value === "WITH" || value === "WITHOUT" ? value : "ALL";
    },
  );
  const [showNew, setShowNew] = useState(false);
  const [newContactDefaults, setNewContactDefaults] =
    useState<ContactCreateDefaults | null>(null);
  const [editingId, setEditingId] = useState<Id<"contacts"> | null>(null);
  const [panelId, setPanelId] = useState<Id<"contacts"> | null>(null);
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
  const removeContact = useMutation(api.contacts.remove);
  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  const table = useEntityTable(
    "contact",
    CONTACT_COLUMNS,
    results.map((c) => c._id),
  );
  const sticky = useStickyColumns(table.visible);
  const currentParams = new URLSearchParams({
    ...(view !== "table" ? { view } : {}),
    ...(view === "kanban" && kanbanGroup ? { group: kanbanGroup } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(companyFilter !== "ALL" ? { company: companyFilter } : {}),
    ...(filters.length > 0 ? { f: encodeFilters(filters) } : {}),
  }).toString();
  const currentHref = currentParams
    ? `/app/contacts?${currentParams}`
    : "/app/contacts";

  useEffect(() => {
    const next = new URLSearchParams();
    if (view !== "table") next.set("view", view);
    if (view === "kanban" && kanbanGroup) next.set("group", kanbanGroup);
    if (search.trim()) next.set("q", search.trim());
    if (companyFilter !== "ALL") next.set("company", companyFilter);
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    setSearchParams(next, { replace: true });
  }, [companyFilter, filters, kanbanGroup, search, setSearchParams, view]);

  const contactKanbanGroupOptions: Array<ObjectGroupOption> = [
    { value: "company", label: "Company" },
    { value: "title", label: "Title" },
    { value: "owner", label: "Owner" },
    ...[...table.definitionByColumn.values()]
      .map(customFieldKanbanOption)
      .filter(isCustomFieldKanbanOption),
  ];
  const contactSummaryFields: Array<KanbanSummaryField<ContactRow>> = [
    { key: "name", label: "Name", type: "field" },
    { key: "title", label: "Title", type: "field" },
    { key: "email", label: "Email", type: "field" },
    { key: "company", label: "Company", type: "field" },
    { key: "lastActivityAt", label: "Last activity", type: "date" },
    ...[...table.definitionByColumn.values()].map((definition) => ({
      key: `field:${definition.key}`,
      label: definition.label,
      type: customFieldSummaryType(definition.type),
      getValue: (contact: ContactRow) => table.fieldValue(definition, contact._id),
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
    if (companyFilter !== "ALL") next.set("company", companyFilter);
    if (filters.length > 0) next.set("f", encodeFilters(filters));
    const query = next.toString();
    return query ? `/app/contacts?${query}` : "/app/contacts";
  };

  const openSavedView = (href: string) => {
    const next = new URL(href, window.location.origin).searchParams;
    const nextView = next.get("view");
    setView(
      nextView === "kanban" || nextView === "calendar" ? nextView : "table",
    );
    setKanbanGroup(next.get("group") ?? "");
    setSearch(next.get("q") ?? "");
    const nextCompany = next.get("company");
    setCompanyFilter(
      nextCompany === "WITH" || nextCompany === "WITHOUT" ? nextCompany : "ALL",
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

  const deleteContact = async (contact: ContactRow) => {
    if (!window.confirm(`Move ${contact.name} to trash?`)) return;
    await removeContact({ contactId: contact._id });
  };

  const filteredByPreset = results.filter((contact) => {
    if (companyFilter === "WITH") return contact.company !== null;
    if (companyFilter === "WITHOUT") return contact.company === null;
    return true;
  });
  const filtered = applyTableFilters(filteredByPreset, filters, (contact, key) => {
    const definition = table.definitionByColumn.get(key);
    if (definition) return table.fieldValue(definition, contact._id);
    if (key === "company") return contact.company?.name ?? "";
    if (key === "lastActivityAt") return contact.lastActivityAt ?? "";
    return String(contact[key as keyof ContactRow] ?? "");
  });

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
    if (sortKey === "lastActivityAt") {
      return ((a.lastActivityAt ?? 0) - (b.lastActivityAt ?? 0)) * dir;
    }
    const pick = (contact: ContactRow) => {
      if (sortKey === "company") return contact.company?.name ?? "";
      if (sortKey === "title") return contact.title ?? "";
      if (sortKey === "email") return contact.email ?? "";
      return contact.name;
    };
    return pick(a).localeCompare(pick(b)) * dir;
  });
  const visibleIds = sorted.map((contact) => contact._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const liveIds = new Set<string>(results.map((contact) => contact._id));
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

  const toggleRow = (id: Id<"contacts">, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const renderCell = (
    contact: ContactRow,
    column: ResolvedColumn,
  ) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={contact._id}
          value={table.fieldValue(definition, contact._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <button
            type="button"
            onClick={() => setPanelId(contact._id)}
            className="flex items-center gap-2 text-white hover:text-accent"
          >
            <Avatar name={contact.name} src={contact.avatarUrl} />
            {contact.name}
          </button>
        );
      case "title":
        return <span className="text-neutral-400">{contact.title ?? ""}</span>;
      case "email":
        return <span className="text-neutral-400">{contact.email ?? ""}</span>;
      case "company":
        return (
          <span className="text-neutral-400">
            {contact.company?.name ?? ""}
          </span>
        );
      case "lastActivityAt":
        return (
          <span className="text-neutral-500">
            {contact.lastActivityAt ? timeAgo(contact.lastActivityAt) : ""}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ObjectTableHeader
        icon={OBJECT_ICONS.contact}
        title="Contacts"
        selectedCount={selectedIds.size}
        primaryLabel="New Contact"
        onPrimary={() => {
          setNewContactDefaults(null);
          setShowNew(true);
        }}
        updateSlot={
          <ContactBulkToolbar
            selectedIds={[...selectedIds] as Array<Id<"contacts">>}
            onClear={() => setSelectedIds(new Set())}
          />
        }
        options={
          <ContactOptionsPanel
            table={table}
            rows={sorted}
            selectedIds={selectedIds}
          />
        }
      />
      <ViewBar
        label="All Contacts"
        count={sorted.length}
        viewControl={
          <SavedViewsDropdown
            entity="contact"
            currentName="All Contacts"
            count={sorted.length}
            href={currentHref}
            defaultName={
              search || companyFilter !== "ALL"
                ? "Filtered contacts"
                : "All contacts"
            }
            viewTypes={["table", "kanban", "calendar"]}
            currentType={view}
            onTypeChange={setView}
            hrefForType={hrefForViewType}
            onOpenView={openSavedView}
            kanbanGroupOptions={contactKanbanGroupOptions}
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
          ariaLabel="Company filter"
          size="sm"
          value={companyFilter}
          onChange={(value) =>
            setCompanyFilter(value as "ALL" | "WITH" | "WITHOUT")
          }
          options={[
            { value: "ALL", label: "Company" },
            { value: "WITH", label: "With company" },
            { value: "WITHOUT", label: "No company" },
          ]}
          className="w-32"
        />
      </ViewBar>
      <div className="mb-4 md:hidden">
        <Input
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <SlideOver
        open={showNew}
        title="New contact"
        subtitle="Created now"
        icon={
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
            {OBJECT_ICONS.contact}
          </span>
        }
        onClose={() => setShowNew(false)}
        widthClass="max-w-[460px] sm:w-[420px]"
      >
        <NewContactForm
          defaults={newContactDefaults ?? undefined}
          onDone={() => setShowNew(false)}
        />
      </SlideOver>
      {view === "table" ? (
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                <th className="w-10 px-4 py-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    ariaLabel="Select all visible contacts"
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
              {sorted.map((contact) =>
                editingId === contact._id ? (
                  <EditableContactRow
                    key={contact._id}
                    contact={contact}
                    columns={table.visible}
                    sticky={sticky}
                    selected={selectedIds.has(contact._id)}
                    onSelect={(checked) => toggleRow(contact._id, checked)}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={contact._id}
                    onClick={(event) => {
                      if (!isInteractiveClick(event)) setPanelId(contact._id);
                    }}
                    className="cursor-pointer border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(contact._id)}
                        ariaLabel={`Select ${contact.name}`}
                        onChange={(checked) => toggleRow(contact._id, checked)}
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
                          {renderCell(contact, column)}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3" />
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <RecordActionMenu
                        onOpenPanel={() => setPanelId(contact._id)}
                        onEdit={() => setEditingId(contact._id)}
                        onDelete={() => void deleteContact(contact)}
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
          <ContactKanban
            contacts={sorted}
            groupBy={kanbanGroup}
            groupOptions={contactKanbanGroupOptions}
            summaryFields={contactSummaryFields}
            table={table}
            selectedIds={selectedIds}
            onSelect={toggleRow}
            onOpen={setPanelId}
            onCreate={(defaults) => {
              setNewContactDefaults(defaults);
              setShowNew(true);
            }}
          />
        ) : (
          <MissingKanbanGroup
            options={contactKanbanGroupOptions}
            value={kanbanGroup}
            onChange={setKanbanGroup}
          />
        )
      ) : (
        <ObjectCalendar
          items={sorted}
          getDate={(contact) => contact.lastActivityAt ?? contact._creationTime}
          renderItem={(contact) => (
            <ContactMiniCard
              key={contact._id}
              contact={contact}
              onOpen={() => setPanelId(contact._id)}
            />
          )}
        />
      )}
      <RecordSidePanel
        record={panelId ? { type: "contact", id: panelId } : null}
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

function ContactOptionsPanel({
  table,
  rows,
  selectedIds,
}: {
  table: EntityTable;
  rows: Array<ContactRow>;
  selectedIds: Set<string>;
}) {
  const importRows = useMutation(api.contacts.importRows);
  const [message, setMessage] = useState<string | null>(null);

  const exportRows = (selectedOnly = false) => {
    const source = selectedOnly
      ? rows.filter((contact) => selectedIds.has(contact._id))
      : rows;
    downloadCsv(
      selectedOnly ? "selected-contacts.csv" : "contacts.csv",
      source.map((contact) => {
        const row: Record<string, string | number | null | undefined> = {
          name: contact.name,
          email: contact.email,
          title: contact.title,
          companyName: contact.company?.name,
          lastActivityAt: contact.lastActivityAt
            ? new Date(contact.lastActivityAt).toISOString()
            : "",
        };
        for (const column of table.visible) {
          const definition = table.definitionByColumn.get(column.key);
          if (definition) {
            row[column.label] = table.fieldValue(definition, contact._id);
          }
        }
        return row;
      }),
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text()).map((row) => ({
      name: pickCsv(row, ["name", "Name", "contact", "Contact"]) ?? "",
      email: pickCsv(row, ["email", "Email"]),
      title: pickCsv(row, ["title", "Title", "role", "Role"]),
      companyName: pickCsv(row, ["companyName", "Company Name", "company", "Company"]),
      companyDomain: pickCsv(row, [
        "companyDomain",
        "Company Domain",
        "domain",
        "Domain",
      ]),
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
        Import Contacts
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
        <AddCustomFieldButton entity="contact" menuAlign="left" />
        <ColumnsButton table={table} menuAlign="left" />
      </div>
      {message ? <p className="px-2 text-xs text-neutral-500">{message}</p> : null}
    </div>
  );
}

function ContactBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: Array<Id<"contacts">>;
  onClear: () => void;
}) {
  const companies = useQuery(api.companies.names);
  const bulkUpdate = useMutation(api.contacts.bulkUpdate);
  const bulkRemove = useMutation(api.contacts.bulkRemove);
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("UNCHANGED");
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const applyBulkUpdate = async () => {
    const updates: {
      title?: string | null;
      companyId?: Id<"companies"> | null;
    } = {};
    if (title.trim()) updates.title = title.trim();
    if (companyId !== "UNCHANGED") {
      updates.companyId = companyId ? (companyId as Id<"companies">) : null;
    }
    if (Object.keys(updates).length === 0 || selectedIds.length === 0) return;
    const count = await bulkUpdate({ contactIds: selectedIds, updates });
    setMessage(`Updated ${count} contacts`);
    setTitle("");
    setCompanyId("UNCHANGED");
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Move ${selectedIds.length} contacts to trash?`)) return;
    const count = await bulkRemove({ contactIds: selectedIds });
    onClear();
    setMessage(`Moved ${count} contacts to trash`);
  };

  return (
    <div className="relative">
      <Button onClick={() => setShowUpdate((value) => !value)}>Update</Button>
      {showUpdate ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="grid gap-2">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Set title"
              className="py-1.5"
            />
            <Select
              ariaLabel="Bulk company"
              value={companyId}
              onChange={setCompanyId}
              options={[
                { value: "UNCHANGED", label: "Company unchanged" },
                { value: "", label: "Clear company" },
                ...(companies?.map((company) => ({
                  value: company._id,
                  label: company.name,
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

function ContactKanban({
  contacts,
  groupBy,
  groupOptions,
  summaryFields,
  table,
  selectedIds,
  onSelect,
  onOpen,
  onCreate,
}: {
  contacts: Array<ContactRow>;
  groupBy: string;
  groupOptions: Array<ObjectGroupOption>;
  summaryFields: Array<KanbanSummaryField<ContactRow>>;
  table: EntityTable;
  selectedIds: Set<string>;
  onSelect: (id: Id<"contacts">, checked: boolean) => void;
  onOpen: (id: Id<"contacts">) => void;
  onCreate: (defaults: ContactCreateDefaults | null) => void;
}) {
  const updateContact = useMutation(api.contacts.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const definition = table.definitionByColumn.get(groupBy);
  const moveContact = (contact: ContactRow, columnKey: string) => {
    const nextValue = columnKey === "Unspecified" ? "" : columnKey;
    if (definition) {
      void setFieldValue({
        fieldId: definition._id,
        entityId: contact._id,
        value: nextValue,
      });
      return;
    }
    if (groupBy === "title") {
      void updateContact({
        contactId: contact._id,
        title: nextValue ? nextValue : null,
      });
      return;
    }
    const target = contacts.find((item) => {
      const value = contactGroupValue(item, groupBy, table);
      return Array.isArray(value) ? value.includes(columnKey) : value === columnKey;
    });
    if (groupBy === "company") {
      void updateContact({
        contactId: contact._id,
        companyId: nextValue
          ? target?.companyId ?? target?.company?._id
          : null,
      });
      return;
    }
    if (groupBy === "owner") {
      void updateContact({
        contactId: contact._id,
        ownerId: nextValue ? target?.ownerId ?? null : null,
      });
    }
  };

  return (
    <ObjectKanban<ContactRow>
      columns={groupedKanbanColumns({
        items: contacts,
        groupBy,
        options: groupOptions,
        getValue: (contact, field) => contactGroupValue(contact, field, table),
        renderItem: (contact) => (
          <ContactMiniCard
            key={contact._id}
            contact={contact}
            selected={selectedIds.has(contact._id)}
            onSelect={(checked) => onSelect(contact._id, checked)}
            onOpen={() => onOpen(contact._id)}
          />
        ),
      }).map((column, index) => {
        const nextValue = column.key === "Unspecified" ? "" : column.key;
        const target = nextValue
          ? contacts.find((item) => {
              const value = contactGroupValue(item, groupBy, table);
              return Array.isArray(value)
                ? value.includes(column.key)
                : value === column.key;
            })
          : undefined;
        const defaults: ContactCreateDefaults | null = definition && nextValue
          ? { customField: { fieldId: definition._id, value: nextValue } }
          : groupBy === "title"
            ? nextValue
              ? { title: nextValue }
              : null
            : groupBy === "company" && target?.companyId
              ? { companyId: target.companyId }
              : null;
        return {
          ...column,
          tone: kanbanLaneTone(index),
          onAdd: () => onCreate(defaults),
        };
      })}
      getItemKey={(contact) => contact._id}
      summaryFields={summaryFields}
      onMove={moveContact}
    />
  );
}

function contactGroupValue(
  contact: ContactRow,
  groupBy: string,
  table: EntityTable,
) {
  const definition = table.definitionByColumn.get(groupBy);
  if (definition) {
    const value = table.fieldValue(definition, contact._id);
    if (definition.type === "multiSelect" && typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  }
  if (groupBy === "company") return contact.company?.name;
  if (groupBy === "title") return contact.title;
  if (groupBy === "owner") return contact.owner?.name;
  return undefined;
}

function ContactMiniCard({
  contact,
  selected,
  onSelect,
  onOpen,
}: {
  contact: ContactRow;
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
          <Avatar name={contact.name} src={contact.avatarUrl} size={18} />
          <span className="truncate">{contact.name}</span>
        </button>
        {onSelect ? (
          <Checkbox
            checked={Boolean(selected)}
            ariaLabel={`Select ${contact.name}`}
            onChange={onSelect}
          />
        ) : null}
      </div>
      {contact.title ? (
        <span className="mt-2 block truncate text-xs text-neutral-500">
          {contact.title}
        </span>
      ) : null}
      {contact.company ? (
        <span className="mt-3 block truncate text-xs text-neutral-400">
          {contact.company.name}
        </span>
      ) : null}
    </article>
  );
}

function EditableContactRow({
  contact,
  columns,
  sticky,
  selected,
  onSelect,
  onDone,
}: {
  contact: ContactRow;
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onDone: () => void;
}) {
  const update = useMutation(api.contacts.update);
  const remove = useMutation(api.contacts.remove);
  const companies = useQuery(api.companies.names);
  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [companyId, setCompanyId] = useState(contact.companyId ?? "");
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
        contactId: contact._id,
        name: trimmedName,
        title: title.trim() || null,
        email: email.trim() || null,
        companyId: companyId ? (companyId as Id<"companies">) : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const deleteContact = async () => {
    if (!window.confirm(`Move ${contact.name} to trash?`)) return;
    try {
      setError(null);
      await remove({ contactId: contact._id });
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
          ariaLabel={`Select ${contact.name}`}
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
        } else if (column.key === "title") {
          content = (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void save()}
              placeholder="Title"
              className="w-full rounded-md border border-edge bg-ink px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
            />
          );
        } else if (column.key === "email") {
          content = (
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void save()}
              placeholder="Email"
              className="w-full rounded-md border border-edge bg-ink px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
            />
          );
        } else if (column.key === "company") {
          content = (
            <Select
              size="sm"
              ariaLabel="Company"
              value={companyId}
              onChange={setCompanyId}
              options={[
                { value: "", label: "No company" },
                ...(companies?.map((company) => ({
                  value: company._id,
                  label: company.name,
                })) ?? []),
              ]}
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
          <Button variant="danger" onClick={() => void deleteContact()}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Composer row at the bottom of the table: name, optional email, optional
// company. Enter creates through the same mutation the rest of the app uses.
// Cells align to whatever columns are visible right now.
function InlineAddRow({
  columns,
  sticky,
}: {
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
}) {
  const create = useMutation(api.contacts.create);
  const companies = useQuery(api.companies.names);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setError(null);
      await create({
        name: name.trim(),
        email: email.trim() || undefined,
        title: title.trim() || undefined,
        companyId: companyId ? (companyId as Id<"companies">) : undefined,
      });
      setName("");
      setTitle("");
      setEmail("");
      setCompanyId("");
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
                  placeholder="+ Add contact"
                  className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                />
                {columns.length === 1 ? addButton : null}
              </div>
              {error ? (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              ) : null}
            </>
          );
        } else if (column.key === "email") {
          content = (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="email (optional)"
              className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
            />
          );
        } else if (column.key === "title") {
          content = (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="title (optional)"
              className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
            />
          );
        } else if (column.key === "company") {
          content = (
            <Select
              size="sm"
              ariaLabel="Company"
              value={companyId}
              onChange={setCompanyId}
              options={[
                { value: "", label: "company (optional)" },
                ...(companies?.map((company) => ({
                  value: company._id,
                  label: company.name,
                })) ?? []),
              ]}
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
      <td className="px-4 py-2 text-right">{addButton}</td>
    </tr>
  );
}

function NewContactForm({
  defaults,
  onDone,
}: {
  defaults?: ContactCreateDefaults;
  onDone: () => void;
}) {
  const create = useMutation(api.contacts.create);
  const setFieldValue = useMutation(api.fields.setValue);
  const companies = useQuery(api.companies.names);
  const [name, setName] = useState("");
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState(defaults?.companyId ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setError(null);
      const contactId = await create({
        name: trimmed,
        email: email.trim() || undefined,
        title: title.trim() || undefined,
        companyId: companyId ? (companyId as Id<"companies">) : undefined,
      });
      if (defaults?.customField) {
        await setFieldValue({
          fieldId: defaults.customField.fieldId,
          entityId: contactId,
          value: defaults.customField.value,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 p-4">
      <Input
        placeholder="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Select
        ariaLabel="Company"
        value={companyId}
        onChange={setCompanyId}
        options={[
          { value: "", label: "No company" },
          ...(companies?.map((company) => ({
            value: company._id,
            label: company.name,
          })) ?? []),
        ]}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Create
        </Button>
      </div>
    </form>
  );
}
