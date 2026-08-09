import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Checkbox, Input, NumberInput, Panel } from "./ui";
import { timeAgo } from "../lib/format";

// The shared notes-and-tasks surface used by company and contact detail.
// Every write goes through activities.create, which also feeds the Activity
// page and can schedule an email reminder through the selected provider.

type ActivityRow = FunctionReturnType<
  typeof api.activities.forCompany
>[number];

const DAY = 86_400_000;

export function TimelineComposer({
  companyId,
  contactId,
}: {
  companyId?: Id<"companies">;
  contactId?: Id<"contacts">;
}) {
  const create = useMutation(api.activities.create);
  const capabilities = useQuery(api.capabilities.status);
  const provider = useQuery(api.email.provider);

  const [mode, setMode] = useState<"NOTE" | "TASK">("NOTE");
  const [body, setBody] = useState("");
  const [dueDays, setDueDays] = useState("3");
  const [remind, setRemind] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailReady =
    provider && capabilities
      ? provider === "agentmail"
        ? capabilities.agentmail
        : capabilities.resend
      : false;

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await create({
        type: mode,
        body: trimmed,
        companyId,
        contactId,
        dueAt:
          mode === "TASK"
            ? Date.now() + Math.max(0, Number(dueDays) || 0) * DAY
            : undefined,
        remindMe: mode === "TASK" ? remind : undefined,
      });
      setBody("");
      setRemind(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 rounded-md border border-edge p-0.5 text-xs">
          {(["NOTE", "TASK"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={`rounded px-2.5 py-1 capitalize transition-colors ${
                mode === option
                  ? "bg-raised text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
        <Input
          placeholder={
            mode === "NOTE"
              ? "Log a note on the timeline"
              : "What needs doing?"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        <Button variant="primary" onClick={() => void submit()}>
          Add
        </Button>
      </div>
      {mode === "TASK" ? (
        <div className="flex flex-wrap items-center gap-3 pl-1 text-xs text-neutral-500">
          <span className="flex items-center gap-2">
            due in
            <NumberInput
              value={dueDays}
              onChange={setDueDays}
              min={0}
              className="w-20"
            />
            days
          </span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <Checkbox checked={remind} onChange={setRemind} ariaLabel="Email me a reminder" />
            email me a reminder
          </label>
          {remind && !emailReady ? (
            <span className="text-yellow-400">
              No email key is configured; the reminder will log a skip.
            </span>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

export function TimelineFeed({
  activities,
}: {
  activities: Array<ActivityRow> | undefined;
}) {
  const completeTask = useMutation(api.activities.completeTask);

  if (activities && activities.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-neutral-600">No activity yet</p>
    );
  }
  return (
    <>
      {activities?.map((activity) => {
        const openTask = activity.type === "TASK" && !activity.completedAt;
        const overdue =
          openTask && activity.dueAt !== undefined && activity.dueAt < Date.now();
        return (
          <div
            key={activity._id}
            className="border-b border-edge/60 px-4 py-3 text-sm last:border-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Badge
                  tone={
                    activity.type === "TASK"
                      ? activity.completedAt
                        ? "green"
                        : overdue
                          ? "red"
                          : "yellow"
                      : "neutral"
                  }
                >
                  {activity.type === "TASK" && activity.completedAt
                    ? "TASK · done"
                    : activity.type}
                </Badge>
                {openTask && activity.dueAt ? (
                  <span
                    className={`text-xs ${overdue ? "text-red-400" : "text-neutral-500"}`}
                  >
                    {overdue
                      ? "overdue"
                      : `due in ${Math.max(1, Math.round((activity.dueAt - Date.now()) / DAY))}d`}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-3">
                {openTask ? (
                  <button
                    onClick={() =>
                      void completeTask({ activityId: activity._id })
                    }
                    className="text-xs text-neutral-500 transition-colors hover:text-emerald-400"
                  >
                    Complete
                  </button>
                ) : null}
                <span className="text-xs text-neutral-600">
                  {timeAgo(activity._creationTime)}
                </span>
              </span>
            </div>
            <p
              className={`mt-1 ${
                activity.completedAt
                  ? "text-neutral-500 line-through"
                  : "text-neutral-300"
              }`}
            >
              {activity.body}
            </p>
          </div>
        );
      })}
    </>
  );
}

export function TimelinePanel({
  companyId,
  contactId,
  activities,
}: {
  companyId?: Id<"companies">;
  contactId?: Id<"contacts">;
  activities: Array<ActivityRow> | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TimelineComposer companyId={companyId} contactId={contactId} />
      <Panel>
        <TimelineFeed activities={activities} />
      </Panel>
    </div>
  );
}
