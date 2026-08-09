import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DemoBanner } from "../components/DemoBanner";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/companies", label: "Companies" },
  { to: "/app/contacts", label: "Contacts" },
  { to: "/app/deals", label: "Deals" },
  { to: "/app/agents", label: "Agents" },
  { to: "/app/settings", label: "Settings" },
];

// The CRM shell: demo banner on top, sidebar on the left, routed content on
// the right. Seeds the workspace on first visit so the demo is never empty.
export function AppLayout() {
  const info = useQuery(api.demo.info);
  const seed = useMutation(api.demo.seedPublic);

  useEffect(() => {
    if (info === null) {
      void seed();
    }
  }, [info, seed]);

  return (
    <div className="flex h-screen flex-col bg-ink">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-52 shrink-0 flex-col border-r border-edge bg-ink">
          <Link
            to="/"
            className="border-b border-edge px-4 py-4 text-sm font-semibold text-white"
          >
            CRM on Convex
          </Link>
          <nav className="flex flex-col gap-0.5 p-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-raised text-white"
                      : "text-neutral-400 hover:bg-panel hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-edge p-4 text-[11px] leading-relaxed text-neutral-500">
            Runs entirely on one Convex deployment: database, agents, crons,
            and this site.
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
