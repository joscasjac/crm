import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Avatar,
  Button,
  Input,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { timeAgo } from "../lib/format";
import { SortHeader } from "./Deals";

type SortKey = "name" | "title" | "email" | "company" | "lastActivityAt";

export function Contacts() {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<"ALL" | "WITH" | "WITHOUT">(
    "ALL",
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "lastActivityAt" ? "desc" : "asc");
    }
  };

  const filtered = results.filter((contact) => {
    if (companyFilter === "WITH") return contact.company !== null;
    if (companyFilter === "WITHOUT") return contact.company === null;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "lastActivityAt") {
      return ((a.lastActivityAt ?? 0) - (b.lastActivityAt ?? 0)) * dir;
    }
    const left =
      sortKey === "company" ? (a.company?.name ?? "") : String(a[sortKey] ?? "");
    const right =
      sortKey === "company" ? (b.company?.name ?? "") : String(b[sortKey] ?? "");
    return left.localeCompare(right) * dir;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Contacts"
        subtitle="People arrive from threads and enrichment; every field carries its evidence."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search contacts by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          ariaLabel="Company filter"
          value={companyFilter}
          onChange={(value) =>
            setCompanyFilter(value as "ALL" | "WITH" | "WITHOUT")
          }
          options={[
            { value: "ALL", label: "All contacts" },
            { value: "WITH", label: "With a company" },
            { value: "WITHOUT", label: "No company" },
          ]}
          className="w-full sm:w-44"
        />
      </div>
      <Panel>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <SortHeader
                label="Name"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => toggleSort("name")}
              />
              <SortHeader
                label="Title"
                active={sortKey === "title"}
                dir={sortDir}
                onClick={() => toggleSort("title")}
              />
              <SortHeader
                label="Email"
                active={sortKey === "email"}
                dir={sortDir}
                onClick={() => toggleSort("email")}
              />
              <SortHeader
                label="Company"
                active={sortKey === "company"}
                dir={sortDir}
                onClick={() => toggleSort("company")}
              />
              <SortHeader
                label="Last activity"
                active={sortKey === "lastActivityAt"}
                dir={sortDir}
                onClick={() => toggleSort("lastActivityAt")}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((contact) => (
              <tr
                key={contact._id}
                className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/app/contacts/${contact._id}`}
                    className="flex items-center gap-2 text-white hover:text-accent"
                  >
                    <Avatar name={contact.name} src={contact.avatarUrl} />
                    {contact.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {contact.title ?? ""}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {contact.email ?? ""}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {contact.company?.name ?? ""}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {contact.lastActivityAt
                    ? timeAgo(contact.lastActivityAt)
                    : ""}
                </td>
              </tr>
            ))}
            <InlineAddRow />
          </tbody>
        </table>
        </div>
        {status === "CanLoadMore" ? (
          <div className="border-t border-edge p-3 text-center">
            <Button onClick={() => loadMore(25)}>Load more</Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

// Composer row at the bottom of the table: name, optional email, optional
// company. Enter creates through the same mutation the rest of the app uses.
function InlineAddRow() {
  const create = useMutation(api.contacts.create);
  const companies = useQuery(api.companies.names);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setError(null);
      await create({
        name: name.trim(),
        email: email.trim() || undefined,
        companyId: companyId ? (companyId as Id<"companies">) : undefined,
      });
      setName("");
      setEmail("");
      setCompanyId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <tr className="bg-white/[0.01]">
      <td className="px-4 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="+ Add contact"
          className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2 text-xs text-red-400">{error ?? ""}</td>
      <td className="px-4 py-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="email (optional)"
          className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2">
        <Select
          size="sm"
          ariaLabel="Company"
          value={companyId}
          onChange={setCompanyId}
          options={[
            { value: "", label: "company (optional)" },
            ...(companies?.map((company) => ({
              value: company._id,
              label: company.name,
            })) ?? []),
          ]}
        />
      </td>
      <td className="px-4 py-2 text-right">
        {name.trim() ? (
          <Button variant="primary" onClick={() => void submit()}>
            Add
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
