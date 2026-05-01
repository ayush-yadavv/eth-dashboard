import { describe, expect, it } from "vitest";
import { addMemberSchema, createTaskSchema, projectCreateSchema } from "../../lib/validation/schemas";

describe("validation schemas", () => {
  it("normalizes member email and accepts valid role", () => {
    const parsed = addMemberSchema.parse({
      email: "  TEST@EXAMPLE.COM  ",
      role: "admin",
    });

    expect(parsed.email).toBe("test@example.com");
    expect(parsed.role).toBe("admin");
  });

  it("rejects invalid due date format", () => {
    const result = createTaskSchema.safeParse({
      title: "Ship release",
      dueDate: "06-01-2026",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty project name", () => {
    const result = projectCreateSchema.safeParse({
      name: "   ",
    });

    expect(result.success).toBe(false);
  });
});
