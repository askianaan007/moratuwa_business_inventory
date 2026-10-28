import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { approvalBadge, bookStatusBadge, formatDate, formatLKR } from "@/lib/format";
import type { LedgerEntry, PageMeta } from "@/lib/types";

export const metadata: Metadata = { title: "Ledger" };

const FILTERS = [
  { label: "All", params: {} },
  { label: "Not in book", params: { bookStatus: "PENDING_BOOK" } },
  { label: "Awaiting HOD", params: { approvalStatus: "SUBMITTED" } },
  { label: "Approved", params: { approvalStatus: "APPROVED" } },
] as const;

type Search = Record<string, string | string[] | undefined>;

function pick(search: Search) {
  const get = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : undefined);
  return { q: get("q"), bookStatus: get("bookStatus"), approvalStatus: get("approvalStatus"), page: get("page") };
}

function toQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function LedgerPage({ searchParams }: PageProps<"/ledger">) {
  return (
    <>
      <PageHeader
        title="Ledger"
        action={
          <Link href="/ledger/new" className="btn btn-primary">
            <PlusIcon className="size-5" />
            New
          </Link>
        }
      />
      <Suspense fallback={<CardSkeleton rows={5} />}>
        <LedgerResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LedgerResults({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = pick(await searchParams);
  const { data, meta } = await apiGet<{ data: LedgerEntry[]; meta: PageMeta }>(`/ledger${toQuery(filters)}`);
  const page = meta.page;

  return (
    <div className="flex flex-col gap-3">
      <form role="search" className="join w-full">
        <label className="input join-item w-full">
          <SearchIcon className="size-5 opacity-50" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Description, serial, ref no, brand…"
            className="grow"
          />
        </label>
        {filters.bookStatus && <input type="hidden" name="bookStatus" value={filters.bookStatus} />}
        {filters.approvalStatus && <input type="hidden" name="approvalStatus" value={filters.approvalStatus} />}
        <button className="btn btn-secondary join-item">Search</button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((filter) => {
          const params = { bookStatus: undefined, approvalStatus: undefined, ...filter.params } as Record<string, string | undefined>;
          const active = params.bookStatus === filters.bookStatus && params.approvalStatus === filters.approvalStatus;
          return (
            <Link
              key={filter.label}
              href={`/ledger${toQuery({ q: filters.q, ...params })}`}
              className={`btn btn-sm rounded-full ${active ? "btn-secondary" : "btn-outline border-base-300"}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <p className="text-sm text-base-content/60">{meta.total} entries</p>

      {data.length === 0 ? (
        <EmptyState title="No entries found">Try a different search or filter.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/ledger/${entry.id}`}
                className="block rounded-box border border-base-300 bg-base-100 p-4 active:bg-base-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{entry.description}</p>
                  <p className="font-semibold whitespace-nowrap">{formatLKR(entry.value)}</p>
                </div>
                <p className="mt-1 text-sm text-base-content/70">
                  {[entry.brand, entry.modelNo].filter(Boolean).join(" · ") || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-base-content/60">
                  <span>{formatDate(entry.entryDate)}</span>
                  <span>· Qty {entry.quantity}</span>
                  {entry.refNo && <span>· {entry.refNo}</span>}
                  <span className="ml-auto flex gap-1">
                    <Badge className={bookStatusBadge[entry.bookStatus].className}>
                      {bookStatusBadge[entry.bookStatus].label}
                    </Badge>
                    <Badge className={approvalBadge[entry.approvalStatus].className}>
                      {approvalBadge[entry.approvalStatus].label}
                    </Badge>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {meta.totalPages > 1 && (
        <div className="join self-center">
          <Link
            href={`/ledger${toQuery({ ...filters, page: String(page - 1) })}`}
            className={`btn join-item ${page <= 1 ? "btn-disabled" : ""}`}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="btn join-item pointer-events-none">
            {page} / {meta.totalPages}
          </span>
          <Link
            href={`/ledger${toQuery({ ...filters, page: String(page + 1) })}`}
            className={`btn join-item ${page >= meta.totalPages ? "btn-disabled" : ""}`}
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>
      )}
    </div>
  );
}
