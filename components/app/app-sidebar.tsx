"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BlocksIcon,
  FolderKanbanIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserCircle2Icon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type ProjectNav = {
  role: "admin" | "member";
  project: { id: string; name: string };
};

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectNav[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { projects?: ProjectNav[] };
        if (!cancelled && response.ok) {
          setProjects(result.projects ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProjectId = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const activeProjectRole = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((item) => item.project.id === activeProjectId)?.role ?? null;
  }, [activeProjectId, projects]);

  const uniqueProjects = useMemo(() => {
    const map = new Map<string, ProjectNav>();
    for (const item of projects) {
      const existing = map.get(item.project.id);
      if (!existing || item.role === "admin") {
        map.set(item.project.id, item);
      }
    }
    return Array.from(map.values());
  }, [projects]);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Dashboard"
              isActive={pathname === "/dashboard"}
              onClick={() => router.push("/dashboard")}
            >
              <BlocksIcon />
              <span>Team Task Manager</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  isActive={pathname === "/dashboard"}
                  onClick={() => router.push("/dashboard")}
                >
                  <HomeIcon />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Profile"
                  isActive={pathname === "/profile"}
                  onClick={() => router.push("/profile")}
                >
                  <UserCircle2Icon />
                  <span>Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {activeProjectId && activeProjectRole === "admin" ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Manage Users"
                    isActive={pathname === `/projects/${activeProjectId}/manage-users`}
                    onClick={() => router.push(`/projects/${activeProjectId}/manage-users`)}
                  >
                    <ShieldCheckIcon />
                    <span>Manage Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {uniqueProjects.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <FolderKanbanIcon />
                    <span>No projects yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {uniqueProjects.map((item) => (
                <SidebarMenuItem key={item.project.id}>
                  <SidebarMenuButton
                    tooltip={item.project.name}
                    isActive={activeProjectId === item.project.id}
                    onClick={() => router.push(`/projects/${item.project.id}`)}
                  >
                    <FolderKanbanIcon />
                    <span>{item.project.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2 py-2 text-xs text-sidebar-foreground/80">
          {userEmail}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
