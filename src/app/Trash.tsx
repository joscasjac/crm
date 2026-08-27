import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, EmptyState, PageHeader, Panel } from "../components/ui";
import { formatMoney, stageLabel, timeAgo } from "../lib/format";

export function Trash() {
  const trash = useQuery(api.trash.list);
  const restoreCompany = useMutation(api.trash.restoreCompany);
  const restoreContact = useMutation(api.trash.restoreContact);
  const restoreDeal = useMutation(api.trash.restoreDeal);

  const empty =
    trash &&
    trash.companies.length === 0 &&
    trash.contacts.length === 0 &&
    trash.deals.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Trash"
        subtitle="Recover deleted companies, contacts, and deals."
      />
      {trash === undefined ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : empty ? (
        <EmptyState message="Trash is empty" />
      ) : (
        <div className="grid gap-4">
          <TrashSection title="Companies">
            {trash.companies.map((company) => (
              <TrashRow
                key={company._id}
                title={company.name}
                subtitle={company.domain ?? "Company"}
                deletedAt={company.deletedAt}
                onRestore={() =>
                  void restoreCompany({
                    companyId: company._id as Id<"companies">,
                  })
                }
              />
            ))}
          </TrashSection>
          <TrashSection title="Contacts">
            {trash.contacts.map((contact) => (
              <TrashRow
                key={contact._id}
                title={contact.name}
                subtitle={contact.email ?? "Contact"}
                deletedAt={contact.deletedAt}
                onRestore={() =>
                  void restoreContact({
                    contactId: contact._id as Id<"contacts">,
                  })
                }
              />
            ))}
          </TrashSection>
          <TrashSection title="Deals">
            {trash.deals.map((deal) => (
              <TrashRow
                key={deal._id}
                title={deal.name}
                subtitle={`${stageLabel(deal.stage)} · ${formatMoney(deal.amountMinor, deal.currency)}`}
                deletedAt={deal.deletedAt}
                onRestore={() =>
                  void restoreDeal({ dealId: deal._id as Id<"deals"> })
                }
              />
            ))}
          </TrashSection>
        </div>
      )}
    </div>
  );
}

function TrashSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel>
      <div className="border-b border-edge px-4 py-3">
        <h2 className="text-sm font-medium text-white">{title}</h2>
      </div>
      <div>{children}</div>
    </Panel>
  );
}

function TrashRow({
  title,
  subtitle,
  deletedAt,
  onRestore,
}: {
  title: string;
  subtitle: string;
  deletedAt: number;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge/60 px-4 py-3 text-sm last:border-0">
      <div className="min-w-0">
        <p className="truncate text-white">{title}</p>
        <p className="truncate text-xs text-neutral-500">
          {subtitle} · deleted {timeAgo(deletedAt)}
        </p>
      </div>
      <Button onClick={onRestore}>Restore</Button>
    </div>
  );
}
