"use client";

import { memo, useState } from "react";
import { Badge } from "@/components/ui";
import type { CheckEdit } from "@/lib/audit-outbox";
import { CHECK_ACTIONS, checkStatus } from "@/lib/lab-status";
import type { FaultReason, LabCheck, LabCheckStatus } from "@/lib/types";

/**
 * One item to inspect: big status buttons, then reason chips when it is not
 * working. Every tap saves (through the outbox), so there is no Save button.
 */
export const CheckItem = memo(function CheckItem({
  check,
  reasons,
  editable,
  error,
  onRecord,
}: {
  check: LabCheck;
  reasons: FaultReason[];
  editable: boolean;
  error?: string;
  onRecord: (checkId: string, edit: Partial<CheckEdit>) => void;
}) {
  const [more, setMore] = useState(Boolean(check.notes || check.actionTaken || check.followUp));
  const meta = checkStatus[check.status];
  const askReason = meta.needsReason || check.status === "NOT_CHECKED";
  const hasReason = Boolean(check.faultReasonId || check.reasonText);
  const missingReason = meta.needsReason && !hasReason;
  const record = (edit: Partial<CheckEdit>) => onRecord(check.id, edit);
  const pickStatus = (status: LabCheckStatus) => {
    // Keep the reason only when it still applies.
    const keep = checkStatus[status].needsReason || status === "NOT_CHECKED";
    record({ status, ...(keep ? {} : { faultReasonId: null, reasonText: null }) });
  };
  const suggestion = check.suggestedStatus && check.status === "NOT_CHECKED" ? check.suggestedStatus : null;

  return (
    <article
      id={`check-${check.id}`}
      className={`rounded-box border bg-base-100 p-3 transition-colors duration-200 ${
        error || missingReason ? "border-error" : check.status === "NOT_CHECKED" ? "border-base-300" : "border-base-200"
      } ${check.targetRetiredAfterStart ? "opacity-60" : ""}`}
    >
      <header className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="font-mono font-semibold">{check.itemCode}</span>
            <span className="text-sm text-base-content/70">{check.targetKind === "SEAT" ? "Table (no PC)" : check.typeName}</span>
          </p>
          {(check.serialNo || check.assetTag) && (
            <p className="truncate text-xs text-base-content/50">{[check.serialNo && `S/N ${check.serialNo}`, check.assetTag].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <Badge className={`${meta.badge} shrink-0`}>
          {meta.symbol} {meta.label}
        </Badge>
      </header>

      {check.addedAfterStart && <p className="mb-2 text-xs text-info">Added to the room after this audit started.</p>}
      {check.targetRetiredAfterStart && <p className="mb-2 text-xs text-warning">Removed from the room since the audit started.</p>}

      {suggestion && editable && (
        <div className="mb-2 flex items-center gap-2 rounded-field bg-base-200 px-2 py-1.5 text-xs">
          <span className="flex-1">
            Last month: <b>{checkStatus[suggestion].label}</b>
            {check.suggestedReason && ` — ${check.suggestedReason}`}
          </span>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => record({ status: suggestion, reasonText: checkStatus[suggestion].needsReason ? check.suggestedReason : null })}
          >
            Still the same
          </button>
        </div>
      )}

      {editable ? (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-label={`Status of ${check.itemCode}`}>
          {CHECK_ACTIONS.map((s) => {
            const active = check.status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickStatus(s)}
                className={`btn h-12 flex-col gap-0 px-1 text-xs leading-tight transition-transform active:scale-95 ${active ? checkStatus[s].button : "btn-outline border-base-300 font-normal"}`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {checkStatus[s].symbol}
                </span>
                {checkStatus[s].label}
              </button>
            );
          })}
        </div>
      ) : (
        (check.faultReason || check.reasonText) && <p className="text-sm">{check.faultReason?.label ?? check.reasonText}</p>
      )}

      {editable && askReason && (
        <div className="animate-in mt-3">
          <p className={`mb-1 text-xs font-medium ${missingReason ? "text-error" : "text-base-content/70"}`}>
            {check.status === "NOT_CHECKED" ? "Why could it not be checked? (needed to submit)" : "Reason (required)"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => {
              const active = check.faultReasonId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => record(active ? { faultReasonId: null } : { faultReasonId: r.id, reasonText: null })}
                  className={`btn btn-sm rounded-full font-normal ${active ? "btn-neutral" : "btn-outline border-base-300"}`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <input
            key={`${check.id}-${check.faultReasonId ?? "none"}`}
            defaultValue={check.faultReasonId ? "" : (check.reasonText ?? "")}
            onBlur={(e) => {
              const value = e.target.value.trim() || null;
              if (value !== (check.faultReasonId ? null : check.reasonText)) record(value ? { reasonText: value, faultReasonId: null } : { reasonText: null });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="Or type a reason"
            aria-label="Other reason"
            maxLength={500}
            className="input input-sm mt-2 w-full"
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {editable && (
        <div className="mt-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setMore(!more)} aria-expanded={more}>
            {more ? "Hide notes" : "+ Notes, action taken, follow-up"}
          </button>
          {more && (
            <div className="animate-in mt-1 grid gap-2">
              {(["notes", "actionTaken", "followUp"] as const).map((field) => (
                <input
                  key={field}
                  defaultValue={check[field] ?? ""}
                  onBlur={(e) => {
                    const value = e.target.value.trim() || null;
                    if (value !== check[field]) record({ [field]: value });
                  }}
                  placeholder={field === "notes" ? "Notes" : field === "actionTaken" ? "Action taken (e.g. reseated cable)" : "Follow-up (e.g. order new PSU)"}
                  aria-label={field}
                  maxLength={field === "notes" ? 1000 : 500}
                  className="input input-sm w-full"
                />
              ))}
            </div>
          )}
        </div>
      )}
      {!editable && (check.notes || check.actionTaken || check.followUp) && (
        <p className="mt-1 text-xs text-base-content/60">{[check.notes, check.actionTaken && `Action: ${check.actionTaken}`, check.followUp && `Follow-up: ${check.followUp}`].filter(Boolean).join(" · ")}</p>
      )}
    </article>
  );
});
