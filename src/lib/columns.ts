// Shared column model for the Companies, Contacts, and Deals tables.
// Built-in columns are declared here once; active custom field definitions
// become extra columns with a `field:` key prefix. The tableSettings table
// stores sparse per-column overrides (label, hidden, pinned) and this module
// merges the two. Preference array order becomes display order, and pinning
// partitions pinned columns to the front while preserving that order.

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

export const PROJECT_COLUMNS: Array<BuiltinColumn> = [
  { key: "name", label: "Project", locked: true },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "dueAt", label: "Due" },
  { key: "company", label: "Company" },
  { key: "deal", label: "Deal" },
];

export const TASK_COLUMNS: Array<BuiltinColumn> = [
  { key: "title", label: "Task", locked: true },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Owner" },
  { key: "dueAt", label: "Due" },
  { key: "project", label: "Project" },
  { key: "links", label: "CRM link" },
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
  const orderByKey = new Map(prefs.map((pref, index) => [pref.key, index]));
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
  ].sort((a, b) => {
    const ao = orderByKey.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const bo = orderByKey.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
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

  const isEmpty = !next.label && !next.hidden && !next.pinned;
  const existingIndex = prefs.findIndex((pref) => pref.key === key);
  if (existingIndex === -1) {
    return isEmpty ? prefs : [...prefs, next];
  }
  if (isEmpty) return prefs.filter((pref) => pref.key !== key);
  return prefs.map((pref, index) => (index === existingIndex ? next : pref));
}

export function orderPrefs(
  prefs: Array<ColumnPref>,
  columns: Array<ResolvedColumn>,
  fromKey: string,
  direction: -1 | 1,
): Array<ColumnPref> {
  const ordered = columns.map((column) => {
    const existing = prefs.find((pref) => pref.key === column.key);
    return existing ?? { key: column.key };
  });
  const fromIndex = ordered.findIndex((pref) => pref.key === fromKey);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= ordered.length) return prefs;
  const next = [...ordered];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
