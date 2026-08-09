import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
import { DEAL_COLUMNS } from "../lib/columns";
import type { ResolvedColumn } from "../lib/columns";
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

// Kanban board grouped by stage, with native drag and drop between columns
// and a column-driven list view that shares the table infrastructure with
// Companies and Contacts. Stage moves are one mutation and every other
// open client sees the card move in real time.
export function Deals() {
  const board = useQuery(api.deals.board);
  const changeStage = useMutation(api.deals.changeStage);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [dragDealId, setDragDealId] = useState<Id<"deals"> | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("amountMinor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const onDrop = (stage: (typeof STAGES)[number]) => {
    setDropStage(null);
    if (!dragDealId) return;
    void changeStage({ dealId: dragDealId, stage });
    setDragDealId(null);
  };

  const allDeals: Array<BoardDeal> =
    board?.flatMap((column) => column.deals) ?? [];

  const table = useEntityTable(
    "deal",
    DEAL_COLUMNS,
    allDeals.map((d) => d._id),
  );
  const sticky = useStickyColumns(table.visible);

  const setSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
  };

  const sortDefinition = table.definitionByColumn.get(sortKey);
  const sorted = [...allDeals].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortDefinition) {
      const av = table.fieldValue(sortDefinition, a._id) ?? "";
      const bv = table.fieldValue(sortDefinition, b._id) ?? "";
      if (sortDefinition.type === "number") {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      return av.localeCompare(bv) * dir;
    }
    if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * dir;
    const pick = (deal: BoardDeal) => {
      if (sortKey === "company") return deal.company?.name ?? "";
      if (sortKey === "owner") return deal.owner?.name ?? "";
      if (sortKey === "stage") return deal.stage;
      return deal.name;
    };
    return pick(a).localeCompare(pick(b)) * dir;
  });

  const renderCell = (deal: BoardDeal, column: ResolvedColumn) => {
    const definition = table.definitionByColumn.get(column.key);
    if (definition) {
      return (
        <FieldCell
          definition={definition}
          entityId={deal._id}
          value={table.fieldValue(definition, deal._id)}
        />
      );
    }
    switch (column.key) {
      case "name":
        return <span className="text-white">{deal.name}</span>;
      case "company":
        return deal.company ? (
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
        ) : null;
      case "stage":
        return (
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
        );
      case "amountMinor":
        return (
          <span className="text-neutral-300">
            {formatMoney(deal.amountMinor, deal.currency)}
          </span>
        );
      case "owner":
        return deal.owner ? (
          <span className="flex items-center gap-2 text-neutral-400">
            <Avatar name={deal.owner.name} src={deal.owner.avatarUrl} size={18} />
            {deal.owner.name}
          </span>
        ) : null;
      default:
        return null;
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
            {view === "list" ? <ColumnsButton table={table} /> : null}
            <Button variant="primary" onClick={() => setShowNew(true)}>
              New deal
            </Button>
          </div>
        }
      />
      {showNew ? <NewDealForm onDone={() => setShowNew(false)} /> : null}

      {view === "list" ? (
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
                {sorted.map((deal) => (
                  <tr
                    key={deal._id}
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
                          {renderCell(deal, column)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function NewDealForm({ onDone }: { onDone: () => void }) {
  const companies = useQuery(api.companies.names);
  const settings = useQuery(api.tableSettings.get, { entity: "deal" });
  const create = useMutation(api.deals.create);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Workspace defaults from Settings prefill the pieces the form does not ask
  // about: stage and currency.
  const defaultStage = settings?.defaults.stage ?? "QUALIFIED";
  const defaultCurrency = settings?.defaults.currency ?? "USD";

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
        currency: defaultCurrency,
        stage: defaultStage,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  };

  return (
    <Panel className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-xs text-neutral-500">
            Deal name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-full sm:w-56">
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
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs text-neutral-500">
            Amount ({defaultCurrency})
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
      <p className="mt-2 text-xs text-neutral-600">
        New deals start in {stageLabel(defaultStage)}. Change defaults in
        Settings.
      </p>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </Panel>
  );
}
