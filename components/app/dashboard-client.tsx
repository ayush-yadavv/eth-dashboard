"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type DashboardData = {
  summary: {
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    assignedToMe: number;
  };
  projects: Array<{
    projectId: string;
    role: "admin" | "member";
    project: { id: string; name: string; description: string | null };
    tasksTotal: number;
    tasksDone: number;
    progress: number;
  }>;
  projectsPagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  overdueTasks: Array<{ id: string; title: string; due_date: string | null; project_id: string }>;
  dueSoon: Array<{ id: string; title: string; due_date: string | null; project_id: string }>;
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize] = useState(8);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      projectSearch: projectSearch.trim(),
      projectPage: String(projectPage),
      projectPageSize: String(projectPageSize),
    });
    const response = await fetch(`/api/dashboard?${query.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as DashboardData & { error?: string };

    if (!response.ok) {
      setError(result.error ?? "Could not load dashboard");
      setLoading(false);
      return;
    }

    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({
      projectSearch: projectSearch.trim(),
      projectPage: String(projectPage),
      projectPageSize: String(projectPageSize),
    });
    fetch(`/api/dashboard?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as DashboardData & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(result.error ?? "Could not load dashboard");
          setLoading(false);
          return;
        }
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load dashboard");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectSearch, projectPage, projectPageSize]);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProjectName,
        description: newProjectDescription || undefined,
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "Project creation failed");
      toast.error(result.error ?? "Project creation failed");
      return;
    }

    setNewProjectName("");
    setNewProjectDescription("");
    toast.success("Project created");
    setIsCreateProjectDialogOpen(false);
    void load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  }

  if (error || !data) {
    return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error ?? "Unknown error"}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open Tasks" value={data.summary.openTasks} />
        <MetricCard label="Completed" value={data.summary.completedTasks} />
        <MetricCard label="Overdue" value={data.summary.overdueTasks} />
        <MetricCard label="Assigned To Me" value={data.summary.assignedToMe} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
            <DialogTrigger render={<Button />}>Create Project</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>Create a new project workspace for your team.</DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={onCreateProject}>
                <Input
                  className="h-10"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  required
                />
                <Input
                  className="h-10"
                  placeholder="Description"
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                />
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            className="h-10"
            placeholder="Search projects by name or description"
            value={projectSearch}
            onChange={(event) => {
              setProjectPage(1);
              setProjectSearch(event.target.value);
            }}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data.projectsPagination.total} projects</span>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {data.projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : null}
          {data.projects.map((item) => (
            <Link
              key={item.projectId}
              href={`/projects/${item.projectId}`}
              className="block rounded-lg border border-border bg-background p-3 hover:bg-secondary/60"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{item.project.name}</h3>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.role}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.project.description || "No description"}</p>
              <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.tasksDone}/{item.tasksTotal} tasks done
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.projectsPagination.page} / {data.projectsPagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={data.projectsPagination.page <= 1}
              onClick={() => setProjectPage((page) => Math.max(1, page - 1))}
            >
              Prev
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={data.projectsPagination.page >= data.projectsPagination.totalPages}
              onClick={() => setProjectPage((page) => Math.min(data.projectsPagination.totalPages, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Overdue tasks</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.overdueTasks.length === 0 ? <li className="text-muted-foreground">No overdue tasks.</li> : null}
            {data.overdueTasks.map((task) => (
              <li key={task.id} className="rounded-md border border-border bg-background px-3 py-2">
                {task.title} · due {task.due_date ?? "n/a"}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Due soon</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.dueSoon.length === 0 ? <li className="text-muted-foreground">No tasks with due dates.</li> : null}
            {data.dueSoon.map((task) => (
              <li key={task.id} className="rounded-md border border-border bg-background px-3 py-2">
                {task.title} · due {task.due_date ?? "n/a"}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
