import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { RoomDetail, User } from "@/lib/types";
import { LayoutEditor } from "./layout-editor";

export default function LayoutPage({ params }: PageProps<"/audit/rooms/[roomId]/layout">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Room layout" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Layout params={params} />
    </Suspense>
  );
}

async function Layout({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [{ data: detail }, { data: me }] = await Promise.all([apiGet<{ data: RoomDetail }>(`/rooms/${roomId}`), apiGet<{ data: { user: User } }>("/auth/me")]);
  if (me.user.role !== "ADMIN" && me.user.role !== "HOD") redirect(`/audit/rooms/${roomId}`);
  return <LayoutEditor detail={detail} />;
}
