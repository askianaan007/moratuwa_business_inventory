import Link from "next/link";
import { Suspense } from "react";
import { Badge, CardSkeleton, Field, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { approvalBadge, bookStatusBadge, conditionBadge, entryTypeBadge, formatDate, formatLKR } from "@/lib/format";
import type { LedgerEntryDetail, User } from "@/lib/types";
import { EntryActions } from "./entry-actions";

export default function LedgerEntryPage({ params }: PageProps<"/ledger/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Ledger entry" backHref="/ledger" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <EntryDetail params={params} />
    </Suspense>
  );
}

async function EntryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: entry }, { data: me }] = await Promise.all([
    apiGet<{ data: LedgerEntryDetail }>(`/ledger/${encodeURIComponent(id)}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
  ]);

  return (
    <>
      <PageHeader title={entry.description} subtitle={entry.department.name} backHref="/ledger" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge className={`badge-md ${entryTypeBadge[entry.entryType].className}`}>
          {entryTypeBadge[entry.entryType].label}
        </Badge>
        <Badge className={`badge-md ${bookStatusBadge[entry.bookStatus].className}`}>
          {bookStatusBadge[entry.bookStatus].label}
          {entry.bookPage && ` · ${entry.bookVolume ? `Vol ${entry.bookVolume}, ` : ""}p. ${entry.bookPage}`}
        </Badge>
        <Badge className={`badge-md ${approvalBadge[entry.approvalStatus].className}`}>
          {approvalBadge[entry.approvalStatus].label}
        </Badge>
        <Badge className={`badge-md ${entry.hodSigned ? "badge-success" : "badge-ghost"}`}>
          {entry.hodSigned ? "HOD signed" : "Not signed by HOD"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">
        <section className="rounded-box border border-base-300 bg-base-100 p-4 lg:p-5">
          <dl>
            <Field label="Category">
              {entry.category && (
                <Link href={`/ledger?categoryId=${entry.category.id}`} className="link">
                  {entry.category.name}
                </Link>
              )}
            </Field>
            {entry.entryType === "RECEIPT" ? (
              <>
                <Field label="No">{entry.receiptNo}</Field>
                <Field label="Date">{formatDate(entry.entryDate)}</Field>
                <Field label="SIN No">{entry.sinNo}</Field>
                <Field label="SIN date">{entry.sinDate && formatDate(entry.sinDate)}</Field>
              </>
            ) : (
              <>
                <Field label="Date">{formatDate(entry.entryDate)}</Field>
                <Field label="Ref. No">{entry.refNo}</Field>
              </>
            )}
            <Field label="Description">{entry.description}</Field>
            <Field label="Brand">{entry.brand}</Field>
            <Field label="Model No">{entry.modelNo}</Field>
            <Field label="Serial No">{entry.serialNo}</Field>
            <Field label="Item code">{entry.itemCode}</Field>
            <Field label="Quantity">{entry.quantity}</Field>
            <Field label="Unit price">{formatLKR(entry.unitPrice)}</Field>
            <Field label="Value">
              <span className="text-lg font-bold">{formatLKR(entry.value)}</span>
            </Field>
            <Field label="Remark">{entry.remark}</Field>
            <Field label="HOD signature">{entry.hodSigned ? "Signed" : "Not signed"}</Field>
            <Field label="Recorded by">{entry.createdBy?.name}</Field>
          </dl>
        </section>

        <div className="flex flex-col gap-4">
        <EntryActions entry={entry} user={me.user} />

        {entry.items.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Items ({entry.items.length})</h2>
            <ul className="flex flex-col gap-2">
              {entry.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/items/${item.tagCode}`}
                    className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 hover:bg-base-200/50 active:bg-base-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">{item.tagCode}</p>
                      <p className="truncate text-sm text-base-content/60">
                        {item.isBulk ? `Bulk × ${item.bulkQty}` : `S/N ${item.serialNo ?? "—"}`}
                        {item.location && ` · ${item.location.code}`}
                      </p>
                    </div>
                    <Badge className={conditionBadge[item.condition].className}>
                      {conditionBadge[item.condition].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.approvals.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">HOD decisions</h2>
            <ul className="flex flex-col gap-2">
              {entry.approvals.map((a) => (
                <li key={a.id} className="rounded-box border border-base-300 bg-base-100 p-3 text-sm">
                  <span className="font-medium">{a.approver.name}</span> — {approvalBadge[a.status].label.toLowerCase()} on{" "}
                  {new Date(a.decidedAt).toLocaleString("en-GB")}
                  {a.comment && <p className="mt-1 text-base-content/70">“{a.comment}”</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </div>
    </>
  );
}
