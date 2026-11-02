import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { SerialListDetail, User } from "@/lib/types";
import { SerialCapture } from "./serial-capture";

export default function SerialListPage({ params }: PageProps<"/serials/[listId]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Serial list" backHref="/serials" />
          <CardSkeleton rows={5} />
        </>
      }
    >
      <List params={params} />
    </Suspense>
  );
}

async function List({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const [{ data: list }, { data: me }, { data: reader }] = await Promise.all([
    apiGet<{ data: SerialListDetail }>(`/serial-lists/${encodeURIComponent(listId)}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: { ai: boolean } }>("/label-reader"),
  ]);
  return <SerialCapture list={list} canEdit={me.user.role !== "VIEWER"} aiReader={reader.ai} />;
}
