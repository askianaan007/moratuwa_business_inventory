"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api-client";
import { useAction } from "@/lib/use-action";
import type { Department, Location } from "@/lib/types";

/**
 * Admin/HOD: create a lab or classroom, or turn an existing location into one.
 * `departments` is non-empty only for users without a department (admins),
 * who must say which department the new room belongs to.
 */
export function NewRoomForm({ locations, departments }: { locations: Location[]; departments: Department[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim() || undefined;
    const body =
      mode === "existing"
        ? { locationId: text("locationId"), roomType: text("roomType") }
        : { departmentId: text("departmentId"), code: text("code"), name: text("name"), building: text("building"), floor: text("floor"), roomType: text("roomType") };
    const result = await run(() => api<{ data: { id: string } }>("/rooms", { method: "POST", body }));
    if (result) router.push(`/audit/rooms/${result.data.id}/layout`);
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <PlusIcon className="size-5" />
        New lab or classroom
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="New room">
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {locations.length > 0 && (
            <div role="tablist" className="tabs tabs-box">
              <button type="button" role="tab" className={`tab flex-1 ${mode === "new" ? "tab-active" : ""}`} onClick={() => setMode("new")}>
                New room
              </button>
              <button type="button" role="tab" className={`tab flex-1 ${mode === "existing" ? "tab-active" : ""}`} onClick={() => setMode("existing")}>
                Existing location
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Type</span>
            <select name="roomType" className="select w-full" defaultValue="LAB">
              <option value="LAB">Computer lab</option>
              <option value="CLASSROOM">Classroom</option>
            </select>
          </label>
          {mode === "existing" ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Location</span>
              <select name="locationId" className="select w-full" required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              {departments.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Department</span>
                  <select name="departmentId" className={`select w-full ${fieldErrors.departmentId ? "select-error" : ""}`} required defaultValue={departments.length === 1 ? departments[0]!.id : ""}>
                    {departments.length > 1 && (
                      <option value="" disabled>
                        Choose a department
                      </option>
                    )}
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-[8rem_1fr] gap-3">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">Code</span>
                  <input name="code" required placeholder="ELEC-LAB-02" className={`input w-full uppercase ${fieldErrors.code ? "input-error" : ""}`} />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">Name</span>
                  <input name="name" required placeholder="Computer Lab 02" className={`input w-full ${fieldErrors.name ? "input-error" : ""}`} />
                </label>
              </div>
              {(fieldErrors.code || fieldErrors.name) && <p className="text-sm text-error">{fieldErrors.code ?? fieldErrors.name}</p>}
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <input name="building" placeholder="Building (optional)" aria-label="Building" className="input w-full" />
                <input name="floor" placeholder="Floor" aria-label="Floor" className="input w-full" />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending && <span className="loading loading-spinner" />}
            Create and set up layout
          </button>
        </form>
      </Sheet>
    </>
  );
}
