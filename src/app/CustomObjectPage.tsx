import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ObjectDataTable,
  useLocalObjectTable,
  type ObjectDataColumn,
} from "../components/ObjectDataTable";
import {
  OBJECT_ICONS,
  ObjectTableHeader,
  OptionRow,
  ViewBar,
} from "../components/ObjectTableChrome";
import { SavedViewsDropdown } from "../components/SavedViewButton";
import { SlideOver } from "../components/SlideOver";
import {
  EmptyState,
  Input,
  Panel,
} from "../components/ui";
import { customFieldTypeLabel, formatCustomFieldValue } from "../lib/customFields";
import { timeAgo } from "../lib/format";

type CustomRecord =
  FunctionReturnType<typeof api.customObjects.listRecords>["page"][number];

export function CustomObjectPage() {
  const { objectKey } = useParams<{ objectKey: string }>();
  const object = useQuery(
    api.customObjects.getByKey,
    objectKey ? { key: objectKey } : "skip",
  );
  const fields = useQuery(
    api.customObjects.fields,
    object ? { objectId: object._id } : "skip",
  );
  const createRecord = useMutation(api.customObjects.createRecord);
  const [activeRecordId, setActiveRecordId] =
    useState<Id<"customObjectRecords"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const { results, status, loadMore } = usePaginatedQuery(
    api.customObjects.listRecords,
    object ? { objectId: object._id } : "skip",
    { initialNumItems: 50 },
  );
  const rows = results as Array<CustomRecord>;
  const tableFields = fields ?? [];
  const columns: Array<ObjectDataColumn<CustomRecord>> = [
    {
      key: "name",
      label: "Name",
      locked: true,
      render: (record) => (
        <span className="inline-flex max-w-full items-center gap-2 rounded bg-raised px-2 py-0.5 text-neutral-200">
          <span className="text-neutral-500">-</span>
          <span className="truncate">{record.title}</span>
        </span>
      ),
    },
    ...tableFields
      .filter((field) => field.key !== "name")
      .map((field): ObjectDataColumn<CustomRecord> => ({
        key: `field:${field.key}`,
        label: field.label,
        render: (record) => (
          <span className="block max-w-64 truncate text-neutral-400">
            {formatCustomFieldValue(field.type, record.values[field.key]) ||
              "Not set"}
          </span>
        ),
      })),
    {
      key: "updatedAt",
      label: "Updated",
      render: (record) => (
        <span className="text-neutral-400">{timeAgo(record.updatedAt)}</span>
      ),
    },
  ];
  const table = useLocalObjectTable(
    object ? `object-table:custom:${object.key}` : "object-table:custom",
    columns,
  );
  const visibleIds = rows.map((record) => record._id);

  useEffect(() => {
    const liveIds = new Set(rows.map((record) => String(record._id)));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => liveIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);

  const create = async () => {
    if (!object) return;
    const id = await createRecord({ objectId: object._id, title: "Untitled" });
    setActiveRecordId(id);
  };

  const toggleVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleRecord = (id: Id<"customObjectRecords">, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (object === undefined) {
    return <p className="text-sm text-neutral-500">Loading object...</p>;
  }

  if (object === null) {
    return <EmptyState message="Custom object not found" />;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <ObjectTableHeader
        icon={OBJECT_ICONS.custom}
        title={object.pluralLabel}
        selectedCount={selectedIds.size}
        primaryLabel={`New ${object.singularLabel}`}
        onPrimary={() => void create()}
        options={
          <div className="space-y-1">
            <OptionRow onClick={() => void create()}>
              New {object.singularLabel}
            </OptionRow>
            <OptionRow>Import {object.pluralLabel}</OptionRow>
            <OptionRow>Export view</OptionRow>
          </div>
        }
      />
      <ViewBar
        label={`All ${object.pluralLabel}`}
        count={rows.length}
        viewControl={
          <SavedViewsDropdown
            entity={`custom:${object.key}`}
            currentName={object.pluralLabel}
            count={rows.length}
            href={`/app/objects/${object.key}`}
            defaultName={`All ${object.pluralLabel}`}
            currentType="table"
            lockedType="table"
            hrefForType={() => `/app/objects/${object.key}`}
          />
        }
      >
        <span>Filter</span>
        <span>Sort</span>
        <span>Options</span>
      </ViewBar>
      <ObjectDataTable
        rows={rows}
        columns={columns}
        table={table}
        getRowId={(record) => record._id}
        selectedIds={selectedIds}
        activeRowId={activeRecordId}
        loading={object === undefined || fields === undefined}
        emptyMessage={`No ${object.pluralLabel.toLowerCase()} yet`}
        selectAllLabel={`Select all ${object.pluralLabel}`}
        getRowSelectLabel={(record) => `Select ${record.title}`}
        onToggleVisible={toggleVisible}
        onSelectRow={(record, checked) => toggleRecord(record._id, checked)}
        onRowClick={(record) => setActiveRecordId(record._id)}
        onAddRow={() => void create()}
        settingsHref="/app/settings/customObjects"
        minWidth={960}
        footer={
          <>
        {status === "CanLoadMore" ? (
          <button
            type="button"
            onClick={() => loadMore(50)}
            className="w-full border-t border-edge px-4 py-3 text-sm text-neutral-400 transition-colors hover:bg-raised/50 hover:text-white"
          >
            Load more
          </button>
        ) : null}
          </>
        }
      />
      <CustomRecordPanel
        recordId={activeRecordId}
        onClose={() => setActiveRecordId(null)}
      />
    </div>
  );
}

function CustomRecordPanel({
  recordId,
  onClose,
}: {
  recordId: Id<"customObjectRecords"> | null;
  onClose: () => void;
}) {
  const data = useQuery(
    api.customObjects.getRecord,
    recordId ? { recordId } : "skip",
  );
  const updateRecord = useMutation(api.customObjects.updateRecord);
  const setRelationship = useMutation(api.customObjects.setRelationship);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setTitle(data.record.title);
    setValues(data.record.values);
  }, [data]);

  const save = async (patch?: Record<string, string>) => {
    if (!recordId) return;
    const nextValues = patch ?? values;
    await updateRecord({ recordId, title, values: nextValues });
  };

  return (
    <SlideOver
      open={recordId !== null}
      title={data?.record.title ?? "Record"}
      subtitle={data?.object ? data.object.singularLabel : undefined}
      icon={<span className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-accent">{OBJECT_ICONS.custom}</span>}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {data === undefined ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : data === null ? (
          <EmptyState message="Record not found" />
        ) : (
          <div className="grid gap-4">
            <Panel className="p-4">
              <h3 className="mb-4 text-sm font-medium text-white">Fields</h3>
              <label className="grid gap-1 text-xs text-neutral-500">
                Name
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => void save()}
                />
              </label>
              <div className="mt-4 grid gap-3">
                {data.fields
                  .filter((field) => field.key !== "name")
                  .map((field) => (
                    <label
                      key={field._id}
                      className="grid gap-1 text-xs text-neutral-500"
                    >
                      {field.label}
                      <Input
                        type={
                          field.type === "number" || field.type === "currency"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={values[field.key] ?? ""}
                        placeholder={customFieldTypeLabel(field.type)}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        onBlur={() => void save()}
                      />
                    </label>
                  ))}
              </div>
            </Panel>
            <Panel className="p-4">
              <h3 className="mb-3 text-sm font-medium text-white">
                Relationships
              </h3>
              <div className="grid gap-3">
                {data.relationships.length === 0 ? (
                  <p className="text-sm text-neutral-600">
                    No relationships mapped yet.
                  </p>
                ) : (
                  data.relationships.map(({ definition, links }) => (
                    <label
                      key={definition._id}
                      className="grid gap-1 text-xs text-neutral-500"
                    >
                      {definition.label}
                      <Input
                        defaultValue={links[0]?.targetEntityId ?? ""}
                        placeholder={`Paste ${definition.targetKind} record id`}
                        onBlur={(event) =>
                          void setRelationship({
                            relationshipId: definition._id,
                            sourceRecordId: data.record._id,
                            targetEntityId: event.target.value,
                          })
                        }
                      />
                    </label>
                  ))
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
