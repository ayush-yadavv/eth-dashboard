"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

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
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);

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
      toast.error(result.error ?? "Could not add member");
      return;
    }

    setInviteLink(result.action === "invited" ? result.invitation?.invitePath ?? null : null);
    toast.success(result.action === "invited" ? "Invite created" : "Member added");
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

  async function removeMember(userId: string) {
    const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Could not remove member");
      toast.error(result.error ?? "Could not remove member");
      return;
    }
    toast.success("Member removed");
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Add member</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Existing users are added directly. Unknown emails receive an invite email.
            </p>
          </div>
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
                  type="email"
                  placeholder="member@email.com"
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
        </div>
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
                  <Button
                    variant="outline"
                    onClick={() => setMemberToRemove(member)}
                    disabled={currentUserId === member.user_id}
                    className="h-7 border-destructive text-xs text-destructive disabled:opacity-50"
                  >
                    Remove
                  </Button>
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
              {log.punched_out_at ? new Date(log.punched_out_at).toLocaleString() : "Active"} | Duration:{" "}
              {formatDuration(log.punched_in_at, log.punched_out_at)}
            </div>
          ))}
        </div>
      </section>

      <Dialog open={Boolean(memberToRemove)} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              This will remove {memberToRemove?.profiles?.full_name || memberToRemove?.profiles?.email || "this user"} from the project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!memberToRemove) return;
                await removeMember(memberToRemove.user_id);
                setMemberToRemove(null);
              }}
            >
              Confirm remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
