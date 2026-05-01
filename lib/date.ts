export function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return dueDate < dayStart.toISOString().slice(0, 10);
}

export function addDays(days: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString();
}
