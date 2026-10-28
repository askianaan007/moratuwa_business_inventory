"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api-client";
import { todayISO } from "@/lib/format";
import { formatPeriod } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { LabAuditDetail } from "@/lib/types";

const AUDITOR_KEY = "labledger:auditor";

function remembered(): { name?: string; designation?: string } {
  try {
    return JSON.parse(localStorage.getItem(AUDITOR_KEY) ?? "{}") as { name?: string; designation?: string };
  } catch {
    return {};
  }
}

/** Opens a sheet to start this month's audit for one room. */
export function StartAuditButton({ roomId, roomName, period, defaultName }: { roomId: string; roomName: string; period: string; defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ name?: string; designation?: string }>({});
  const { pending, error, fieldErrors, run } = useAction();

  function openSheet() {
    setSaved(remembered());
    setOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const auditorName = String(form.get("auditorName") ?? "").trim();
    const auditorDesignation = String(form.get("auditorDesignation") ?? "").trim() || null;
    const result = await run(() =>
      api<{ data: LabAuditDetail }>("/lab-audits", {
        method: "POST",
        body: {
          roomId,
          period,
          auditorName,
          auditorDesignation,
          startedOn: String(form.get("startedOn")),
          copyFromPrevious: form.get("copyFromPrevious") === "on",
        },
      }),
    );
    if (!result) return;
    try {
      localStorage.setItem(AUDITOR_KEY, JSON.stringify({ name: auditorName, designation: auditorDesignation }));
    } catch {
      // Storage unavailable: just don't remember.
    }
    router.push(`/audit/runs/${result.data.id}`);
  }

  return (
    <>
      <button type="button" className="btn btn-primary flex-1" onClick={openSheet}>
        Start audit
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Start audit" subtitle={`${roomName} · ${formatPeriod(period)}`}>
        <form id={`start-${roomId}`} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Auditor name</span>
            <input name="auditorName" required minLength={2} defaultValue={saved.name ?? defaultName} className={`input w-full ${fieldErrors.auditorName ? "input-error" : ""}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Designation</span>
            <input name="auditorDesignation" defaultValue={saved.designation ?? "Technical Officer"} className="input w-full" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Start date</span>
            <input name="startedOn" type="date" required defaultValue={todayISO()} max={todayISO()} className="input w-full" />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-box border border-base-300 p-3">
            <input name="copyFromPrevious" type="checkbox" defaultChecked className="checkbox checkbox-primary mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Show last approved month as hints</span>
              <span className="block text-base-content/60">Hints never count as checked — you still confirm each item.</span>
            </span>
          </label>
          <button type="submit" className="btn btn-primary btn-lg mt-1" disabled={pending}>
            {pending && <span className="loading loading-spinner" />}
            Start
          </button>
        </form>
      </Sheet>
    </>
  );
}
