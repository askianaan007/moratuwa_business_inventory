import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowsIcon, PlusIcon } from "@/components/icons";
import { ShareBar, Stat } from "@/components/inventory/stat";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { conditionBadge } from "@/lib/format";
import { itemStatusBadge, pickParams, toQuery, type InventorySummary } from "@/lib/inventory";
import type { Department, ItemCondition, ItemStatus, User } from "@/lib/types";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Inventory" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pickParams(await searchParams, ["departmentId", "building"] as const);
  const [{ data: s }, { data: me }, { data: departments }, { meta: roomMeta }] = await Promise.all([
    apiGet<{ data: InventorySummary }>(`/inventory/summary${toQuery(params)}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: Department[] }>("/departments"),
    apiGet<{ meta: { buildings: string[] } }>(`/inventory/rooms${toQuery({ departmentId: params.departmentId })}`),
  ]);
  const canEdit = me.user.role !== "VIEWER";
  const scope = toQuery(params).slice(1);
  const assets = (extra: Record<string, string>) => `/inventory/assets${toQuery({ ...params, ...extra })}`;
  const attention = (s.byCondition.NEEDS_REPAIR ?? 0) + (s.byCondition.DAMAGED ?? 0) + (s.byCondition.UNSERVICEABLE ?? 0);
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.units));
  const maxRoom = Math.max(1, ...s.byRoom.map((c) => c.units));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventory"
        subtitle="Every asset in every room. The handwritten register stays the official record."
        action={
          canEdit && (
            <Link href="/ledger/new" className="btn btn-primary">
              <PlusIcon className="size-5" />
              <span className="hidden sm:inline">Register assets</span>
              <span className="sm:hidden">Add</span>
            </Link>
          )
        }
      />

      {(me.user.role === "ADMIN" || roomMeta.buildings.length > 0) && (
        <form className="flex flex-wrap gap-2" aria-label="Filter overview">
          {me.user.role === "ADMIN" && departments.length > 1 && (
            <select name="departmentId" defaultValue={params.departmentId ?? ""} className="select select-sm w-full sm:w-auto">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {roomMeta.buildings.length > 0 && (
            <select name="building" defaultValue={params.building ?? ""} className="select select-sm w-full sm:w-auto">
              <option value="">All buildings</option>
              {roomMeta.buildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-sm">Apply</button>
          {scope && (
            <Link href="/inventory" className="btn btn-sm btn-ghost">
              Clear
            </Link>
          )}
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Asset records" value={s.records} hint={`${s.individual} tracked one by one`} href={assets({})} />
        <Stat label="Units in quantity stock" value={s.bulkUnits} hint={`${s.bulkRecords} bulk record(s)`} href={assets({ kind: "bulk" })} />
        <Stat label="Rooms" value={s.rooms} hint={`${s.buildings} building(s)`} href={`/inventory/rooms${toQuery(params)}`} />
        <Stat label="Transfers (30 days)" value={s.movesLast30Days} href="/inventory/transfers" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Need attention" value={attention} hint="Repair, damaged, unserviceable" tone={attention ? "text-warning" : ""} href={assets({ condition: "NEEDS_REPAIR" })} />
        <Stat label="Missing" value={s.byStatus.MISSING ?? 0} tone={s.byStatus.MISSING ? "text-error" : ""} href={assets({ status: "MISSING" })} />
        <Stat label="Location mismatches" value={s.openFindings} tone={s.openFindings ? "text-error" : ""} href="/inventory/findings" />
        <Stat label="No room recorded" value={s.unlocated} tone={s.unlocated ? "text-warning" : ""} href={assets({ locationId: "none" })} />
        <Stat label={`Not verified in ${s.verifyWindowDays} days`} value={s.unverified} hint={`${s.pendingBook} not yet in book`} />
      </div>

      {s.records === 0 ? (
        <EmptyState title="No assets yet">
          Assets are created from ledger entries (one record per book line, with a tag per unit).{" "}
          {canEdit && (
            <Link href="/ledger/new" className="link">
              Register the first one
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-box border border-base-300 bg-base-100 p-4">
            <h2 className="mb-3 font-semibold">Condition and status</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {(Object.keys(conditionBadge) as ItemCondition[]).map((c) => (
                <li key={c}>
                  <Link href={assets({ condition: c })} className="flex items-center gap-2 hover:underline">
                    <Badge className={conditionBadge[c].className}>{conditionBadge[c].label}</Badge>
                    <span className="ml-auto tabular-nums">{s.byCondition[c] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="divider my-2" />
            <ul className="flex flex-col gap-2 text-sm">
              {(Object.keys(itemStatusBadge) as ItemStatus[])
                .filter((st) => st !== "DISPOSED")
                .map((st) => (
                  <li key={st}>
                    <Link href={assets({ status: st })} className="flex items-center gap-2 hover:underline">
                      <Badge className={itemStatusBadge[st].className}>{itemStatusBadge[st].label}</Badge>
                      <span className="ml-auto tabular-nums">{s.byStatus[st] ?? 0}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4">
            <h2 className="mb-3 font-semibold">By category</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {s.byCategory.map((c) => (
                <li key={c.id ?? "none"}>
                  <Link href={assets(c.id ? { categoryId: c.id } : {})} className="block hover:underline">
                    <span className="flex items-baseline gap-2">
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.attention > 0 && <span className="text-xs text-warning">{c.attention} attention</span>}
                      <span className="font-semibold tabular-nums">{c.units}</span>
                    </span>
                    <ShareBar value={c.units} max={maxCat} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="mb-3 flex items-center">
              <h2 className="flex-1 font-semibold">Largest rooms</h2>
              <Link href="/inventory/rooms" className="link link-hover text-sm">
                All rooms
              </Link>
            </div>
            <ul className="flex flex-col gap-3 text-sm">
              {s.byRoom.map((r) => (
                <li key={r.id ?? "none"}>
                  <Link href={r.id ? `/inventory/rooms/${r.id}` : assets({ locationId: "none" })} className="block hover:underline">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-base-content/60">{r.code}</span>
                      <span className="flex-1 truncate">{r.id ? r.name : "No room recorded"}</span>
                      <span className="font-semibold tabular-nums">{r.units}</span>
                    </span>
                    <ShareBar value={r.units} max={maxRoom} tone="bg-secondary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/scan" className="btn btn-outline btn-sm">
          Scan a tag
        </Link>
        <Link href="/inventory/transfers" className="btn btn-outline btn-sm">
          <ArrowsIcon className="size-4" /> Transfer history
        </Link>
        <a href={`/api/v1/inventory/assets.csv${toQuery(params)}`} className="btn btn-outline btn-sm" download>
          Export register (Excel CSV)
        </a>
      </div>
    </div>
  );
}
