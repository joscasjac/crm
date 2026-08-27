import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CustomFieldsEditor } from "../components/CustomFieldsEditor";
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
import { FavoriteButton } from "../components/FavoriteButton";
import {
  OBJECT_ICONS,
  ObjectTableHeader,
  OptionRow,
  ViewBar,
} from "../components/ObjectTableChrome";
import {
  MissingKanbanGroup,
  ObjectKanban,
  type KanbanSummaryField,
  type ObjectGroupOption,
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
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { downloadCsv, parseCsv } from "../lib/csv";
import { TASK_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import {
  customFieldKanbanOption,
  customFieldSummaryType,
  isCustomFieldKanbanOption,
} from "../lib/customFields";
import { shortDate, timeAgo } from "../lib/format";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  dateInputValue,
  priorityClass,
  priorityLabel,
  statusClass,
  taskStatusLabel,
  timestampFromDate,
} from "./workUtils";

type Task = FunctionReturnType<typeof api.tasks.list>[number];
type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.get>>;
type TaskStatus = (typeof TASK_STATUSES)[number];
type TaskPriority = (typeof TASK_PRIORITIES)[number];
type CalendarMode = "day" | "week" | "month";

export function Tasks() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"list" | "board" | "calendar">(() => {
    const requestedView = params.get("view");
    return requestedView === "board" || requestedView === "calendar"
      ? requestedView
      : "list";
  });
  const [status, setStatus] = useState<"open" | "all" | TaskStatus>(() => {
    const value = params.get("status");
    return value === "all" || TASK_STATUSES.includes(value as TaskStatus)
      ? (value as "all" | TaskStatus)
      : "open";
  });
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [kanbanGroup, setKanbanGroup] = useState(
    () => params.get("group") ?? "",
  );
  const [showNew, setShowNew] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{
    status?: TaskStatus;
    priority?: TaskPriority;
  } | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    const value = params.get("calendar");
    return value === "day" || value === "week" ? value : "month";
  });
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"projectTasks"> | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const move = useMutation(api.tasks.move);
  const updateTask = useMutation(api.tasks.update);
  const setFieldValue = useMutation(api.fields.setValue);
  const tasks = useQuery(api.tasks.list, {
    status,
    search: search || undefined,
  });
  const taskRows = tasks ?? [];
  const table = useEntityTable(
    "task",
    TASK_COLUMNS,
    taskRows.map((task) => task._id),
  );
  const sticky = useStickyColumns(table.visible);
  const calendarWindow = useMemo(
    () => calendarRange(new Date(), calendarMode),
    [calendarMode],
  );
  const calendarTasks = useQuery(api.tasks.calendar, calendarWindow);
  const taskKanbanGroupOptions: Array<ObjectGroupOption> = [
    {
      value: "status",
      label: "Status",
      values: TASK_STATUSES.map((item) => ({
        value: item,
        label: taskStatusLabel[item],
      })),
    },
    {
      value: "priority",
      label: "Priority",
      values: TASK_PRIORITIES.map((item) => ({
        value: item,
        label: priorityLabel[item],
      })),
    },
    { value: "assignee", label: "Assignee" },
    { value: "project", label: "Project" },
    { value: "company", label: "Company" },
    { value: "contact", label: "Contact" },
    { value: "deal", label: "Deal" },
    ...[...table.definitionByColumn.values()]
      .map(customFieldKanbanOption)
      .filter(isCustomFieldKanbanOption),
  ];
  const taskSummaryFields: Array<KanbanSummaryField<Task>> = [
    { key: "title", label: "Name", type: "field" },
    { key: "status", label: "Status", type: "field" },
    { key: "priority", label: "Priority", type: "field" },
    { key: "assignee", label: "Owner", type: "field" },
    { key: "subtaskCount", label: "Subtasks", type: "number" },
    { key: "openSubtaskCount", label: "Open subtasks", type: "number" },
    { key: "commentCount", label: "Comments", type: "number" },
    { key: "dueAt", label: "Due date", type: "date" },
    ...[...table.definitionByColumn.values()].map((definition) => ({
      key: `field:${definition.key}`,
      label: definition.label,
      type: customFieldSummaryType(definition.type),
      getValue: (task: Task) => table.fieldValue(definition, task._id),
    })),
  ];
  const currentParams = new URLSearchParams({
    ...(view !== "list" ? { view } : {}),
    ...(view === "board" && kanbanGroup ? { group: kanbanGroup } : {}),
    ...(status !== "open" ? { status } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(view === "calendar" && calendarMode !== "month"
      ? { calendar: calendarMode }
      : {}),
  }).toString();
  const currentHref = currentParams ? `/app/tasks?${currentParams}` : "/app/tasks";
  const hrefForViewType = (
    type: "table" | "kanban" | "calendar",
    config?: { kanbanGroup?: string },
  ) => {
    const next = new URLSearchParams();
    if (type === "kanban") next.set("view", "board");
    if (type === "calendar") next.set("view", "calendar");
    if (type === "kanban" && config?.kanbanGroup) {
      next.set("group", config.kanbanGroup);
    }
    if (status !== "open") next.set("status", status);
    if (search.trim()) next.set("q", search.trim());
    if (type === "calendar" && calendarMode !== "month") {
      next.set("calendar", calendarMode);
    }
    const query = next.toString();
    return query ? `/app/tasks?${query}` : "/app/tasks";
  };

  const openSavedView = (href: string) => {
    const next = new URL(href, window.location.origin).searchParams;
    const nextView = next.get("view");
    setView(
      nextView === "board" || nextView === "kanban"
        ? "board"
        : nextView === "calendar"
          ? "calendar"
          : "list",
    );
    setKanbanGroup(next.get("group") ?? "");
    setSearch(next.get("q") ?? "");
    const nextStatus = next.get("status");
    setStatus(
      nextStatus === "all" || TASK_STATUSES.includes(nextStatus as TaskStatus)
        ? (nextStatus as "all" | TaskStatus)
        : "open",
    );
    const nextCalendar = next.get("calendar");
    setCalendarMode(
      nextCalendar === "day" || nextCalendar === "week"
        ? nextCalendar
        : "month",
    );
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (view !== "list") next.set("view", view);
    if (view === "board" && kanbanGroup) next.set("group", kanbanGroup);
    if (status !== "open") next.set("status", status);
    if (search.trim()) next.set("q", search.trim());
    if (view === "calendar" && calendarMode !== "month") {
      next.set("calendar", calendarMode);
    }
    setParams(next, { replace: true });
  }, [calendarMode, kanbanGroup, search, setParams, status, view]);

  const moveTaskToGroup = (task: Task, columnKey: string) => {
    const nextValue = columnKey === "Unspecified" ? "" : columnKey;
    const definition = table.definitionByColumn.get(kanbanGroup);
    if (definition) {
      void setFieldValue({
        fieldId: definition._id,
        entityId: task._id,
        value: nextValue,
      });
      return;
    }
    if (kanbanGroup === "status" && nextValue) {
      void move({ taskId: task._id, status: nextValue as TaskStatus });
      return;
    }
    if (kanbanGroup === "priority" && nextValue) {
      void updateTask({
        taskId: task._id,
        priority: nextValue as TaskPriority,
      });
      return;
    }
    const target = taskRows.find((item) => {
      const value = taskGroupValue(item, kanbanGroup, table);
      return Array.isArray(value) ? value.includes(columnKey) : value === columnKey;
    });
    if (kanbanGroup === "assignee") {
      const assignee = target?.assignees.find((item) => item.name === columnKey);
      void updateTask({
        taskId: task._id,
        assigneeIds: nextValue && assignee ? [assignee._id] : [],
      });
      return;
    }
    if (!nextValue) return;
    if (kanbanGroup === "project" && target?.projectId) {
      void updateTask({ taskId: task._id, projectId: target.projectId });
    }
    if (kanbanGroup === "company" && target?.companyId) {
      void updateTask({ taskId: task._id, companyId: target.companyId });
    }
    if (kanbanGroup === "contact" && target?.contactId) {
      void updateTask({ taskId: task._id, contactId: target.contactId });
    }
    if (kanbanGroup === "deal" && target?.dealId) {
      void updateTask({ taskId: task._id, dealId: target.dealId });
    }
  };

  const visibleIds = taskRows.map((task) => task._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (!tasks) return;
    const liveIds = new Set<string>(taskRows.map((task) => task._id));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [taskRows, tasks]);

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

  const toggleTask = (id: Id<"projectTasks">, checked: boolean) => {
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
        icon={OBJECT_ICONS.task}
        title="Tasks"
        selectedCount={selectedIds.size}
        primaryLabel="New Task"
        onPrimary={() => {
          setNewTaskDefaults(null);
          setShowNew(true);
        }}
        updateSlot={
          <TaskBulkToolbar
            selectedIds={[...selectedIds] as Array<Id<"projectTasks">>}
            onClear={() => setSelectedIds(new Set())}
          />
        }
        options={
          <TaskOptionsPanel
            table={table}
            rows={taskRows}
            selectedIds={selectedIds}
          />
        }
      />

      <ViewBar
        label="Tasks"
        count={tasks?.length ?? 0}
        viewControl={
          <SavedViewsDropdown
            entity="task"
            currentName="Tasks"
            count={tasks?.length ?? 0}
            href={currentHref}
            defaultName={
              search
                ? "Filtered tasks"
                : status === "open"
                  ? "Open tasks"
                  : status === "all"
                    ? "All tasks"
                    : taskStatusLabel[status]
            }
            viewTypes={["table", "kanban", "calendar"]}
            currentType={
              view === "board" ? "kanban" : view === "calendar" ? "calendar" : "table"
            }
            onTypeChange={(type) => {
              setView(
                type === "kanban"
                  ? "board"
                  : type === "calendar"
                    ? "calendar"
                    : "list",
              );
            }}
            hrefForType={hrefForViewType}
            onOpenView={openSavedView}
            kanbanGroupOptions={taskKanbanGroupOptions}
            currentKanbanGroup={kanbanGroup}
          />
        }
      >
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          ariaLabel="Task status filter"
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: "open", label: "Open tasks" },
            { value: "all", label: "All tasks" },
            ...TASK_STATUSES.map((item) => ({
              value: item,
              label: taskStatusLabel[item],
            })),
          ]}
          className="w-full sm:w-44"
        />
        {view === "calendar" ? (
          <div className="flex rounded-md border border-edge p-0.5 text-xs">
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalendarMode(mode)}
                className={`rounded px-2.5 py-1 capitalize transition-colors ${
                  calendarMode === mode
                    ? "bg-raised text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        ) : null}
      </ViewBar>

      <SlideOver
        open={showNew}
        title="New task"
        subtitle="Created now"
        onClose={() => setShowNew(false)}
        widthClass="max-w-[520px] sm:w-[500px]"
      >
        <TaskForm
          onDone={() => setShowNew(false)}
          defaults={newTaskDefaults ?? undefined}
          compact
        />
      </SlideOver>

      <div className="mt-5">
        {view === "list" ? (
          <TaskList
            tasks={tasks}
            table={table}
            sticky={sticky}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            onToggleVisible={toggleVisible}
            onSelectRow={toggleTask}
            onSelect={setSelectedTaskId}
          />
        ) : view === "board" ? (
          kanbanGroup ? (
            <ObjectKanban<Task>
              columns={groupedKanbanColumns({
                items: tasks ?? [],
                groupBy: kanbanGroup,
                options: taskKanbanGroupOptions,
                getValue: (task, field) => taskGroupValue(task, field, table),
                renderItem: (task) => (
                  <TaskKanbanCard
                    key={task._id}
                    task={task}
                    selected={selectedIds.has(task._id)}
                    onSelect={setSelectedTaskId}
                    onToggleSelect={(checked) => toggleTask(task._id, checked)}
                  />
                ),
              }).map((column, index) => ({
                ...column,
                tone:
                  kanbanGroup === "status"
                    ? statusClass(column.key as TaskStatus)
                    : kanbanGroup === "priority"
                      ? priorityClass(column.key as TaskPriority)
                      : kanbanLaneTone(index),
                onAdd:
                  kanbanGroup === "status" && TASK_STATUSES.includes(column.key as TaskStatus)
                    ? () => {
                        setNewTaskDefaults({ status: column.key as TaskStatus });
                        setShowNew(true);
                      }
                    : kanbanGroup === "priority" && TASK_PRIORITIES.includes(column.key as TaskPriority)
                      ? () => {
                          setNewTaskDefaults({ priority: column.key as TaskPriority });
                          setShowNew(true);
                        }
                      : undefined,
              }))}
              getItemKey={(task) => task._id}
              summaryFields={taskSummaryFields}
              onMove={moveTaskToGroup}
            />
          ) : (
            <MissingKanbanGroup
              options={taskKanbanGroupOptions}
              value={kanbanGroup}
              onChange={setKanbanGroup}
            />
          )
        ) : (
          <TaskCalendar
            mode={calendarMode}
            tasks={calendarTasks}
            onSelect={setSelectedTaskId}
          />
        )}
      </div>
      <TaskSidePanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onOpenTask={setSelectedTaskId}
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

function taskExportValue(task: Task, key: string) {
  switch (key) {
    case "title":
      return task.title;
    case "status":
      return task.status;
    case "priority":
      return task.priority;
    case "assignee":
      return task.assignees.map((assignee) => assignee.email).join("; ");
    case "dueAt":
      return task.dueAt ? new Date(task.dueAt).toISOString() : "";
    case "project":
      return task.project?.name;
    case "links":
      return [
        task.links.company?.name,
        task.links.contact?.name,
        task.links.deal?.name,
      ].filter(Boolean).join("; ");
    default:
      return "";
  }
}

function TaskOptionsPanel({
  table,
  rows,
  selectedIds,
}: {
  table: EntityTable;
  rows: Array<Task>;
  selectedIds: Set<string>;
}) {
  const importRows = useMutation(api.tasks.importRows);
  const [message, setMessage] = useState<string | null>(null);

  const exportRows = (selectedOnly = false) => {
    const source = selectedOnly
      ? rows.filter((task) => selectedIds.has(task._id))
      : rows;
    downloadCsv(
      selectedOnly ? "selected-tasks.csv" : "tasks.csv",
      source.map((task) => {
        const row: Record<string, string | number | null | undefined> = {};
        for (const column of table.visible) {
          const definition = table.definitionByColumn.get(column.key);
          if (definition) {
            row[column.label] = table.fieldValue(definition, task._id);
            continue;
          }
          row[column.label] = taskExportValue(task, column.key);
        }
        return row;
      }),
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCsv(await file.text()).map((row) => ({
      title: pickCsv(row, ["title", "Title", "task", "Task"]) ?? "",
      description: pickCsv(row, ["description", "Description"]),
      status: pickCsv(row, ["status", "Status"]),
      priority: pickCsv(row, ["priority", "Priority"]),
      projectName: pickCsv(row, ["project", "Project", "projectName", "Project Name"]),
      assigneeEmails: pickCsv(row, ["assignees", "Assignees", "assigneeEmails"]),
      companyName: pickCsv(row, ["company", "Company", "companyName", "Company Name"]),
      contactName: pickCsv(row, ["contact", "Contact", "contactName", "Contact Name"]),
      dealName: pickCsv(row, ["deal", "Deal", "dealName", "Deal Name"]),
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
          Import Tasks
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
          <AddCustomFieldButton entity="task" menuAlign="left" />
          <ColumnsButton table={table} menuAlign="left" />
        </div>
        {message ? (
          <p className="mt-2 px-2 text-xs text-neutral-500">{message}</p>
        ) : null}
      </section>
    </div>
  );
}

function TaskBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: Array<Id<"projectTasks">>;
  onClear: () => void;
}) {
  const users = useQuery(api.users.list);
  const update = useMutation(api.tasks.update);
  const remove = useMutation(api.tasks.remove);
  const [status, setStatus] = useState<"UNCHANGED" | TaskStatus>("UNCHANGED");
  const [priority, setPriority] = useState<"UNCHANGED" | TaskPriority>(
    "UNCHANGED",
  );
  const [assigneeId, setAssigneeId] = useState("UNCHANGED");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const apply = async () => {
    const updates: {
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeIds?: Array<Id<"users">>;
    } = {};
    if (status !== "UNCHANGED") updates.status = status;
    if (priority !== "UNCHANGED") updates.priority = priority;
    if (assigneeId !== "UNCHANGED") {
      updates.assigneeIds = assigneeId ? [assigneeId as Id<"users">] : [];
    }
    if (Object.keys(updates).length === 0) return;
    await Promise.all(selectedIds.map((taskId) => update({ taskId, ...updates })));
    setMessage(`Updated ${selectedIds.length} tasks`);
    setStatus("UNCHANGED");
    setPriority("UNCHANGED");
    setAssigneeId("UNCHANGED");
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Move ${selectedIds.length} tasks to trash?`)) return;
    await Promise.all(selectedIds.map((taskId) => remove({ taskId })));
    onClear();
    setMessage(`Moved ${selectedIds.length} tasks to trash`);
  };

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)}>Update</Button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <div className="grid gap-2">
            <Select
              ariaLabel="Bulk task status"
              value={status}
              onChange={(value) => setStatus(value as typeof status)}
              options={[
                { value: "UNCHANGED", label: "Status unchanged" },
                ...TASK_STATUSES.map((item) => ({
                  value: item,
                  label: taskStatusLabel[item],
                })),
              ]}
            />
            <Select
              ariaLabel="Bulk task priority"
              value={priority}
              onChange={(value) => setPriority(value as typeof priority)}
              options={[
                { value: "UNCHANGED", label: "Priority unchanged" },
                ...TASK_PRIORITIES.map((item) => ({
                  value: item,
                  label: priorityLabel[item],
                })),
              ]}
            />
            <Select
              ariaLabel="Bulk task assignee"
              value={assigneeId}
              onChange={setAssigneeId}
              options={[
                { value: "UNCHANGED", label: "Assignee unchanged" },
                { value: "", label: "Clear assignees" },
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

function TaskList({
  tasks,
  table,
  sticky,
  selectedIds,
  allVisibleSelected,
  onToggleVisible,
  onSelectRow,
  onSelect,
}: {
  tasks?: Array<Task>;
  table: EntityTable;
  sticky: StickyColumns;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  onToggleVisible: (checked: boolean) => void;
  onSelectRow: (id: Id<"projectTasks">, checked: boolean) => void;
  onSelect: (id: Id<"projectTasks">) => void;
}) {
  const remove = useMutation(api.tasks.remove);

  const deleteTask = async (task: Task) => {
    if (!window.confirm(`Move ${task.title} to trash?`)) return;
    await remove({ taskId: task._id });
  };

  const renderCell = (task: Task, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={task._id}
          value={table.fieldValue(definition, task._id)}
        />
      );
    }
    switch (column.key) {
      case "title":
        return (
          <>
            <button
              onClick={() => onSelect(task._id)}
              className="text-left text-white hover:text-accent"
            >
              {task.title}
            </button>
            {task.description ? (
              <p className="mt-0.5 max-w-sm truncate text-xs text-neutral-500">
                {task.description}
              </p>
            ) : null}
          </>
        );
      case "status":
        return (
          <Badge className={statusClass(task.status)}>
            {taskStatusLabel[task.status]}
          </Badge>
        );
      case "priority":
        return (
          <Badge className={priorityClass(task.priority)}>
            {priorityLabel[task.priority]}
          </Badge>
        );
      case "assignee":
        return <AssigneeAvatars task={task} />;
      case "dueAt":
        return (
          <span className="text-neutral-400">
            {task.dueAt ? shortDate(task.dueAt) : "No date"}
          </span>
        );
      case "project":
        return task.project ? (
          <Link
            to={`/app/projects/${task.project._id}`}
            className="text-neutral-400 hover:text-accent"
          >
            {task.project.name}
          </Link>
        ) : (
          <span className="text-neutral-600">None</span>
        );
      case "links":
        return <CrmLinks task={task} />;
      default:
        return null;
    }
  };

  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <th className="w-10 px-4 py-2">
                <Checkbox
                  checked={allVisibleSelected}
                  ariaLabel="Select all visible tasks"
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
            {tasks?.map((task) => (
              <tr
                key={task._id}
                className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(task._id)}
                    ariaLabel={`Select ${task.title}`}
                    onChange={(checked) => onSelectRow(task._id, checked)}
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
                      {renderCell(task, column)}
                    </td>
                  );
                })}
                <td className="px-2 py-3" />
                <td className="px-4 py-3 text-right">
                  <RecordActionMenu
                    onOpenPanel={() => onSelect(task._id)}
                    onDelete={() => void deleteTask(task)}
                  />
                </td>
              </tr>
            ))}
            {tasks && tasks.length === 0 ? (
              <tr>
                <td colSpan={table.visible.length + 3} className="px-4 py-8">
                  <EmptyState message="No tasks yet" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TaskKanbanCard({
  task,
  selected,
  onSelect,
  onToggleSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: Id<"projectTasks">) => void;
  onToggleSelect: (checked: boolean) => void;
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
          onClick={() => onSelect(task._id)}
          className="min-w-0 truncate text-left text-sm font-medium text-white hover:text-accent"
        >
          {task.title}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={priorityClass(task.priority)}>
            {priorityLabel[task.priority]}
          </Badge>
          <Checkbox
            checked={selected}
            ariaLabel={`Select ${task.title}`}
            onChange={onToggleSelect}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge className={statusClass(task.status)}>
          {taskStatusLabel[task.status]}
        </Badge>
        <span className="text-neutral-500">
          {task.dueAt ? shortDate(task.dueAt) : "No due date"}
        </span>
      </div>
      {task.project ? (
        <p className="mt-2 truncate text-xs text-neutral-500">
          {task.project.name}
        </p>
      ) : null}
      <div className="mt-3 text-xs">
        <AssigneeAvatars task={task} />
      </div>
    </article>
  );
}

function taskGroupValue(task: Task, groupBy: string, table: EntityTable) {
  const definition = table.definitionByColumn.get(groupBy);
  if (definition) {
    const value = table.fieldValue(definition, task._id);
    if (definition.type === "multiSelect" && typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
  }
  if (groupBy === "status") return task.status;
  if (groupBy === "priority") return task.priority;
  if (groupBy === "assignee") {
    return task.assignees.length > 0
      ? task.assignees.map((assignee) => assignee.name)
      : undefined;
  }
  if (groupBy === "project") return task.project?.name;
  if (groupBy === "company") return task.links.company?.name;
  if (groupBy === "contact") return task.links.contact?.name;
  if (groupBy === "deal") return task.links.deal?.name;
  return undefined;
}

function AssigneeAvatars({ task }: { task: Task | TaskDetail }) {
  const assignees = task.assignees.length > 0
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
  if (assignees.length === 0) {
    return <span className="text-neutral-600">Unassigned</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-2 text-neutral-400">
      <span className="flex -space-x-1">
        {assignees.slice(0, 3).map((assignee) => (
          <Avatar
            key={assignee._id}
            name={assignee.name}
            src={assignee.avatarUrl}
            size={18}
          />
        ))}
      </span>
      <span className="min-w-0 truncate">
        {assignees.map((assignee) => assignee.name).join(", ")}
      </span>
    </span>
  );
}

function TaskCalendar({
  mode,
  tasks,
  onSelect,
}: {
  mode: CalendarMode;
  tasks?: Array<Task>;
  onSelect: (id: Id<"projectTasks">) => void;
}) {
  const today = new Date();

  if (mode === "day") {
    const dayTasks = (tasks ?? []).filter((task) => isSameDay(task.dueAt, today));
    return (
      <Panel className="p-4">
        <CalendarHeader
          title={today.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          count={dayTasks.length}
        />
        <div className="divide-y divide-edge">
          {dayTasks.length === 0 ? (
            <EmptyState message="No tasks scheduled today" />
          ) : (
            dayTasks.map((task) => (
              <CalendarTaskRow key={task._id} task={task} onSelect={onSelect} />
            ))
          )}
        </div>
      </Panel>
    );
  }

  if (mode === "week") {
    const weekDays = weekDates(today);
    return (
      <Panel className="p-4">
        <CalendarHeader title="This week" count={tasks?.length ?? 0} />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {weekDays.map((date) => {
            const dateTasks = (tasks ?? []).filter((task) =>
              isSameDay(task.dueAt, date),
            );
            return (
              <div key={date.toISOString()} className="min-h-40 rounded-md border border-edge p-2">
                <p
                  className={`text-xs ${
                    isSameCalendarDay(date, today) ? "text-accent" : "text-neutral-500"
                  }`}
                >
                  {date.toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                  })}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {dateTasks.map((task) => (
                    <button
                      key={task._id}
                      onClick={() => onSelect(task._id)}
                      className="truncate rounded border border-edge bg-ink px-2 py-1 text-left text-[11px] text-neutral-300 hover:border-accent hover:text-white"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];

  return (
    <Panel className="p-4">
      <CalendarHeader
        title={today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        count={tasks?.length ?? 0}
      />
      <div className="grid grid-cols-7 border-l border-t border-edge text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border-b border-r border-edge px-2 py-1 text-neutral-600"
          >
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          const dateTasks =
            day === null
              ? []
              : (tasks ?? []).filter((task) => {
                  if (!task.dueAt) return false;
                  const due = new Date(task.dueAt);
                  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === day;
                });
          return (
            <div
              key={index}
              className="min-h-28 border-b border-r border-edge p-2"
            >
              {day ? (
                <span
                  className={`text-xs ${
                    day === today.getDate() ? "text-accent" : "text-neutral-500"
                  }`}
                >
                  {day}
                </span>
              ) : null}
              <div className="mt-2 flex flex-col gap-1">
                {dateTasks.slice(0, 3).map((task) => (
                  <button
                    key={task._id}
                    onClick={() => onSelect(task._id)}
                    className="truncate rounded border border-edge bg-ink px-2 py-1 text-left text-[11px] text-neutral-300 hover:border-accent hover:text-white"
                  >
                    {task.title}
                  </button>
                ))}
                {dateTasks.length > 3 ? (
                  <span className="text-[11px] text-neutral-600">
                    +{dateTasks.length - 3} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function CalendarHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-medium text-white">{title}</h2>
      <span className="text-xs text-neutral-600">
        {count} scheduled
      </span>
    </div>
  );
}

function AssigneePicker({
  value,
  onChange,
}: {
  value: Array<Id<"users">>;
  onChange: (value: Array<Id<"users">>) => void;
}) {
  const users = useQuery(api.users.list);
  const selected = new Set(value);
  const selectedNames =
    users
      ?.filter((user) => selected.has(user._id))
      .map((user) => user.name)
      .join(", ") || "Unassigned";

  const toggle = (id: Id<"users">, checked: boolean) => {
    const next = new Set(value);
    if (checked) next.add(id);
    else next.delete(id);
    onChange([...next]);
  };

  return (
    <div className="rounded-md border border-edge bg-ink p-2 text-sm lg:col-span-2">
      <p className="mb-2 truncate text-xs text-neutral-500">
        Assignees: {selectedNames}
      </p>
      <div className="grid gap-1">
        {users?.map((user) => (
          <label
            key={user._id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-neutral-300 hover:bg-raised"
          >
            <Checkbox
              checked={selected.has(user._id)}
              ariaLabel={`Assign ${user.name}`}
              onChange={(checked) => toggle(user._id, checked)}
            />
            <Avatar name={user.name} src={user.avatarUrl} size={18} />
            <span className="truncate">{user.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CalendarTaskRow({
  task,
  onSelect,
}: {
  task: Task;
  onSelect: (id: Id<"projectTasks">) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task._id)}
      className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-accent"
    >
      <span className="min-w-0 truncate text-white">{task.title}</span>
      <span className="shrink-0 text-xs text-neutral-600">
        {task.project?.name ?? taskStatusLabel[task.status]}
      </span>
    </button>
  );
}

export function TaskSidePanel({
  taskId,
  onClose,
  onOpenTask,
}: {
  taskId: Id<"projectTasks"> | null;
  onClose: () => void;
  onOpenTask: (id: Id<"projectTasks">) => void;
}) {
  const task = useQuery(api.tasks.get, taskId ? { taskId } : "skip");

  return (
    <SlideOver
      open={taskId !== null}
      onClose={onClose}
      title={task?.title ?? "Task"}
      subtitle={task ? `Created ${timeAgo(task._creationTime)}` : undefined}
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded bg-edge text-xs font-medium text-neutral-300">
          T
        </span>
      }
      actions={
        taskId && task ? (
          <>
            <FavoriteButton
              label={task.title}
              href={`/app/tasks/${taskId}`}
              kind="record"
              entityType="task"
              entityId={taskId}
            />
            <Link
              to={`/app/tasks/${taskId}`}
              className="rounded-md border border-edge px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-edge-strong hover:text-white"
            >
              Open detail
            </Link>
          </>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {taskId ? (
          <TaskDetailBody
            taskId={taskId}
            task={task}
            onDeleted={onClose}
            onOpenTask={onOpenTask}
          />
        ) : null}
      </div>
    </SlideOver>
  );
}

export function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const id = taskId as Id<"projectTasks"> | undefined;
  const task = useQuery(api.tasks.get, id ? { taskId: id } : "skip");

  if (!id) return <EmptyState message="Task not found" />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={task?.title ?? "Task"}
        subtitle={task ? `Created ${timeAgo(task._creationTime)}` : "Loading task..."}
        action={
          task ? (
            <FavoriteButton
              label={task.title}
              href={`/app/tasks/${id}`}
              kind="record"
              entityType="task"
              entityId={id}
            />
          ) : null
        }
      />
      <TaskDetailBody
        taskId={id}
        task={task}
        onDeleted={() => navigate("/app/tasks")}
        onOpenTask={(nextId) => navigate(`/app/tasks/${nextId}`)}
      />
    </div>
  );
}

function TaskDetailBody({
  taskId,
  task,
  onDeleted,
  onOpenTask,
}: {
  taskId: Id<"projectTasks">;
  task: TaskDetail | null | undefined;
  onDeleted: () => void;
  onOpenTask: (id: Id<"projectTasks">) => void;
}) {
  const update = useMutation(api.tasks.update);
  const remove = useMutation(api.tasks.remove);
  const addComment = useMutation(api.tasks.addComment);
  const createTask = useMutation(api.tasks.create);
  const generateUploadUrl = useMutation(api.tasks.generateUploadUrl);
  const addAttachment = useMutation(api.tasks.addAttachment);
  const removeAttachment = useMutation(api.tasks.removeAttachment);
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (task === undefined) {
    return <Panel className="p-4 text-sm text-neutral-500">Loading task...</Panel>;
  }
  if (task === null) return <EmptyState message="Task not found" />;

  const submitComment = () => {
    const body = comment.trim();
    if (!body) return;
    void addComment({ taskId, body });
    setComment("");
  };

  const submitSubtask = () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    void createTask({
      title,
      parentTaskId: taskId,
      projectId: task.projectId,
      companyId: task.companyId,
      contactId: task.contactId,
      dealId: task.dealId,
      assigneeIds: task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []),
      priority: task.priority,
      status: "todo",
    });
    setSubtaskTitle("");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error(`Could not upload ${file.name}`);
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await addAttachment({
          taskId,
          storageId,
          name: file.name,
          contentType: file.type || undefined,
          size: file.size,
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <Checkbox
              checked={task.status === "done"}
              onChange={(checked) =>
                void update({
                  taskId,
                  status: checked ? "done" : "todo",
                })
              }
            />
            Done
          </label>
          <Select
            ariaLabel="Task status"
            value={task.status}
            onChange={(status) =>
              void update({ taskId, status: status as TaskStatus })
            }
            options={TASK_STATUSES.map((item) => ({
              value: item,
              label: taskStatusLabel[item],
            }))}
          />
          <Select
            ariaLabel="Task priority"
            value={task.priority}
            onChange={(priority) =>
              void update({ taskId, priority: priority as TaskPriority })
            }
            options={TASK_PRIORITIES.map((item) => ({
              value: item,
              label: priorityLabel[item],
            }))}
          />
          <DateInput
            ariaLabel="Task due date"
            value={dateInputValue(task.dueAt)}
            onChange={(value) =>
              void update({ taskId, dueAt: timestampFromDate(value) })
            }
          />
          <AssigneePicker
            value={task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : [])}
            onChange={(assigneeIds) => void update({ taskId, assigneeIds })}
          />
          <CustomFieldsEditor entity="task" entityId={taskId} variant="inline" />
        </div>

        {task.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-400">
            {task.description}
          </p>
        ) : null}

        <div className="mt-5 space-y-2 text-sm">
          {task.project ? (
            <Link
              to={`/app/projects/${task.project._id}`}
              className="block text-accent hover:underline"
            >
              {task.project.name}
            </Link>
          ) : null}
          <CrmLinks task={task} />
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-white">Subtasks</h3>
          <span className="text-xs text-neutral-600">
            {task.openSubtaskCount} open / {task.subtaskCount} total
          </span>
        </div>
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Add subtask"
            value={subtaskTitle}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSubtask();
            }}
          />
          <Button onClick={submitSubtask} disabled={!subtaskTitle.trim()}>
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {task.subtasks.length === 0 ? (
            <p className="text-sm text-neutral-600">No subtasks yet</p>
          ) : (
            task.subtasks.map((subtask) => (
              <button
                key={subtask._id}
                onClick={() => onOpenTask(subtask._id)}
                className="flex w-full items-center justify-between rounded-md border border-edge bg-ink px-3 py-2 text-left text-sm transition-colors hover:border-accent"
              >
                <span className="text-neutral-300">{subtask.title}</span>
                <Badge className={statusClass(subtask.status)}>
                  {taskStatusLabel[subtask.status]}
                </Badge>
              </button>
            ))
          )}
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-white">Files</h3>
          <Button onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading" : "Add files"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        {task.attachments.length === 0 ? (
          <p className="text-sm text-neutral-600">No files yet</p>
        ) : (
          <div className="space-y-2">
            {task.attachments.map((attachment) => (
              <div
                key={attachment._id}
                className="flex items-center justify-between gap-3 rounded-md border border-edge bg-ink px-3 py-2 text-sm"
              >
                <a
                  href={attachment.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-neutral-300 hover:text-accent"
                >
                  {attachment.name}
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-neutral-600">
                    {formatFileSize(attachment.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void removeAttachment({ attachmentId: attachment._id })
                    }
                    className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-raised hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <h3 className="mb-2 text-sm font-medium text-white">Comments</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Add a comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitComment();
            }}
          />
          <Button onClick={submitComment}>Add</Button>
        </div>
        <div className="mt-3 space-y-3">
          {task.comments.map((row) => (
            <div key={row._id} className="rounded-md border border-edge p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  {row.author?.name ?? "Workspace"}
                </span>
                <span className="text-neutral-600">
                  {timeAgo(row._creationTime)}
                </span>
              </div>
              <p className="text-sm text-neutral-300">{row.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="border-t border-edge pt-4">
        <Button
          variant="danger"
          onClick={() => {
            void remove({ taskId });
            onDeleted();
          }}
        >
          Delete task
        </Button>
      </div>
    </div>
  );
}

export function TaskForm({
  onDone,
  defaults,
  compact = false,
}: {
  onDone: () => void;
  defaults?: {
    projectId?: Id<"projects">;
    status?: TaskStatus;
    priority?: TaskPriority;
  };
  compact?: boolean;
}) {
  const create = useMutation(api.tasks.create);
  const projects = useQuery(api.projects.names);
  const companies = useQuery(api.companies.names);
  const contacts = useQuery(api.contacts.names);
  const deals = useQuery(api.deals.names);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaults?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(
    defaults?.priority ?? "medium",
  );
  const [projectId, setProjectId] = useState(defaults?.projectId ?? "");
  const [assigneeIds, setAssigneeIds] = useState<Array<Id<"users">>>([]);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    void create({
      title: trimmed,
      description: description.trim() || undefined,
      status,
      priority,
      projectId: projectId ? (projectId as Id<"projects">) : undefined,
      assigneeIds,
      companyId: companyId ? (companyId as Id<"companies">) : undefined,
      contactId: contactId ? (contactId as Id<"contacts">) : undefined,
      dealId: dealId ? (dealId as Id<"deals">) : undefined,
      dueAt: timestampFromDate(dueDate),
    });
    onDone();
  };

  return (
    <Panel className={compact ? "border-0 bg-transparent p-4 shadow-none" : "mt-5 p-4"}>
      <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "lg:grid-cols-6"}`}>
        <div className={compact ? "" : "lg:col-span-3"}>
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onChange={(value) => setStatus(value as TaskStatus)}
          options={TASK_STATUSES.map((item) => ({
            value: item,
            label: taskStatusLabel[item],
          }))}
        />
        <Select
          value={priority}
          onChange={(value) => setPriority(value as TaskPriority)}
          options={TASK_PRIORITIES.map((item) => ({
            value: item,
            label: priorityLabel[item],
          }))}
        />
        <DateInput value={dueDate} onChange={setDueDate} />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`min-h-20 rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none ${compact ? "" : "lg:col-span-6"}`}
        />
        <Picker
          value={projectId}
          onChange={setProjectId}
          options={projects}
          label="No project"
        />
        <AssigneePicker
          value={assigneeIds}
          onChange={setAssigneeIds}
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
        <div className={`flex justify-end gap-2 ${compact ? "" : "lg:col-span-1"}`}>
          <Button onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create
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

function CrmLinks({ task }: { task: Pick<TaskDetail, "links"> }) {
  const links = [
    task.links.company
      ? { to: `/app/companies/${task.links.company._id}`, label: task.links.company.name }
      : null,
    task.links.contact
      ? { to: `/app/contacts/${task.links.contact._id}`, label: task.links.contact.name }
      : null,
    task.links.deal ? { to: "/app/deals", label: task.links.deal.name } : null,
  ].filter(Boolean) as Array<{ to: string; label: string }>;

  if (links.length === 0) return <span className="text-neutral-600">No CRM link</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="rounded border border-edge px-1.5 py-0.5 text-xs text-neutral-400 hover:border-accent hover:text-accent"
        >
          {link.label}
        </Link>
      ))}
    </span>
  );
}

function calendarRange(date: Date, mode: CalendarMode) {
  if (mode === "day") {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }
  if (mode === "week") {
    const days = weekDates(date);
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[6]);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { startAt: start, endAt: end };
}

function weekDates(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function isSameDay(timestamp: number | undefined, date: Date) {
  if (!timestamp) return false;
  return isSameCalendarDay(new Date(timestamp), date);
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
