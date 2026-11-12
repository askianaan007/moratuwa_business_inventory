import Link from "next/link";
import { Suspense } from "react";
import { AlertIcon } from "@/components/icons";
import { Badge, CardSkeleton, Field, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { approvalBadge, bookStatusBadge, conditionBadge, formatDate, formatLKR } from "@/lib/format";
import { bookRef, itemStatusBadge, qty, type InventoryAssetDetail, type InventoryRoom } from "@/lib/inventory";
import { checkStatus, formatPeriod } from "@/lib/lab-status";
import type { ApprovalStatus, User } from "@/lib/types";
import { AssetActions } from "./asset-actions";

export default function AssetPage({ params }: PageProps<"/inventory/assets/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Asset" backHref="/inventory/assets" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Asset params={params} />
    </Suspense>
  );
}

const ACTION_LABEL: Record<string, string> = {
  update: "Details changed",
  transfer: "Transferred",
  dispose: "Disposed",
  move: "Moved",
  verified: "Verified in room",
  found_elsewhere: "Found in another room",
};

const DATE_TIME = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function Asset({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: a }, { data: me }] = await Promise.all([apiGet<{ data: InventoryAssetDetail }>(`/inventory/assets/${id}`), apiGet<{ data: { user: User } }>("/auth/me")]);
  const { data: rooms } = await apiGet<{ data: InventoryRoom[] }>(`/inventory/rooms?departmentId=${a.ledgerEntry.departmentId}`);
  const e = a.ledgerEntry;
  const ref = bookRef(e);
  const fitted = a.equipment.find((x) => x.state !== "RETIRED");

  // One timeline: transfers, sightings, lab audit results and edits, newest first.
  const timeline = [
    ...a.movements.map((m) => ({
      key: `m${m.id}`,
      at: m.movedAt,
      title: `${m.fromLocation?.code ?? "—"} → ${m.toLocation.code}`,
      text: m.reason,
      by: m.movedBy?.name,
      tone: "bg-primary",
    })),
    ...a.auditRecords.map((r) => ({
      key: `r${r.id}`,
      at: r.scannedAt,
      title: r.result === "FOUND_ELSEWHERE" ? `Seen in ${r.observedLocation?.code ?? "another room"}` : r.result === "FOUND" ? `Verified in ${r.observedLocation?.code ?? "room"}` : r.result.toLowerCase(),
      text: [r.session.title, r.note].filter(Boolean).join(" · "),
      by: r.scannedBy.name,
      tone: r.result === "FOUND" ? "bg-success" : "bg-warning",
    })),
    ...a.labChecks.map((c) => ({
      key: `c${c.id}`,
      at: c.checkedAt ?? `${c.audit.period}T00:00:00Z`,
      title: `${formatPeriod(c.audit.period)} lab audit: ${checkStatus[c.status].label}`,
      text: c.faultReason?.label ?? c.reasonText,
      by: undefined,
      tone: c.status === "WORKING" ? "bg-success" : "bg-error",
    })),
    ...a.log
      .filter((l) => l.action === "update" || l.action === "dispose")
      .map((l) => ({ key: `l${l.id}`, at: l.at, title: ACTION_LABEL[l.action] ?? l.action, text: null, by: l.actor?.name, tone: "bg-base-content/40" })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <>
      <PageHeader title={e.description} subtitle={<span className="font-mono">{a.tagCode}</span>} backHref="/inventory/assets" />

      <div className="mb-3 flex flex-wrap gap-2">
        <Badge className={`badge-md ${conditionBadge[a.condition].className}`}>{conditionBadge[a.condition].label}</Badge>
        <Badge className={`badge-md ${itemStatusBadge[a.status].className}`}>{itemStatusBadge[a.status].label}</Badge>
        {a.isBulk && <Badge className="badge-md badge-outline">Quantity stock × {qty(a)}</Badge>}
        <Badge className={`badge-md ${bookStatusBadge[e.bookStatus].className}`}>{bookStatusBadge[e.bookStatus].label}</Badge>
      </div>

      {a.warnings.length > 0 && (
        <div role="alert" className="alert alert-warning alert-soft mb-3 items-start text-sm">
          <AlertIcon className="size-5 shrink-0" />
          <ul className="flex flex-col gap-0.5">
            {a.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <AssetActions asset={a} rooms={rooms} role={me.user.role} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h2 className="mb-1 font-semibold">Identification</h2>
          <dl>
            <Field label="Internal tag (QR)">
              <span className="font-mono">{a.tagCode}</span>
            </Field>
            <Field label="Manufacturer serial">{a.isBulk ? "—" : a.serialNo}</Field>
            <Field label="Item code">{e.itemCode}</Field>
            <Field label="Category">{e.category?.name}</Field>
            <Field label="Brand / model">{[e.brand, e.modelNo].filter(Boolean).join(" · ") || null}</Field>
            <Field label="Custodian">{a.custodian}</Field>
            <Field label="Last verified">{a.lastSeen ? DATE_TIME(a.lastSeen) : <span className="text-warning">Never</span>}</Field>
          </dl>
        </section>

        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h2 className="mb-1 font-semibold">Location</h2>
          <dl>
            <Field label="Registered room">
              {a.location ? (
                <Link href={`/inventory/rooms/${a.location.id}`} className="link">
                  {a.location.code} — {a.location.name}
                </Link>
              ) : (
                <span className="text-warning">Not recorded</span>
              )}
            </Field>
            <Field label="Building / floor">{a.location ? [a.location.building, a.location.floor && `Floor ${a.location.floor}`].filter(Boolean).join(", ") || null : null}</Field>
            <Field label="Fitted in lab as">
              {fitted ? (
                <Link href={`/audit/rooms/${fitted.location.id}`} className="link">
                  {fitted.code} ({fitted.type.name}
                  {fitted.workstation && `, PC ${fitted.workstation.number}`}) · {fitted.location.code}
                </Link>
              ) : null}
            </Field>
            <Field label="Department">{e.department.name}</Field>
          </dl>
        </section>

        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="mb-1 flex items-center">
            <h2 className="flex-1 font-semibold">Official register (book)</h2>
            <Link href={`/ledger/${e.id}`} className="link link-hover text-sm">
              Open entry
            </Link>
          </div>
          <dl>
            <Field label="Book reference">{ref}</Field>
            <Field label="In book">
              <Badge className={bookStatusBadge[e.bookStatus].className}>{bookStatusBadge[e.bookStatus].label}</Badge>
            </Field>
            <Field label="Entry date">{formatDate(e.entryDate)}</Field>
            <Field label="Receipt / SIN / ref">{[e.receiptNo, e.sinNo, e.refNo].filter(Boolean).join(" · ") || null}</Field>
            <Field label="Book line quantity">
              {e.quantity}
              {e._count.items !== e.quantity && !a.isBulk && <span className="ml-1 text-xs text-warning">({e._count.items} tagged)</span>}
            </Field>
            <Field label="Unit price">{formatLKR(e.unitPrice)}</Field>
            <Field label="HOD signed">{e.hodSigned ? "Yes" : "No"}</Field>
            <Field label="Approval">
              <Badge className={approvalBadge[e.approvalStatus as ApprovalStatus]?.className ?? "badge-ghost"}>{approvalBadge[e.approvalStatus as ApprovalStatus]?.label ?? e.approvalStatus}</Badge>
            </Field>
            {e.serialNo && e.serialNo !== a.serialNo && <Field label="Serial as written in book">{e.serialNo}</Field>}
            {e.remark && <Field label="Remark">{e.remark}</Field>}
          </dl>
        </section>

        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h2 className="mb-2 font-semibold">History</h2>
          {a.disposal && (
            <p className="mb-3 rounded-field bg-base-200 p-2 text-sm">
              <b>Disposed</b> {formatDate(a.disposal.disposedAt)} by {a.disposal.approvedBy.name}: {a.disposal.reason}
              {a.disposal.boardRef && ` (ref. ${a.disposal.boardRef})`}
            </p>
          )}
          {timeline.length === 0 ? (
            <p className="text-sm text-base-content/60">No transfers, checks or changes recorded yet.</p>
          ) : (
            <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto border-l-2 border-base-300 pl-4">
              {timeline.map((t) => (
                <li key={t.key} className="relative text-sm">
                  <span className={`absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-base-100 ${t.tone}`} aria-hidden />
                  <p className="font-medium">{t.title}</p>
                  {t.text && <p className="text-base-content/70">{t.text}</p>}
                  <p className="text-xs text-base-content/50">
                    {DATE_TIME(t.at)}
                    {t.by && ` · ${t.by}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {a.equipment.length > 1 && (
            <p className="mt-3 text-xs text-base-content/60">
              Lab use: {a.equipment.map((x) => `${x.code} (${x.state.toLowerCase().replace("_", " ")})`).join(", ")}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
