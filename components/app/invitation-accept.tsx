"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvitationAccept({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedProjectId, setAcceptedProjectId] = useState<string | null>(null);

  async function acceptInvitation() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
    const result = (await response.json()) as { error?: string; projectId?: string };
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Could not accept invitation");
      return;
    }

    setAcceptedProjectId(result.projectId ?? null);
    router.refresh();
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Project invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">Accept this invitation to join the project.</p>

      {error ? <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {acceptedProjectId ? (
        <p className="mt-4 rounded-md bg-secondary px-3 py-2 text-sm">
          Invitation accepted.{" "}
          <Link href={`/projects/${acceptedProjectId}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Open project
          </Link>
        </p>
      ) : (
        <button
          onClick={acceptInvitation}
          disabled={loading}
          className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Accepting..." : "Accept invitation"}
        </button>
      )}
    </div>
  );
}
