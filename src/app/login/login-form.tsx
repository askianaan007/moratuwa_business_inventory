"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { safeNext } from "@/lib/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email: form.get("email"), password: form.get("password") } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="card-title">Sign in</h2>

      {error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {error}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          className="input input-lg w-full"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input input-lg w-full"
        />
      </label>

      <button type="submit" className="btn btn-primary btn-lg mt-2" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Sign in
      </button>
    </form>
  );
}
