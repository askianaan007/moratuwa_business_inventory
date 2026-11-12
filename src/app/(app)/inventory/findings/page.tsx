import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { Finding, InventoryRoom } from "@/lib/inventory";
import type { User } from "@/lib/types";
import { ResolveFinding } from "./resolve-finding";

export const metadata: Metadata = { title: "Findings" };

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Findings" />
          <CardSkeleton rows={4} />
        </>
      }
    >
      <Findings />
    </Suspense>
  );
}

async function Findings() {
  const [{ data: findings }, { data: rooms }, { data: me }] = await Promise.all([
    apiGet<{ data: Finding[] }>("/inventory/findings"),
    apiGet<{ data: InventoryRoom[] }>("/inventory/rooms"),
    apiGet<{ data: { user: User } }>("/auth/me"),
  ]);
  const open = findings.filter((f) => !f.resolved);
  const closed = findings.filter((f) => f.resolved).slice(0, 20);
  const canEdit = me.user.role !== "VIEWER";

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Findings" subtitle="Assets physically seen somewhere other than their registered room" />
      <p className="text-sm text-base-content/70">
        Use <b>Seen it</b> on an asset (or scan its tag) to record where it really is. The registered room never changes on its own: transfer the item if the move was
        authorised, or bring it back and confirm it in its room.
      </p>

      {open.length === 0 ? (
        <EmptyState title="No open location mismatches">Everything recorded as seen is in its registered room.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((f) => (
            <li key={f.id} className="rounded-box border border-warning/60 bg-base-100 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/inventory/assets/${f.asset.id}`} className="font-mono text-sm font-semibold hover:underline">
                  {f.asset.tagCode}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm">{f.asset.description}</span>
              </div>
              <p className="mt-1 text-sm">
                Registered in <b>{f.asset.location?.code ?? "no room"}</b>, seen in <b>{f.observedLocation?.code ?? "—"}</b>
              </p>
              <p className="text-xs text-base-content/60">
                {new Date(f.scannedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} by {f.scannedBy.name}
                {f.note && ` · “${f.note}”`}
              </p>
              {canEdit && <ResolveFinding finding={f} rooms={rooms} />}
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-base-content/70">Recently resolved ({closed.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {closed.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Badge className="badge-success badge-outline">Resolved</Badge>
                <Link href={`/inventory/assets/${f.asset.id}`} className="font-mono hover:underline">
                  {f.asset.tagCode}
                </Link>
                <span className="truncate text-base-content/60">seen in {f.observedLocation?.code}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
