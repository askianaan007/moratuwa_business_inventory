"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { DepartmentSummary } from "@/lib/types";

/** Admin-only: add a new department. */
export function AddDepartmentForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const text = (key: string) => String(form.get(key) ?? "").trim() || undefined;

    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      await api("/departments", { method: "POST", body: { name: text("name"), code: text("code") } });
      formEl.reset();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("Could not reach the server. Check your connection.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-box border-2 border-primary bg-base-100 p-4" noValidate>
      <p className="font-semibold">Add department</p>
      {formError && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required placeholder="e.g. Electrical Engineering" className={`input w-full ${errors.name ? "input-error" : ""}`} />
          {errors.name && <span className="text-sm text-error">{errors.name}</span>}
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Code</span>
          <input name="code" required placeholder="ELEC" maxLength={10} className={`input w-full uppercase ${errors.code ? "input-error" : ""}`} />
          {errors.code && <span className="text-sm text-error">{errors.code}</span>}
        </label>
      </div>
      <p className="text-xs text-base-content/60">The code goes into asset tags and audit references, so it cannot be changed later.</p>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Add department
      </button>
    </form>
  );
}

/** Admin-only: rename a department. Its code stays fixed. */
export function DepartmentAdminActions({ department }: { department: DepartmentSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRename() {
    const name = window.prompt("New name", department.name)?.trim();
    if (!name || name === department.name) return;
    setPending(true);
    setError(null);
    try {
      await api(`/departments/${department.id}`, { method: "PATCH", body: { name } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-base-200 px-4 py-2">
      {error && <p className="w-full text-sm text-error">{error}</p>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void onRename()}>
        Rename
      </button>
    </div>
  );
}
