// Shared column model for the Companies, Contacts, and Deals tables.
// Built-in columns are declared here once; active custom field definitions
// become extra columns with a `field:` key prefix. The tableSettings table
// stores sparse per-column overrides (label, hidden, pinned) and this module
// merges the two. Registry order is canonical: overrides never reorder
// columns, pinning only partitions them to the front.

export type ColumnPref = {
  key: string;
  label?: string;
  hidden?: boolean;
  pinned?: boolean;
};

export type BuiltinColumn = {
  key: string;
  label: string;
  // The primary column anchors the row (name link, avatar) so it can be
  // pinned and renamed but never hidden.
  locked?: boolean;
};

export type ResolvedColumn = {
  key: string;
  label: string;
  defaultLabel: string;
  hidden: boolean;
  pinned: boolean;
  locked: boolean;
  custom: boolean;
};

export const COMPANY_COLUMNS: Array<BuiltinColumn> = [
  { key: "name", label: "Company", locked: true },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "enrichmentStatus", label: "Enrichment" },
  { key: "contactCount", label: "Contacts" },
  { key: "dealCount", label: "Deals" },
  { key: "lastActivityAt", label: "Last activity" },
];

export const CONTACT_COLUMNS: Array<BuiltinColumn> = [
  { key: "name", label: "Name", locked: true },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "lastActivityAt", label: "Last activity" },
];

export const DEAL_COLUMNS: Array<BuiltinColumn> = [
  { key: "name", label: "Deal", locked: true },
  { key: "company", label: "Company" },
  { key: "stage", label: "Stage" },
  { key: "amountMinor", label: "Amount" },
  { key: "owner", label: "Owner" },
];

export const FIELD_COLUMN_PREFIX = "field:";

export const fieldColumnKey = (fieldKey: string) =>
  `${FIELD_COLUMN_PREFIX}${fieldKey}`;

export function resolveColumns(
  builtins: Array<BuiltinColumn>,
  customs: Array<{ key: string; label: string }>,
  prefs: Array<ColumnPref>,
): Array<ResolvedColumn> {
  const prefByKey = new Map(prefs.map((pref) => [pref.key, pref]));
  const merge = (
    key: string,
    defaultLabel: string,
    locked: boolean,
    custom: boolean,
  ): ResolvedColumn => {
    const pref = prefByKey.get(key);
    return {
      key,
      label: pref?.label?.trim() || defaultLabel,
      defaultLabel,
      hidden: locked ? false : (pref?.hidden ?? false),
      pinned: pref?.pinned ?? false,
      locked,
      custom,
    };
  };
  const all = [
    ...builtins.map((b) => merge(b.key, b.label, b.locked ?? false, false)),
    ...customs.map((c) => merge(c.key, c.label, false, true)),
  ];
  return [...all.filter((c) => c.pinned), ...all.filter((c) => !c.pinned)];
}

// Merge one column's override into the sparse pref list. Entries that end
// up carrying no information are dropped so the stored array stays small.
export function upsertPref(
  prefs: Array<ColumnPref>,
  key: string,
  patch: { label?: string; hidden?: boolean; pinned?: boolean },
): Array<ColumnPref> {
  const existing = prefs.find((pref) => pref.key === key);
  const next: ColumnPref = { key };
  const label =
    patch.label !== undefined ? patch.label.trim() : existing?.label;
  if (label) next.label = label;
  const hidden = patch.hidden !== undefined ? patch.hidden : existing?.hidden;
  if (hidden) next.hidden = true;
  const pinned = patch.pinned !== undefined ? patch.pinned : existing?.pinned;
  if (pinned) next.pinned = true;

  const rest = prefs.filter((pref) => pref.key !== key);
  const isEmpty = !next.label && !next.hidden && !next.pinned;
  return isEmpty ? rest : [...rest, next];
}
