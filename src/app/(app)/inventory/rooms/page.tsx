import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { RoomForm } from "@/components/inventory/room-form";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { pickParams, ROOM_TYPES, toQuery, type InventoryRoom } from "@/lib/inventory";
import { roomTypeLabel } from "@/lib/lab-status";
import type { Department, User } from "@/lib/types";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage({ searchParams }: PageProps<"/inventory/rooms">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Rooms" />
          <CardSkeleton rows={5} />
        </>
      }
    >
      <Rooms searchParams={searchParams} />
    </Suspense>
  );
}

async function Rooms({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pickParams(await searchParams, ["q", "roomType", "building", "departmentId"] as const);
  const [{ data: rooms, meta }, { data: me }, { data: departments }] = await Promise.all([
    apiGet<{ data: InventoryRoom[]; meta: { buildings: string[] } }>(`/inventory/rooms${toQuery(params)}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: Department[] }>("/departments"),
  ]);
  const canManage = me.user.role === "ADMIN" || me.user.role === "HOD";
  const filtered = Boolean(params.q || params.roomType || params.building);

  // Building → floor → rooms, the way people walk the campus.
  const groups = new Map<string, InventoryRoom[]>();
  for (const r of rooms) {
    const key = [r.building ?? "No building", r.floor && `Floor ${r.floor}`].filter(Boolean).join(" · ");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Rooms"
        subtitle="Labs, lecture halls, offices, stores and any other location"
        action={canManage && <RoomForm departments={me.user.departmentId ? [] : departments} buildings={meta.buildings} />}
      />

      <form role="search" className="flex flex-col gap-2 sm:flex-row">
        <label className="input w-full sm:flex-1">
          <SearchIcon className="size-5 opacity-50" />
          <input type="search" name="q" defaultValue={params.q} placeholder="Code, name or building" className="grow" aria-label="Search rooms" />
        </label>
        <div className="flex gap-2">
          <select name="roomType" defaultValue={params.roomType ?? ""} className="select flex-1 sm:w-40" aria-label="Room type">
            <option value="">All types</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {roomTypeLabel[t]}
              </option>
            ))}
          </select>
          {meta.buildings.length > 0 && (
            <select name="building" defaultValue={params.building ?? ""} className="select flex-1 sm:w-44" aria-label="Building">
              <option value="">All buildings</option>
              {meta.buildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary">Go</button>
        </div>
      </form>

      {rooms.length === 0 ? (
        <EmptyState title={filtered ? "No rooms match" : "No rooms yet"}>
          {filtered ? (
            <Link href="/inventory/rooms" className="link">
              Clear filters
            </Link>
          ) : canManage ? (
            "Create the first room with “New room”."
          ) : (
            "Ask an admin or HOD to add rooms."
          )}
        </EmptyState>
      ) : (
        [...groups.entries()].map(([group, list]) => (
          <section key={group}>
            <h2 className="mb-2 text-xs font-bold tracking-wide text-base-content/60 uppercase">{group}</h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/inventory/rooms/${r.id}`} className="flex h-full items-center gap-3 rounded-box border border-base-300 bg-base-100 p-4 transition-colors hover:bg-base-200/50 active:bg-base-200">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{r.name}</span>
                        <span className="font-mono text-xs text-base-content/50">{r.code}</span>
                      </p>
                      <p className="text-sm text-base-content/60">
                        {roomTypeLabel[r.roomType]} · {r.assets} asset record{r.assets === 1 ? "" : "s"}
                        {r.workstations > 0 && ` · ${r.workstations} PCs`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.needsAttention > 0 && <Badge className="badge-warning">{r.needsAttention} need attention</Badge>}
                        {r.assets === 0 && r.labEquipment === 0 && <Badge className="badge-ghost">Empty</Badge>}
                        {me.user.role === "ADMIN" && <Badge className="badge-ghost">{r.department.code}</Badge>}
                      </div>
                    </div>
                    <ChevronRightIcon className="size-5 opacity-40" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
