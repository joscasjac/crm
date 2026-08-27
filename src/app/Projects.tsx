import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
import { SavedViewsDropdown } from "../components/SavedViewButton";
import { SlideOver } from "../components/SlideOver";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DateInput,
  EmptyState,
  Input,
  Panel,
  Select,
} from "../components/ui";
import { downloadCsv, parseCsv } from "../lib/csv";
import {
  customFieldKanbanOption,
  customFieldSummaryType,
  isCustomFieldKanbanOption,
} from "../lib/customFields";
import { shortDate } from "../lib/format";
import { PROJECT_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import {
  PROJECT_STATUSES,
  dateInputValue,
  projectStatusLabel,
  statusClass,
  timestampFromDate,
} from "./workUtils";

type Project = FunctionReturnType<typeof api.projects.list>[number];
type ProjectStatus = (typeof PROJECT_STATUSES)[number];
type ProjectCreateDefaults = Partial<Project> & {
  customField?: {
    fieldId: Id<"fieldDefinitions">;
    value: string;
  };
};

export function Projects() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [status, setStatus] = useState<"all" | ProjectStatus>(() => {
    const value = params.get("status");
    return PROJECT_STATUSES.includes(value as ProjectStatus)
      ? (value as ProjectStatus)
      : "all";
  });
  const [showNew, setShowNew] = useState(false);
  const [newProjectDefaults, setNewProjectDefaults] =
    useState<ProjectCreateDefaults | null>(null);
  const [view, setView] = useState<ObjectViewType>(() => {
    const value = params.get("view");
    return value === "kanban" || value === "calendar" ? value : "table";
  });
  const [kanbanGroup, setKanbanGroup] = useState(
    () => params.get("group") ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const projects = useQuery(api.projects.list, {
    status,
    search: search || undefined,
  });
  const projectRows = projects ?? [];
  const table = useEntityTable(
    "project",
    PROJECT_COLUMNS,
    projectRows.map((project) => project._id),
  );
  const sticky = useStickyColumns(table.visible);
  const projectKanbanGroupOptions: Array<ObjectGroupOption> = [
    {
      value: "status",
      label: "Status",
      values: PROJECT_STATUSES.map((item) => ({
        value: item,
        label: projectStatusLabel[item],
      })),
    },
    { value: "owner", label: "Owner" },
    { value: "company", label: "Company" },
    { value: "contact", label: "Point of Contact" },
    { value: "deal", label: "Deal" },
    ...[...table.definitionByColumn.values()]
      .map(customFieldKanbanOption)
      .filter(isCustomFieldKanbanOption),
  ];
  const projectSummaryFields: Array<KanbanSummaryField<Project>> = [
    { key: "name", label: "Name", type: "field" },
    { key: "taskCount", label: "Tasks", type: "number" },
    { key: "openTaskCount", label: "Open tasks", type: "number" },
    { key: "doneTaskCount", label: "Completed tasks", type: "number" },
    { key: "status", label: "Status", type: "field" },
    { key: "owner", label: "Owner", type: "field" },
    { key: "startAt", label: "Start date", type: "date" },
    { key: "dueAt", label: "Due date", type: "date" },
    ...[...table.definitionByColumn.values()].map((definition) => ({
      key: `field:${definition.key}`,
      label: definition.label,
      type: customFieldSummaryType(definition.type),
      getValue: (project: Project) => table.fieldValue(definition, project._id),
    })),
  ];
  const currentParams = new URLSearchParams({
    ...(view === "kanban" ? { view: "kanban" } : {}),
    ...(view === "calendar" ? { view: "calendar" } : {}),
    ...(view === "kanban" && kanbanGroup ? { group: kanbanGroup } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(status !== "all" ? { status } : {}),
  }).toString();
  const currentHref = currentParams
    ? `/app/projects?${currentParams}`
    : "/app/projects";
  const hrefForViewType = (
    type: ObjectViewType,
    config?: { kanbanGroup?: string },
  ) => {
    const next = new URLSearchParams();
    if (type === "kanban") next.set("view", "kanban");
    if (type === "calendar") next.set("view", "calendar");
    if (type === "kanban" && config?.kanbanGroup) {
      next.set("group", config.kanbanGroup);
    }
    if (search.trim()) next.set("q", search.trim());
    if (status !== "all") next.set("status", status);
    const query = next.toString();
    return query ? `/app/projects?${query}` : "/app/projects";
  };

  const openSavedView = (href: string) => {
    const next = new URL(href, window.location.origin).searchParams;
    const nextView = next.get("view");
    setView(
      nextView === "kanban" || nextView === "calendar" ? nextView : "table",
    );
    setKanbanGroup(next.get("group") ?? "");
    setSearch(next.get("q") ?? "");
    const nextStatus = next.get("status");
    setStatus(
      PROJECT_STATUSES.includes(nextStatus as ProjectStatus)
        ? (nextStatus as ProjectStatus)
        : "all",
    );
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (view === "kanban") next.set("view", "kanban");
    if (view === "calendar") next.set("view", "calendar");
    if (view === "kanban" && kanbanGroup) next.set("group", kanbanGroup);
    if (search.trim()) next.set("q", search.trim());
    if (status !== "all") next.set("status", status);
    setParams(next, { replace: true });
  }, [kanbanGroup, search, setParams, status, view]);

  const visibleIds = projectRows.map((project) => project._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (!projects) return;
    const liveIds = new Set<string>(projectRows.map((project) => project._id));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [projectRows, projects]);

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

  const toggleProject = (id: Id<"projects">, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ObjectTableHeader
        icon={OBJECT_ICONS.project}
        title="Projects"
        selectedCount={selectedIds.size}
        primaryLabel="New Project"
        onPrimary={() => {
          setNewProjectDefaults(null);
          setShowNew(true);
        }}
        updateSlot={
          <ProjectBulkToolbar
            selectedIds={[...selectedIds] as Array<Id<"projects">>}
            onClear={() => setSelectedIds(new Set())}
          />
        }
        options={
          <ProjectOptionsPanel
            table={table}
            rows={projectRows}
            selectedIds={selectedIds}
          />
        }
      />

      <ViewBar
        label="All projects"
        count={projects?.length ?? 0}
        viewControl={
          <SavedViewsDropdown
            entity="project"
            currentName="Projects"
            count={projects?.length ?? 0}
            href={currentHref}
            defaultName={
              search || status !== "all" || view !== "table"
                ? "Filtered projects"
                : "All projects"
            }
            viewTypes={["table", "kanban", "calendar"]}
            currentType={view}
            onTypeChange={setView}
            hrefForType={hrefForViewType}
            onOpenView={openSavedView}
            kanbanGroupOptions={projectKanbanGroupOptions}
            currentKanbanGroup={kanbanGroup}
          />
        }
      >
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          ariaLabel="Project status filter"
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: "all", label: "All projects" },
            ...PROJECT_STATUSES.map((item) => ({
              value: item,
              label: projectStatusLabel[item],
            })),
          ]}
          className="w-full sm:w-44"
        />
      </ViewBar>

      <SlideOver
        open={showNew}
        title="New project"
        subtitle="Created now"
        onClose={() => setShowNew(false)}
        widthClass="max-w-[520px] sm:w-[500px]"
      >
        <ProjectForm
          initial={newProjectDefaults ?? undefined}
          onDone={() => setShowNew(false)}
          compact
        />
      </SlideOver>

      {view === "kanban" ? (
        kanbanGroup ? (
          <ProjectKanban
            projects={projects ?? []}
            groupBy={kanbanGroup}
            groupOptions={projectKanbanGroupOptions}
            summaryFields={projectSummaryFields}
            table={table}
            onCreate={(defaults) => {
              setNewProjectDefaults(defaults);
              setShowNew(true);
            }}
          />
        ) : (
          <MissingKanbanGroup
            options={projectKanbanGroupOptions}
            value={kanbanGroup}
            onChange={setKanbanGroup}
          />
        )
      ) : view === "calendar" ? (
        <ObjectCalendar
          items={projects ?? []}
          getDate={(project) => project.dueAt ?? project.startAt}
          renderItem={(project) => (
            <ProjectCalendarCard key={project._id} project={project} />
          )}
        />
      ) : (
        <ProjectTable
          projects={projects ?? []}
          table={table}
          sticky={sticky}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onToggleVisible={toggleVisible}
          onSelect={toggleProject}
        />
      )}
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

function projectExportValue(project: Project, key: string) {
  switch (key) {
    case "name":
      return project.name;
    case "status":
      return project.status;
    case "owner":
      return project.owner?.name;
    case "dueAt":
      return project.dueAt ? new Date(project.dueAt).toISOString() : "";
    case "company":
      return project.links.company?.name;
    case "deal":
      return project.links.deal?.name;
    default:
      return "";
  }
}

function ProjectOptionsPanel({
  table,
  rows,
  selectedIds,
}: {
  table: EntityTable;
  rows: Array<Project>;
  selectedIds: Set<string>;
}) {
  const importRows = useMutation(api.projects.importRows);
  const [message, setMessage] = useState<string | null>(null);

  const exportRows = (selectedOnly = false) => {
    const source = selectedOnly
      ? rows.filter((project) => selectedIds.has(project._id))
      : rows;
    downloadCsv(
      selectedOnly ? "selected-projects.csv" : "projects.csv",
      source.map((project) => {
        const row: Record<string, string | number | null | undefined> = {};
        for (const column of table.visible) {
          const definition = table.definitionByColumn.get(column.key);
          if (definition) {
            row[column.label] = table.fieldValue(definition, project._id);
            continue;
          }
          row[column.label] = projectExportValue(project, column.key);
        }
        return row;
      }),
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text()).map((row) => ({
      name: pickCsv(row, ["name", "Name", "project", "Project"]) ?? "",
      description: pickCsv(row, ["description", "Description"]),
      status: pickCsv(row, ["status", "Status"]),
      ownerEmail: pickCsv(row, ["ownerEmail", "Owner Email"]),
      companyName: pickCsv(row, ["company", "Company", "companyName", "Company Name"]),
      contactName: pickCsv(row, ["contact", "Contact", "contactName", "Contact Name"]),
      dealName: pickCsv(row, ["deal", "Deal", "dealName", "Deal Name"]),
      startAt: pickCsv(row, ["startAt", "Start", "Start At"]),
      dueAt: pickCsv(row, ["dueAt", "Due", "Due At"]),
    }));
    const result = await importRows({ rows: parsed });
    setMessage(
      `Imported ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    );
  };

  return (
    <div className="grid gap-4">
      <section>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Other
        </p>
        <label className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white">
          Import Projects
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
        <OptionRow>Search</OptionRow>
        <OptionRow>Go to Settings</OptionRow>
        <div className="my-2 h-px bg-edge" />
        <div className="flex items-center gap-2 px-2">
          <AddCustomFieldButton entity="project" menuAlign="left" />
          <ColumnsButton table={table} menuAlign="left" />
        </div>
        {message ? (
          <p className="mt-2 px-2 text-xs text-neutral-500">{message}</p>
        ) : null}
      </section>
    </div>
  );
}

function ProjectBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: Array<Id<"projects">>;
  onClear: () => void;
}) {
  const users = useQuery(api.users.list);
  const update = useMutation(api.projects.update);
  const remove = useMutation(api.projects.remove);
  const [status, setStatus] = useState<"UNCHANGED" | ProjectStatus>("UNCHANGED");
  const [ownerId, setOwnerId] = useState("UNCHANGED");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const apply = async () => {
    const updates: {
      status?: ProjectStatus;
      ownerId?: Id<"users">;
    } = {};
    if (status !== "UNCHANGED") updates.status = status;
    if (ownerId !== "UNCHANGED" && ownerId) {
      updates.ownerId = ownerId as Id<"users">;
    }
    if (Object.keys(updates).length === 0) return;
    await Promise.all(
      selectedIds.map((projectId) => update({ projectId, ...updates })),
    );
    setMessage(`Updated ${selectedIds.length} projects`);
    setStatus("UNCHANGED");
    setOwnerId("UNCHANGED");
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Move ${selectedIds.length} projects to trash?`)) return;
    await Promise.all(selectedIds.map((projectId) => remove({ projectId })));
    onClear();
    setMessage(`Moved ${selectedIds.length} projects to trash`);
  };

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)}>Update</Button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="grid gap-2">
            <Select
              ariaLabel="Bulk project status"
              value={status}
              onChange={(value) => setStatus(value as typeof status)}
              options={[
                { value: "UNCHANGED", label: "Status unchanged" },
                ...PROJECT_STATUSES.map((item) => ({
                  value: item,
                  label: projectStatusLabel[item],
                })),
              ]}
            />
            <Select
              ariaLabel="Bulk project owner"
              value={ownerId}
              onChange={setOwnerId}
              options={[
                { value: "UNCHANGED", label: "Owner unchanged" },
                ...(users?.map((user) => ({
                  value: user._id,
                  label: user.name,
                })) ?? []),
              ]}
            />
            <Button
              variant="primary"
              onClick={() => void apply().then(() => setOpen(false))}
            >
              Apply update
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-edge pt-3">
            <Button
              variant="danger"
              onClick={() => void deleteSelected().then(() => setOpen(false))}
            >
              Delete selected
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
                setOpen(false);
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

function ProjectTable({
  projects,
  table,
  sticky,
  selectedIds,
  allVisibleSelected,
  onToggleVisible,
  onSelect,
}: {
  projects: Array<Project>;
  table: EntityTable;
  sticky: StickyColumns;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  onToggleVisible: (checked: boolean) => void;
  onSelect: (id: Id<"projects">, checked: boolean) => void;
}) {
  const remove = useMutation(api.projects.remove);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Move ${project.name} to trash?`)) return;
    await remove({ projectId: project._id });
  };

  const renderCell = (project: Project, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={project._id}
          value={table.fieldValue(definition, project._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <>
            <Link
              to={`/app/projects/${project._id}`}
              className="font-medium text-white hover:text-accent"
            >
              {project.name}
            </Link>
            {project.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                {project.description}
              </p>
            ) : null}
          </>
        );
      case "status":
        return (
          <Badge className={statusClass(project.status)}>
            {projectStatusLabel[project.status]}
          </Badge>
        );
      case "owner":
        return project.owner ? (
          <span className="flex items-center gap-2 text-neutral-400">
            <Avatar
              name={project.owner.name}
              src={project.owner.avatarUrl}
              size={18}
            />
            {project.owner.name}
          </span>
        ) : (
          <span className="text-neutral-600">Unassigned</span>
        );
      case "dueAt":
        return (
          <span className="text-neutral-400">
            {project.dueAt ? shortDate(project.dueAt) : ""}
          </span>
        );
      case "company":
        return project.links.company ? (
          <Link
            to={`/app/companies/${project.links.company._id}`}
            className="text-neutral-400 hover:text-accent"
          >
            {project.links.company.name}
          </Link>
        ) : (
          <span className="text-neutral-600">None</span>
        );
      case "deal":
        return project.links.deal ? (
          <span className="text-neutral-400">{project.links.deal.name}</span>
        ) : (
          <span className="text-neutral-600">None</span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                <th className="w-10 px-4 py-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    ariaLabel="Select all visible projects"
                    onChange={onToggleVisible}
                  />
                </th>
                {table.visible.map((column) => (
                  <HeaderCell
                    key={column.key}
                    column={column}
                    table={table}
                    sticky={sticky}
                  />
                ))}
                <AddColumnHeaderCell table={table} />
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project._id}
                  className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(project._id)}
                      ariaLabel={`Select ${project.name}`}
                      onChange={(checked) => onSelect(project._id, checked)}
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
                        {renderCell(project, column)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-3" />
                  <td className="px-4 py-3 text-right">
                    <RecordActionMenu
                      onEdit={() => setEditingProject(project)}
                      onDelete={() => void deleteProject(project)}
                    />
                  </td>
                </tr>
              ))}
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={table.visible.length + 3} className="px-4 py-8">
                    <EmptyState message="No projects yet" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      <SlideOver
        open={Boolean(editingProject)}
        title={editingProject?.name ?? "Edit project"}
        subtitle="Project fields"
        onClose={() => setEditingProject(null)}
        widthClass="max-w-[520px] sm:w-[500px]"
      >
        {editingProject ? (
          <ProjectForm
            initial={editingProject}
            onDone={() => setEditingProject(null)}
            compact
          />
        ) : null}
      </SlideOver>
    </>
  );
}

function ProjectKanban({
  projects,
  groupBy,
  groupOptions,
  summaryFields,
  table,
  onCreate,
}: {
  projects: Array<Project>;
  groupBy: string;
  groupOptions: Array<ObjectGroupOption>;
  summaryFields: Array<KanbanSummaryField<Project>>;
  table: EntityTable;
  onCreate: (defaults: ProjectCreateDefaults | null) => void;
}) {
  const update = useMutation(api.projects.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const definition = table.definitionByColumn.get(groupBy);
  const moveProject = (project: Project, columnKey: string) => {
    const nextValue = columnKey === "Unspecified" ? "" : columnKey;
    if (definition) {
      void setFieldValue({
        fieldId: definition._id,
        entityId: project._id,
        value: nextValue,
      });
      return;
    }
    if (groupBy === "status" && nextValue) {
      void update({
        projectId: project._id,
        status: nextValue as ProjectStatus,
      });
      return;
    }
    if (!nextValue) return;
    const target = projects.find((item) => {
      const value = projectGroupValue(item, groupBy, table);
      return Array.isArray(value) ? value.includes(columnKey) : value === columnKey;
    });
    if (groupBy === "owner" && target?.ownerId) {
      void update({ projectId: project._id, ownerId: target.ownerId });
    }
    if (groupBy === "company" && target?.companyId) {
      void update({ projectId: project._id, companyId: target.companyId });
    }
    if (groupBy === "contact" && target?.contactId) {
      void update({ projectId: project._id, contactId: target.contactId });
    }
    if (groupBy === "deal" && target?.dealId) {
      void update({ projectId: project._id, dealId: target.dealId });
    }
  };

  return (
    <ObjectKanban<Project>
      columns={groupedKanbanColumns({
        items: projects,
        groupBy,
        options: groupOptions,
        getValue: (project, field) => projectGroupValue(project, field, table),
        renderItem: (project) => (
          <ProjectKanbanCard key={project._id} project={project} />
        ),
      }).map((column, index) => {
        const nextValue = column.key === "Unspecified" ? "" : column.key;
        const target = nextValue
          ? projects.find((item) => {
              const value = projectGroupValue(item, groupBy, table);
              return Array.isArray(value)
                ? value.includes(column.key)
                : value === column.key;
            })
          : undefined;
        const defaults: ProjectCreateDefaults | null = definition && nextValue
          ? { customField: { fieldId: definition._id, value: nextValue } }
          : groupBy === "status" && nextValue
            ? { status: nextValue as ProjectStatus }
            : groupBy === "owner" && target?.ownerId
              ? { ownerId: target.ownerId }
              : groupBy === "company" && target?.companyId
                ? { companyId: target.companyId }
                : groupBy === "contact" && target?.contactId
                  ? { contactId: target.contactId }
                  : groupBy === "deal" && target?.dealId
                    ? { dealId: target.dealId }
                    : null;
        return {
          ...column,
          tone:
            groupBy === "status"
              ? statusClass(column.key as ProjectStatus)
              : kanbanLaneTone(index),
          onAdd: () => onCreate(defaults),
        };
      })}
      getItemKey={(project) => project._id}
      summaryFields={summaryFields}
      onMove={moveProject}
    />
  );
}

function projectGroupValue(
  project: Project,
  groupBy: string,
  table: EntityTable,
) {
  const definition = table.definitionByColumn.get(groupBy);
  if (definition) {
    const value = table.fieldValue(definition, project._id);
    if (definition.type === "multiSelect" && typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  }
  if (groupBy === "status") return project.status;
  if (groupBy === "owner") return project.owner?.name;
  if (groupBy === "company") return project.links.company?.name;
  if (groupBy === "contact") return project.links.contact?.name;
  if (groupBy === "deal") return project.links.deal?.name;
  return undefined;
}

function ProjectKanbanCard({ project }: { project: Project }) {
  const progress =
    project.taskCount === 0
      ? 0
      : Math.round((project.doneTaskCount / project.taskCount) * 100);
  return (
    <article className="rounded-md border border-edge bg-panel p-3 shadow-sm transition-colors hover:border-edge-strong">
      <Link
        to={`/app/projects/${project._id}`}
        className="block truncate text-sm font-medium text-white hover:text-accent"
      >
        {project.name}
      </Link>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
          {project.description}
        </p>
      ) : null}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-edge">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{progress}%</span>
        <span>{project.openTaskCount} open</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {project.owner ? (
          <span className="flex min-w-0 items-center gap-1.5 text-neutral-400">
            <Avatar
              name={project.owner.name}
              src={project.owner.avatarUrl}
              size={18}
            />
            <span className="truncate">{project.owner.name}</span>
          </span>
        ) : null}
        {project.dueAt ? (
          <span className="rounded border border-edge px-2 py-1 text-neutral-400">
            Due {shortDate(project.dueAt)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function ProjectCalendarCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/app/projects/${project._id}`}
      className="block rounded-md border border-edge bg-panel px-2 py-1.5 text-xs shadow-sm transition-colors hover:border-edge-strong"
    >
      <span className="block truncate font-medium text-white">
        {project.name}
      </span>
      <span className="mt-1 block truncate text-neutral-500">
        {projectStatusLabel[project.status]}
      </span>
    </Link>
  );
}

export function ProjectForm({
  onDone,
  initial,
  compact = false,
}: {
  onDone: () => void;
  initial?: ProjectCreateDefaults;
  compact?: boolean;
}) {
  const create = useMutation(api.projects.create);
  const update = useMutation(api.projects.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const companies = useQuery(api.companies.names);
  const contacts = useQuery(api.contacts.names);
  const deals = useQuery(api.deals.names);
  const users = useQuery(api.users.list);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "active");
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? "");
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [contactId, setContactId] = useState(initial?.contactId ?? "");
  const [dealId, setDealId] = useState(initial?.dealId ?? "");
  const [startAt, setStartAt] = useState(dateInputValue(initial?.startAt));
  const [dueAt, setDueAt] = useState(dateInputValue(initial?.dueAt));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      description: description.trim() || undefined,
      status,
      ownerId: ownerId ? (ownerId as Id<"users">) : undefined,
      companyId: companyId ? (companyId as Id<"companies">) : undefined,
      contactId: contactId ? (contactId as Id<"contacts">) : undefined,
      dealId: dealId ? (dealId as Id<"deals">) : undefined,
      startAt: timestampFromDate(startAt),
      dueAt: timestampFromDate(dueAt),
    };
    if (initial?._id) {
      await update({ projectId: initial._id, ...payload });
    } else {
      const projectId = await create(payload);
      if (initial?.customField) {
        await setFieldValue({
          fieldId: initial.customField.fieldId,
          entityId: projectId,
          value: initial.customField.value,
        });
      }
    }
    onDone();
  };

  return (
    <Panel className={compact ? "border-0 bg-transparent p-4 shadow-none" : "mb-5 p-4"}>
      <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "lg:grid-cols-6"}`}>
        <div className={compact ? "" : "lg:col-span-3"}>
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onChange={(value) => setStatus(value as ProjectStatus)}
          options={PROJECT_STATUSES.map((item) => ({
            value: item,
            label: projectStatusLabel[item],
          }))}
        />
        <DateInput value={startAt} onChange={setStartAt} />
        <DateInput value={dueAt} onChange={setDueAt} />
        <textarea
          placeholder="Project brief"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`min-h-20 rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none ${compact ? "" : "lg:col-span-6"}`}
        />
        <Picker
          value={ownerId}
          onChange={setOwnerId}
          options={users}
          label="No owner"
        />
        <Picker
          value={companyId}
          onChange={setCompanyId}
          options={companies}
          label="No company"
        />
        <Picker
          value={contactId}
          onChange={setContactId}
          options={contacts}
          label="No contact"
        />
        <Picker value={dealId} onChange={setDealId} options={deals} label="No deal" />
        <div className={`flex justify-end gap-2 ${compact ? "" : "lg:col-span-2"}`}>
          <Button onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary">
            {initial?._id ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Picker<T extends { _id: string; name: string }>({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: Array<T>;
  label: string;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={[
        { value: "", label },
        ...(options ?? []).map((option) => ({
          value: option._id,
          label: option.name,
        })),
      ]}
    />
  );
}
