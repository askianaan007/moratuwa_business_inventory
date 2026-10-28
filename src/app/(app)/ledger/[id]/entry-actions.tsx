"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { LedgerEntryDetail, User } from "@/lib/types";

/** Workflow buttons: mark as written in the book, submit to HOD, approve/reject. */
export function EntryActions({ entry, user }: { entry: LedgerEntryDetail; user: User }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user.role !== "VIEWER";
  const canDecide =
    (user.role === "HOD" || user.role === "ADMIN") &&
    entry.approvalStatus === "SUBMITTED" &&
    (entry.createdById !== user.id || user.role === "ADMIN");
  const canSubmit = canEdit && (entry.approvalStatus === "DRAFT" || entry.approvalStatus === "REJECTED");
  const needsBook = canEdit && entry.bookStatus === "PENDING_BOOK";

  if (!canDecide && !canSubmit && !needsBook) return null;

  async function run(path: string, body?: unknown) {
    setPending(true);
    setError(null);
    try {
      await api(`/ledger/${entry.id}${path}`, { method: "POST", body });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  function onMarkWritten(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run("/book", {
      bookVolume: String(form.get("bookVolume") ?? "").trim() || undefined,
      bookPage: Number(form.get("bookPage")),
    });
  }

  function onDecide(decision: "APPROVED" | "REJECTED") {
    const comment = decision === "REJECTED" ? window.prompt("Reason for rejecting (optional)") : undefined;
    if (comment === null) return; // cancelled
    void run("/decision", { decision, comment: comment || undefined });
  }

  return (
    <section className="flex flex-col gap-3 rounded-box border-2 border-primary bg-base-100 p-4">
      {error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {error}
        </div>
      )}

      {needsBook && (
        <form onSubmit={onMarkWritten} className="flex flex-col gap-2">
          <p className="font-semibold">Written into the ledger book?</p>
          <div className="flex gap-2">
            <input name="bookVolume" placeholder="Vol." className="input w-20" aria-label="Book volume" />
            <input
              name="bookPage"
              type="number"
              inputMode="numeric"
              min={1}
              required
              placeholder="Page no."
              className="input flex-1"
              aria-label="Book page number"
            />
            <button className="btn btn-secondary" disabled={pending}>
              Mark
            </button>
          </div>
        </form>
      )}

      {canSubmit && (
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run("/submit")}>
          Send to HOD for approval
        </button>
      )}

      {canDecide && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-success" disabled={pending} onClick={() => onDecide("APPROVED")}>
            Approve
          </button>
          <button type="button" className="btn btn-outline btn-error" disabled={pending} onClick={() => onDecide("REJECTED")}>
            Reject
          </button>
        </div>
      )}
    </section>
  );
}
