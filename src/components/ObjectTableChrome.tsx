import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "./ui";

function tinyIcon(path: ReactNode) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export const OBJECT_ICONS = {
  company: tinyIcon(
    <>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-7h6v7" />
      <path d="M8 9h.01M12 9h.01M16 9h.01" />
    </>,
  ),
  contact: tinyIcon(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  deal: tinyIcon(
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <path d="M16 15l2 2 4-5" />
    </>,
  ),
  project: tinyIcon(
    <>
      <path d="M4 6h7l2 2h7v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 13h8M8 16h5" />
    </>,
  ),
  task: tinyIcon(
    <>
      <path d="M9 11l2 2 4-5" />
      <path d="M5 4h14v16H5z" />
      <path d="M8 18h8" />
    </>,
  ),
  note: tinyIcon(
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h5" />
      <path d="M10 13h6M10 17h5" />
    </>,
  ),
  custom: tinyIcon(
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 17h6M17 14v6" />
    </>,
  ),
};

export function ObjectTableHeader({
  icon,
  title,
  selectedCount,
  primaryLabel,
  onPrimary,
  updateSlot,
  options,
}: {
  icon: ReactNode;
  title: string;
  selectedCount?: number;
  primaryLabel?: string;
  onPrimary?: () => void;
  updateSlot?: ReactNode;
  options?: ReactNode;
}) {
  return (
    <div className="-mx-6 -mt-6 border-b border-edge bg-ink px-6 py-3">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/10 text-accent">
            {icon}
          </span>
          <h1 className="truncate text-base font-semibold text-white">
            {title}
          </h1>
          {selectedCount ? (
            <>
              <span className="text-neutral-500">-&gt;</span>
              <span className="whitespace-nowrap text-sm font-medium text-neutral-400">
                {selectedCount} selected
              </span>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedCount ? updateSlot : null}
          {primaryLabel && onPrimary ? (
            <Button variant="primary" onClick={onPrimary}>
              + {primaryLabel}
            </Button>
          ) : null}
          {options ? <OptionsPanelButton>{options}</OptionsPanelButton> : null}
        </div>
      </div>
    </div>
  );
}

export function ViewBar({
  label,
  count,
  viewControl,
  children,
}: {
  label: string;
  count: number;
  viewControl?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-mx-6 mb-0 flex min-h-12 items-center justify-between gap-4 border-b border-edge bg-ink px-6 py-2">
      {viewControl ?? (
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-neutral-500">{tinyIcon(<path d="M4 7h16M4 12h16M4 17h16" />)}</span>
          <span className="truncate font-medium text-neutral-300">{label}</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500">{count}</span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-5 text-sm text-neutral-400">
        {children}
      </div>
    </div>
  );
}

export function TextToolbarButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-colors hover:text-white"
    >
      {children}
    </button>
  );
}

function OptionsPanelButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Options"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-edge text-neutral-500 transition-colors hover:border-edge-strong hover:text-white"
      >
        <span className="text-sm leading-none">...</span>
      </button>
      {mounted ? (
        <ObjectOptionsPanel visible={visible} onClose={() => setOpen(false)}>
          {children}
        </ObjectOptionsPanel>
      ) : null}
    </>
  );
}

function ObjectOptionsPanel({
  children,
  visible,
  onClose,
}: {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-edge bg-ink shadow-2xl transition-[transform,opacity] duration-200 ease-out ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <input
          autoFocus
          placeholder="Type anything..."
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none"
        />
        <button
          type="button"
          aria-label="Close options"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-edge text-neutral-500 transition-colors hover:border-edge-strong hover:text-white"
        >
          X
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-4">{children}</div>
    </aside>
  );
}

export function OptionRow({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-raised hover:text-white"
    >
      {children}
    </button>
  );
}
