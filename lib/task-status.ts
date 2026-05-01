export type UiTaskStatus = "start" | "hold_pause" | "finish";
export type DbTaskStatus = "todo" | "in_progress" | "done";
export type AnyTaskStatus = UiTaskStatus | DbTaskStatus;

export function toDbTaskStatus(status: AnyTaskStatus): DbTaskStatus {
  if (status === "start" || status === "todo") return "todo";
  if (status === "hold_pause" || status === "in_progress") return "in_progress";
  return "done";
}

export function toUiTaskStatus(status: AnyTaskStatus): UiTaskStatus {
  if (status === "start" || status === "todo") return "start";
  if (status === "hold_pause" || status === "in_progress") return "hold_pause";
  return "finish";
}
