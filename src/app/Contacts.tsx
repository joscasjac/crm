import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ColumnsButton,
  FieldCell,
  HeaderCell,
  useEntityTable,
  useStickyColumns,
} from "../components/dataTable";
import type { StickyColumns } from "../components/dataTable";
import {
  Avatar,
  Button,
  Input,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { CONTACT_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
import { timeAgo } from "../lib/format";

export function Contacts() {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<"ALL" | "WITH" | "WITHOUT">(
    "ALL",
  );
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  const table = useEntityTable(
    "contact",
    CONTACT_COLUMNS,
    results.map((c) => c._id),
  );
  const sticky = useStickyColumns(table.visible);

  const setSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
  };

  const filtered = results.filter((contact) => {
    if (companyFilter === "WITH") return contact.company !== null;
    if (companyFilter === "WITHOUT") return contact.company === null;
    return true;
  });

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
    if (sortKey === "lastActivityAt") {
      return ((a.lastActivityAt ?? 0) - (b.lastActivityAt ?? 0)) * dir;
    }
    const pick = (contact: (typeof results)[number]) => {
      if (sortKey === "company") return contact.company?.name ?? "";
      if (sortKey === "title") return contact.title ?? "";
      if (sortKey === "email") return contact.email ?? "";
      return contact.name;
    };
    return pick(a).localeCompare(pick(b)) * dir;
  });

  const renderCell = (
    contact: (typeof results)[number],
    column: ResolvedColumn,
  ) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={contact._id}
          value={table.fieldValue(definition, contact._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return (
          <Link
            to={`/app/contacts/${contact._id}`}
            className="flex items-center gap-2 text-white hover:text-accent"
          >
            <Avatar name={contact.name} src={contact.avatarUrl} />
            {contact.name}
          </Link>
        );
      case "title":
        return <span className="text-neutral-400">{contact.title ?? ""}</span>;
      case "email":
        return <span className="text-neutral-400">{contact.email ?? ""}</span>;
      case "company":
        return (
          <span className="text-neutral-400">
            {contact.company?.name ?? ""}
          </span>
        );
      case "lastActivityAt":
        return (
          <span className="text-neutral-500">
            {contact.lastActivityAt ? timeAgo(contact.lastActivityAt) : ""}
          </span>
        );
      default:
        return null;
    }
  };

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
        <div className="ml-auto">
          <ColumnsButton table={table} />
        </div>
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
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
              {sorted.map((contact) => (
                <tr
                  key={contact._id}
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
                        {renderCell(contact, column)}
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

// Composer row at the bottom of the table: name, optional email, optional
// company. Enter creates through the same mutation the rest of the app uses.
// Cells align to whatever columns are visible right now.
function InlineAddRow({
  columns,
  sticky,
}: {
  columns: Array<ResolvedColumn>;
  sticky: StickyColumns;
}) {
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
                  placeholder="+ Add contact"
                  className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                />
                {columns.length === 1 ? addButton : null}
              </div>
              {error ? (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              ) : null}
            </>
          );
        } else if (column.key === "email") {
          content = (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="email (optional)"
              className="w-full bg-transparent text-sm text-neutral-400 placeholder:text-neutral-700 focus:outline-none"
            />
          );
        } else if (column.key === "company") {
          content = (
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
