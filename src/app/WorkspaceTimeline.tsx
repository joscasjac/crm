import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Badge, EmptyState, PageHeader, Panel } from "../components/ui";
import { shortDate, timeAgo } from "../lib/format";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "NOTE", label: "Notes" },
  { value: "EMAIL", label: "Emails" },
  { value: "TASK", label: "Tasks" },
  { value: "CALL", label: "Calls" },
  { value: "MEETING", label: "Meetings" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];
type TimelineRow = FunctionReturnType<typeof api.activities.workspaceTimeline>[number];

export function WorkspaceTimeline() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("type");
  const type = FILTERS.some((filter) => filter.value === requested)
    ? (requested as Filter)
    : "ALL";
  const rows = useQuery(api.activities.workspaceTimeline, {
    type: type === "ALL" ? "ALL" : type,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Timeline"
        subtitle="Notes, emails, tasks, calls, and deal updates across the workspace."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() =>
              setParams(filter.value === "ALL" ? {} : { type: filter.value })
            }
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              type === filter.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-edge text-neutral-400 hover:border-edge-strong hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {rows && rows.length === 0 ? (
        <EmptyState message="No timeline activity yet" />
      ) : (
        <Panel>
          <div className="divide-y divide-edge">
            {rows?.map((row) => (
              <TimelineItem key={row._id} row={row} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function TimelineItem({ row }: { row: TimelineRow }) {
  const target =
    row.companyId && row.company
      ? { to: `/app/companies/${row.companyId}`, label: row.company.name }
      : row.contactId && row.contact
        ? { to: `/app/contacts/${row.contactId}`, label: row.contact.name }
        : row.dealId && row.deal
          ? { to: "/app/deals", label: row.deal.name }
          : null;
  const openTask = row.type === "TASK" && !row.completedAt;
  const overdue = openTask && row.dueAt !== undefined && row.dueAt < Date.now();

  return (
    <div className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[132px_minmax(0,1fr)]">
      <div className="text-xs text-neutral-600">
        <div>{shortDate(row._creationTime)}</div>
        <div>{timeAgo(row._creationTime)}</div>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={badgeTone(row.type, overdue, !!row.completedAt)}>
            {row.type === "TASK" && row.completedAt ? "TASK · done" : row.type}
          </Badge>
          {target ? (
            <Link to={target.to} className="text-accent hover:underline">
              {target.label}
            </Link>
          ) : (
            <span className="text-neutral-500">Workspace</span>
          )}
          {row.author ? (
            <span className="text-xs text-neutral-600">by {row.author.name}</span>
          ) : null}
          {openTask && row.dueAt ? (
            <span
              className={`text-xs ${
                overdue ? "text-red-400" : "text-neutral-500"
              }`}
            >
              {overdue ? "overdue" : `due ${shortDate(row.dueAt)}`}
            </span>
          ) : null}
        </div>
        <p
          className={`whitespace-pre-wrap leading-6 ${
            row.completedAt ? "text-neutral-500 line-through" : "text-neutral-300"
          }`}
        >
          {row.body}
        </p>
      </div>
    </div>
  );
}

function badgeTone(
  type: string,
  overdue: boolean | undefined,
  completed: boolean,
) {
  if (type === "TASK") {
    if (completed) return "green";
    if (overdue) return "red";
    return "yellow";
  }
  if (type === "EMAIL") return "green";
  return "neutral";
}
