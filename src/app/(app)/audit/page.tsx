import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { auditStatusBadge, currentPeriod, formatPeriod, roomTypeLabel } from "@/lib/lab-status";
import type { AuditOverview, User } from "@/lib/types";
import { StartAuditButton } from "./start-audit";

export const metadata: Metadata = { title: "Monthly lab audit" };

function shift(period: string, months: number) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyAuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <Suspense fallback={<CardSkeleton rows={3} />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).period;
  // currentPeriod() reads the clock, so opt out of prerendering first.
  await connection();
  const period = typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw) ? raw : currentPeriod();
  const [{ data }, { data: me }] = await Promise.all([
    apiGet<{ data: AuditOverview }>(`/lab-audits/overview?period=${period}`),
    apiGet<{ data: { user: User } }>("/auth/me"),
  ]);
  const canAudit = me.user.role !== "VIEWER";
  const canConfigure = me.user.role === "ADMIN" || me.user.role === "HOD";
  const isCurrent = period === currentPeriod();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link href={`/audit?period=${shift(period, -1)}`} className="btn btn-ghost btn-circle" aria-label="Previous month">
          <ChevronLeftIcon />
        </Link>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold tracking-tight">{formatPeriod(period)}</h1>
          <p className="text-sm text-base-content/60">Monthly lab & classroom audit</p>
        </div>
        <Link
          href={`/audit?period=${shift(period, 1)}`}
          className={`btn btn-ghost btn-circle ${isCurrent ? "btn-disabled" : ""}`}
          aria-label="Next month"
          aria-disabled={isCurrent}
        >
          <ChevronRightIcon />
        </Link>
      </div>

      {data.rooms.length === 0 ? (
        <EmptyState title="No labs or classrooms yet">
          {canConfigure ? (
            <Link href="/audit/rooms" className="link">
              Set up your first room
            </Link>
          ) : (
            "Ask an admin or HOD to set up the rooms."
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.rooms.map((room) => {
            const audit = room.audit;
            const p = audit?.progress;
            return (
              <li key={room.id} className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{room.name}</p>
                    <p className="text-sm text-base-content/60">
                      <span className="font-mono">{room.code}</span> · {roomTypeLabel[room.roomType]} · {room.workstationCount} PCs
                    </p>
                  </div>
                  {audit ? (
                    <Badge className={auditStatusBadge[audit.status].className}>{auditStatusBadge[audit.status].label}</Badge>
                  ) : (
                    <Badge className="badge-ghost">Not started</Badge>
                  )}
                </div>

                {p && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-base-content/70">
                      <span>
                        {p.checked}/{p.total} checked
                      </span>
                      <span>
                        {p.byStatus.NOT_WORKING + p.byStatus.NEEDS_REPAIR + p.byStatus.MISSING} faults
                      </span>
                    </div>
                    <progress className="progress progress-primary w-full" value={p.completion} max={100} aria-label="Audit progress" />
                  </div>
                )}

                <div className="mt-auto flex gap-2">
                  {audit ? (
                    <Link href={`/audit/runs/${audit.id}`} className="btn btn-primary flex-1">
                      {audit.status === "DRAFT" || audit.status === "RETURNED" ? "Continue audit" : "Open"}
                    </Link>
                  ) : !room.hasLayout ? (
                    <Link href={`/audit/rooms/${room.id}`} className="btn btn-outline flex-1">
                      {canConfigure ? "Set up layout first" : "Layout not set up"}
                    </Link>
                  ) : canAudit ? (
                    <StartAuditButton roomId={room.id} roomName={room.name} period={period} defaultName={me.user.name} />
                  ) : null}
                  <Link href={`/audit/rooms/${room.id}`} className="btn btn-ghost">
                    Room
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
