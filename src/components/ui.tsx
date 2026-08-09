import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { initials } from "../lib/format";

// Small shared primitives so every screen reads the same.

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-edge bg-panel ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles = {
    primary:
      "bg-primary text-primary-ink hover:bg-primary-hover border border-transparent",
    secondary:
      "bg-white/10 text-white hover:bg-white/15 border border-transparent",
    ghost: "text-neutral-400 hover:text-white border border-transparent",
    danger:
      "border border-edge text-red-400 hover:border-red-500 bg-transparent",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none ${props.className ?? ""}`}
    />
  );
}

// A themed replacement for the native select, so option lists render in the
// app's palette instead of the OS popover. Click to open, Escape or an
// outside click to close, check mark on the current value.
export function Select({
  value,
  onChange,
  options,
  className = "",
  size = "md",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border border-edge bg-ink text-left text-neutral-300 transition-colors hover:border-edge-strong focus:border-accent focus:outline-none ${pad}`}
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-9" transform="translate(0 -1.5)" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-36 overflow-y-auto rounded-md border border-edge bg-panel p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                size === "sm" ? "text-xs" : "text-sm"
              } ${
                option.value === value
                  ? "bg-raised text-white"
                  : "text-neutral-400 hover:bg-raised hover:text-white"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="m4 12 5 5L20 6" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// A number field with themed stepper arrows. The native spinner is hidden
// globally in index.css.
export function NumberInput({
  value,
  onChange,
  min,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  className?: string;
  placeholder?: string;
}) {
  const step = (delta: number) => {
    const current = Number(value);
    const next = (Number.isFinite(current) ? current : 0) + delta;
    onChange(String(min !== undefined ? Math.max(min, next) : next));
  };
  const arrow = (up: boolean) => (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {up ? <path d="m5 15 7-7 7 7" /> : <path d="m5 9 7 7 7-7" />}
    </svg>
  );
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-md border border-edge bg-ink focus-within:border-accent ${className}`}
    >
      <input
        type="number"
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
      />
      <div className="flex shrink-0 flex-col border-l border-edge">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(1)}
          className="flex flex-1 items-center px-1.5 text-neutral-500 transition-colors hover:bg-raised hover:text-white"
        >
          {arrow(true)}
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(-1)}
          className="flex flex-1 items-center border-t border-edge px-1.5 text-neutral-500 transition-colors hover:bg-raised hover:text-white"
        >
          {arrow(false)}
        </button>
      </div>
    </div>
  );
}

// A themed checkbox; the native control only takes an accent color, which is
// enough to stop it flashing OS blue on the dark canvas.
export function Checkbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-3.5 w-3.5 cursor-pointer rounded border-edge"
      style={{ accentColor: "var(--color-primary)" }}
    />
  );
}

export function Avatar({
  name,
  src,
  size = 24,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-edge text-[10px] font-medium text-neutral-300"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function CompanyLogo({
  name,
  logoUrl,
  size = 24,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded bg-edge text-[10px] font-medium text-neutral-300"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "yellow" | "red";
}) {
  const tones = {
    neutral: "border-edge text-neutral-400",
    green: "border-emerald-800 text-emerald-400",
    yellow: "border-yellow-800 text-yellow-400",
    red: "border-red-900 text-red-400",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${tones}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-edge py-12 text-sm text-neutral-500">
      {message}
    </div>
  );
}
