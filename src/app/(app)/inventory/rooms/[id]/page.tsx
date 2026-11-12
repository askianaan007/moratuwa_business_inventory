import Link from "next/link";
import { Suspense } from "react";
import { DownloadIcon, GridIcon, PrinterIcon } from "@/components/icons";
import { AssetList } from "@/components/inventory/asset-list";
import { RoomForm } from "@/components/inventory/room-form";
import { ShareBar, Stat } from "@/components/inventory/stat";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { formatDate } from "@/lib/format";
import { pickParams, toQuery, type InventoryAsset, type InventoryRoom, type InventoryRoomDetail } from "@/lib/inventory";
import { roomTypeLabel } from "@/lib/lab-status";
import type { PageMeta, User } from "@/lib/types";
import { ArchiveRoom, BringAssets } from "./room-actions";

export default function RoomPage({ params, searchParams }: PageProps<"/inventory/rooms/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Room" backHref="/inventory/rooms" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Room params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Room({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { categoryId, page } = pickParams(await searchParams, ["categoryId", "page"] as const);
  const [{ data: room }, { data: me }] = await Promise.all([apiGet<{ data: InventoryRoomDetail }>(`/inventory/rooms/${id}`), apiGet<{ data: { user: User } }>("/auth/me")]);
  const [{ data: assets, meta }, { data: rooms, meta: roomsMeta }] = await Promise.all([
    apiGet<{ data: InventoryAsset[]; meta: PageMeta }>(`/inventory/assets${toQuery({ locationId: id, categoryId, page, pageSize: 50, sort: "description" })}`),
    apiGet<{ data: InventoryRoom[]; meta: { buildings: string[] } }>(`/inventory/rooms?departmentId=${room.departmentId}`),
  ]);
  const canEdit = me.user.role !== "VIEWER";
  const canManage = me.user.role === "ADMIN" || me.user.role === "HOD";
  const maxCat = Math.max(1, ...room.categories.map((c) => c.units));
  const isLab = room.roomType === "LAB" || room.roomType === "CLASSROOM";
  const roomQs = toQuery({ locationId: id, categoryId });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={room.name}
        subtitle={
          <>
            <span className="font-mono">{room.code}</span> · {roomTypeLabel[room.roomType]}
            {room.building && ` · ${room.building}`}
            {room.floor && `, floor ${room.floor}`}
          </>
        }
        backHref="/inventory/rooms"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {canEdit && <BringAssets room={room} />}
        {canManage && <RoomForm room={room} buildings={roomsMeta.buildings} />}
        <a href={`/api/v1/inventory/labels.pdf${roomQs}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm shrink-0">
          <PrinterIcon className="size-4" /> QR labels
        </a>
        <a href={`/api/v1/inventory/assets.csv${roomQs}`} download className="btn btn-outline btn-sm shrink-0">
          <DownloadIcon className="size-4" /> Export
        </a>
        {isLab && (
          <Link href={`/audit/rooms/${room.id}`} className="btn btn-outline btn-sm shrink-0">
            <GridIcon className="size-4" /> {room.hasLayout ? "Layout & lab audit" : "Set up layout"}
          </Link>
        )}
        {canManage && <ArchiveRoom room={room} />}
      </div>

      {room.openAudit && (
        <Link href={`/audit/runs/${room.openAudit.id}`} className="alert alert-info alert-soft text-sm">
          Lab audit {room.openAudit.reference} is open for this room.
        </Link>
      )}
      {room.foundHereElsewhere > 0 && (
        <Link href="/inventory/findings" className="alert alert-warning alert-soft text-sm">
          {room.foundHereElsewhere} item(s) registered elsewhere were seen in this room. Review findings.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Asset records" value={room.totals.records} />
        <Stat label="Units (incl. quantity stock)" value={room.totals.units} />
        <Stat label="Need attention" value={room.totals.attention} tone={room.totals.attention ? "text-warning" : ""} />
        <Stat label="Lab PCs / items" value={`${room.workstations} / ${room.labEquipment}`} hint={isLab ? "Managed in Audit → Rooms" : undefined} />
      </div>

      {room.categories.length > 0 && (
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h2 className="mb-3 font-semibold">What is in this room</h2>
          <ul className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <Link href={`/inventory/rooms/${id}`} className={`block ${!categoryId ? "font-semibold" : "hover:underline"}`}>
                All categories <span className="float-right tabular-nums">{room.totals.units}</span>
              </Link>
            </li>
            {room.categories.map((c) => (
              <li key={c.id ?? "none"}>
                <Link href={`/inventory/rooms/${id}${toQuery({ categoryId: c.id ?? undefined })}`} className={`block ${categoryId === c.id ? "font-semibold" : "hover:underline"}`}>
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.attention > 0 && <span className="text-xs text-warning">{c.attention}!</span>}
                    <span className="tabular-nums">{c.units}</span>
                  </span>
                  <ShareBar value={c.units} max={maxCat} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">
          Assets {meta.total > 0 && <span className="text-sm font-normal text-base-content/60">({meta.total})</span>}
        </h2>
        {assets.length === 0 ? (
          <EmptyState title="No assets registered in this room">{canEdit ? "Use “Bring assets here” or register new ones from the ledger." : null}</EmptyState>
        ) : (
          <AssetList assets={assets} rooms={rooms} canEdit={canEdit} showRoom={false} />
        )}
        {meta.totalPages > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {meta.page > 1 && (
              <Link href={`/inventory/rooms/${id}${toQuery({ categoryId, page: meta.page - 1 })}`} className="btn btn-sm">
                Previous
              </Link>
            )}
            <span className="btn btn-sm btn-ghost pointer-events-none">
              {meta.page} / {meta.totalPages}
            </span>
            {meta.page < meta.totalPages && (
              <Link href={`/inventory/rooms/${id}${toQuery({ categoryId, page: meta.page + 1 })}`} className="btn btn-sm">
                Next
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 flex items-center">
          <h2 className="flex-1 font-semibold">Recent transfers</h2>
          <Link href={`/inventory/transfers?locationId=${id}`} className="link link-hover text-sm">
            All
          </Link>
        </div>
        {room.movements.length === 0 ? (
          <p className="text-sm text-base-content/60">No transfers in or out yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-200 text-sm">
            {room.movements.map((m) => {
              const incoming = m.toLocation.id === id;
              return (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <Badge className={incoming ? "badge-success badge-outline" : "badge-ghost"}>{incoming ? "In" : "Out"}</Badge>
                  <Link href={`/inventory/assets/${m.assetItem!.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    <span className="font-mono text-xs">{m.assetItem!.tagCode}</span> {m.assetItem!.ledgerEntry.description}
                  </Link>
                  <span className="shrink-0 text-xs text-base-content/60">
                    {incoming ? `from ${m.fromLocation?.code ?? "—"}` : `to ${m.toLocation.code}`} · {formatDate(m.movedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
