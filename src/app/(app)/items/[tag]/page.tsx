import Link from "next/link";
import { Suspense } from "react";
import { Badge, CardSkeleton, Field, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { conditionBadge, formatDate, formatLKR, itemStatusLabel } from "@/lib/format";
import type { AssetItemDetail } from "@/lib/types";

export default function ItemPage({ params }: PageProps<"/items/[tag]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Item" backHref="/scan" />
          <CardSkeleton rows={3} />
        </>
      }
    >
      <ItemDetail params={params} />
    </Suspense>
  );
}

async function ItemDetail({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const { data: item } = await apiGet<{ data: AssetItemDetail }>(`/items/by-tag/${encodeURIComponent(tag)}`);
  const entry = item.ledgerEntry;

  return (
    <>
      <PageHeader title={entry.description} subtitle={<span className="font-mono">{item.tagCode}</span>} backHref="/scan" />

      <div className="mb-4 flex gap-2">
        <Badge className={`badge-md ${conditionBadge[item.condition].className}`}>{conditionBadge[item.condition].label}</Badge>
        <Badge className="badge-md badge-ghost">{itemStatusLabel[item.status]}</Badge>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <dl>
            <Field label="Serial No">{item.isBulk ? `Bulk × ${item.bulkQty}` : item.serialNo}</Field>
            <Field label="Location">{item.location ? `${item.location.code} — ${item.location.name}` : null}</Field>
            <Field label="Custodian">{item.custodian}</Field>
            <Field label="Brand / Model">{[entry.brand, entry.modelNo].filter(Boolean).join(" · ") || null}</Field>
            <Field label="Unit price">{formatLKR(entry.unitPrice)}</Field>
            <Field label="Received">{formatDate(entry.entryDate)}</Field>
            <Field label="Ref. No">{entry.refNo}</Field>
          </dl>
          <Link href={`/ledger/${entry.id}`} className="btn btn-outline btn-sm mt-3 w-full">
            Open ledger entry
          </Link>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Movement history</h2>
          {item.movements.length === 0 ? (
            <p className="text-sm text-base-content/60">No movements recorded.</p>
          ) : (
            <ul className="timeline timeline-vertical timeline-compact">
              {item.movements.map((m) => (
                <li key={m.id}>
                  <div className="timeline-start text-xs text-base-content/60">{formatDate(m.movedAt)}</div>
                  <div className="timeline-middle size-2 rounded-full bg-primary" />
                  <div className="timeline-end timeline-box text-sm">
                    {m.fromLocation?.code ?? "—"} → {m.toLocation.code}
                    {m.reason && <span className="block text-base-content/60">{m.reason}</span>}
                  </div>
                  <hr />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
