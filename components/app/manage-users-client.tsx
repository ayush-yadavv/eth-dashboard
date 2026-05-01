"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Member = {
  user_id: string;
  role: "admin" | "member";
  profiles: { id: string; email: string; full_name: string | null } | null;
};

type AttendanceLog = {
  id: string;
  user_id: string;
  punched_in_at: string;
  punched_out_at: string | null;
};

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
};

export function ManageUsersClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamLogs, setTeamLogs] = useState<AttendanceLog[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.profiles?.full_name || member.profiles?.email || member.user_id);
    });
    return map;
  }, [members]);

  async function load() {
    setLoading(true);
    setError(null);

    const [projectRes, projectsRes, membersRes, attendanceRes, meRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/attendance`, { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
    ]);

    const [projectJson, projectsJson, membersJson, attendanceJson, meJson] = await Promise.all([
      projectRes.json(),
      projectsRes.json(),
      membersRes.json(),
      attendanceRes.json(),
      meRes.json(),
    ]);

    if (!projectRes.ok || !projectsRes.ok || !membersRes.ok || !attendanceRes.ok || !meRes.ok) {
      setError(
        projectJson.error ??
          projectsJson.error ??
          membersJson.error ??
          attendanceJson.error ??
          meJson.error ??
          "Could not load user management data",
      );
      setLoading(false);
      return;
    }

    const role = (projectsJson.projects as Array<{ role: "admin" | "member"; project: { id: string } }>).find(
      (item) => item.project.id === projectId,
    )?.role;

    setIsAdmin(role === "admin");
    setProject(projectJson.project as ProjectSummary);
    setMembers((membersJson.members ?? []) as Member[]);
    setTeamLogs((attendanceJson.teamLogs ?? []) as AttendanceLog[]);
    setCurrentUserId((meJson.user?.id as string | undefined) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/attendance`, { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
    ])
      .then(async ([projectRes, projectsRes, membersRes, attendanceRes, meRes]) => {
        const [projectJson, projectsJson, membersJson, attendanceJson, meJson] = await Promise.all([
          projectRes.json(),
          projectsRes.json(),
          membersRes.json(),
          attendanceRes.json(),
          meRes.json(),
        ]);

        if (cancelled) return;

        if (!projectRes.ok || !projectsRes.ok || !membersRes.ok || !attendanceRes.ok || !meRes.ok) {
          setError(
            projectJson.error ??
              projectsJson.error ??
              membersJson.error ??
              attendanceJson.error ??
              meJson.error ??
              "Could not load user management data",
          );
          setLoading(false);
          return;
        }

        const role = (projectsJson.projects as Array<{ role: "admin" | "member"; project: { id: string } }>).find(
          (item) => item.project.id === projectId,
        )?.role;

        setIsAdmin(role === "admin");
        setProject(projectJson.project as ProjectSummary);
        setMembers((membersJson.members ?? []) as Member[]);
        setTeamLogs((attendanceJson.teamLogs ?? []) as AttendanceLog[]);
        setCurrentUserId((meJson.user?.id as string | undefined) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load user management data");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail, role: memberRole }),
    });
    const result = (await response.json()) as {
      error?: string;
      action?: "added" | "invited";
      invitation?: { invitePath: string };
    };

    if (!response.ok) {
      setError(result.error ?? "Could not add member");
      return;
    }

    setInviteLink(result.action === "invited" ? result.invitation?.invitePath ?? null : null);
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

  async function removeMember(userId: string) {
    const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Could not remove member");
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading user management...</p>;
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h1 className="text-xl font-semibold">User Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin access required for this page.</p>
        <Link href={`/projects/${projectId}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">User Management</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} | add members, change roles, and review attendance logs.
            </p>
          </div>
          <Link href={`/projects/${projectId}`} className="text-sm text-primary hover:underline">
            Back to project
          </Link>
        </div>
      </section>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Add member</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Existing users are added directly. Unknown emails receive an invite email.
        </p>
        <form onSubmit={addMember} className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            type="email"
            placeholder="member@email.com"
            className="rounded-md border border-input bg-background px-3 py-2 md:col-span-2"
            required
          />
          <select
            value={memberRole}
            onChange={(event) => setMemberRole(event.target.value as "admin" | "member")}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 md:col-span-3">
            Add member
          </button>
        </form>
        {inviteLink ? (
          <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
            Invite sent. Link: <code>{inviteLink}</code>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Team members</h2>
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <div key={member.user_id} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{(member.profiles?.full_name || member.profiles?.email || member.user_id) + ` (${member.role})`}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    disabled={currentUserId === member.user_id}
                    onChange={(event) => void updateMemberRole(member.user_id, event.target.value as "admin" | "member")}
                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    onClick={() => void removeMember(member.user_id)}
                    disabled={currentUserId === member.user_id}
                    className="rounded border border-destructive px-2 py-1 text-xs text-destructive disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Team attendance logs</h2>
        <div className="mt-3 space-y-2">
          {teamLogs.length === 0 ? <p className="text-sm text-muted-foreground">No attendance logs yet.</p> : null}
          {teamLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
              <span className="font-medium">{memberNameById.get(log.user_id) ?? log.user_id}</span> | In:{" "}
              {new Date(log.punched_in_at).toLocaleString()} | Out:{" "}
              {log.punched_out_at ? new Date(log.punched_out_at).toLocaleString() : "Active"}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
