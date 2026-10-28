"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DownloadIcon, FileIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { api, ApiError } from "@/lib/api-client";
import { formatDate, todayISO } from "@/lib/format";
import { auditStatusBadge, checkStatus } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { LabAuditDetail, LabCheckStatus, User } from "@/lib/types";

interface Progress {
  total: number;
  checked: number;
  byStatus: Record<LabCheckStatus, number>;
  pct: number;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;

/** Items added to or removed from the room after the audit started. */
export function TargetSyncBanner({ audit }: { audit: LabAuditDetail }) {
  const router = useRouter();
  const [changes, setChanges] = useState<{ added: { itemCode: string }[]; retired: { itemCode: string }[] } | null>(null);
  const { pending, error, run } = useAction();

  useEffect(() => {
    let live = true;
    api<{ data: { added: { itemCode: string }[]; retired: { itemCode: string }[] } }>(`/lab-audits/${audit.id}/targets/preview`, { method: "POST", body: {} })
      .then((res) => live && setChanges(res.data))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [audit.id, audit.version]);

  if (!changes || (!changes.added.length && !changes.retired.length)) return null;
  const sync = async () => {
    const res = await run(() => api(`/lab-audits/${audit.id}/targets/sync`, { method: "POST", body: { expectedVersion: audit.version } }));
    if (res) {
      setChanges(null);
      router.refresh();
    }
  };

  return (
    <div className="alert alert-info alert-soft mb-3 flex-wrap text-sm">
      <span className="flex-1">
        The room changed since this audit started
        {changes.added.length > 0 && `: ${changes.added.length} new item(s) (${changes.added.slice(0, 4).map((a) => a.itemCode).join(", ")}${changes.added.length > 4 ? "…" : ""})`}
        {changes.retired.length > 0 && `; ${changes.retired.length} removed`}.
      </span>
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => void sync()}>
        Update checklist
      </button>
      {error && <p className="w-full text-error">{error}</p>}
    </div>
  );
}

export function AuditPanels({
  audit,
  user,
  progress,
  editable,
  flush,
  onFocusCheck,
}: {
  audit: LabAuditDetail;
  user: User;
  progress: Progress;
  editable: boolean;
  flush: () => Promise<boolean>;
  onFocusCheck: (checkId: string) => void;
}) {
  const [details, setDetails] = useState(false);
  const faults = progress.byStatus.NOT_WORKING + progress.byStatus.NEEDS_REPAIR + progress.byStatus.MISSING;
  const pdf = `/api/v1/lab-audits/${audit.id}/report.pdf`;
  const docx = `/api/v1/lab-audits/${audit.id}/report.docx`;
  const latest = audit.snapshots[0];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="flex-1 font-semibold">Audit details</h2>
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetails(true)}>
              Edit
            </button>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-base-content/60">Auditor</dt>
          <dd>
            {audit.auditorName}
            {audit.auditorDesignation && `, ${audit.auditorDesignation}`}
          </dd>
          <dt className="text-base-content/60">Dates</dt>
          <dd>
            {formatDate(audit.startedOn)} – {audit.completedOn ? formatDate(audit.completedOn) : "in progress"}
          </dd>
          {audit.generalRemarks && (
            <>
              <dt className="text-base-content/60">Remarks</dt>
              <dd className="whitespace-pre-line">{audit.generalRemarks}</dd>
            </>
          )}
          {audit.recommendations && (
            <>
              <dt className="text-base-content/60">Recommend.</dt>
              <dd className="whitespace-pre-line">{audit.recommendations}</dd>
            </>
          )}
        </dl>
      </section>

      {editable && <SubmitPanel audit={audit} progress={progress} faults={faults} flush={flush} onFocusCheck={onFocusCheck} onEditDetails={() => setDetails(true)} />}
      {audit.status === "SUBMITTED" && audit.canDecide && <DecisionPanel audit={audit} />}
      {audit.status === "SUBMITTED" && !audit.canDecide && (
        <p className="rounded-box bg-base-200 p-3 text-sm">Waiting for the Head of Department to approve. People who carried out the audit cannot approve it.</p>
      )}

      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <h2 className="mb-1 font-semibold">Report (A4)</h2>
        <p className="mb-3 text-sm text-base-content/60">
          {latest ? `Revision ${latest.revision} · ${latest.kind === "APPROVED" ? "approved" : "as submitted"} ${formatDate(latest.createdAt)}` : "Draft — marked DRAFT until submitted."}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a href={`${pdf}?inline=1`} target="_blank" rel="noopener" className="btn btn-outline">
            <FileIcon className="size-4" /> View PDF
          </a>
          <a href={pdf} download className="btn btn-primary">
            <DownloadIcon className="size-4" /> PDF
          </a>
          <a href={docx} download className="btn btn-outline">
            <DownloadIcon className="size-4" /> Word
          </a>
        </div>
        {audit.snapshots.length > 1 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-base-content/70">Earlier revisions</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {audit.snapshots.slice(1).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex-1">
                    Rev {s.revision} · {s.kind.toLowerCase()} · {formatDate(s.createdAt)}
                  </span>
                  <a className="link" href={`${pdf}?revision=${s.revision}`} download>
                    PDF
                  </a>
                  <a className="link" href={`${docx}?revision=${s.revision}`} download>
                    Word
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {user.role === "ADMIN" && (audit.status === "SUBMITTED" || audit.status === "APPROVED") && <ReopenPanel audit={audit} />}

      {audit.transitions.length > 0 && (
        <section className="px-1">
          <h2 className="mb-2 text-sm font-semibold text-base-content/70">History</h2>
          <ol className="flex flex-col gap-2 border-l-2 border-base-300 pl-3 text-sm">
            {audit.transitions.map((t) => (
              <li key={t.id}>
                <span className={`badge badge-xs mr-1 ${auditStatusBadge[t.to].className}`} />
                <b>{auditStatusBadge[t.to].label}</b> · {t.actor.name} · {formatDate(t.at)}
                {t.comment && <p className="text-base-content/70">“{t.comment}”</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <DetailsSheet audit={audit} open={details} onClose={() => setDetails(false)} />
    </div>
  );
}

function SubmitPanel({
  audit,
  progress,
  faults,
  flush,
  onFocusCheck,
  onEditDetails,
}: {
  audit: LabAuditDetail;
  progress: Progress;
  faults: number;
  flush: () => Promise<boolean>;
  onFocusCheck: (checkId: string) => void;
  onEditDetails: () => void;
}) {
  const router = useRouter();
  const [problems, setProblems] = useState<{ path: string; message: string }[]>([]);
  const { pending, error, run, setError } = useAction();
  const left = progress.byStatus.NOT_CHECKED;

  async function submit() {
    setProblems([]);
    const saved = await flush();
    if (!saved) {
      setError("Some changes are not saved yet. Check your connection and the highlighted items.");
      return;
    }
    try {
      const res = await run(async () => {
        try {
          return await api(`/lab-audits/${audit.id}/submit`, { method: "POST", body: { expectedVersion: audit.version } });
        } catch (err) {
          if (err instanceof ApiError && err.code === "AUDIT_INCOMPLETE") setProblems(err.details);
          throw err;
        }
      });
      if (res) router.refresh();
    } catch {
      // handled by useAction
    }
  }

  return (
    <section className="rounded-box border-2 border-primary/40 bg-base-100 p-4">
      <h2 className="font-semibold">{audit.status === "RETURNED" ? "Fix and resubmit" : "Submit to Head of Department"}</h2>
      <p className="mt-1 text-sm text-base-content/70">
        {progress.checked} of {progress.total} checked · {faults} fault{faults === 1 ? "" : "s"}
        {left > 0 && ` · ${left} not checked (each needs a reason)`}
      </p>
      {audit.status === "RETURNED" && audit.transitions.at(-1)?.comment && (
        <p className="mt-2 rounded-field bg-error/10 p-2 text-sm">HOD: “{audit.transitions.at(-1)!.comment}”</p>
      )}
      {!audit.completedOn && <p className="mt-2 text-xs text-base-content/60">The completion date will be set to today. <button type="button" className="link" onClick={onEditDetails}>Change</button></p>}
      {problems.length > 0 && (
        <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-field bg-error/10 p-2 text-sm">
          {problems.map((p) => (
            <li key={p.path}>
              <button type="button" className="link text-left" onClick={() => onFocusCheck(p.path)}>
                {p.message}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && !problems.length && <p className="mt-2 text-sm text-error">{error}</p>}
      <button type="button" className="btn btn-primary mt-3 w-full" disabled={pending} onClick={() => void submit()}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        Submit audit
      </button>
    </section>
  );
}

function DecisionPanel({ audit }: { audit: LabAuditDetail }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();
  const faults = audit.checks.filter((c) => c.status === "NOT_WORKING" || c.status === "NEEDS_REPAIR" || c.status === "MISSING").length;

  async function decide(decision: "APPROVED" | "RETURNED", form: HTMLFormElement) {
    const comment = text(new FormData(form), "comment");
    const res = await run(() => api(`/lab-audits/${audit.id}/decision`, { method: "POST", body: { expectedVersion: audit.version, decision, comment } }));
    if (res) router.refresh();
  }

  return (
    <form
      className="rounded-box border-2 border-warning/50 bg-base-100 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void decide("APPROVED", e.currentTarget);
      }}
    >
      <h2 className="font-semibold">Review this audit</h2>
      <p className="mb-2 text-sm text-base-content/70">
        {audit.checks.length} items · {faults} fault{faults === 1 ? "" : "s"} · by {audit.auditorName}. Open the PDF below before approving.
      </p>
      <textarea name="comment" rows={2} placeholder="Comment (required to return)" aria-label="Comment" className={`textarea w-full ${fieldErrors.comment ? "textarea-error" : ""}`} />
      {(fieldErrors.comment || error) && <p className="text-sm text-error">{fieldErrors.comment ?? error}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-outline btn-error" disabled={pending} onClick={(e) => void decide("RETURNED", e.currentTarget.form!)}>
          Return
        </button>
        <button type="submit" className="btn btn-success" disabled={pending}>
          {pending && <span className="loading loading-spinner loading-sm" />}
          Approve
        </button>
      </div>
    </form>
  );
}

function ReopenPanel({ audit }: { audit: LabAuditDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await run(() => api(`/lab-audits/${audit.id}/reopen`, { method: "POST", body: { expectedVersion: audit.version, reason: text(new FormData(event.currentTarget), "reason") } }));
    if (res) router.refresh();
  }

  return open ? (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-box border border-base-300 p-4">
      <p className="text-sm">Reopening returns the audit to the auditor. Earlier report revisions are kept.</p>
      <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason" className="input w-full" />
      {error && <p className="text-sm text-error">{error}</p>}
      <button type="submit" className="btn btn-warning" disabled={pending}>
        Reopen audit
      </button>
    </form>
  ) : (
    <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setOpen(true)}>
      Reopen (admin)
    </button>
  );
}

function DetailsSheet({ audit, open, onClose }: { audit: LabAuditDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const auditorName = text(form, "auditorName");
    const res = await run(() =>
      api(`/lab-audits/${audit.id}`, {
        method: "PATCH",
        body: {
          expectedVersion: audit.version,
          ...(auditorName && { auditorName }),
          auditorDesignation: text(form, "auditorDesignation"),
          startedOn: form.get("startedOn"),
          completedOn: text(form, "completedOn"),
          generalRemarks: text(form, "generalRemarks"),
          recommendations: text(form, "recommendations"),
        },
      }),
    );
    if (res) {
      try {
        localStorage.setItem("labledger:auditor", JSON.stringify({ name: auditorName, designation: text(form, "auditorDesignation") }));
      } catch {
        // optional convenience
      }
      onClose();
      router.refresh();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Audit details"
      subtitle="Printed on the report"
      footer={
        <button type="submit" form="audit-details" className="btn btn-primary w-full" disabled={pending}>
          {pending && <span className="loading loading-spinner loading-sm" />}
          Save
        </button>
      }
    >
      <form id="audit-details" onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {error && <p className="text-sm text-error">{error}</p>}
        <label className="flex flex-col gap-1 text-sm">
          Auditor name
          <input name="auditorName" defaultValue={audit.auditorName} required className={`input w-full ${fieldErrors.auditorName ? "input-error" : ""}`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Designation
          <input name="auditorDesignation" defaultValue={audit.auditorDesignation ?? ""} placeholder="e.g. Technical Officer" className="input w-full" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Started
            <input type="date" name="startedOn" defaultValue={audit.startedOn.slice(0, 10)} max={todayISO()} className="input w-full" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Completed
            <input type="date" name="completedOn" defaultValue={audit.completedOn?.slice(0, 10) ?? ""} max={todayISO()} className={`input w-full ${fieldErrors.completedOn ? "input-error" : ""}`} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          General remarks
          <textarea name="generalRemarks" defaultValue={audit.generalRemarks ?? ""} rows={3} className="textarea w-full" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Recommendations
          <textarea name="recommendations" defaultValue={audit.recommendations ?? ""} rows={3} className="textarea w-full" />
        </label>
        <p className="text-xs text-base-content/60">
          {checkStatus.NOT_CHECKED.symbol} Items left “Not checked” must say why before you can submit.
        </p>
      </form>
    </Sheet>
  );
}
