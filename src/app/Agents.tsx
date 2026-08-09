import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Panel,
} from "../components/ui";
import { timeAgo } from "../lib/format";

const SUGGESTED = [
  "Brief every deal owner before a renewal call",
  "Flag deals with no activity for 14 days",
  "Hand new customers from Sales to Onboarding",
];

// Agents that build agents: describe a process in a sentence and it becomes
// a versioned definition with its own status and run history.
export function Agents() {
  const agents = useQuery(api.agents.list);
  const createDraft = useMutation(api.agents.createDraft);
  const setStatus = useMutation(api.agents.setStatus);
  const remove = useMutation(api.agents.remove);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = async (text: string) => {
    try {
      setError(null);
      await createDraft({ description: text });
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Agents"
        subtitle="Definitions are data, versions are rows, deploying is a pointer move."
      />

      <Panel className="mb-6 p-4">
        <h3 className="mb-1 text-sm font-medium text-white">
          What should we get done?
        </h3>
        <p className="mb-3 text-xs text-neutral-600">
          Describe how your CRM should act. The description becomes a draft
          agent with versioned instructions.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Send a summary to the owner when a deal stalls for a week"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create(description)}
          />
          <Button variant="primary" onClick={() => void create(description)}>
            Create agent
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void create(suggestion)}
              className="rounded-full border border-edge px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-accent hover:text-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </Panel>

      {agents && agents.length === 0 ? (
        <EmptyState message="No agents yet. Describe one above." />
      ) : (
        <div className="flex flex-col gap-3">
          {agents?.map((agent) => (
            <Panel key={agent._id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-white">
                      {agent.name}
                    </h3>
                    <Badge
                      tone={
                        agent.status === "deployed"
                          ? "green"
                          : agent.status === "paused"
                            ? "yellow"
                            : "neutral"
                      }
                    >
                      {agent.status}
                    </Badge>
                    {agent.currentVersion ? (
                      <span className="text-xs text-neutral-600">
                        v{agent.currentVersion.number}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {agent.description}
                  </p>
                  {agent.currentVersion ? (
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-ink p-3 text-xs leading-relaxed text-neutral-400">
                      {agent.currentVersion.instructions}
                    </pre>
                  ) : null}
                  {agent.recentRuns.length > 0 ? (
                    <p className="mt-2 text-xs text-neutral-600">
                      Last run {timeAgo(agent.recentRuns[0].startedAt)} ·{" "}
                      {agent.recentRuns[0].status}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {agent.status === "deployed" ? (
                    <Button
                      onClick={() =>
                        void setStatus({
                          definitionId: agent._id,
                          status: "paused",
                        })
                      }
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() =>
                        void setStatus({
                          definitionId: agent._id,
                          status: "deployed",
                        })
                      }
                    >
                      Deploy
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => void remove({ definitionId: agent._id })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
