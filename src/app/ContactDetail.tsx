import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ComposeEmail } from "../components/ComposeEmail";
import { FieldCell } from "../components/dataTable";
import { FavoriteButton } from "../components/FavoriteButton";
import { TimelinePanel } from "../components/Timeline";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  NumberInput,
  Panel,
  Select,
} from "../components/ui";

export function ContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const contact = useQuery(
    api.contacts.get,
    contactId ? { contactId: contactId as Id<"contacts"> } : "skip",
  );
  const activities = useQuery(
    api.activities.forContact,
    contactId ? { contactId: contactId as Id<"contacts"> } : "skip",
  );
  const scheduleRecheck = useMutation(api.agentTasks.scheduleRecheck);
  const updateContact = useMutation(api.contacts.update);
  const removeContact = useMutation(api.contacts.remove);
  const companies = useQuery(api.companies.names);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("14");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!contact || editing) return;
    setName(contact.name);
    setEmail(contact.email ?? "");
    setTitle(contact.title ?? "");
    setCompanyId(contact.companyId ?? "");
  }, [contact, editing]);

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

  const saveContact = async () => {
    try {
      setSaveFeedback(null);
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");
      await updateContact({
        contactId: contact._id,
        name: trimmedName,
        email: email.trim() || null,
        title: title.trim() || null,
        companyId: companyId ? (companyId as Id<"companies">) : null,
      });
      setEditing(false);
      setSaveFeedback("Saved.");
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : "Could not save");
    }
  };

  const cancelEdit = () => {
    setName(contact.name);
    setEmail(contact.email ?? "");
    setTitle(contact.title ?? "");
    setCompanyId(contact.companyId ?? "");
    setEditing(false);
    setSaveFeedback(null);
  };

  const deleteContact = async () => {
    if (!window.confirm(`Delete ${contact.name}? This also removes their timeline and facts.`)) {
      return;
    }
    try {
      await removeContact({ contactId: contact._id });
      navigate("/app/contacts");
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={contact.name} src={contact.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
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
        <div className="flex items-center gap-2">
          <FavoriteButton
            label={contact.name}
            href={`/app/contacts/${contact._id}`}
            kind="record"
            entityType="contact"
            entityId={contact._id}
          />
          <Button onClick={() => setComposeOpen(true)}>Email</Button>
          <Button variant="danger" onClick={() => void deleteContact()}>
            Delete
          </Button>
        </div>
      </div>

      <ComposeEmail
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaultTo={contact.email ?? ""}
        contactId={contact._id}
        companyId={contact.companyId ?? undefined}
      />

      <Panel className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-white">Contact details</h3>
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => void saveContact()}>
                Save
              </Button>
              <Button variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-neutral-500">
              Name
              <Input
                className="mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="text-xs text-neutral-500">
              Title
              <Input
                className="mt-1"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add title"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Email
              <Input
                className="mt-1"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Add email"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Company
              <Select
                className="mt-1"
                ariaLabel="Company"
                value={companyId}
                onChange={setCompanyId}
                options={[
                  { value: "", label: "No company" },
                  ...(companies?.map((company) => ({
                    value: company._id,
                    label: company.name,
                  })) ?? []),
                ]}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailLine label="Title" value={contact.title ?? "Not set"} />
            <DetailLine label="Email" value={contact.email ?? "Not set"} />
            <DetailLine
              label="Company"
              value={contact.company?.name ?? "Not set"}
            />
          </div>
        )}
        {saveFeedback ? (
          <p className="mt-3 text-xs text-neutral-400">{saveFeedback}</p>
        ) : null}
      </Panel>

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
              <NumberInput
                value={days}
                onChange={setDays}
                min={1}
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

      <div className="mt-4">
        <CustomFieldsPanel contactId={contact._id} />
      </div>

      <div className="mt-4">
        <h3 className="mb-3 text-sm font-medium text-white">Timeline</h3>
        <TimelinePanel contactId={contact._id} activities={activities} />
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="mt-0.5 truncate text-neutral-300">{value}</p>
    </div>
  );
}

function CustomFieldsPanel({ contactId }: { contactId: Id<"contacts"> }) {
  const fields = useQuery(api.fields.forEntity, {
    entity: "contact",
    entityId: contactId,
  });
  if (!fields || fields.length === 0) return null;
  return (
    <Panel className="p-4">
      <h3 className="mb-2 text-sm font-medium text-white">Custom fields</h3>
      <div className="flex flex-col gap-1.5">
        {fields.map((field) => (
          <div
            key={field.definition._id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="shrink-0 text-neutral-500">
              {field.definition.label}
              {field.definition.agentFilled ? (
                <span className="ml-2 text-[10px] text-accent">agent</span>
              ) : null}
            </span>
            <div className="min-w-0 max-w-56 flex-1 text-right">
              <FieldCell
                definition={field.definition}
                entityId={contactId}
                value={field.value ?? undefined}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
