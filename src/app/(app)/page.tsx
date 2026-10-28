import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, ScanIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { bookStatusBadge, formatDate, formatLKR } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/ledger/new" className="btn btn-primary btn-lg h-auto flex-col gap-1 py-4">
          <PlusIcon className="size-7" />
          New entry
        </Link>
        <Link href="/scan" className="btn btn-secondary btn-lg h-auto flex-col gap-1 py-4">
          <ScanIcon className="size-7" />
          Scan item
        </Link>
      </div>

      <Suspense fallback={<CardSkeleton rows={4} />}>
        <Summary />
      </Suspense>
    </div>
  );
}

async function Summary() {
  const { data } = await apiGet<{ data: DashboardSummary }>("/dashboard/summary");

  return (
    <>
      <div className="rounded-box bg-secondary p-5 text-secondary-content">
        <p className="text-sm opacity-70">Total inventory value</p>
        <p className="text-3xl font-bold tracking-tight">{formatLKR(data.totalValue)}</p>
        <p className="mt-1 text-sm opacity-70">
          {data.items} items across {data.entries} ledger entries
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat href="/ledger?bookStatus=PENDING_BOOK" label="Not yet in book" value={data.pendingBook} tone="text-warning" />
        <Stat href="/ledger?approvalStatus=SUBMITTED" label="Awaiting HOD" value={data.awaitingApproval} tone="text-info" />
        <Stat label="Need repair / damaged" value={data.needsAttention} tone="text-error" />
        <Stat label="Missing" value={data.missing} tone="text-error" />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recent entries</h2>
          <Link href="/ledger" className="link link-hover text-sm">
            View all
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState title="No entries yet">Tap “New entry” to record your first item.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recent.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/ledger/${entry.id}`}
                  className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 active:bg-base-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.description}</p>
                    <p className="text-sm text-base-content/60">
                      {formatDate(entry.entryDate)} · Qty {entry.quantity}
                      {entry.brand && ` · ${entry.brand}`}
                    </p>
                  </div>
                  <Badge className={bookStatusBadge[entry.bookStatus].className}>
                    {bookStatusBadge[entry.bookStatus].label}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone: string; href?: string }) {
  const body = (
    <>
      <p className={`text-2xl font-bold ${value > 0 ? tone : ""}`}>{value}</p>
      <p className="text-sm text-base-content/70">{label}</p>
    </>
  );
  const className = "rounded-box border border-base-300 bg-base-100 p-4";
  return href ? (
    <Link href={href} className={`${className} active:bg-base-200`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
