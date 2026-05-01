import { describe, expect, it } from "vitest";
import { canManageProject, canUpdateTask } from "../../lib/auth/permissions";

describe("permission helpers", () => {
  it("allows only admins to manage project settings", () => {
    expect(canManageProject("admin")).toBe(true);
    expect(canManageProject("member")).toBe(false);
  });

  it("allows admin to update any task", () => {
    expect(canUpdateTask("admin", "user-1", "user-2")).toBe(true);
  });

  it("allows assignee member to update task", () => {
    expect(canUpdateTask("member", "user-1", "user-1")).toBe(true);
  });

  it("denies non-assignee member updates", () => {
    expect(canUpdateTask("member", "user-1", "user-2")).toBe(false);
    expect(canUpdateTask("member", "user-1", null)).toBe(false);
  });
});
