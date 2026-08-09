import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CommandK } from "../components/CommandK";
import { DemoBanner } from "../components/DemoBanner";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { ThemeToggle } from "../components/ThemeToggle";

// Every nav item has a stable id; order and visibility live on the
// workspace row so they sync across tabs and reset with the demo.
export const NAV_ITEMS = [
  { id: "dashboard", to: "/app", label: "Dashboard", end: true },
  { id: "companies", to: "/app/companies", label: "Companies" },
  { id: "contacts", to: "/app/contacts", label: "Contacts" },
  { id: "deals", to: "/app/deals", label: "Deals" },
  { id: "ask", to: "/app/ask", label: "Ask" },
  { id: "agents", to: "/app/agents", label: "Agents" },
  { id: "activity", to: "/app/activity", label: "Activity" },
] as const;

// The CRM shell: demo banner on top, sidebar on the left, routed content on
// the right. Seeds the workspace on first visit so the demo is never empty.
export function AppLayout() {
  const info = useQuery(api.demo.info);
  const seed = useMutation(api.demo.seedPublic);
  const prefs = useQuery(api.prefs.sidebar);
  const setOrder = useMutation(api.prefs.setSidebarOrder);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // Attio-style rail toggle; the preference sticks per browser.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("crm-sidebar-collapsed") === "1",
  );
  const toggleSidebar = () => {
    setCollapsed((value) => {
      localStorage.setItem("crm-sidebar-collapsed", value ? "0" : "1");
      return !value;
    });
  };

  useEffect(() => {
    if (info === null) {
      void seed();
    }
  }, [info, seed]);

  // Global keys: Cmd K search, Cmd ? shortcuts, Cmd . sidebar. Ctrl works
  // as the modifier on non-Mac keyboards. Cmd Shift / reports "?" on most
  // layouts but "/" with shiftKey on some, so match both.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (e.key === ".") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // Apply saved order, append anything new, drop hidden items.
  const savedOrder = prefs?.order;
  const hidden = new Set(prefs?.hidden ?? []);
  const ordered = savedOrder
    ? [
        ...savedOrder
          .map((id) => NAV_ITEMS.find((item) => item.id === id))
          .filter((item): item is (typeof NAV_ITEMS)[number] => !!item),
        ...NAV_ITEMS.filter((item) => !savedOrder.includes(item.id)),
      ]
    : [...NAV_ITEMS];
  const visible = ordered.filter((item) => !hidden.has(item.id));

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids: Array<string> = ordered.map((item) => item.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    void setOrder({ order: ids });
  };

  return (
    <div className="flex h-screen flex-col bg-ink">
      <DemoBanner />
      <CommandK open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      {/* Mobile top bar: logo, search, and the drawer trigger. */}
      <div className="flex items-center justify-between border-b border-edge bg-ink px-4 py-3 md:hidden">
        <Link
          to="/"
          className="flex items-baseline gap-1.5 text-sm font-semibold text-white"
        >
          CRM on Convex
          <span className="rounded border border-edge px-1 py-px text-[9px] font-medium uppercase tracking-wide text-neutral-500">
            demo
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            title="Search"
            className="rounded-md p-2 text-neutral-400 transition-colors hover:text-white"
          >
            <SearchIcon />
          </button>
          <button
            onClick={() => setMobileNavOpen(true)}
            title="Menu"
            className="rounded-md p-2 text-neutral-400 transition-colors hover:text-white"
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {/* Mobile drawer: plain links, no drag to reorder. */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-64 max-w-[85vw] flex-col border-l border-edge bg-ink">
            <div className="flex items-center justify-between border-b border-edge px-4 py-4">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                title="Close menu"
                className="rounded-md p-1 text-neutral-400 transition-colors hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 overflow-y-auto p-2">
              {visible.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={"end" in item ? item.end : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-raised text-white"
                        : "text-neutral-400 hover:bg-panel hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/app/settings"
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-raised text-white"
                      : "text-neutral-400 hover:bg-panel hover:text-white"
                  }`
                }
              >
                Settings
              </NavLink>
              <Link
                to="/docs"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-panel hover:text-white"
              >
                Docs
              </Link>
            </nav>
            <div className="mt-auto border-t border-edge p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <a
                    href="https://github.com/waynesutton/trycrm-convex"
                    className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    GitHub
                  </a>
                  <a
                    href="https://github.com/waynesutton/trycrm-convex/fork"
                    className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    Fork
                  </a>
                </div>
                <ThemeToggle compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            title="Show sidebar"
            className="absolute left-3 top-3 z-20 hidden rounded-md border border-edge bg-panel p-1.5 text-neutral-400 transition-colors hover:text-white md:block"
          >
            <SidebarIcon />
          </button>
        ) : null}
        <aside
          className={`hidden w-52 shrink-0 flex-col border-r border-edge bg-ink ${
            collapsed ? "" : "md:flex"
          }`}
        >
          <div className="flex items-center justify-between border-b border-edge px-4 py-4">
            <Link
              to="/"
              className="flex items-baseline gap-1.5 text-sm font-semibold text-white"
            >
              CRM on Convex
              <span className="rounded border border-edge px-1 py-px text-[9px] font-medium uppercase tracking-wide text-neutral-500">
                demo
              </span>
            </Link>
            <button
              onClick={toggleSidebar}
              title="Hide sidebar"
              className="text-neutral-500 transition-colors hover:text-white"
            >
              <SidebarIcon />
            </button>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-edge px-3 py-1.5 text-left text-sm text-neutral-500 transition-colors hover:border-accent hover:text-neutral-300"
          >
            <SearchIcon />
            Search
            <kbd className="ml-auto rounded border border-edge px-1 text-[10px] text-neutral-600">
              ⌘K
            </kbd>
          </button>
          <nav className="flex flex-col gap-0.5 p-2">
            {visible.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={"end" in item ? item.end : undefined}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(item.id)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors ${
                    dragId === item.id ? "opacity-40" : ""
                  } ${
                    isActive
                      ? "bg-raised text-white"
                      : "text-neutral-400 hover:bg-panel hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-raised text-white"
                    : "text-neutral-400 hover:bg-panel hover:text-white"
                }`
              }
            >
              Settings
            </NavLink>
            <Link
              to="/docs"
              className="rounded-md px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-panel hover:text-white"
            >
              Docs
            </Link>
          </nav>
          <p className="px-4 pt-1 text-[10px] text-neutral-600">
            Drag items to reorder. Hide them in Settings.
          </p>
          <div className="mt-auto border-t border-edge p-4">
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Runs entirely on one Convex deployment: database, agents, crons,
              and this site.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/waynesutton/trycrm-convex"
                  className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/waynesutton/trycrm-convex/fork"
                  className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                >
                  Fork
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShortcutsOpen(true)}
                  title="Keyboard shortcuts (⌘?)"
                  className="text-neutral-500 transition-colors hover:text-white"
                >
                  <KeyboardIcon />
                </button>
                <ThemeToggle compact />
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Phosphor's SidebarSimple, inlined from phosphoricons.com (MIT).
function SidebarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor">
      <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H80V200H40ZM216,200H96V56H216V200Z" />
    </svg>
  );
}

// Phosphor's Keyboard, inlined from phosphoricons.com (MIT).
function KeyboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
      <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,144H32V64H224V192ZM48,136a8,8,0,0,1,8-8H200a8,8,0,0,1,0,16H56A8,8,0,0,1,48,136Zm0-32a8,8,0,0,1,8-8H200a8,8,0,0,1,0,16H56A8,8,0,0,1,48,104Zm8,56H72a8,8,0,0,1,0,16H56a8,8,0,0,1,0-16Zm40,0h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm104,0a8,8,0,0,1,0,16H184a8,8,0,0,1,0-16Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// Phosphor's List, inlined from phosphoricons.com (MIT).
function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
      <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

// Phosphor's X, inlined from phosphoricons.com (MIT).
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
    </svg>
  );
}
