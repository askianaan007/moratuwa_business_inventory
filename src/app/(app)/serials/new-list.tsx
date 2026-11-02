"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api-client";
import type { Department, SerialListSummary } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/** Creates a list and opens it, ready to scan. `checkedBy` prefills the "Checked by" signature from the most recent list. */
export function NewSerialList({
  departments,
  checkedBy,
}: {
  departments: Department[];
  checkedBy: { name: string | null; designation: string | null };
}) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await run(() =>
      api<{ data: SerialListSummary }>("/serial-lists", {
        method: "POST",
        body: {
          title: form.get("title"),
          location: form.get("location"),
          notes: form.get("notes"),
          checkedByName: form.get("checkedByName"),
          checkedByDesignation: form.get("checkedByDesignation"),
          ...(departments.length && { departmentId: form.get("departmentId") || undefined }),
        },
      }),
    );
    if (created) router.push(`/serials/${created.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-box border-2 border-primary bg-base-100 p-4" noValidate>
      <p className="font-semibold">New serial list</p>
      {error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Name <span className="text-error">*</span>
        </span>
        <input name="title" required placeholder="e.g. Lab 02 PCs" className={`input w-full ${fieldErrors.title ? "input-error" : ""}`} />
        {fieldErrors.title && <span className="text-sm text-error">{fieldErrors.title}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Location</span>
        <input name="location" placeholder="e.g. Lab 02, ground floor" className="input w-full" />
      </label>
      {departments.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Department <span className="text-error">*</span>
          </span>
          <select name="departmentId" defaultValue="" required className={`select w-full ${fieldErrors.departmentId ? "select-error" : ""}`}>
            <option value="">— Select —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Notes</span>
        <textarea name="notes" rows={2} className="textarea w-full" placeholder="Shown on the PDF" />
      </label>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Checked by</span>
          <input name="checkedByName" defaultValue={checkedBy.name ?? ""} placeholder="Name" className="input w-full" />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Designation</span>
          <input name="checkedByDesignation" defaultValue={checkedBy.designation ?? ""} placeholder="e.g. Technical Officer" className="input w-full" />
        </label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <span className="loading loading-spinner" /> : <PlusIcon className="size-5" />}
        Create and start scanning
      </button>
    </form>
  );
}
