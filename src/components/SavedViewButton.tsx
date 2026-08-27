import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Button, Input } from "./ui";

type SavedViewEntity = string;
export type SavedViewType = "table" | "kanban" | "calendar";
export type SavedViewFieldOption = {
  value: string;
  label: string;
};

const VIEW_TYPE_LABEL: Record<SavedViewType, string> = {
  table: "Table",
  kanban: "Kanban",
  calendar: "Calendar",
};

function viewTypeFromHref(href: string): SavedViewType {
  const params = new URL(href, window.location.origin).searchParams;
  const view = params.get("view");
  if (view === "kanban" || view === "board") return "kanban";
  if (view === "calendar") return "calendar";
  return "table";
}

function normalizedHref(href: string) {
  const url = new URL(href, window.location.origin);
  url.searchParams.sort();
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function sameHref(a: string, b: string) {
  return normalizedHref(a) === normalizedHref(b);
}

export function SavedViewsDropdown({
  entity,
  currentName,
  count,
  href,
  defaultName,
  viewTypes = ["table"],
  currentType = "table",
  lockedType = "table",
  builtInViews = [],
  hrefForType,
  onOpenView,
  kanbanGroupOptions = [],
  currentKanbanGroup,
  defaultKanbanGroup,
}: {
  entity: SavedViewEntity;
  currentName: string;
  count: number;
  href: string;
  defaultName: string;
  viewTypes?: Array<SavedViewType>;
  currentType?: SavedViewType;
  lockedType?: SavedViewType;
  builtInViews?: Array<{ type: SavedViewType; label: string }>;
  onTypeChange?: (type: SavedViewType) => void;
  hrefForType?: (
    type: SavedViewType,
    config?: { kanbanGroup?: string },
  ) => string;
  onOpenView?: (href: string) => void;
  kanbanGroupOptions?: Array<SavedViewFieldOption>;
  currentKanbanGroup?: string | null;
  defaultKanbanGroup?: string;
}) {
  const views = useQuery(api.savedViews.list, { entity });
  const saveView = useMutation(api.savedViews.save);
  const removeView = useMutation(api.savedViews.remove);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(defaultName);
  const [draftType, setDraftType] = useState<SavedViewType>(currentType);
  const [draftKanbanGroup, setDraftKanbanGroup] = useState(
    currentKanbanGroup ?? defaultKanbanGroup ?? "",
  );
  const [openedView, setOpenedView] = useState<{
    href: string;
    name: string;
    type: SavedViewType;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const lockedHref = hrefForType
    ? hrefForType(lockedType, {
        kanbanGroup: lockedType === "kanban" ? defaultKanbanGroup : undefined,
      })
    : href;
  const builtInRows = builtInViews.map((view) => ({
    ...view,
    href: hrefForType ? hrefForType(view.type) : href,
  }));
  const activeView = views?.find((view) => sameHref(view.href, href));
  const activeBuiltIn = builtInRows.find((view) => sameHref(view.href, href));
  const pendingView =
    openedView && sameHref(openedView.href, href) ? openedView : null;
  const activeType = activeView
    ? viewTypeFromHref(activeView.href)
    : pendingView
        ? pendingView.type
        : activeBuiltIn
          ? activeBuiltIn.type
          : currentType;
  const activeName =
    activeView?.name ?? pendingView?.name ?? activeBuiltIn?.label ?? currentName;
  const hasKanbanGroup =
    draftType !== "kanban" ||
    kanbanGroupOptions.length === 0 ||
    Boolean(draftKanbanGroup);
  const rowClass = (rowHref: string) =>
    `flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
      sameHref(rowHref, href)
        ? "bg-raised text-white"
        : "text-neutral-300 hover:bg-raised hover:text-white"
    }`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!creating) {
      setName(defaultName);
      setDraftType(currentType);
      setDraftKanbanGroup(currentKanbanGroup ?? defaultKanbanGroup ?? "");
    }
  }, [creating, currentKanbanGroup, currentType, defaultKanbanGroup, defaultName]);

  const openView = (
    nextHref: string,
    nextName: string,
    nextType: SavedViewType,
    shouldNavigate = false,
  ) => {
    setOpenedView({ href: nextHref, name: nextName, type: nextType });
    onOpenView?.(nextHref);
    if (shouldNavigate) navigate(nextHref);
    setOpen(false);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setStatus(null);
      const nextHref = hrefForType
        ? hrefForType(draftType, { kanbanGroup: draftKanbanGroup || undefined })
        : href;
      await saveView({
        entity,
        name: trimmed,
        href: nextHref,
      });
      openView(nextHref, trimmed, draftType, true);
      setCreating(false);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save view");
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[260px] items-center gap-2 rounded-md bg-raised px-2.5 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <TypeIcon type={activeType} />
        <span className="min-w-0 truncate font-medium">{activeName}</span>
        <span className="text-neutral-600">/</span>
        <span className="text-neutral-500">{count}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-visible rounded-lg border border-edge bg-panel shadow-2xl">
          {creating ? (
            <div className="p-2">
              <div className="mb-2 flex items-center gap-2 px-1 py-1 text-sm font-medium text-white">
                <button
                  type="button"
                  aria-label="Cancel create view"
                  onClick={() => setCreating(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  X
                </button>
                Create view
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-edge bg-ink text-[11px] font-semibold text-neutral-400">
                  123
                </span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void save()}
                  className="py-2"
                />
              </div>
              <div className="mb-3 rounded-md border border-edge bg-ink p-2">
                <p className="-mt-4 ml-1 w-max bg-ink px-1 text-[11px] text-neutral-600">
                  View type
                </p>
                <div className="flex items-center justify-between gap-2 text-sm text-neutral-300">
                  <ViewTypePicker
                    value={draftType}
                    options={viewTypes}
                    onChange={(type) => {
                      setDraftType(type);
                      if (
                        type === "kanban" &&
                        !draftKanbanGroup &&
                        defaultKanbanGroup
                      ) {
                        setDraftKanbanGroup(defaultKanbanGroup);
                      }
                    }}
                  />
                </div>
              </div>
              {draftType === "kanban" && kanbanGroupOptions.length > 0 ? (
                <div className="mb-3 rounded-md border border-edge bg-ink p-2">
                  <p className="-mt-4 ml-1 w-max bg-ink px-1 text-[11px] text-neutral-600">
                    Stages
                  </p>
                  <ViewFieldPicker
                    value={draftKanbanGroup}
                    options={kanbanGroupOptions}
                    placeholder="Select field"
                    onChange={setDraftKanbanGroup}
                  />
                </div>
              ) : null}
              <Button
                variant="primary"
                onClick={() => void save()}
                disabled={!name.trim() || !hasKanbanGroup}
              >
                Save view
              </Button>
              {status ? (
                <p className="mt-2 text-xs text-red-300">{status}</p>
              ) : null}
            </div>
          ) : (
            <div className="p-1">
              <div className={`${rowClass(lockedHref)} justify-between`}>
                <Link
                  to={lockedHref}
                  onClick={() => {
                    openView(lockedHref, currentName, lockedType);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:text-white"
                >
                  <TypeIcon type={lockedType} />
                  <span className="truncate">{currentName}</span>
                </Link>
                <LockIcon />
              </div>
              {builtInRows.map((view) => (
                <Link
                  key={`${view.type}-${view.href}`}
                  to={view.href}
                  onClick={() => {
                    openView(view.href, view.label, view.type);
                  }}
                  className={`mt-1 ${rowClass(view.href)}`}
                >
                  <TypeIcon type={view.type} />
                  <span className="truncate">{view.label}</span>
                </Link>
              ))}
              {views === undefined ? (
                <p className="px-2 py-2 text-xs text-neutral-500">
                  Loading views...
                </p>
              ) : (
                views.map((view) => (
                  <div
                    key={view._id}
                    className={`group ${rowClass(view.href)}`}
                  >
                    <TypeIcon type={viewTypeFromHref(view.href)} />
                    <Link
                      to={view.href}
                      onClick={() => {
                        openView(view.href, view.name, viewTypeFromHref(view.href));
                      }}
                      className="min-w-0 flex-1 truncate hover:text-white"
                    >
                      {view.name}
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${view.name} view`}
                      onClick={() => void removeView({ viewId: view._id })}
                      className="text-neutral-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              )}
              <div className="mx-1 my-1 h-px bg-edge" />
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-raised hover:text-white"
              >
                <PlusIcon />
                Add view
              </button>
            </div>
          )}
        </div>
      ) : null}
      {!open && status ? (
        <span className="absolute left-0 top-full mt-1 text-[11px] text-neutral-500">
          {status}
        </span>
      ) : null}
    </div>
  );
}

export function SavedViewButton({
  entity,
  href,
  defaultName,
}: {
  entity: SavedViewEntity;
  href: string;
  defaultName: string;
}) {
  const saveView = useMutation(api.savedViews.save);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    try {
      setStatus(null);
      await saveView({ entity, name, href });
      setOpen(false);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)}>Save view</Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-edge bg-panel p-3 shadow-xl">
          <label className="block text-xs text-neutral-500">
            View name
            <Input
              className="mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void save()}
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={!name.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
      {status ? (
        <span className="absolute right-0 top-full mt-1 text-[11px] text-neutral-500">
          {status}
        </span>
      ) : null}
    </div>
  );
}

export function SavedViewsMenu({ entity }: { entity: SavedViewEntity }) {
  const views = useQuery(api.savedViews.list, { entity });
  const removeView = useMutation(api.savedViews.remove);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)}>Views</Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-edge bg-panel p-1 shadow-xl">
          {views === undefined ? (
            <p className="px-2 py-2 text-xs text-neutral-500">Loading views...</p>
          ) : views.length === 0 ? (
            <p className="px-2 py-2 text-xs text-neutral-500">
              No saved views yet
            </p>
          ) : (
            views.map((view) => (
              <div
                key={view._id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-raised"
              >
                <Link
                  to={view.href}
                  onClick={() => setOpen(false)}
                  className="min-w-0 flex-1 truncate text-sm text-neutral-300 hover:text-white"
                >
                  {view.name}
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${view.name} view`}
                  onClick={() => void removeView({ viewId: view._id })}
                  className="rounded px-1.5 py-1 text-xs text-neutral-600 hover:bg-ink hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function TableIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-500"
    >
      <path d="M3 4h18v16H3zM3 10h18M9 4v16" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-500"
    >
      <path d="M4 5h5v14H4zM10 5h5v10h-5zM16 5h4v7h-4z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-500"
    >
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function TypeIcon({ type }: { type: SavedViewType }) {
  if (type === "kanban") return <KanbanIcon />;
  if (type === "calendar") return <CalendarIcon />;
  return <TableIcon />;
}

function ViewTypePicker({
  value,
  options,
  onChange,
}: {
  value: SavedViewType;
  options: Array<SavedViewType>;
  onChange: (type: SavedViewType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="flex w-full items-center justify-between gap-2 text-sm text-neutral-300"
      >
        <span className="flex items-center gap-2">
          <TypeIcon type={value} />
          {VIEW_TYPE_LABEL[value]}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border border-edge bg-panel p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-raised hover:text-white ${
                option === value ? "text-white" : "text-neutral-400"
              }`}
            >
              <TypeIcon type={option} />
              {VIEW_TYPE_LABEL[option]}
              {option === value ? (
                <span className="ml-auto text-neutral-500">
                  <CheckIcon />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ViewFieldPicker({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: Array<SavedViewFieldOption>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="flex w-full items-center justify-between gap-2 text-sm text-neutral-300"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border border-edge bg-panel p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-raised hover:text-white ${
                option.value === value ? "text-white" : "text-neutral-400"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? (
                <span className="ml-auto text-neutral-500">
                  <CheckIcon />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-neutral-500 transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-500"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-500"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M5 6l1 15h12l1-15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="m4 12 5 5L20 6" />
    </svg>
  );
}
