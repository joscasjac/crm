import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CompanyLogo, EmptyState, PageHeader, Panel } from "../components/ui";
import { formatMoney, stageLabel, timeAgo } from "../lib/format";

export function Dashboard() {
  const summary = useQuery(api.dashboard.summary);
  const activity = useQuery(api.dashboard.recentActivity);
  const upcoming = useQuery(api.agentTasks.upcoming);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Pipeline rollups are reactive aggregates; every card updates live."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Open pipeline"
          value={summary ? formatMoney(summary.openPipelineMinor, "USD") : "…"}
        />
        <Stat
          label="Open deals"
          value={summary ? String(summary.openDealCount) : "…"}
        />
        <Stat
          label="Closed won"
          value={summary ? formatMoney(summary.wonMinor, "USD") : "…"}
        />
        <Stat
          label="Companies"
          value={summary ? String(summary.companyCount) : "…"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-medium text-white">
            Pipeline by stage
          </h2>
          <div className="flex flex-col gap-2">
            {summary?.pipelineByStage.map((row) => (
              <div
                key={row.stage}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-neutral-400">
                  {stageLabel(row.stage)}
                </span>
                <span className="text-neutral-200">
                  {formatMoney(row.totalMinor, "USD")}
                  <span className="ml-2 text-neutral-600">{row.count}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-medium text-white">
            Agent follow-ups
          </h2>
          {upcoming && upcoming.length === 0 ? (
            <EmptyState message="No scheduled agent work" />
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming?.slice(0, 8).map((task) => (
                <div key={task._id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-200">
                      {task.company?.name ?? task.contact?.name ?? task.kind}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {task.dueAt > Date.now()
                        ? `in ${Math.max(1, Math.round((task.dueAt - Date.now()) / 86400000))}d`
                        : "due"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    {task.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-medium text-white">
            Recent activity
          </h2>
          <div className="flex flex-col gap-3">
            {activity?.slice(0, 8).map((row) => (
              <div key={row._id} className="flex items-start gap-2 text-sm">
                {row.company ? (
                  <Link to={`/app/companies/${row.company._id}`}>
                    <CompanyLogo
                      name={row.company.name}
                      logoUrl={row.company.logoUrl}
                      size={20}
                    />
                  </Link>
                ) : (
                  <span className="h-5 w-5 rounded bg-edge" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-neutral-300">{row.body}</p>
                  <p className="text-xs text-neutral-600">
                    {timeAgo(row._creationTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </Panel>
  );
}
