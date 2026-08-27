import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";

const ACTIONS = [
  { id: "new-company", label: "New company", sublabel: "Companies", to: "/app/companies?new=1" },
  { id: "new-deal", label: "New deal", sublabel: "Deals", to: "/app/deals?new=1" },
  { id: "timeline", label: "Open timeline", sublabel: "Timeline", to: "/app/timeline" },
  { id: "tasks", label: "Open tasks", sublabel: "Tasks", to: "/app/tasks" },
  { id: "notes", label: "Open notes", sublabel: "Timeline", to: "/app/timeline?type=NOTE" },
  { id: "emails", label: "Open emails", sublabel: "Timeline", to: "/app/timeline?type=EMAIL" },
  { id: "trash", label: "Open trash", sublabel: "Recover records", to: "/app/trash" },
  { id: "settings", label: "Go to settings", sublabel: "Workspace", to: "/app/settings" },
] as const;

// Command-K search over the CRM: records, projects, and tasks. In demo
// mode this is the whole search surface, on purpose; it never leaves the
// workspace data.
export function CommandK({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = useQuery(api.search.global, q.trim() ? { q } : "skip");

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      // Focus after the modal paints.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const searchRows = results ?? [];
  const actionRows = ACTIONS.filter((action) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return (
      action.label.toLowerCase().includes(term) ||
      action.sublabel.toLowerCase().includes(term)
    );
  }).slice(0, q.trim() ? 4 : 8);
  const rows = [
    ...actionRows.map((action) => ({ kind: "action" as const, ...action })),
    ...searchRows.map((row) => ({ kind: "record" as const, ...row })),
  ];

  const go = (row: (typeof rows)[number]) => {
    onClose();
    if (row.kind === "action") {
      navigate(row.to);
      return;
    }
    if (row.type === "company") navigate(`/app/companies/${row.id}`);
    else if (row.type === "contact") navigate(`/app/contacts/${row.id}`);
    else if (row.type === "project") navigate(`/app/projects/${row.id}`);
    else if (row.type === "task") navigate("/app/tasks");
    else navigate("/app/deals");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && rows[active]) {
      go(rows[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[10vh] sm:pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Type anything..."
          className="w-full border-b border-edge bg-transparent px-5 py-4 text-base text-white placeholder:text-neutral-500 focus:outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-4 text-xs text-neutral-500">
              Nothing matches "{q}".
            </p>
          ) : (
            rows.map((row, index) => (
              <button
                key={row.kind === "action" ? row.id : `${row.type}-${row.id}`}
                onClick={() => go(row)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
                  index === active
                    ? "bg-raised text-white"
                    : "text-neutral-300"
                }`}
              >
                <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  {row.kind === "action" ? "Action" : row.type}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="truncate text-xs text-neutral-500">
                  {row.sublabel}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
