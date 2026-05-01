import { ProjectRole } from "@/lib/types";

export function canManageProject(role: ProjectRole) {
  return role === "admin";
}

export function canUpdateTask(role: ProjectRole, userId: string, assigneeUserId: string | null) {
  return role === "admin" || (assigneeUserId !== null && assigneeUserId === userId);
}
