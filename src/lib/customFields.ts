export const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "True/False" },
  { value: "dateTime", label: "Date and Time" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multiSelect", label: "Multi-select" },
  { value: "rating", label: "Rating" },
  { value: "files", label: "Files" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Emails" },
  { value: "link", label: "Links" },
  { value: "phone", label: "Phones" },
  { value: "fullName", label: "Full Name" },
  { value: "address", label: "Address" },
  { value: "richText", label: "Rich Text" },
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]["value"];

export function customFieldTypeLabel(type: string) {
  return CUSTOM_FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function customFieldNeedsOptions(type: string) {
  return type === "select" || type === "multiSelect";
}

export function customFieldKanbanValues(
  type: string,
  options?: Array<string>,
): Array<{ value: string; label: string }> | undefined {
  if (type === "select" || type === "multiSelect") {
    return options && options.length > 0
      ? options.map((option) => ({ value: option, label: option }))
      : undefined;
  }
  if (type === "boolean") {
    return [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ];
  }
  if (type === "rating") {
    return [1, 2, 3, 4, 5].map((rating) => ({
      value: String(rating),
      label: `${rating}/5`,
    }));
  }
  return undefined;
}

export type CustomFieldKanbanOption = {
  value: string;
  label: string;
  values: Array<{ value: string; label: string }>;
};

export function customFieldKanbanOption(definition: {
  key: string;
  label: string;
  type: string;
  options?: Array<string>;
}): CustomFieldKanbanOption | null {
  const values = customFieldKanbanValues(definition.type, definition.options);
  if (!values) return null;
  return {
    value: `field:${definition.key}`,
    label: definition.label,
    values,
  };
}

export function isCustomFieldKanbanOption(
  option: CustomFieldKanbanOption | null,
): option is CustomFieldKanbanOption {
  return option !== null;
}

export function formatCustomFieldValue(type: string, value?: string | null) {
  if (!value) return "";
  if (type === "boolean") return value === "true" ? "Yes" : "No";
  if (type === "multiSelect") return value.split(",").filter(Boolean).join(", ");
  if (type === "rating") return `${value}/5`;
  if (type === "currency") return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
  if (type === "dateTime") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  return value;
}

export function customFieldSummaryType(type: string) {
  if (type === "number" || type === "currency" || type === "rating") {
    return "number" as const;
  }
  if (type === "date" || type === "dateTime") {
    return "date" as const;
  }
  return "field" as const;
}
