import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, PrinterIcon, SearchIcon } from "@/components/icons";
import { AssetList } from "@/components/inventory/asset-list";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { bookStatusBadge, conditionBadge } from "@/lib/format";
import { itemStatusBadge, pickParams, toQuery, type InventoryAsset, type InventoryRoom } from "@/lib/inventory";
import type { BookStatus, Category, ItemCondition, ItemStatus, PageMeta, User } from "@/lib/types";

export const metadata: Metadata = { title: "Assets" };

const KEYS = ["q", "categoryId", "locationId", "building", "status", "condition", "bookStatus", "kind", "includeDisposed", "sort", "page", "departmentId"] as const;
const SORTS = { tag: "Tag A–Z", "-tag": "Tag Z–A", description: "Description", location: "Room", condition: "Condition", "-updated": "Recently changed" } as const;

export default function AssetsPage({ searchParams }: PageProps<"/inventory/assets">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Assets" />
          <div className="skeleton mb-3 h-10 w-full" />
          <CardSkeleton rows={6} />
        </>
      }
    >
      <Assets searchParams={searchParams} />
    </Suspense>
  );
}

async function Assets({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pickParams(await searchParams, KEYS);
  const [{ data: assets, meta }, { data: rooms }, { data: categories }, { data: me }] = await Promise.all([
    apiGet<{ data: InventoryAsset[]; meta: PageMeta }>(`/inventory/assets${toQuery({ ...params, pageSize: 25 })}`),
    apiGet<{ data: InventoryRoom[] }>(`/inventory/rooms${toQuery({ departmentId: params.departmentId })}`),
    apiGet<{ data: Category[] }>("/categories"),
    apiGet<{ data: { user: User } }>("/auth/me"),
  ]);
  const canEdit = me.user.role !== "VIEWER";
  const filters = { ...params, page: undefined };
  const hasFilters = Object.entries(filters).some(([k, v]) => v && k !== "sort");
  const exportQs = toQuery({ ...filters, sort: undefined });
  const pageHref = (page: number) => `/inventory/assets${toQuery({ ...filters, page })}`;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Assets"
        subtitle="Search by tag, serial, description, brand, model, book page or room"
        action={
          <div className="flex gap-1">
            <a href={`/api/v1/inventory/labels.pdf${exportQs}`} target="_blank" rel="noopener" className="btn btn-sm btn-ghost" title="Print QR labels for this list (up to 500)">
              <PrinterIcon className="size-4" />
              <span className="hidden sm:inline">Labels</span>
            </a>
            <a href={`/api/v1/inventory/assets.csv${exportQs}`} download className="btn btn-sm btn-ghost" title="Download as CSV (opens in Excel)">
              <DownloadIcon className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </a>
          </div>
        }
      />

      <form role="search" className="flex flex-col gap-2">
        <div className="join w-full">
          <label className="input join-item w-full">
            <SearchIcon className="size-5 opacity-50" />
            <input type="search" name="q" defaultValue={params.q} placeholder="Tag, serial, description, page no…" className="grow" aria-label="Search assets" />
          </label>
          <button className="btn btn-secondary join-item">Search</button>
        </div>
        <details className="collapse-arrow collapse rounded-box border border-base-300 bg-base-100" open={hasFilters || undefined}>
          <summary className="collapse-title min-h-0 py-2.5 text-sm font-medium">Filters{hasFilters && " (on)"}</summary>
          <div className="collapse-content">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select name="categoryId" defaultValue={params.categoryId ?? ""} className="select select-sm w-full" aria-label="Category">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select name="locationId" defaultValue={params.locationId ?? ""} className="select select-sm w-full" aria-label="Room">
                <option value="">All rooms</option>
                <option value="none">No room recorded</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
              <select name="condition" defaultValue={params.condition ?? ""} className="select select-sm w-full" aria-label="Condition">
                <option value="">Any condition</option>
                {(Object.keys(conditionBadge) as ItemCondition[]).map((c) => (
                  <option key={c} value={c}>
                    {conditionBadge[c].label}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue={params.status ?? ""} className="select select-sm w-full" aria-label="Status">
                <option value="">Any status (not disposed)</option>
                {(Object.keys(itemStatusBadge) as ItemStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {itemStatusBadge[s].label}
                  </option>
                ))}
              </select>
              <select name="bookStatus" defaultValue={params.bookStatus ?? ""} className="select select-sm w-full" aria-label="Inventory book">
                <option value="">Any book status</option>
                {(Object.keys(bookStatusBadge) as BookStatus[]).map((b) => (
                  <option key={b} value={b}>
                    {bookStatusBadge[b].label}
                  </option>
                ))}
              </select>
              <select name="kind" defaultValue={params.kind ?? ""} className="select select-sm w-full" aria-label="Tracking">
                <option value="">Individual and quantity</option>
                <option value="individual">Tracked one by one</option>
                <option value="bulk">Quantity stock</option>
              </select>
              <select name="sort" defaultValue={params.sort ?? "tag"} className="select select-sm w-full" aria-label="Sort">
                {Object.entries(SORTS).map(([v, l]) => (
                  <option key={v} value={v}>
                    Sort: {l}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="includeDisposed" value="true" defaultChecked={params.includeDisposed === "true"} className="checkbox checkbox-sm" />
                Include disposed
              </label>
            </div>
            {params.departmentId && <input type="hidden" name="departmentId" value={params.departmentId} />}
            <div className="mt-2 flex gap-2">
              <button className="btn btn-sm btn-primary">Apply</button>
              {hasFilters && (
                <Link href="/inventory/assets" className="btn btn-sm btn-ghost">
                  Clear all
                </Link>
              )}
            </div>
          </div>
        </details>
      </form>

      <p className="text-sm text-base-content/60" aria-live="polite">
        {meta.total} asset record{meta.total === 1 ? "" : "s"}
        {meta.totalPages > 1 && ` · page ${meta.page} of ${meta.totalPages}`}
      </p>

      {assets.length === 0 ? (
        <EmptyState title="No assets found">
          {hasFilters ? "Try a different search or clear the filters." : "Assets appear here once ledger entries are recorded."}
        </EmptyState>
      ) : (
        <AssetList assets={assets} rooms={rooms} canEdit={canEdit} />
      )}

      {meta.totalPages > 1 && (
        <nav className="join mx-auto" aria-label="Pages">
          <Link href={pageHref(meta.page - 1)} aria-disabled={meta.page <= 1} className={`btn join-item ${meta.page <= 1 ? "btn-disabled" : ""}`} aria-label="Previous page">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="btn join-item pointer-events-none tabular-nums">
            {meta.page} / {meta.totalPages}
          </span>
          <Link href={pageHref(meta.page + 1)} aria-disabled={meta.page >= meta.totalPages} className={`btn join-item ${meta.page >= meta.totalPages ? "btn-disabled" : ""}`} aria-label="Next page">
            <ChevronRightIcon className="size-4" />
          </Link>
        </nav>
      )}
    </div>
  );
}
