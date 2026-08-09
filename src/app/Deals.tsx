import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Avatar,
  Button,
  CompanyLogo,
  Input,
  PageHeader,
  Panel,
} from "../components/ui";
import { formatMoney, stageLabel } from "../lib/format";

const STAGES = [
  "QUALIFIED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

// Kanban board grouped by stage. Stage moves are a mutation and every other
// open client sees the card move in real time.
export function Deals() {
  const board = useQuery(api.deals.board);
  const changeStage = useMutation(api.deals.changeStage);
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle="Move a card and the dashboard rollups update in the same transaction."
        action={
          <Button variant="primary" onClick={() => setShowNew(true)}>
            New deal
          </Button>
        }
      />
      {showNew ? <NewDealForm onDone={() => setShowNew(false)} /> : null}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {board?.map((column) => (
          <div key={column.stage} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-neutral-400">
                {stageLabel(column.stage)}
              </span>
              <span className="text-xs text-neutral-600">
                {column.deals.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {column.deals.map((deal) => (
                <Panel key={deal._id} className="p-3">
                  <p className="text-sm font-medium text-white">{deal.name}</p>
                  {deal.company ? (
                    <Link
                      to={`/app/companies/${deal.company._id}`}
                      className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-accent"
                    >
                      <CompanyLogo
                        name={deal.company.name}
                        logoUrl={deal.company.logoUrl}
                        size={14}
                      />
                      {deal.company.name}
                    </Link>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">
                      {formatMoney(deal.amountMinor, deal.currency)}
                    </span>
                    {deal.owner ? (
                      <Avatar
                        name={deal.owner.name}
                        src={deal.owner.avatarUrl}
                        size={18}
                      />
                    ) : null}
                  </div>
                  <select
                    value={deal.stage}
                    onChange={(e) =>
                      void changeStage({
                        dealId: deal._id,
                        stage: e.target
                          .value as (typeof STAGES)[number],
                      })
                    }
                    className="mt-2 w-full rounded border border-edge bg-ink px-2 py-1 text-xs text-neutral-400 focus:border-accent focus:outline-none"
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabel(stage)}
                      </option>
                    ))}
                  </select>
                </Panel>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewDealForm({ onDone }: { onDone: () => void }) {
  const companies = useQuery(api.companies.names);
  const create = useMutation(api.deals.create);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      setError(null);
      const dollars = Number(amount);
      if (!Number.isFinite(dollars) || dollars < 0) {
        throw new Error("Enter a valid amount");
      }
      await create({
        name,
        companyId: companyId as Id<"companies">,
        amountMinor: Math.round(dollars * 100),
        currency: "USD",
        stage: "QUALIFIED",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <Panel className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="mb-1 block text-xs text-neutral-500">
            Deal name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-56">
          <label className="mb-1 block text-xs text-neutral-500">
            Company
          </label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          >
            <option value="">Pick a company</option>
            {companies?.map((company) => (
              <option key={company._id} value={company._id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs text-neutral-500">
            Amount (USD)
          </label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={!name.trim() || !companyId}
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
