import { useEffect } from "react";

// Every shortcut the app actually has, in one themed modal. Opened from
// the keyboard icon in the sidebar footer or with Cmd ?.

const GROUPS: Array<{
  title: string;
  rows: Array<{ keys: Array<string>; does: string }>;
}> = [
  {
    title: "Anywhere",
    rows: [
      { keys: ["⌘", "K"], does: "Search companies, contacts, and deals" },
      { keys: ["⌘", "."], does: "Hide or show the sidebar" },
      { keys: ["⌘", "?"], does: "Open this list" },
      { keys: ["Esc"], does: "Close any open dialog" },
    ],
  },
  {
    title: "Search results",
    rows: [
      { keys: ["↑", "↓"], does: "Move through results" },
      { keys: ["Enter"], does: "Open the selected record" },
    ],
  },
  {
    title: "Ask",
    rows: [
      { keys: ["Enter"], does: "Send the message" },
      { keys: ["Shift", "Enter"], does: "New line" },
      { keys: ["/"], does: "Slash commands: /crm, /search, /read, /task, /note" },
    ],
  },
];

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-sm font-medium text-white">
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="text-neutral-500 transition-colors hover:text-white"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {group.title}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.rows.map((row) => (
                  <div
                    key={row.does}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-neutral-300">{row.does}</span>
                    <span className="flex shrink-0 gap-1">
                      {row.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-edge bg-raised px-1.5 py-0.5 font-sans text-[11px] text-neutral-200"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
