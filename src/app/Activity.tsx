import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Input,
  PageHeader,
  Panel,
} from "../components/ui";

type LogRow = {
  _id: Id<"logEvents">;
  _creationTime: number;
  kind: "M" | "A" | "C";
  fn: string;
  status: "success" | "error" | "info";
  message: string;
};

// The activity log, in the shape of the Convex dashboard's logs page: one
// row per notable function outcome, newest first, live. Pause freezes the
// view without dropping the subscription; Clear wipes the table for everyone.
// The demo reset cron wipes it too, every ten minutes.
export function Activity() {
  const live = useQuery(api.logs.list);
  const clear = useMutation(api.logs.clear);
  const clearMany = useMutation(api.logs.clearMany);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const frozen = useRef<Array<LogRow> | null>(null);

  useEffect(() => {
    if (paused && frozen.current === null && live) {
      frozen.current = live;
    }
    if (!paused) {
      frozen.current = null;
    }
  }, [paused, live]);

  const rows = (paused ? (frozen.current ?? live) : live) ?? [];
  const term = filter.trim().toLowerCase();
  const shown = term
    ? rows.filter(
        (row) =>
          row.fn.toLowerCase().includes(term) ||
          row.message.toLowerCase().includes(term),
      )
    : rows;

  // Selection tracks visible rows only; select-all toggles everything shown.
  const shownSelected = shown.filter((row) => selected.has(row._id));
  const allShownSelected =
    shown.length > 0 && shownSelected.length === shown.length;
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(
      allShownSelected ? new Set() : new Set(shown.map((row) => row._id)),
    );
  };
  const clearSelected = async () => {
    await clearMany({ ids: shownSelected.map((row) => row._id) });
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Activity"
        subtitle="Every notable function outcome, live from the deployment. Timeline writes land here too. Resets with the demo."
        action={
          <div className="flex gap-2">
            <Button onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </Button>
            {shownSelected.length > 0 ? (
              <Button variant="danger" onClick={() => void clearSelected()}>
                Clear selected ({shownSelected.length})
              </Button>
            ) : (
              <Button variant="danger" onClick={() => void clear()}>
                Clear logs
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Filter logs by function or message"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {paused ? (
        <p className="mb-3 text-xs text-yellow-400">
          Paused. New events keep arriving on the server; Resume to catch up.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState message="No log events yet. Create a company or move a deal and watch this fill in." />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                <th className="w-8 px-4 py-3">
                  <Checkbox
                    checked={allShownSelected}
                    onChange={toggleAll}
                    ariaLabel="Select all"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Function</th>
                <th className="px-4 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {shown.map((row) => (
                <tr
                  key={row._id}
                  className={`border-b border-edge/60 last:border-0 hover:bg-white/[0.02] ${
                    selected.has(row._id) ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <Checkbox
                      checked={selected.has(row._id)}
                      onChange={() => toggleRow(row._id)}
                      ariaLabel="Select row"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {new Date(row._creationTime).toLocaleTimeString([], {
                      hour12: false,
                    })}
                    .
                    {String(Math.floor(row._creationTime % 1000)).padStart(3, "0")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-raised px-1.5 py-0.5 text-neutral-400">
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        row.status === "success"
                          ? "green"
                          : row.status === "error"
                            ? "red"
                            : "neutral"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-300">
                    {row.fn}
                  </td>
                  <td className="max-w-md truncate px-4 py-2 text-neutral-500">
                    {row.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
