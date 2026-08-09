import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  Badge,
  Button,
  CompanyLogo,
  Input,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { timeAgo } from "../lib/format";
import { SortHeader } from "./Deals";

type SortKey =
  | "name"
  | "domain"
  | "industry"
  | "enrichmentStatus"
  | "contactCount"
  | "dealCount"
  | "lastActivityAt";

const ENRICHMENT_FILTERS = [
  "ALL",
  "ENRICHED",
  "RESEARCHING",
  "NONE",
  "FAILED",
] as const;

export function Companies() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [enrichmentFilter, setEnrichmentFilter] =
    useState<(typeof ENRICHMENT_FILTERS)[number]>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
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

  const filtered =
    enrichmentFilter === "ALL"
      ? results
      : results.filter((c) => c.enrichmentStatus === enrichmentFilter);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (
      sortKey === "contactCount" ||
      sortKey === "dealCount" ||
      sortKey === "lastActivityAt"
    ) {
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir;
    }
    return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * dir;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Companies"
        subtitle="Every account in the pipeline. New companies with a domain enrich themselves."
        action={
          <Button variant="primary" onClick={() => setShowNew(true)}>
            New company
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-72">
          <Input
            placeholder="Search companies by name or domain"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          ariaLabel="Enrichment filter"
          value={enrichmentFilter}
          onChange={(value) =>
            setEnrichmentFilter(value as (typeof ENRICHMENT_FILTERS)[number])
          }
          options={ENRICHMENT_FILTERS.map((f) => ({
            value: f,
            label: f === "ALL" ? "All enrichment states" : f.toLowerCase(),
          }))}
          className="w-52"
        />
      </div>

      {showNew ? <NewCompanyForm onDone={() => setShowNew(false)} /> : null}

      <Panel>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <SortHeader
                label="Company"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => toggleSort("name")}
              />
              <SortHeader
                label="Domain"
                active={sortKey === "domain"}
                dir={sortDir}
                onClick={() => toggleSort("domain")}
              />
              <SortHeader
                label="Industry"
                active={sortKey === "industry"}
                dir={sortDir}
                onClick={() => toggleSort("industry")}
              />
              <SortHeader
                label="Enrichment"
                active={sortKey === "enrichmentStatus"}
                dir={sortDir}
                onClick={() => toggleSort("enrichmentStatus")}
              />
              <SortHeader
                label="Contacts"
                active={sortKey === "contactCount"}
                dir={sortDir}
                onClick={() => toggleSort("contactCount")}
              />
              <SortHeader
                label="Deals"
                active={sortKey === "dealCount"}
                dir={sortDir}
                onClick={() => toggleSort("dealCount")}
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
            {sorted.map((company) => (
              <tr
                key={company._id}
                className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/app/companies/${company._id}`}
                    className="flex items-center gap-2 text-white hover:text-accent"
                  >
                    <CompanyLogo
                      name={company.name}
                      logoUrl={company.logoUrl}
                    />
                    {company.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {company.domain ?? ""}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {company.industry ?? ""}
                </td>
                <td className="px-4 py-3">
                  <EnrichmentBadge status={company.enrichmentStatus} />
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {company.contactCount}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {company.dealCount}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {company.lastActivityAt
                    ? timeAgo(company.lastActivityAt)
                    : ""}
                </td>
              </tr>
            ))}
            <InlineAddRow />
          </tbody>
        </table>
        {status === "CanLoadMore" ? (
          <div className="border-t border-edge p-3 text-center">
            <Button onClick={() => loadMore(25)}>Load more</Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

// The last table row is a composer: type a name, optionally a domain, and
// Enter creates the company through the same mutation the form uses, so a
// domain still queues enrichment.
function InlineAddRow() {
  const create = useMutation(api.companies.create);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setError(null);
      await create({ name: name.trim(), domain: domain.trim() || undefined });
      setName("");
      setDomain("");
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
          placeholder="+ Add company"
          className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="domain (optional)"
          className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
        />
      </td>
      <td colSpan={4} className="px-4 py-2 text-xs text-red-400">
        {error ?? ""}
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

export function EnrichmentBadge({ status }: { status: string }) {
  if (status === "ENRICHED") return <Badge tone="green">Enriched</Badge>;
  if (status === "RESEARCHING") return <Badge tone="yellow">Researching</Badge>;
  if (status === "FAILED") return <Badge tone="red">Failed</Badge>;
  return <Badge>None</Badge>;
}

function NewCompanyForm({ onDone }: { onDone: () => void }) {
  const create = useMutation(api.companies.create);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      setError(null);
      await create({ name, domain: domain || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <Panel className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="mb-1 block text-xs text-neutral-500">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-56">
          <label className="mb-1 block text-xs text-neutral-500">
            Domain (optional, triggers enrichment)
          </label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
          />
        </div>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={!name.trim()}
        >
          Create
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </Panel>
  );
}
