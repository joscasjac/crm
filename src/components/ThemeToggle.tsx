import { useEffect, useState } from "react";

// Light and dark mode switch. The choice lives in localStorage and an inline
// script in index.html applies it before first paint, so there is no flash.
type Theme = "dark" | "light";

function currentTheme(): Theme {
  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center gap-1.5 rounded-md border border-edge text-neutral-400 transition-colors hover:border-edge-strong hover:text-white ${
        compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
      }`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {compact ? null : label}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
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
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
