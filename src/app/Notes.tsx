import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FavoriteButton } from "../components/FavoriteButton";
import {
  ObjectDataTable,
  useLocalObjectTable,
  type ObjectDataColumn,
} from "../components/ObjectDataTable";
import {
  OBJECT_ICONS,
  ObjectTableHeader,
  OptionRow,
  TextToolbarButton,
  ViewBar,
} from "../components/ObjectTableChrome";
import { SlideOver } from "../components/SlideOver";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Panel,
} from "../components/ui";
import { SavedViewsDropdown } from "../components/SavedViewButton";
import { shortDate, timeAgo } from "../lib/format";

type Note = FunctionReturnType<typeof api.notes.list>[number];
type NoteTab = "home" | "timeline" | "files";

export function Notes() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeNoteId, setActiveNoteId] = useState<Id<"activities"> | null>(
    () => (params.get("note") as Id<"activities"> | null),
  );
  const notes = useQuery(api.notes.list, { search: search || undefined });
  const createNote = useMutation(api.notes.create);
  const removeNote = useMutation(api.notes.remove);
  const rows = notes ?? [];
  const columns: Array<ObjectDataColumn<Note>> = [
    {
      key: "title",
      label: "Title",
      locked: true,
      render: (note) => (
        <span className="inline-flex max-w-full items-center gap-2 rounded bg-raised px-2 py-0.5 text-neutral-200">
          <span className="text-neutral-500">-</span>
          <span className="truncate">{note.title}</span>
        </span>
      ),
    },
    {
      key: "relations",
      label: "Relations",
      render: (note) => (
        <span className="block max-w-64 truncate text-neutral-400">
          {relationLabel(note)}
        </span>
      ),
    },
    {
      key: "body",
      label: "Body",
      render: (note) => (
        <span className="block max-w-80 truncate text-neutral-400">
          {note.noteBody || note.title}
        </span>
      ),
    },
    {
      key: "createdBy",
      label: "Created by",
      render: (note) => (
        <span className="text-neutral-300">{note.author?.name ?? "System"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Creation date",
      render: (note) => (
        <span className="text-neutral-400">{timeAgo(note._creationTime)}</span>
      ),
    },
  ];
  const table = useLocalObjectTable("object-table:notes", columns);
  const visibleIds = rows.map((note) => note._id);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (activeNoteId) next.set("note", activeNoteId);
    setParams(next, { replace: true });
  }, [activeNoteId, search, setParams]);

  useEffect(() => {
    if (!notes) return;
    const liveIds = new Set(rows.map((note) => String(note._id)));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [notes, rows]);

  const create = async () => {
    const id = await createNote({ title: "Untitled" });
    setActiveNoteId(id);
  };

  const deleteSelected = async () => {
    for (const id of selectedIds) {
      await removeNote({ noteId: id as Id<"activities"> });
    }
    setSelectedIds(new Set());
    if (activeNoteId && selectedIds.has(activeNoteId)) setActiveNoteId(null);
  };

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

  const toggleNote = (id: Id<"activities">, checked: boolean) => {
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
        icon={OBJECT_ICONS.note}
        title="Notes"
        selectedCount={selectedIds.size}
        primaryLabel="New Note"
        onPrimary={() => void create()}
        updateSlot={
          <Button variant="danger" onClick={() => void deleteSelected()}>
            Delete selected
          </Button>
        }
        options={
          <div className="space-y-1">
            <OptionRow onClick={() => void create()}>New Note</OptionRow>
            {selectedIds.size > 0 ? (
              <OptionRow onClick={() => void deleteSelected()}>
                Delete selected
              </OptionRow>
            ) : null}
          </div>
        }
      />

      <ViewBar
        label="All Notes"
        count={rows.length}
        viewControl={
          <SavedViewsDropdown
            entity="note"
            currentName="Notes"
            count={rows.length}
            href="/app/notes"
            defaultName="All Notes"
            currentType="table"
            lockedType="table"
            hrefForType={() => "/app/notes"}
          />
        }
      >
        <TextToolbarButton>Filter</TextToolbarButton>
        <TextToolbarButton>Sort</TextToolbarButton>
        <div className="w-64">
          <Input
            placeholder="Search notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </ViewBar>

      <ObjectDataTable
        rows={rows}
        columns={columns}
        table={table}
        getRowId={(note) => note._id}
        selectedIds={selectedIds}
        activeRowId={activeNoteId}
        loading={notes === undefined}
        emptyMessage="No notes yet"
        selectAllLabel="Select all notes"
        getRowSelectLabel={(note) => `Select ${note.title}`}
        onToggleVisible={toggleVisible}
        onSelectRow={(note, checked) => toggleNote(note._id, checked)}
        onRowClick={(note) => setActiveNoteId(note._id)}
        onAddRow={() => void create()}
        settingsHref="/app/settings/customObjects"
        footer={
          <div className="border-t border-edge px-12 py-3 text-sm text-neutral-500">
            Count all{" "}
            <span className="font-medium text-neutral-300">{rows.length}</span>
          </div>
        }
      />

      <NoteSidePanel
        noteId={activeNoteId}
        onClose={() => setActiveNoteId(null)}
        onDelete={async (id) => {
          await removeNote({ noteId: id });
          setActiveNoteId(null);
        }}
      />
    </div>
  );
}

function NoteSidePanel({
  noteId,
  onClose,
  onDelete,
}: {
  noteId: Id<"activities"> | null;
  onClose: () => void;
  onDelete: (id: Id<"activities">) => Promise<void>;
}) {
  const note = useQuery(api.notes.get, noteId ? { noteId } : "skip");
  const updateNote = useMutation(api.notes.update);
  const [tab, setTab] = useState<NoteTab>("home");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const href = noteId ? `/app/notes?note=${noteId}` : "/app/notes";

  useEffect(() => {
    if (!noteId) return;
    setTab("home");
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setBody(note.noteBody);
  }, [note]);

  const save = async (patch: { title?: string; body?: string }) => {
    if (!noteId) return;
    setSaving(true);
    try {
      await updateNote({ noteId, ...patch });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={noteId !== null}
      title={note?.title ?? "Note"}
      subtitle={note ? `Created ${timeAgo(note._creationTime)}` : undefined}
      icon={<NoteMark />}
      onClose={onClose}
      actions={
        noteId ? (
          <FavoriteButton
            label={note?.title ?? "Note"}
            href={href}
            kind="record"
            entityType="note"
            entityId={noteId}
          />
        ) : null
      }
    >
      <nav className="flex gap-1 overflow-x-auto border-b border-edge px-4">
        {(["home", "timeline", "files"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`whitespace-nowrap px-3 py-3 text-sm capitalize transition-colors ${
              tab === item
                ? "border-b-2 border-accent text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {note === undefined ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : note === null ? (
          <EmptyState message="Note not found" />
        ) : tab === "timeline" ? (
          <Panel>
            <div className="border-b border-edge/60 px-4 py-3 text-sm last:border-0">
              <div className="flex items-center justify-between gap-2">
                <Badge>NOTE</Badge>
                <span className="text-xs text-neutral-600">
                  {timeAgo(note._creationTime)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-neutral-300">
                {note.body}
              </p>
            </div>
          </Panel>
        ) : tab === "files" ? (
          <EmptyState message="No files attached to this note yet" />
        ) : (
          <div className="grid gap-4">
            <Panel className="p-4">
              <h3 className="mb-4 text-sm font-medium text-white">Fields</h3>
              <div className="grid gap-5">
                <NoteFieldGroup
                  title="General"
                  rows={[
                    ["Title", title || "Untitled"],
                    ["Relations", relationLabel(note)],
                  ]}
                />
                <NoteFieldGroup
                  title="System"
                  rows={[
                    ["Creation date", shortDate(note._creationTime)],
                    ["Created by", note.author?.name ?? "System"],
                  ]}
                />
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Note</h3>
                {saving ? (
                  <span className="text-xs text-neutral-600">Saving</span>
                ) : null}
              </div>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => {
                  if (title !== note.title) void save({ title });
                }}
                placeholder="Title"
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onBlur={() => {
                  if (body !== note.noteBody) void save({ body });
                }}
                placeholder="Type '/' for commands, '@' for mentions"
                className="mt-3 min-h-56 w-full resize-none rounded-md border border-edge bg-ink px-3 py-2 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:border-accent focus:outline-none"
              />
            </Panel>
          </div>
        )}
      </div>
      {noteId ? (
        <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-3">
          <Button variant="danger" onClick={() => void onDelete(noteId)}>
            Delete
          </Button>
        </footer>
      ) : null}
    </SlideOver>
  );
}

function NoteFieldGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-neutral-400">{title}</h4>
        <span className="text-neutral-600">^</span>
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 text-sm"
        >
          <span className="truncate text-neutral-500">{label}</span>
          <span className="min-w-0 truncate text-neutral-300">{value}</span>
        </div>
      ))}
    </section>
  );
}

function relationLabel(note: Pick<Note, "company" | "contact" | "deal">) {
  const labels = [
    note.company?.name,
    note.contact?.name,
    note.deal?.name,
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "No relations";
}

function NoteMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/10 text-emerald-300">
      {OBJECT_ICONS.note}
    </span>
  );
}
