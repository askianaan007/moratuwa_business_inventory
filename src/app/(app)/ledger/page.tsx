import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { approvalBadge, bookStatusBadge, ENTRY_TYPES, entryTypeBadge, formatDate, formatLKR } from "@/lib/format";
import type { CategorySummary, LedgerEntry, PageMeta } from "@/lib/types";

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
  return {
    q: get("q"),
    entryType: get("entryType"),
    categoryId: get("categoryId"),
    bookStatus: get("bookStatus"),
    approvalStatus: get("approvalStatus"),
    page: get("page"),
  };
}

function toQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function LedgerPage({ searchParams }: PageProps<"/ledger">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Ledger" />
          <CardSkeleton rows={5} />
        </>
      }
    >
      <LedgerResults searchParams={searchParams} />
    </Suspense>
  );
}

async function LedgerResults({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = pick(await searchParams);
  const [{ data, meta }, { data: categories }] = await Promise.all([
    apiGet<{ data: LedgerEntry[]; meta: PageMeta }>(`/ledger${toQuery(filters)}`),
    apiGet<{ data: CategorySummary[] }>("/categories"),
  ]);
  const page = meta.page;
  const category = categories.find((c) => c.id === filters.categoryId);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={category ? `${category.name} ledger` : "Ledger"}
        subtitle={
          category && `${category.receivedQuantity} received · ${formatLKR(category.receivedValue)}`
        }
        backHref={category ? "/categories" : undefined}
        action={
          <Link
            href={`/ledger/new${toQuery({ entryType: filters.entryType, categoryId: filters.categoryId })}`}
            className="btn btn-primary"
          >
            <PlusIcon className="size-5" />
            New
          </Link>
        }
      />

      <form role="search" className="join w-full">
        <label className="input join-item w-full">
          <SearchIcon className="size-5 opacity-50" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Description, serial, receipt/ref no, item code…"
            className="grow"
          />
        </label>
        {filters.entryType && <input type="hidden" name="entryType" value={filters.entryType} />}
        {filters.bookStatus && <input type="hidden" name="bookStatus" value={filters.bookStatus} />}
        {filters.approvalStatus && <input type="hidden" name="approvalStatus" value={filters.approvalStatus} />}
        <button className="btn btn-secondary join-item">Search</button>
      </form>

      <form className="join w-full" aria-label="Filter by category">
        <select name="categoryId" defaultValue={filters.categoryId ?? ""} className="select join-item w-full">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.entryType && <input type="hidden" name="entryType" value={filters.entryType} />}
        <button className="btn join-item">Show</button>
      </form>

      <div role="tablist" className="tabs tabs-box tabs-sm w-full">
        {[undefined, ...ENTRY_TYPES].map((type) => (
          <Link
            key={type ?? "ALL"}
            role="tab"
            href={`/ledger${toQuery({ q: filters.q, categoryId: filters.categoryId, entryType: type })}`}
            className={`tab flex-1 ${filters.entryType === type ? "tab-active" : ""}`}
          >
            {type ? `${entryTypeBadge[type].label}s` : "All"}
          </Link>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((filter) => {
          const params = { bookStatus: undefined, approvalStatus: undefined, ...filter.params } as Record<string, string | undefined>;
          const active = params.bookStatus === filters.bookStatus && params.approvalStatus === filters.approvalStatus;
          return (
            <Link
              key={filter.label}
              href={`/ledger${toQuery({ q: filters.q, entryType: filters.entryType, categoryId: filters.categoryId, ...params })}`}
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
                  {[entry.category?.name, entry.brand, entry.modelNo, entry.itemCode].filter(Boolean).join(" · ") || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-base-content/60">
                  <span>{formatDate(entry.entryDate)}</span>
                  <span>· Qty {entry.quantity}</span>
                  {(entry.receiptNo ?? entry.refNo) && <span>· {entry.receiptNo ?? entry.refNo}</span>}
                  <span className="ml-auto flex flex-wrap justify-end gap-1">
                    <Badge className={entryTypeBadge[entry.entryType].className}>
                      {entryTypeBadge[entry.entryType].label}
                    </Badge>
                    {entry.hodSigned && <Badge className="badge-success badge-outline">HOD signed</Badge>}
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
