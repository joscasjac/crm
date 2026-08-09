import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  Panel,
} from "../components/ui";
import { timeAgo } from "../lib/format";

export function ContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const contact = useQuery(
    api.contacts.get,
    contactId ? { contactId: contactId as Id<"contacts"> } : "skip",
  );
  const activities = useQuery(
    api.activities.forContact,
    contactId ? { contactId: contactId as Id<"contacts"> } : "skip",
  );
  const scheduleRecheck = useMutation(api.agentTasks.scheduleRecheck);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("14");
  const [feedback, setFeedback] = useState<string | null>(null);

  if (contact === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }
  if (contact === null) {
    return <EmptyState message="Contact not found. It may have been reset." />;
  }

  const recheck = async () => {
    try {
      setFeedback(null);
      await scheduleRecheck({
        reason,
        dueInDays: Number(days) || 14,
        contactId: contact._id,
        companyId: contact.companyId ?? undefined,
      });
      setReason("");
      setFeedback("Recheck scheduled.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not schedule");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={contact.name} src={contact.avatarUrl} size={40} />
        <div>
          <h1 className="text-xl font-semibold text-white">{contact.name}</h1>
          <p className="text-sm text-neutral-500">
            {[contact.title, contact.email].filter(Boolean).join(" · ")}
            {contact.company ? (
              <>
                {" · "}
                <Link
                  to={`/app/companies/${contact.company._id}`}
                  className="text-neutral-300 hover:text-accent"
                >
                  {contact.company.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h3 className="mb-3 text-sm font-medium text-white">
            Facts and evidence
          </h3>
          {contact.facts.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No recorded facts. Nothing about a person is guessed; fields fill
              when there is evidence.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {contact.facts.map((fact) => (
                <div key={fact._id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">{fact.field}</span>
                    <Badge
                      tone={fact.band === "CONFIRMED" ? "green" : "yellow"}
                    >
                      {fact.band}
                    </Badge>
                  </div>
                  <p className="text-neutral-200">{fact.value}</p>
                  <p className="text-xs text-neutral-600">
                    evidence: {fact.evidenceKind}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <h3 className="mb-1 text-sm font-medium text-white">
            Schedule a recheck
          </h3>
          <p className="mb-3 text-xs text-neutral-600">
            The agent books its own follow-ups, but only with a reason. An
            agent that cannot say why it will be back does not have a reason,
            it has a default.
          </p>
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Why should the agent check back?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-neutral-500">days from now</span>
              <Button variant="primary" onClick={() => void recheck()}>
                Schedule
              </Button>
            </div>
            {feedback ? (
              <p className="text-xs text-neutral-400">{feedback}</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <h3 className="border-b border-edge px-4 py-3 text-sm font-medium text-white">
          Timeline
        </h3>
        {activities && activities.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-600">No activity yet</p>
        ) : (
          activities?.map((activity) => (
            <div
              key={activity._id}
              className="border-b border-edge/60 px-4 py-3 text-sm last:border-0"
            >
              <div className="flex items-center justify-between">
                <Badge>{activity.type}</Badge>
                <span className="text-xs text-neutral-600">
                  {timeAgo(activity._creationTime)}
                </span>
              </div>
              <p className="mt-1 text-neutral-300">{activity.body}</p>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
