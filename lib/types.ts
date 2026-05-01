export type ProjectRole = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "done";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  added_by: string | null;
};

export type ProjectInvitation = {
  id: string;
  project_id: string;
  invited_email: string;
  invited_by: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  assignee_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
