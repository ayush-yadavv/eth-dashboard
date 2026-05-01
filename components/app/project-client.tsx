"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarIcon, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "start" | "hold_pause" | "finish";
  due_date: string | null;
  assignee_user_id: string | null;
};

type Member = {
  user_id: string;
  role: "admin" | "member";
  profiles: { id: string; email: string; full_name: string | null } | null;
};

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
};

type AttendanceLog = {
  id: string;
  user_id: string;
  punched_in_at: string;
  punched_out_at: string | null;
};

function formatDuration(fromIso: string, toIso: string | null) {
  const start = new Date(fromIso).getTime();
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "0m";
  }
  const totalMinutes = Math.floor((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function statusLabel(status: Task["status"]) {
  if (status === "start") return "start";
  if (status === "hold_pause") return "hold/pause";
  return "finish";
}

function taskSortByLabel(sortBy: "created_at" | "due_date" | "title" | "status") {
  if (sortBy === "created_at") return "Sort: created";
  if (sortBy === "due_date") return "Sort: due date";
  if (sortBy === "title") return "Sort: title";
  return "Sort: status";
}

function parseDateString(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateLabel(value: string, placeholder: string) {
  const parsed = parseDateString(value);
  return parsed ? parsed.toLocaleDateString() : placeholder;
}

function toDateValue(date: Date | undefined) {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function ProjectClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize] = useState(20);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskTotalPages, setTaskTotalPages] = useState(1);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("");
  const [taskDueFrom, setTaskDueFrom] = useState("");
  const [taskDueTo, setTaskDueTo] = useState("");
  const [taskSortBy, setTaskSortBy] = useState<"created_at" | "due_date" | "title" | "status">("created_at");
  const [taskSortOrder, setTaskSortOrder] = useState<"asc" | "desc">("desc");
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState<{ id: string; punched_in_at: string } | null>(null);
  const [myAttendanceLogs, setMyAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [teamAttendanceLogs, setTeamAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);

  async function load() {
    setError(null);

    const tasksQuery = new URLSearchParams({
      page: String(taskPage),
      pageSize: String(taskPageSize),
      sortBy: taskSortBy,
      sortOrder: taskSortOrder,
    });
    if (taskSearch.trim()) tasksQuery.set("search", taskSearch.trim());
    if (taskStatusFilter) tasksQuery.set("status", taskStatusFilter);
    if (taskAssigneeFilter) tasksQuery.set("assigneeUserId", taskAssigneeFilter);
    if (taskDueFrom) tasksQuery.set("dueFrom", taskDueFrom);
    if (taskDueTo) tasksQuery.set("dueTo", taskDueTo);

    const [projectRes, tasksRes, membersRes, projectsRes, meRes, attendanceRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/tasks?${tasksQuery.toString()}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/attendance`, { cache: "no-store" }),
    ]);

    const [projectJson, tasksJson, membersJson, projectsJson, meJson, attendanceJson] = await Promise.all([
      projectRes.json(),
      tasksRes.json(),
      membersRes.json(),
      projectsRes.json(),
      meRes.json(),
      attendanceRes.json(),
    ]);

    if (!projectRes.ok || !tasksRes.ok || !membersRes.ok || !projectsRes.ok) {
      setError(projectJson.error ?? tasksJson.error ?? membersJson.error ?? projectsJson.error ?? "Could not load project");
      return;
    }

    const role = (projectsJson.projects as Array<{ role: "admin" | "member"; project: { id: string } }>).find(
      (item) => item.project.id === projectId,
    )?.role;
    setIsAdmin(role === "admin");
    setProject(projectJson.project as ProjectData);
    setTasks((tasksJson.tasks ?? []) as Task[]);
    setTaskTotal((tasksJson.pagination?.total as number | undefined) ?? 0);
    setTaskTotalPages((tasksJson.pagination?.totalPages as number | undefined) ?? 1);
    setMembers((membersJson.members ?? []) as Member[]);
    setCurrentUserId((meJson.user?.id as string | undefined) ?? null);
    setActiveAttendance((attendanceJson.activeSession ?? null) as { id: string; punched_in_at: string } | null);
    setMyAttendanceLogs((attendanceJson.myLogs ?? []) as AttendanceLog[]);
    setTeamAttendanceLogs((attendanceJson.teamLogs ?? []) as AttendanceLog[]);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
      fetch(
        `/api/projects/${projectId}/tasks?${new URLSearchParams({
          page: String(taskPage),
          pageSize: String(taskPageSize),
          sortBy: taskSortBy,
          sortOrder: taskSortOrder,
          ...(taskSearch.trim() ? { search: taskSearch.trim() } : {}),
          ...(taskStatusFilter ? { status: taskStatusFilter } : {}),
          ...(taskAssigneeFilter ? { assigneeUserId: taskAssigneeFilter } : {}),
          ...(taskDueFrom ? { dueFrom: taskDueFrom } : {}),
          ...(taskDueTo ? { dueTo: taskDueTo } : {}),
        }).toString()}`,
        { cache: "no-store" },
      ),
      fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/attendance`, { cache: "no-store" }),
    ])
      .then(async ([projectRes, tasksRes, membersRes, projectsRes, meRes, attendanceRes]) => {
        const [projectJson, tasksJson, membersJson, projectsJson, meJson, attendanceJson] = await Promise.all([
          projectRes.json(),
          tasksRes.json(),
          membersRes.json(),
          projectsRes.json(),
          meRes.json(),
          attendanceRes.json(),
        ]);

        if (cancelled) return;
        if (!projectRes.ok || !tasksRes.ok || !membersRes.ok || !projectsRes.ok) {
          setError(projectJson.error ?? tasksJson.error ?? membersJson.error ?? projectsJson.error ?? "Could not load project");
          return;
        }
        const role = (projectsJson.projects as Array<{ role: "admin" | "member"; project: { id: string } }>).find(
          (item) => item.project.id === projectId,
        )?.role;
        setIsAdmin(role === "admin");
        setProject(projectJson.project as ProjectData);
        setTasks((tasksJson.tasks ?? []) as Task[]);
        setTaskTotal((tasksJson.pagination?.total as number | undefined) ?? 0);
        setTaskTotalPages((tasksJson.pagination?.totalPages as number | undefined) ?? 1);
        setMembers((membersJson.members ?? []) as Member[]);
        setCurrentUserId((meJson.user?.id as string | undefined) ?? null);
        setActiveAttendance((attendanceJson.activeSession ?? null) as { id: string; punched_in_at: string } | null);
        setMyAttendanceLogs((attendanceJson.myLogs ?? []) as AttendanceLog[]);
        setTeamAttendanceLogs((attendanceJson.teamLogs ?? []) as AttendanceLog[]);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load project");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskPage, taskPageSize, taskSortBy, taskSortOrder, taskSearch, taskStatusFilter, taskAssigneeFilter, taskDueFrom, taskDueTo]);
  const assignedToMeCount = useMemo(
    () => tasks.filter((task) => currentUserId !== null && task.assignee_user_id === currentUserId).length,
    [tasks, currentUserId],
  );
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.profiles?.full_name || member.profiles?.email || member.user_id);
    });
    return map;
  }, [members]);

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskTitle,
        description: taskDescription || null,
        dueDate: taskDueDate || null,
        assigneeUserId: taskAssignee || null,
      }),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task creation failed");
      toast.error(result.error ?? "Task creation failed");
      return;
    }

    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskAssignee("");
    setIsCreateTaskDialogOpen(false);
    toast.success("Task created");
    await load();
  }

  async function onEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask) return;
    const response = await fetch(`/api/tasks/${editingTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskTitle,
        description: taskDescription || null,
        dueDate: taskDueDate || null,
        assigneeUserId: taskAssignee || null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task update failed");
      toast.error(result.error ?? "Task update failed");
      return;
    }
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskAssignee("");
    toast.success("Task updated");
    await load();
  }

  async function onEditProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectNameDraft,
        description: projectDescriptionDraft || null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Project update failed");
      toast.error(result.error ?? "Project update failed");
      return;
    }
    setIsEditProjectDialogOpen(false);
    toast.success("Project updated");
    await load();
  }

  async function deleteProject() {
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Project delete failed");
      toast.error(result.error ?? "Project delete failed");
      return;
    }
    toast.success("Project deleted");
    router.push("/dashboard");
  }

  function openCreateTaskDialog() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskAssignee("");
    setEditingTask(null);
    setIsCreateTaskDialogOpen(true);
  }

  function openEditTaskDialog(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskDueDate(task.due_date ?? "");
    setTaskAssignee(task.assignee_user_id ?? "");
    setIsCreateTaskDialogOpen(false);
  }

  function openEditProjectDialog() {
    if (!project) return;
    setProjectNameDraft(project.name);
    setProjectDescriptionDraft(project.description ?? "");
  }

  async function updateTaskStatus(taskId: string, status: Task["status"]) {
    setStatusUpdatingTaskId(taskId);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task update failed");
      toast.error(result.error ?? "Task update failed");
      setStatusUpdatingTaskId(null);
      return;
    }
    await load();
    toast.success("Task status updated");
    setStatusUpdatingTaskId(null);
  }

  async function deleteTask(taskId: string) {
    if (!isAdmin) {
      setError("Only project admins can delete tasks");
      toast.error("Only project admins can delete tasks");
      return;
    }
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task delete failed");
      toast.error(result.error ?? "Task delete failed");
      return;
    }
    toast.success("Task deleted");
    await load();
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail, role: memberRole }),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Could not add member");
      toast.error(result.error ?? "Could not add member");
      return;
    }

    const typedResult = result as { action?: "added" | "invited"; invitation?: { invitePath: string } };
    if (typedResult.action === "invited") {
      setInviteLink(typedResult.invitation?.invitePath ?? null);
      toast.success("Invite created");
    } else {
      setInviteLink(null);
      toast.success("Member added");
    }

    setMemberEmail("");
    setMemberRole("member");
    setIsAddMemberDialogOpen(false);
    await load();
  }

  async function updateMemberRole(userId: string, role: "admin" | "member") {
    const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Could not update role");
      toast.error(result.error ?? "Could not update role");
      return;
    }
    toast.success("Member role updated");
    await load();
  }

  async function punchIn() {
    setAttendanceLoading(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/attendance/punch-in`, { method: "POST" });
    const result = (await response.json()) as { error?: string };
    setAttendanceLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Could not punch in");
      toast.error(result.error ?? "Could not punch in");
      return;
    }
    toast.success("Punched in");
    await load();
  }

  async function punchOut() {
    setAttendanceLoading(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/attendance/punch-out`, { method: "POST" });
    const result = (await response.json()) as { error?: string };
    setAttendanceLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Could not punch out");
      toast.error(result.error ?? "Could not punch out");
      return;
    }
    toast.success("Punched out");
    await load();
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Loading project...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
                <DialogTrigger render={<Button variant="outline" size="sm" />} onClick={openEditProjectDialog}>
                  Edit Project
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit project</DialogTitle>
                    <DialogDescription>Update project name and description.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-3" onSubmit={onEditProject}>
                    <Input
                      className="h-10 w-full"
                      value={projectNameDraft}
                      onChange={(event) => setProjectNameDraft(event.target.value)}
                      placeholder="Project name"
                      required
                    />
                    <Input
                      className="h-10 w-full"
                      value={projectDescriptionDraft}
                      onChange={(event) => setProjectDescriptionDraft(event.target.value)}
                      placeholder="Description"
                    />
                    <DialogFooter>
                      <Button type="submit">Save changes</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
            {isAdmin ? (
              <Dialog open={isDeleteProjectDialogOpen} onOpenChange={setIsDeleteProjectDialogOpen}>
                <DialogTrigger render={<Button variant="destructive" size="sm" />}>Delete Project</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete project</DialogTitle>
                    <DialogDescription>
                      This action is irreversible. Deleting this project will permanently remove tasks, members, and attendance records.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteProjectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await deleteProject();
                        setIsDeleteProjectDialogOpen(false);
                      }}
                    >
                      Delete permanently
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
            {isAdmin ? (
              <Link
                href={`/projects/${projectId}/manage-users`}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent"
              >
                Manage Users
              </Link>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{project.description || "No description"}</p>
      </section>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Tasks</h2>
          {isAdmin ? (
            <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
              <DialogTrigger
                render={<Button />}
                onClick={openCreateTaskDialog}
              >
                Create Task
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create task</DialogTitle>
                  <DialogDescription>Add a task and assign it to a team member.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateTask}>
                  <Input
                    className="h-10"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Task title"
                    required
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" type="button" className="justify-between">
                          <span>{taskAssignee ? (memberNameById.get(taskAssignee) ?? taskAssignee) : "Unassigned"}</span>
                          <ChevronDown className="size-4 opacity-70" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setTaskAssignee("")}>Unassigned</DropdownMenuItem>
                      {members.map((member) => {
                        const label = member.profiles?.full_name || member.profiles?.email || member.user_id;
                        const selected = taskAssignee === member.user_id;
                        return (
                          <DropdownMenuItem key={member.user_id} onClick={() => setTaskAssignee(member.user_id)}>
                            <span className="flex-1">{label}</span>
                            {selected ? <Check className="size-4" /> : null}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input
                    className="h-10 md:col-span-2"
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                    placeholder="Description"
                  />
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button variant="outline" type="button" className="h-10 justify-between">
                          <span>{formatDateLabel(taskDueDate, "Select due date")}</span>
                          <CalendarIcon className="size-4 opacity-70" />
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={parseDateString(taskDueDate)}
                        onSelect={(date) => setTaskDueDate(toDateValue(date))}
                      />
                      <div className="border-t border-border p-2">
                        <Button variant="ghost" size="sm" type="button" onClick={() => setTaskDueDate("")}>
                          Clear
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <DialogFooter className="md:col-span-2">
                    <Button type="submit">Add task</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </section>

      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update task details and assignment.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onEditTask}>
            <Input
              className="h-10"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Task title"
              required
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" type="button" className="justify-between">
                    <span>{taskAssignee ? (memberNameById.get(taskAssignee) ?? taskAssignee) : "Unassigned"}</span>
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                }
              />
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTaskAssignee("")}>Unassigned</DropdownMenuItem>
                {members.map((member) => {
                  const label = member.profiles?.full_name || member.profiles?.email || member.user_id;
                  const selected = taskAssignee === member.user_id;
                  return (
                    <DropdownMenuItem key={member.user_id} onClick={() => setTaskAssignee(member.user_id)}>
                      <span className="flex-1">{label}</span>
                      {selected ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Input
              className="h-10 md:col-span-2"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Description"
            />
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" type="button" className="h-10 justify-between">
                    <span>{formatDateLabel(taskDueDate, "Select due date")}</span>
                    <CalendarIcon className="size-4 opacity-70" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseDateString(taskDueDate)}
                  onSelect={(date) => setTaskDueDate(toDateValue(date))}
                />
                <div className="border-t border-border p-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setTaskDueDate("")}>
                    Clear
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <DialogFooter className="md:col-span-2">
              <Button type="submit">Save task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-xs text-muted-foreground">Assigned to me: {assignedToMeCount}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-6">
          <Input
            className="h-10 md:col-span-2"
            placeholder="Search title/description"
            value={taskSearch}
            onChange={(event) => {
              setTaskPage(1);
              setTaskSearch(event.target.value);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" type="button" className="justify-between">
                  <span>{taskStatusFilter ? statusLabel(taskStatusFilter as Task["status"]) : "All status"}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  setTaskPage(1);
                  setTaskStatusFilter("");
                }}
              >
                All status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskStatusFilter("start"); }}>start</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskStatusFilter("hold_pause"); }}>hold/pause</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskStatusFilter("finish"); }}>finish</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" type="button" className="justify-between">
                  <span>{taskAssigneeFilter ? (memberNameById.get(taskAssigneeFilter) ?? taskAssigneeFilter) : "All assignees"}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskAssigneeFilter(""); }}>All assignees</DropdownMenuItem>
              {members.map((member) => (
                <DropdownMenuItem key={member.user_id} onClick={() => { setTaskPage(1); setTaskAssigneeFilter(member.user_id); }}>
                  {member.profiles?.full_name || member.profiles?.email || member.user_id}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" type="button" className="h-10 justify-between">
                  <span>{formatDateLabel(taskDueFrom, "Due from")}</span>
                  <CalendarIcon className="size-4 opacity-70" />
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={parseDateString(taskDueFrom)}
                onSelect={(date) => {
                  setTaskPage(1);
                  setTaskDueFrom(toDateValue(date));
                }}
              />
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => { setTaskPage(1); setTaskDueFrom(""); }}>
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" type="button" className="h-10 justify-between">
                  <span>{formatDateLabel(taskDueTo, "Due to")}</span>
                  <CalendarIcon className="size-4 opacity-70" />
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={parseDateString(taskDueTo)}
                onSelect={(date) => {
                  setTaskPage(1);
                  setTaskDueTo(toDateValue(date));
                }}
              />
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => { setTaskPage(1); setTaskDueTo(""); }}>
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" type="button" className="justify-between">
                  <span>{taskSortByLabel(taskSortBy)}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortBy("created_at"); }}>Sort: created</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortBy("due_date"); }}>Sort: due date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortBy("title"); }}>Sort: title</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortBy("status"); }}>Sort: status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" type="button" className="justify-between">
                  <span>{taskSortOrder === "desc" ? "Order: desc" : "Order: asc"}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortOrder("desc"); }}>Order: desc</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTaskPage(1); setTaskSortOrder("asc"); }}>Order: asc</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">No tasks found.</TableCell>
              </TableRow>
            ) : null}
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="font-medium">{task.title}</div>
                  {task.description ? <div className="text-xs text-muted-foreground">{task.description}</div> : null}
                </TableCell>
                <TableCell>{statusLabel(task.status)}</TableCell>
                <TableCell>{task.assignee_user_id ? (memberNameById.get(task.assignee_user_id) ?? task.assignee_user_id) : "Unassigned"}</TableCell>
                <TableCell>{task.due_date ?? "none"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="xs" variant="outline" disabled={statusUpdatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "start")}>Start</Button>
                    <Button size="xs" variant="outline" disabled={statusUpdatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "hold_pause")}>Hold/Pause</Button>
                    <Button size="xs" variant="outline" disabled={statusUpdatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "finish")}>Finish</Button>
                    {(isAdmin || (currentUserId !== null && task.assignee_user_id === currentUserId)) ? (
                      <Button size="xs" variant="secondary" onClick={() => openEditTaskDialog(task)}>Edit</Button>
                    ) : null}
                    {isAdmin ? (
                      <Button size="xs" variant="destructive" onClick={() => deleteTask(task.id)}>Delete</Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{taskTotal} total tasks</span>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" disabled={taskPage <= 1} onClick={() => setTaskPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <span>Page {taskPage} / {taskTotalPages}</span>
            <Button size="xs" variant="outline" disabled={taskPage >= taskTotalPages} onClick={() => setTaskPage((p) => Math.min(taskTotalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Team members</h2>
            {isAdmin ? (
              <p className="mt-1 text-sm text-muted-foreground">
                If the email is registered, the user is added immediately. If not, an invite email is sent.
              </p>
            ) : null}
          </div>
          {isAdmin ? (
            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
              <DialogTrigger render={<Button />}>Add Member</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add member</DialogTitle>
                  <DialogDescription>Add existing user or create invite for new email.</DialogDescription>
                </DialogHeader>
                <form onSubmit={addMember} className="space-y-3">
                  <Input
                    className="h-10"
                    value={memberEmail}
                    onChange={(event) => setMemberEmail(event.target.value)}
                    placeholder="member@email.com"
                    type="email"
                    required
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" type="button" className="w-full justify-between">
                          <span>{memberRole === "admin" ? "Admin" : "Member"}</span>
                          <ChevronDown className="size-4 opacity-70" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setMemberRole("member")}>Member</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMemberRole("admin")}>Admin</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DialogFooter>
                    <Button type="submit">Add member</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {members.map((member) => (
            <li key={member.user_id} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{(member.profiles?.full_name || member.profiles?.email || member.user_id) + ` (${member.role})`}</span>
                {isAdmin ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={currentUserId === member.user_id}
                      render={
                        <Button variant="outline" size="xs" type="button" className="justify-between">
                          <span>{member.role}</span>
                          <ChevronDown className="size-3.5 opacity-70" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => void updateMemberRole(member.user_id, "member")}>member</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void updateMemberRole(member.user_id, "admin")}>admin</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {isAdmin && inviteLink ? (
          <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
            Invite sent. Link: <code>{inviteLink}</code>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Attendance</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {activeAttendance ? (
            <p className="text-sm text-muted-foreground">
              You are punched in since {new Date(activeAttendance.punched_in_at).toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You are currently punched out.</p>
          )}
          {activeAttendance ? (
            <button
              onClick={() => void punchOut()}
              disabled={attendanceLoading}
              className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
            >
              {attendanceLoading ? "Processing..." : "Punch Out"}
            </button>
          ) : (
            <button
              onClick={() => void punchIn()}
              disabled={attendanceLoading}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {attendanceLoading ? "Processing..." : "Punch In"}
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">My recent timings</h3>
          {myAttendanceLogs.length === 0 ? <p className="text-sm text-muted-foreground">No punch logs yet.</p> : null}
          {myAttendanceLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
              In: {new Date(log.punched_in_at).toLocaleString()} | Out:{" "}
              {log.punched_out_at ? new Date(log.punched_out_at).toLocaleString() : "Active"} | Duration:{" "}
              {formatDuration(log.punched_in_at, log.punched_out_at)}
            </div>
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold">Team timings (admin)</h3>
            {teamAttendanceLogs.length === 0 ? <p className="text-sm text-muted-foreground">No team punch logs yet.</p> : null}
            {teamAttendanceLogs.map((log) => (
              <div key={log.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                <span className="font-medium">{memberNameById.get(log.user_id) ?? log.user_id}</span> | In:{" "}
                {new Date(log.punched_in_at).toLocaleString()} | Out:{" "}
                {log.punched_out_at ? new Date(log.punched_out_at).toLocaleString() : "Active"} | Duration:{" "}
                {formatDuration(log.punched_in_at, log.punched_out_at)}
              </div>
            ))}
          </div>
        ) : null}
      </section>

    </div>
  );
}
