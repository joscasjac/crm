export const PROJECT_STATUSES = [
  "planned",
  "active",
  "on_hold",
  "completed",
  "archived",
] as const;

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "done",
  "canceled",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const projectStatusLabel: Record<(typeof PROJECT_STATUSES)[number], string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const taskStatusLabel: Record<(typeof TASK_STATUSES)[number], string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  canceled: "Canceled",
};

export const priorityLabel: Record<(typeof TASK_PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function priorityClass(priority: string) {
  if (priority === "urgent") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (priority === "medium") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  return "border-edge bg-raised text-neutral-400";
}

export function statusClass(status: string) {
  if (status === "done" || status === "completed") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "blocked" || status === "on_hold") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  }
  if (status === "canceled" || status === "archived") {
    return "border-edge bg-raised text-neutral-500";
  }
  return "border-accent/30 bg-accent/10 text-accent";
}

export function dateInputValue(timestamp?: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timestampFromDate(value: string) {
  if (!value) return undefined;
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
