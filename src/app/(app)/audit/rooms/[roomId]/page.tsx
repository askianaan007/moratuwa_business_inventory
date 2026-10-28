import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { EquipmentType, RoomDetail, User } from "@/lib/types";
import { RoomView } from "./room-view";

export default function RoomPage({ params }: PageProps<"/audit/rooms/[roomId]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Room" backHref="/audit/rooms" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [{ data: room }, { data: me }, { data: types }] = await Promise.all([
    apiGet<{ data: RoomDetail }>(`/rooms/${roomId}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: EquipmentType[] }>("/equipment-types"),
  ]);
  const canConfigure = me.user.role === "ADMIN" || me.user.role === "HOD";
  const canEdit = canConfigure || me.user.role === "TECHNICAL_OFFICER";
  return <RoomView detail={room} types={types} canConfigure={canConfigure} canEdit={canEdit} />;
}
