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
} from "../components/ui";
import { timeAgo } from "../lib/format";

export function Companies() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

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

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search companies by name or domain"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showNew ? <NewCompanyForm onDone={() => setShowNew(false)} /> : null}

      <Panel>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium">Enrichment</th>
              <th className="px-4 py-3 font-medium">Contacts</th>
              <th className="px-4 py-3 font-medium">Deals</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {results.map((company) => (
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
