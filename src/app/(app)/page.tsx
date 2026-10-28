import Link from "next/link";
import { Suspense } from "react";
import { BookIcon, ClipboardIcon, PlusIcon, ScanIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { bookStatusBadge, entryTypeBadge, formatDate, formatLKR } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="hidden items-end justify-between gap-4 lg:flex">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-base-content/70">Department inventory at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit" className="btn btn-outline border-base-300">
            <ClipboardIcon className="size-5" />
            Monthly audit
          </Link>
          <Link href="/scan" className="btn btn-secondary">
            <ScanIcon className="size-5" />
            Scan item
          </Link>
          <Link href="/ledger/new" className="btn btn-primary">
            <PlusIcon className="size-5" />
            New entry
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:hidden">
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
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="flex flex-col justify-center rounded-box bg-secondary p-5 text-secondary-content lg:p-6">
          <p className="text-sm opacity-70">Total value received</p>
          <p className="text-3xl font-bold tracking-tight">{formatLKR(data.totalValue)}</p>
          <p className="mt-1 text-sm opacity-70">
            {data.items} items across {data.entries} ledger entries
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4 lg:gap-4">
          <Stat href="/ledger?bookStatus=PENDING_BOOK" label="Not yet in book" value={data.pendingBook} tone="text-warning" />
          <Stat href="/ledger?approvalStatus=SUBMITTED" label="Awaiting HOD" value={data.awaitingApproval} tone="text-info" />
          <Stat label="Need repair / damaged" value={data.needsAttention} tone="text-error" />
          <Stat label="Missing" value={data.missing} tone="text-error" />
        </div>
      </div>

      <Link href="/categories" className="btn btn-outline w-full border-base-300 lg:hidden">
        Ledgers by category
      </Link>

      <section className="lg:rounded-box lg:border lg:border-base-300 lg:bg-base-100">
        <div className="mb-2 flex items-center justify-between lg:mb-0 lg:border-b lg:border-base-300 lg:px-5 lg:py-4">
          <h2 className="font-semibold lg:text-lg">Recent entries</h2>
          <div className="flex items-center gap-4">
            <Link href="/categories" className="link link-hover hidden items-center gap-1 text-sm lg:inline-flex">
              <BookIcon className="size-4" />
              Ledgers by category
            </Link>
            <Link href="/ledger" className="link link-hover text-sm">
              View all
            </Link>
          </div>
        </div>
        {data.recent.length === 0 ? (
          <div className="lg:p-5">
            <EmptyState title="No entries yet">Tap “New entry” to record your first item.</EmptyState>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2 lg:hidden">
              {data.recent.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/ledger/${entry.id}`}
                    className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 hover:bg-base-200/50 active:bg-base-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.description}</p>
                      <p className="text-sm text-base-content/60">
                        {entryTypeBadge[entry.entryType].label} · {formatDate(entry.entryDate)} · Qty {entry.quantity}
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

            <table className="table hidden lg:table">
              <thead>
                <tr>
                  <th className="pl-5">Description</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Value</th>
                  <th className="pr-5">Book</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((entry) => (
                  <tr key={entry.id} className="relative hover:bg-base-200/50">
                    <td className="pl-5">
                      <Link href={`/ledger/${entry.id}`} className="font-medium after:absolute after:inset-0">
                        {entry.description}
                      </Link>
                      {entry.brand && <span className="block text-sm text-base-content/60">{entry.brand}</span>}
                    </td>
                    <td>
                      <Badge className={entryTypeBadge[entry.entryType].className}>{entryTypeBadge[entry.entryType].label}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(entry.entryDate)}</td>
                    <td className="text-right tabular-nums">{entry.quantity}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{formatLKR(entry.value)}</td>
                    <td className="pr-5">
                      <Badge className={bookStatusBadge[entry.bookStatus].className}>{bookStatusBadge[entry.bookStatus].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone: string; href?: string }) {
  const body = (
    <>
      <p className={`text-2xl font-bold lg:text-3xl ${value > 0 ? tone : ""}`}>{value}</p>
      <p className="text-sm text-base-content/70">{label}</p>
    </>
  );
  const className = "flex flex-col justify-center rounded-box border border-base-300 bg-base-100 p-4 lg:p-5";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-base-content/30 hover:bg-base-200/50 active:bg-base-200`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
