import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  Avatar,
  Badge,
  Button,
  Input,
  PageHeader,
  Panel,
} from "../components/ui";

export function Settings() {
  const users = useQuery(api.users.list);
  const definitions = useQuery(api.fields.listDefinitions, {
    entity: "company",
  });
  const createDefinition = useMutation(api.fields.createDefinition);
  const archiveDefinition = useMutation(api.fields.archiveDefinition);
  const [label, setLabel] = useState("");
  const [agentBrief, setAgentBrief] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addField = async () => {
    try {
      setError(null);
      await createDefinition({
        entity: "company",
        key: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label,
        type: "text",
        agentFilled: agentBrief.trim().length > 0,
        agentBrief: agentBrief.trim() || undefined,
      });
      setLabel("");
      setAgentBrief("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create field");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Workspace, team, and custom fields."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Team</h3>
          <div className="flex flex-col gap-2">
            {users?.map((user) => (
              <div key={user._id} className="flex items-center gap-2 text-sm">
                <Avatar name={user.name} src={user.avatarUrl} />
                <span className="text-neutral-200">{user.name}</span>
                <span className="text-neutral-600">{user.email}</span>
                {user.role ? <Badge>{user.role}</Badge> : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-neutral-600">
            Sign-in is disabled on this demo. In a real install Convex Auth
            handles sign-in and this table maps to authenticated users, with
            an allow list that fails closed.
          </p>
        </Panel>

        <Panel className="p-4">
          <h3 className="mb-3 text-sm font-medium text-white">
            Integrations
          </h3>
          <div className="flex flex-col gap-3 text-sm">
            <IntegrationRow
              name="Context.dev brand data"
              detail="Set CONTEXT_DEV_API_KEY on the deployment to enable company enrichment."
            />
            <IntegrationRow
              name="OpenAI"
              detail="Set OPENAI_API_KEY to enable record chat and agent reasoning."
            />
            <IntegrationRow
              name="Resend email"
              detail="Set RESEND_API_KEY to enable outbound email. Not configured on this demo."
            />
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 p-4">
        <h3 className="mb-1 text-sm font-medium text-white">
          Custom company fields
        </h3>
        <p className="mb-3 text-xs text-neutral-600">
          Give a field an agent brief and the agent fills it during research,
          with evidence recorded in the ledger.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="mb-1 block text-xs text-neutral-500">
              Label
            </label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="w-80">
            <label className="mb-1 block text-xs text-neutral-500">
              Agent brief (optional)
            </label>
            <Input
              value={agentBrief}
              onChange={(e) => setAgentBrief(e.target.value)}
              placeholder="What should the agent put here?"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => void addField()}
            disabled={!label.trim()}
          >
            Add field
          </Button>
        </div>
        {error ? <p className="mb-3 text-xs text-red-400">{error}</p> : null}
        <div className="flex flex-col gap-2">
          {definitions?.map((definition) => (
            <div
              key={definition._id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-neutral-200">
                {definition.label}
                {definition.agentFilled ? (
                  <span className="ml-2 text-[10px] text-accent">agent</span>
                ) : null}
                {definition.archived ? (
                  <span className="ml-2 text-[10px] text-neutral-600">
                    archived
                  </span>
                ) : null}
              </span>
              {!definition.archived ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void archiveDefinition({ fieldId: definition._id })
                  }
                >
                  Archive
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function IntegrationRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div>
      <p className="text-neutral-200">{name}</p>
      <p className="text-xs text-neutral-600">{detail}</p>
    </div>
  );
}
