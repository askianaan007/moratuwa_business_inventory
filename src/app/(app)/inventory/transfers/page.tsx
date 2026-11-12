import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchIcon } from "@/components/icons";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { pickParams, toQuery, type InventoryRoom, type Movement } from "@/lib/inventory";
import type { PageMeta } from "@/lib/types";

export const metadata: Metadata = { title: "Transfers" };

const WHEN = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function TransfersPage({ searchParams }: PageProps<"/inventory/transfers">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Transfers" />
          <CardSkeleton rows={6} />
        </>
      }
    >
      <Transfers searchParams={searchParams} />
    </Suspense>
  );
}

async function Transfers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pickParams(await searchParams, ["q", "locationId", "from", "to", "page"] as const);
  const [{ data: rows, meta }, { data: rooms }] = await Promise.all([
    apiGet<{ data: Movement[]; meta: PageMeta }>(`/inventory/transfers${toQuery({ ...params, pageSize: 30 })}`),
    apiGet<{ data: InventoryRoom[] }>("/inventory/rooms"),
  ]);
  const filters = { ...params, page: undefined };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Transfers" subtitle="Every completed move, oldest kept forever" />

      <form className="grid grid-cols-2 gap-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_auto]" role="search">
        <label className="input col-span-2 w-full lg:col-span-1">
          <SearchIcon className="size-4 opacity-50" />
          <input type="search" name="q" defaultValue={params.q} placeholder="Tag, description or reason" className="grow" aria-label="Search transfers" />
        </label>
        <select name="locationId" defaultValue={params.locationId ?? ""} className="select col-span-2 w-full lg:col-span-1" aria-label="Room">
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={params.from} className="input w-full" aria-label="From date" />
        <input type="date" name="to" defaultValue={params.to} className="input w-full" aria-label="To date" />
        <div className="col-span-2 flex gap-2 lg:col-span-1">
          <button className="btn btn-secondary flex-1">Filter</button>
          {filtered && (
            <Link href="/inventory/transfers" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-base-content/60">{meta.total} transfer{meta.total === 1 ? "" : "s"}</p>

      {rows.length === 0 ? (
        <EmptyState title="No transfers found">{filtered ? "Try different filters." : "Transfers appear here when assets move between rooms."}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((m) => (
            <li key={m.id} className="rounded-box border border-base-300 bg-base-100 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/inventory/assets/${m.assetItem!.id}`} className="font-mono text-sm font-semibold hover:underline">
                  {m.assetItem!.tagCode}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm">{m.assetItem!.ledgerEntry.description}</span>
                <span className="text-xs text-base-content/60">{WHEN(m.movedAt)}</span>
              </div>
              <p className="mt-1 text-sm">
                {m.fromLocation ? (
                  <Link href={`/inventory/rooms/${m.fromLocation.id}`} className="link link-hover">
                    {m.fromLocation.code}
                  </Link>
                ) : (
                  "—"
                )}{" "}
                →{" "}
                <Link href={`/inventory/rooms/${m.toLocation.id}`} className="link link-hover font-medium">
                  {m.toLocation.code}
                </Link>
                {m.movedBy && <span className="text-base-content/60"> · by {m.movedBy.name}</span>}
              </p>
              {m.reason && <p className="text-sm text-base-content/70">{m.reason}</p>}
            </li>
          ))}
        </ul>
      )}

      {meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {meta.page > 1 && (
            <Link href={`/inventory/transfers${toQuery({ ...filters, page: meta.page - 1 })}`} className="btn btn-sm">
              Previous
            </Link>
          )}
          <span className="btn btn-sm btn-ghost pointer-events-none">
            {meta.page} / {meta.totalPages}
          </span>
          {meta.page < meta.totalPages && (
            <Link href={`/inventory/transfers${toQuery({ ...filters, page: meta.page + 1 })}`} className="btn btn-sm">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
