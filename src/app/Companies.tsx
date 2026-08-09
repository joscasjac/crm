import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  ColumnsButton,
  FieldCell,
  HeaderCell,
  useEntityTable,
  useStickyColumns,
} from "../components/dataTable";
import type { StickyColumns } from "../components/dataTable";
import {
  Badge,
  Button,
  CompanyLogo,
  Input,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { COMPANY_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import { timeAgo } from "../lib/format";

type CompanyRow = Doc<"companies"> & {
  contactCount: number;
  dealCount: number;
  logoUrl?: string | null;
};

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
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  const table = useEntityTable(
    "company",
    COMPANY_COLUMNS,
    results.map((c) => c._id),
  );
  const sticky = useStickyColumns(table.visible);

  const setSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
  };

  const filtered =
    enrichmentFilter === "ALL"
      ? results
      : results.filter((c) => c.enrichmentStatus === enrichmentFilter);

  const numericKeys = new Set(["contactCount", "dealCount", "lastActivityAt"]);
  const sortDefinition = table.definitionByColumn.get(sortKey);
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortDefinition) {
      const av = table.fieldValue(sortDefinition, a._id) ?? "";
      const bv = table.fieldValue(sortDefinition, b._id) ?? "";
      if (sortDefinition.type === "number") {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      return av.localeCompare(bv) * dir;
    }
    const key = sortKey as keyof CompanyRow;
    if (numericKeys.has(sortKey)) {
      return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * dir;
    }
    return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir;
  });

  const renderCell = (company: CompanyRow, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={company._id}
          value={table.fieldValue(definition, company._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <Link
            to={`/app/companies/${company._id}`}
            className="flex items-center gap-2 text-white hover:text-accent"
          >
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
            {company.name}
          </Link>
        );
      case "domain":
        return <span className="text-neutral-400">{company.domain ?? ""}</span>;
      case "industry":
        return (
          <span className="text-neutral-400">{company.industry ?? ""}</span>
        );
      case "enrichmentStatus":
        return <EnrichmentBadge status={company.enrichmentStatus} />;
      case "contactCount":
        return <span className="text-neutral-400">{company.contactCount}</span>;
      case "dealCount":
        return <span className="text-neutral-400">{company.dealCount}</span>;
      case "lastActivityAt":
        return (
          <span className="text-neutral-500">
            {company.lastActivityAt ? timeAgo(company.lastActivityAt) : ""}
          </span>
        );
      default:
        return null;
    }
  };

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
        <div className="w-full sm:w-72">
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
          className="w-full sm:w-52"
        />
        <div className="ml-auto">
          <ColumnsButton table={table} />
        </div>
      </div>

      {showNew ? <NewCompanyForm onDone={() => setShowNew(false)} /> : null}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                {table.visible.map((column) => (
                  <HeaderCell
                    key={column.key}
                    column={column}
                    table={table}
                    sticky={sticky}
                    sort={sortKey === column.key ? sortDir : null}
                    onSort={(dir) => setSort(column.key, dir)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((company) => (
                <tr
                  key={company._id}
                  className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                >
                  {table.visible.map((column) => {
                    const pin = sticky.pinProps(column, "body");
                    return (
                      <td
                        key={column.key}
                        style={pin.style}
                        className={`whitespace-nowrap px-4 py-3 ${pin.className}`}
                      >
                        {renderCell(company, column)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <InlineAddRow columns={table.visible} sticky={sticky} />
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

// The last table row is a composer: type a name, optionally a domain, and
// Enter creates the company through the same mutation the form uses, so a
// domain still queues enrichment. Cells follow whatever columns are visible.
function InlineAddRow({
  columns,
  sticky,
}: {
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
}) {
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

  const lastKey = columns[columns.length - 1]?.key;
  const addButton = name.trim() ? (
    <Button variant="primary" onClick={() => void submit()}>
      Add
    </Button>
  ) : null;

  return (
    <tr className="bg-white/[0.01]">
      {columns.map((column) => {
        const pin = sticky.pinProps(column, "body");
        let content = null;
        if (column.key === "name") {
          content = (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder="+ Add company"
                  className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                />
                {columns.length === 1 ? addButton : null}
              </div>
              {error ? (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              ) : null}
            </>
          );
        } else if (column.key === "domain") {
          content = (
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="domain (optional)"
              className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
            />
          );
        } else if (column.key === lastKey) {
          content = <div className="text-right">{addButton}</div>;
        }
        return (
          <td
            key={column.key}
            style={pin.style}
            className={`px-4 py-2 ${pin.className}`}
          >
            {content}
          </td>
        );
      })}
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
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-xs text-neutral-500">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-full sm:w-56">
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