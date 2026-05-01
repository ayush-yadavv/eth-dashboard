"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "signup";

type Props = {
  mode: AuthMode;
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const payload: Record<string, string> = {
      email,
      password,
    };

    if (isSignup) {
      payload.fullName = fullName;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Authentication failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">{isSignup ? "Create account" : "Login"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup ? "Start managing team projects and tasks." : "Use your account to continue."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {isSignup ? (
          <label className="block text-sm">
            <span className="mb-1 block text-foreground">Full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </label>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-foreground">Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            type="email"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-foreground">Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            type="password"
            minLength={8}
            required
          />
        </label>

        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Please wait..." : isSignup ? "Create account" : "Login"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-primary underline-offset-4 hover:underline">
          {isSignup ? "Login" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
