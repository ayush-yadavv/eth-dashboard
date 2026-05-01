"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export function ProjectClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState<{ id: string; punched_in_at: string } | null>(null);
  const [myAttendanceLogs, setMyAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [teamAttendanceLogs, setTeamAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function load() {
    setError(null);

    const [projectRes, tasksRes, membersRes, projectsRes, meRes, attendanceRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
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
      fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
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

        if (cancelled) {
          return;
        }

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
  }, [projectId]);

  const tasksByStatus = useMemo(
    () => ({
      start: tasks.filter((task) => task.status === "start"),
      hold_pause: tasks.filter((task) => task.status === "hold_pause"),
      finish: tasks.filter((task) => task.status === "finish"),
    }),
    [tasks],
  );
  const assignedToMe = useMemo(
    () => tasks.filter((task) => currentUserId !== null && task.assignee_user_id === currentUserId),
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
      return;
    }

    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskAssignee("");
    setIsCreateTaskDialogOpen(false);
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
      return;
    }
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskAssignee("");
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
      return;
    }
    setIsEditProjectDialogOpen(false);
    await load();
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
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task update failed");
      return;
    }
    await load();
  }

  async function deleteTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Task delete failed");
      return;
    }
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
      return;
    }

    const typedResult = result as { action?: "added" | "invited"; invitation?: { invitePath: string } };
    if (typedResult.action === "invited") {
      setInviteLink(typedResult.invitation?.invitePath ?? null);
    } else {
      setInviteLink(null);
    }

    setMemberEmail("");
    setMemberRole("member");
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
      return;
    }

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
      return;
    }
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
      return;
    }
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
                    <input
                      value={projectNameDraft}
                      onChange={(event) => setProjectNameDraft(event.target.value)}
                      placeholder="Project name"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      required
                    />
                    <input
                      value={projectDescriptionDraft}
                      onChange={(event) => setProjectDescriptionDraft(event.target.value)}
                      placeholder="Description"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    />
                    <DialogFooter>
                      <Button type="submit">Save changes</Button>
                    </DialogFooter>
                  </form>
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
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Task title"
                  className="rounded-md border border-input bg-background px-3 py-2"
                  required
                />
                <select
                  value={taskAssignee}
                  onChange={(event) => setTaskAssignee(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.profiles?.full_name || member.profiles?.email || member.user_id}
                    </option>
                  ))}
                </select>
                <input
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  placeholder="Description"
                  className="rounded-md border border-input bg-background px-3 py-2 md:col-span-2"
                />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
                <DialogFooter className="md:col-span-2">
                  <Button type="submit">Add task</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update task details and assignment.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onEditTask}>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Task title"
              className="rounded-md border border-input bg-background px-3 py-2"
              required
            />
            <select
              value={taskAssignee}
              onChange={(event) => setTaskAssignee(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profiles?.full_name || member.profiles?.email || member.user_id}
                </option>
              ))}
            </select>
            <input
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Description"
              className="rounded-md border border-input bg-background px-3 py-2 md:col-span-2"
            />
            <input
              type="date"
              value={taskDueDate}
              onChange={(event) => setTaskDueDate(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <DialogFooter className="md:col-span-2">
              <Button type="submit">Save task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section className="grid gap-4 lg:grid-cols-3">
        <TaskColumn
          title="Start"
          tasks={tasksByStatus.start}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          memberNameById={memberNameById}
          onStatusChange={updateTaskStatus}
          onEdit={openEditTaskDialog}
          onDelete={isAdmin ? deleteTask : undefined}
        />
        <TaskColumn
          title="Hold/Pause"
          tasks={tasksByStatus.hold_pause}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          memberNameById={memberNameById}
          onStatusChange={updateTaskStatus}
          onEdit={openEditTaskDialog}
          onDelete={isAdmin ? deleteTask : undefined}
        />
        <TaskColumn
          title="Finish"
          tasks={tasksByStatus.finish}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          memberNameById={memberNameById}
          onStatusChange={updateTaskStatus}
          onEdit={openEditTaskDialog}
          onDelete={isAdmin ? deleteTask : undefined}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Assigned to me</h2>
        <div className="mt-3 space-y-2">
          {assignedToMe.length === 0 ? <p className="text-sm text-muted-foreground">No tasks currently assigned to you.</p> : null}
          {assignedToMe.map((task) => (
            <div key={task.id} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{task.title}</span>
                <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {statusLabel(task.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Due: {task.due_date ?? "none"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Team members</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {members.map((member) => (
            <li key={member.user_id} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{(member.profiles?.full_name || member.profiles?.email || member.user_id) + ` (${member.role})`}</span>
                {isAdmin ? (
                  <select
                    value={member.role}
                    disabled={currentUserId === member.user_id}
                    onChange={(event) => void updateMemberRole(member.user_id, event.target.value as "admin" | "member")}
                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
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

      {isAdmin ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Add member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            If the email is registered, the user is added immediately. If not, an invite email is sent.
          </p>
          <form onSubmit={addMember} className="mt-3 space-y-3">
            <input
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="member@email.com"
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
            <select
              value={memberRole}
              onChange={(event) => setMemberRole(event.target.value as "admin" | "member")}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
              Add member
            </button>
          </form>
          {inviteLink ? (
            <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
              Invite sent. Link: <code>{inviteLink}</code>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function TaskColumn({
  title,
  tasks,
  currentUserId,
  isAdmin,
  memberNameById,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: Task[];
  currentUserId: string | null;
  isAdmin: boolean;
  memberNameById: Map<string, string>;
  onStatusChange: (taskId: string, status: Task["status"]) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete?: (taskId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-3">
        {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks</p> : null}
        {tasks.map((task) => (
          <article key={task.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium">{task.title}</h4>
              {currentUserId && task.assignee_user_id === currentUserId ? (
                <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Assigned to me
                </span>
              ) : null}
            </div>
            {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Assignee:{" "}
              {task.assignee_user_id ? (memberNameById.get(task.assignee_user_id) ?? task.assignee_user_id) : "Unassigned"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Due: {task.due_date ?? "none"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onStatusChange(task.id, "start")}>
                Start
              </button>
              <button
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => onStatusChange(task.id, "hold_pause")}
              >
                Hold/Pause
              </button>
              <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onStatusChange(task.id, "finish")}>
                Finish
              </button>
              {isAdmin || (currentUserId !== null && task.assignee_user_id === currentUserId) ? (
                <button className="rounded border border-border px-2 py-1 text-xs" onClick={() => onEdit(task)}>
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button className="rounded border border-destructive px-2 py-1 text-xs text-destructive" onClick={() => onDelete(task.id)}>
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
