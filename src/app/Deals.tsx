import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Avatar,
  Button,
  CompanyLogo,
  Input,
  NumberInput,
  PageHeader,
  Panel,
  Select,
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

type BoardDeal = FunctionReturnType<
  typeof api.deals.board
>[number]["deals"][number];

type SortKey = "name" | "company" | "stage" | "amountMinor";

// Kanban board grouped by stage, with native drag and drop between columns
// and a sortable list view. Stage moves are one mutation and every other
// open client sees the card move in real time.
export function Deals() {
  const board = useQuery(api.deals.board);
  const changeStage = useMutation(api.deals.changeStage);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [dragDealId, setDragDealId] = useState<Id<"deals"> | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("amountMinor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const onDrop = (stage: (typeof STAGES)[number]) => {
    setDropStage(null);
    if (!dragDealId) return;
    void changeStage({ dealId: dragDealId, stage });
    setDragDealId(null);
  };

  const allDeals: Array<BoardDeal> =
    board?.flatMap((column) => column.deals) ?? [];
  const sorted = [...allDeals].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * dir;
    const left =
      sortKey === "company" ? (a.company?.name ?? "") : String(a[sortKey]);
    const right =
      sortKey === "company" ? (b.company?.name ?? "") : String(b[sortKey]);
    return left.localeCompare(right) * dir;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "amountMinor" ? "desc" : "asc");
    }
  };

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle="Drag a card between stages and the dashboard rollups update in the same transaction."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-edge p-0.5 text-xs">
              {(["board", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`rounded px-2.5 py-1 capitalize transition-colors ${
                    view === mode
                      ? "bg-raised text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => setShowNew(true)}>
              New deal
            </Button>
          </div>
        }
      />
      {showNew ? <NewDealForm onDone={() => setShowNew(false)} /> : null}

      {view === "list" ? (
        <Panel>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs text-neutral-500">
                <SortHeader
                  label="Deal"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <SortHeader
                  label="Company"
                  active={sortKey === "company"}
                  dir={sortDir}
                  onClick={() => toggleSort("company")}
                />
                <SortHeader
                  label="Stage"
                  active={sortKey === "stage"}
                  dir={sortDir}
                  onClick={() => toggleSort("stage")}
                />
                <SortHeader
                  label="Amount"
                  active={sortKey === "amountMinor"}
                  dir={sortDir}
                  onClick={() => toggleSort("amountMinor")}
                />
                <th className="px-4 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((deal) => (
                <tr
                  key={deal._id}
                  className="border-b border-edge/60 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-white">{deal.name}</td>
                  <td className="px-4 py-3">
                    {deal.company ? (
                      <Link
                        to={`/app/companies/${deal.company._id}`}
                        className="flex items-center gap-2 text-neutral-400 hover:text-accent"
                      >
                        <CompanyLogo
                          name={deal.company.name}
                          logoUrl={deal.company.logoUrl}
                          size={16}
                        />
                        {deal.company.name}
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      size="sm"
                      ariaLabel="Stage"
                      value={deal.stage}
                      onChange={(stage) =>
                        void changeStage({
                          dealId: deal._id,
                          stage: stage as (typeof STAGES)[number],
                        })
                      }
                      options={STAGES.map((stage) => ({
                        value: stage,
                        label: stageLabel(stage),
                      }))}
                      className="w-36"
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatMoney(deal.amountMinor, deal.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {deal.owner ? (
                      <span className="flex items-center gap-2 text-neutral-400">
                        <Avatar
                          name={deal.owner.name}
                          src={deal.owner.avatarUrl}
                          size={18}
                        />
                        {deal.owner.name}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {board?.map((column) => (
            <div
              key={column.stage}
              className={`w-64 shrink-0 rounded-lg transition-colors ${
                dropStage === column.stage ? "bg-raised/50" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropStage(column.stage);
              }}
              onDragLeave={() => setDropStage(null)}
              onDrop={() => onDrop(column.stage)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-neutral-400">
                  {stageLabel(column.stage)}
                </span>
                <span className="text-xs text-neutral-600">
                  {column.deals.length}
                </span>
              </div>
              <div className="flex min-h-24 flex-col gap-2">
                {column.deals.map((deal) => (
                  <Panel
                    key={deal._id}
                    className={`cursor-grab p-3 active:cursor-grabbing ${
                      dragDealId === deal._id ? "opacity-40" : ""
                    }`}
                  >
                    <div
                      draggable
                      onDragStart={() => setDragDealId(deal._id)}
                      onDragEnd={() => {
                        setDragDealId(null);
                        setDropStage(null);
                      }}
                    >
                      <p className="text-sm font-medium text-white">
                        {deal.name}
                      </p>
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
                      <Select
                        size="sm"
                        ariaLabel="Stage"
                        value={deal.stage}
                        onChange={(stage) =>
                          void changeStage({
                            dealId: deal._id,
                            stage: stage as (typeof STAGES)[number],
                          })
                        }
                        options={STAGES.map((stage) => ({
                          value: stage,
                          label: stageLabel(stage),
                        }))}
                        className="mt-2"
                      />
                    </div>
                  </Panel>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 transition-colors hover:text-neutral-300 ${
          active ? "text-white" : ""
        }`}
      >
        {label}
        <span className="text-[9px]">
          {active ? (dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
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
          <Select
            ariaLabel="Company"
            value={companyId}
            onChange={setCompanyId}
            options={[
              { value: "", label: "Pick a company" },
              ...(companies?.map((company) => ({
                value: company._id,
                label: company.name,
              })) ?? []),
            ]}
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs text-neutral-500">
            Amount (USD)
          </label>
          <NumberInput value={amount} onChange={setAmount} min={0} />
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
