import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function RecordActionMenu({
  onEdit,
  onDelete,
  onOpenPanel,
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenPanel?: () => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative inline-flex justify-end">
      <button
        type="button"
        title="Actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-edge text-neutral-500 transition-colors hover:border-edge-strong hover:text-white"
      >
        <DotsIcon />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-edge bg-panel p-1 shadow-xl">
          {onOpenPanel ? (
            <MenuButton
              icon={<PanelIcon />}
              label="Open panel"
              onClick={() => {
                onOpenPanel();
                close();
              }}
            />
          ) : null}
          {onEdit ? (
            <MenuButton
              icon={<EditIcon />}
              label="Edit"
              onClick={() => {
                onEdit();
                close();
              }}
            />
          ) : null}
          {extra}
          {onDelete ? (
            <>
              <div className="mx-1 my-1 h-px bg-edge" />
              <MenuButton
                danger
                icon={<TrashIcon />}
                label="Move to trash"
                onClick={() => {
                  onDelete();
                  close();
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-raised ${
        danger ? "text-red-400" : "text-neutral-300 hover:text-white"
      }`}
    >
      <span className="flex w-4 justify-center text-neutral-500">{icon}</span>
      {label}
    </button>
  );
}

function icon(path: ReactNode) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function DotsIcon() {
  return icon(
    <>
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </>,
  );
}

function EditIcon() {
  return icon(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />);
}

function PanelIcon() {
  return icon(<path d="M4 5h16v14H4zM14 5v14" />);
}

function TrashIcon() {
  return icon(<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />);
}
