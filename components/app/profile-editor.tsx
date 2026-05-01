"use client";

import { FormEvent, useState } from "react";

type Props = {
  userId: string;
  email: string;
  initialFullName: string | null;
};

export function ProfileEditor({ userId, email, initialFullName }: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });

    const result = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Could not update profile");
      return;
    }

    setSuccess("Name updated");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
      <p>
        <span className="text-muted-foreground">User ID:</span> {userId}
      </p>
      <p>
        <span className="text-muted-foreground">Email:</span> {email}
      </p>
      <label className="block">
        <span className="mb-1 block text-muted-foreground">Full name</span>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          required
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save name"}
        </button>
        {success ? <span className="text-xs text-primary">{success}</span> : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
