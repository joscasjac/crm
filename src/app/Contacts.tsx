import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Avatar, Button, Input, PageHeader, Panel } from "../components/ui";
import { timeAgo } from "../lib/format";

export function Contacts() {
  const [search, setSearch] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    { search: search || undefined },
    { initialNumItems: 25 },
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Contacts"
        subtitle="People arrive from threads and enrichment; every field carries its evidence."
      />
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search contacts by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Panel>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-neutral-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {results.map((contact) => (
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
