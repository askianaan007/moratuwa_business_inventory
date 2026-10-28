"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { CategorySummary } from "@/lib/types";

/** Admin-only: add a new category (variety). */
export function AddCategoryForm() {
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
      await api("/categories", {
        method: "POST",
        body: { name: text("name"), code: text("code"), description: text("description") },
      });
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
      <p className="font-semibold">Add category</p>
      {formError && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required placeholder="e.g. Projectors" className={`input w-full ${errors.name ? "input-error" : ""}`} />
          {errors.name && <span className="text-sm text-error">{errors.name}</span>}
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Code</span>
          <input
            name="code"
            required
            placeholder="PROJ"
            className={`input w-full uppercase ${errors.code ? "input-error" : ""}`}
          />
          {errors.code && <span className="text-sm text-error">{errors.code}</span>}
        </label>
      </div>
      <input name="description" placeholder="Description (optional)" className="input w-full" aria-label="Description" />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Add category
      </button>
    </form>
  );
}

/** Admin-only: rename, or switch a category on/off. Categories are never deleted. */
export function CategoryAdminActions({ category }: { category: CategorySummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(body: Partial<Pick<CategorySummary, "name" | "isActive">>) {
    setPending(true);
    setError(null);
    try {
      await api(`/categories/${category.id}`, { method: "PATCH", body });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  function onRename() {
    const name = window.prompt("New name", category.name)?.trim();
    if (name && name !== category.name) void update({ name });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-base-200 px-4 py-2">
      {error && <p className="w-full text-sm text-error">{error}</p>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={onRename}>
        Rename
      </button>
      <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
        Active
        <input
          type="checkbox"
          className="toggle toggle-sm toggle-success"
          checked={category.isActive}
          disabled={pending}
          onChange={(e) => void update({ isActive: e.target.checked })}
        />
      </label>
    </div>
  );
}
