import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { auditStatusBadge, formatPeriod, roomTypeLabel } from "@/lib/lab-status";
import type { Department, Location, RoomSummary, User } from "@/lib/types";
import { NewRoomForm } from "./new-room";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage() {
  return (
    <Suspense fallback={<CardSkeleton rows={4} />}>
      <RoomList />
    </Suspense>
  );
}

async function RoomList() {
  const [{ data: rooms }, { data: me }, { data: locations }, { data: departments }] = await Promise.all([
    apiGet<{ data: RoomSummary[] }>("/rooms"),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: Location[] }>("/locations"),
    apiGet<{ data: Department[] }>("/departments"),
  ]);
  const canConfigure = me.user.role === "ADMIN" || me.user.role === "HOD";
  const roomIds = new Set(rooms.map((r) => r.id));

  return (
    <div className="flex flex-col gap-3">
      {canConfigure && (
        <div className="flex flex-col sm:items-end">
          <NewRoomForm locations={locations.filter((l) => !roomIds.has(l.id))} departments={me.user.departmentId ? [] : departments} />
        </div>
      )}
      {rooms.length === 0 ? (
        <EmptyState title="No labs or classrooms yet">{canConfigure ? "Add one above." : "Ask an admin or HOD to add rooms."}</EmptyState>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/audit/rooms/${room.id}`} className="flex h-full items-center gap-3 rounded-box border border-base-300 bg-base-100 p-4 transition-colors hover:bg-base-200/50 active:bg-base-200">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {room.name}
                    <span className="font-mono text-xs text-base-content/50">{room.code}</span>
                  </p>
                  <p className="text-sm text-base-content/60">
                    {roomTypeLabel[room.roomType]} · {room.workstationCount} PCs · {room.equipmentCount} items
                    {room.building && ` · ${room.building}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!room.hasLayout && <Badge className="badge-warning">Layout not set</Badge>}
                    {room.lastAudit && (
                      <Badge className={auditStatusBadge[room.lastAudit.status].className}>
                        {formatPeriod(room.lastAudit.period)} · {auditStatusBadge[room.lastAudit.status].label}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRightIcon className="size-5 opacity-50" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
