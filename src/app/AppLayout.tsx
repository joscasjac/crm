import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CommandK } from "../components/CommandK";
import { ComposeEmail } from "../components/ComposeEmail";
import { SignInScreen } from "../components/SignInScreen";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Panel } from "../components/ui";
import { TaskForm } from "./Tasks";

// Every nav item has a stable id; order and visibility live on the
// workspace row so they sync across tabs and reset with the demo.
export const NAV_ITEMS = [
  { id: "home", to: "/app", label: "Home", end: true },
  { id: "timeline", to: "/app/timeline", label: "Timeline" },
  { id: "tasks", to: "/app/tasks", label: "Tasks" },
  { id: "notes", to: "/app/notes", label: "Notes" },
  { id: "companies", to: "/app/companies", label: "Companies" },
  { id: "contacts", to: "/app/contacts", label: "Contacts" },
  { id: "deals", to: "/app/deals", label: "Deals" },
  { id: "projects", to: "/app/projects", label: "Projects" },
  { id: "trash", to: "/app/trash", label: "Trash" },
] as const;

// The CRM shell: demo banner on top, sidebar on the left, routed content on
// the right. Seeds the workspace on first visit so the demo is never empty.
export function AppLayout() {
  const info = useQuery(api.demo.info);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const seed = useMutation(api.demo.seedPublic);
  const requiresSignIn = info?.demoMode === false && !isAuthenticated;
  const canLoadPrefs =
    info !== undefined && (info?.demoMode !== false || isAuthenticated);
  const prefs = useQuery(api.prefs.sidebar, canLoadPrefs ? {} : "skip");
  const favorites = useQuery(api.favorites.list, canLoadPrefs ? {} : "skip");
  const customObjects = useQuery(
    api.customObjects.list,
    canLoadPrefs ? {} : "skip",
  );
  const setOrder = useMutation(api.prefs.setSidebarOrder);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickEmailOpen, setQuickEmailOpen] = useState(false);
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

  if (info === undefined || (info?.demoMode === false && isLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-sm text-neutral-500">
        Loading workspace...
      </main>
    );
  }

  if (requiresSignIn) {
    return <SignInScreen />;
  }

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
  const visibleMain = visible.filter((item) => item.id !== "timeline");
  const showTimeline = !hidden.has("timeline");

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
      <CommandK open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ComposeEmail
        open={quickEmailOpen}
        onClose={() => setQuickEmailOpen(false)}
      />
      <QuickTaskModal
        open={quickTaskOpen}
        onClose={() => setQuickTaskOpen(false)}
      />
      <QuickNoteModal
        open={quickNoteOpen}
        onClose={() => setQuickNoteOpen(false)}
      />
      {/* Mobile top bar: logo, search, and the drawer trigger. */}
      <div className="flex items-center justify-between border-b border-edge bg-ink px-4 py-3 md:hidden">
        <Link
          to="/app"
          className="flex items-baseline gap-1.5 text-sm font-semibold text-white"
        >
          CRM on Convex
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
              <QuickActions
                onTask={() => {
                  setQuickTaskOpen(true);
                  setMobileNavOpen(false);
                }}
                onNote={() => {
                  setQuickNoteOpen(true);
                  setMobileNavOpen(false);
                }}
                onEmail={() => {
                  setQuickEmailOpen(true);
                  setMobileNavOpen(false);
                }}
              />
              {favorites && favorites.length > 0 ? (
                <MobileNavGroup
                  title="Favorites"
                  items={favorites.map((item) => ({
                    id: item._id,
                    to: item.href,
                    label: item.label,
                  }))}
                  onClick={() => setMobileNavOpen(false)}
                />
              ) : null}
              {customObjects && customObjects.length > 0 ? (
                <MobileNavGroup
                  title="Custom objects"
                  items={customObjects.map((item) => ({
                    id: item._id,
                    to: `/app/objects/${item.key}`,
                    label: item.pluralLabel,
                  }))}
                  onClick={() => setMobileNavOpen(false)}
                />
              ) : null}
              {visibleMain.map((item) => (
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
              {showTimeline ? (
                <NavLink
                  to="/app/timeline"
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-raised text-white"
                        : "text-neutral-400 hover:bg-panel hover:text-white"
                    }`
                  }
                >
                  Timeline
                </NavLink>
              ) : null}
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
              to="/app"
              className="flex items-baseline gap-1.5 text-sm font-semibold text-white"
            >
              CRM on Convex
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
          <QuickActions
            onTask={() => setQuickTaskOpen(true)}
            onNote={() => setQuickNoteOpen(true)}
            onEmail={() => setQuickEmailOpen(true)}
          />
          <nav className="flex flex-col gap-0.5 p-2">
            {favorites && favorites.length > 0 ? (
              <SidebarGroup
                title="Favorites"
                items={favorites.map((item) => ({
                  id: item._id,
                  to: item.href,
                  label: item.label,
                }))}
              />
            ) : null}
            {customObjects && customObjects.length > 0 ? (
              <SidebarGroup
                title="Custom objects"
                items={customObjects.map((item) => ({
                  id: item._id,
                  to: `/app/objects/${item.key}`,
                  label: item.pluralLabel,
                }))}
              />
            ) : null}
            {visibleMain.map((item) => (
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
            {showTimeline ? (
              <NavLink
                to="/app/timeline"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-raised text-white"
                      : "text-neutral-400 hover:bg-panel hover:text-white"
                  }`
                }
              >
                Timeline
              </NavLink>
            ) : null}
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
                {isAuthenticated ? (
                  <button
                    onClick={() => void signOut()}
                    className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    Sign out
                  </button>
                ) : null}
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

function SidebarGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; to: string; label: string }>;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase text-neutral-600">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.slice(0, 8).map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              `truncate rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-raised text-white"
                  : "text-neutral-400 hover:bg-panel hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function QuickActions({
  onTask,
  onNote,
  onEmail,
}: {
  onTask: () => void;
  onNote: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="mx-2 mt-2 grid grid-cols-3 gap-1">
      <button
        type="button"
        onClick={onTask}
        title="New task"
        className="rounded-md border border-edge px-2 py-1.5 text-xs text-neutral-400 transition-colors hover:border-edge-strong hover:text-white"
      >
        Task
      </button>
      <button
        type="button"
        onClick={onNote}
        title="New note"
        className="rounded-md border border-edge px-2 py-1.5 text-xs text-neutral-400 transition-colors hover:border-edge-strong hover:text-white"
      >
        Note
      </button>
      <button
        type="button"
        onClick={onEmail}
        title="New email"
        className="rounded-md border border-edge px-2 py-1.5 text-xs text-neutral-400 transition-colors hover:border-edge-strong hover:text-white"
      >
        Email
      </button>
    </div>
  );
}

function QuickTaskModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16">
      <div className="w-full max-w-4xl">
        <TaskForm onDone={onClose} />
      </div>
    </div>
  );
}

function QuickNoteModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.activities.create);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      setError(null);
      await create({ type: "NOTE", body: trimmed });
      setBody("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16">
      <Panel className="w-full max-w-lg p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white">New note</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        <textarea
          autoFocus
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a workspace note"
          className="min-h-32 w-full resize-none rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-accent focus:outline-none"
        />
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!body.trim()}
          >
            Add note
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function MobileNavGroup({
  title,
  items,
  onClick,
}: {
  title: string;
  items: Array<{ id: string; to: string; label: string }>;
  onClick: () => void;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase text-neutral-600">
        {title}
      </p>
      {items.slice(0, 8).map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          onClick={onClick}
          className={({ isActive }) =>
            `block truncate rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-raised text-white"
                : "text-neutral-400 hover:bg-panel hover:text-white"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
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
