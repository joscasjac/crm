import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CustomFieldsEditor } from "../components/CustomFieldsEditor";
import { FavoriteButton } from "../components/FavoriteButton";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { shortDate, timeAgo } from "../lib/format";
import { ProjectForm } from "./Projects";
import { TaskForm, TaskSidePanel } from "./Tasks";
import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  priorityClass,
  priorityLabel,
  projectStatusLabel,
  statusClass,
  taskStatusLabel,
} from "./workUtils";

type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const id = projectId as Id<"projects"> | undefined;
  const project = useQuery(api.projects.get, id ? { projectId: id } : "skip");
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const updateTask = useMutation(api.tasks.update);
  const [editing, setEditing] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"projectTasks"> | null>(
    null,
  );

  if (!id) return <EmptyState message="Project not found" />;
  if (project === undefined) {
    return <div className="text-sm text-neutral-500">Loading project...</div>;
  }
  if (project === null) return <EmptyState message="Project not found" />;

  const progress =
    project.taskCount === 0
      ? 0
      : Math.round((project.doneTaskCount / project.taskCount) * 100);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={project.name}
        subtitle="Project command center for related tasks, ownership, due dates, and CRM links."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton
              label={project.name}
              href={`/app/projects/${project._id}`}
              kind="record"
              entityType="project"
              entityId={project._id}
            />
            <Button onClick={() => setEditing((value) => !value)}>
              {editing ? "Close" : "Edit"}
            </Button>
            <Button variant="primary" onClick={() => setShowNewTask(true)}>
              New task
            </Button>
          </div>
        }
      />

      {editing ? (
        <ProjectForm initial={project} onDone={() => setEditing(false)} />
      ) : null}

      {showNewTask ? (
        <TaskForm
          defaults={{ projectId: project._id }}
          onDone={() => setShowNewTask(false)}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge className={statusClass(project.status)}>
                  {projectStatusLabel[project.status]}
                </Badge>
                {project.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-400">
                    {project.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-neutral-600">
                    No project brief yet
                  </p>
                )}
              </div>
              <Select
                ariaLabel="Project status"
                value={project.status}
                onChange={(status) =>
                  void updateProject({
                    projectId: project._id,
                    status: status as ProjectStatus,
                  })
                }
                options={PROJECT_STATUSES.map((status) => ({
                  value: status,
                  label: projectStatusLabel[status],
                }))}
                className="w-40"
              />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{progress}% complete</span>
              <span>
                {project.doneTaskCount} done / {project.taskCount} total
              </span>
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-edge px-4 py-3">
              <h2 className="text-sm font-medium text-white">Tasks</h2>
            </div>
            <div className="divide-y divide-edge">
              {project.tasks.length === 0 ? (
                <div className="p-4">
                  <EmptyState message="No tasks in this project yet" />
                </div>
              ) : (
                project.tasks.map((task) => (
                  <div
                    key={task._id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_140px_120px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() =>
                            void updateTask({
                              taskId: task._id,
                              status:
                                task.status === "done" ? "todo" : "done",
                            })
                          }
                          className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                            task.status === "done"
                              ? "border-accent bg-accent"
                              : "border-edge"
                          }`}
                          title="Toggle done"
                        />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(task._id)}
                            className={`truncate text-sm font-medium ${
                              task.status === "done"
                                ? "text-neutral-500 line-through"
                                : "text-left text-white hover:text-accent"
                            }`}
                          >
                            {task.title}
                          </button>
                          {task.description ? (
                            <p className="mt-1 truncate text-xs text-neutral-600">
                              {task.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <Select
                      ariaLabel="Task status"
                      value={task.status}
                      onChange={(status) =>
                        void updateTask({
                          taskId: task._id,
                          status: status as (typeof TASK_STATUSES)[number],
                        })
                      }
                      options={TASK_STATUSES.map((status) => ({
                        value: status,
                        label: taskStatusLabel[status],
                      }))}
                      size="sm"
                    />
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <Badge className={priorityClass(task.priority)}>
                        {priorityLabel[task.priority]}
                      </Badge>
                      <span className="text-neutral-600">
                        {task.dueAt ? shortDate(task.dueAt) : "No date"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h2 className="mb-3 text-sm font-medium text-white">Details</h2>
            <div className="space-y-3 text-sm">
              <DetailRow label="Owner">
                {project.owner ? (
                  <span className="flex items-center gap-2 text-neutral-300">
                    <Avatar
                      name={project.owner.name}
                      src={project.owner.avatarUrl}
                      size={18}
                    />
                    {project.owner.name}
                  </span>
                ) : (
                  "Unassigned"
                )}
              </DetailRow>
              <DetailRow label="Start">
                {project.startAt ? shortDate(project.startAt) : "Unset"}
              </DetailRow>
              <DetailRow label="Due">
                {project.dueAt ? shortDate(project.dueAt) : "Unset"}
              </DetailRow>
              <DetailRow label="Created">{timeAgo(project._creationTime)}</DetailRow>
              <CustomFieldsEditor
                entity="project"
                entityId={project._id}
                variant="inline"
              />
            </div>
          </Panel>

          <Panel className="p-4">
            <h2 className="mb-3 text-sm font-medium text-white">CRM links</h2>
            <div className="flex flex-col gap-2 text-sm">
              {project.links.company ? (
                <Link
                  to={`/app/companies/${project.links.company._id}`}
                  className="text-accent hover:underline"
                >
                  {project.links.company.name}
                </Link>
              ) : null}
              {project.links.contact ? (
                <Link
                  to={`/app/contacts/${project.links.contact._id}`}
                  className="text-accent hover:underline"
                >
                  {project.links.contact.name}
                </Link>
              ) : null}
              {project.links.deal ? (
                <Link to="/app/deals" className="text-accent hover:underline">
                  {project.links.deal.name}
                </Link>
              ) : null}
              {!project.links.company && !project.links.contact && !project.links.deal ? (
                <span className="text-neutral-600">No linked CRM records</span>
              ) : null}
            </div>
          </Panel>

          <Panel className="p-4">
            <Button
              variant="danger"
              onClick={() => {
                void removeProject({ projectId: project._id });
                navigate("/app/projects");
              }}
            >
              Delete project
            </Button>
          </Panel>
        </aside>
      </div>
      <TaskSidePanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onOpenTask={setSelectedTaskId}
      />
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-600">{label}</span>
      <span className="text-right text-neutral-300">{children}</span>
    </div>
  );
}
