import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { EquipmentType, FaultReason, LabAuditDetail, User } from "@/lib/types";
import { AuditRunner } from "./audit-runner";

export default function AuditRunPage({ params }: PageProps<"/audit/runs/[auditId]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Audit" backHref="/audit" />
          <CardSkeleton rows={5} />
        </>
      }
    >
      <Run params={params} />
    </Suspense>
  );
}

async function Run({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const [{ data: audit }, { data: me }, { data: reasons }, { data: types }] = await Promise.all([
    apiGet<{ data: LabAuditDetail }>(`/lab-audits/${auditId}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: FaultReason[] }>("/fault-reasons"),
    apiGet<{ data: EquipmentType[] }>("/equipment-types"),
  ]);
  return <AuditRunner audit={audit} user={me.user} reasons={reasons} types={types} />;
}
