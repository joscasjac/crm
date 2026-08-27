import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function SlideOver({
  open,
  title,
  subtitle,
  icon,
  actions,
  onClose,
  children,
  widthClass = "max-w-[760px] sm:w-[620px]",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close panel"
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-edge bg-ink shadow-2xl transition-[transform,opacity] duration-200 ease-out ${widthClass} ${
          visible ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"
        }`}
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-white">
                {title}
              </h2>
              {subtitle ? (
                <p className="truncate text-xs text-neutral-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-edge text-neutral-500 transition-colors hover:border-edge-strong hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        </header>
        {children}
      </aside>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
