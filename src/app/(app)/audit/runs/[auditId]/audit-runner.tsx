"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckItem } from "@/components/audit/check-item";
import { RoomPlan, StatusLegend } from "@/components/room/room-plan";
import { Sheet } from "@/components/sheet";
import { Badge, PageHeader } from "@/components/ui";
import { useAuditOutbox, type SaveState } from "@/lib/audit-outbox";
import { auditStatusBadge, checkStatus, formatPeriod, worstStatus } from "@/lib/lab-status";
import type { EquipmentType, FaultReason, LabAuditDetail, LabCheck, LabCheckStatus, User } from "@/lib/types";
import { AuditPanels, TargetSyncBanner } from "./audit-panels";

interface Station {
  key: string;
  label: string;
  positionCode: string | null;
  seatId: string | null;
  checks: LabCheck[];
}
interface RowGroup {
  key: string;
  label: string;
  stations: Station[];
}
interface Section {
  key: string;
  title: string;
  rows: RowGroup[];
}

type Filter = "all" | "todo" | "faults";
const FAULTS = new Set<LabCheckStatus>(["NOT_WORKING", "NEEDS_REPAIR", "MISSING"]);
const MONITOR = "MON";
const GONE_WITHOUT_MONITOR = new Set(["CPU", "KBD", "MSE"]);
// The card and row shortcuts leave the UPS alone; "All working · next" inside
// a PC includes it, since the auditor is looking at that PC's items.
const SKIP_ALL_WORKING = new Set(["UPS"]);
const workable = (c: LabCheck) => c.status === "NOT_CHECKED" && !c.targetRetiredAfterStart;
const quickWorkable = (c: LabCheck) => workable(c) && !SKIP_ALL_WORKING.has(c.typeCode);
const canMonitorOnly = (checks: LabCheck[]) =>
  checks.some((c) => c.typeCode === MONITOR && c.status === "NOT_CHECKED" && !c.targetRetiredAfterStart);
const AUDITORS = new Set(["ADMIN", "HOD", "TECHNICAL_OFFICER"]);

/** Block → row → PC, in the order an auditor walks the room. */
function buildSections(audit: LabAuditDetail, checks: LabCheck[]): Section[] {
  const desks = audit.plan.desks;
  const deskBySeat = new Map(desks.map((d) => [d.seatId, d]));
  const deskByWs = new Map(desks.filter((d) => d.workstationId).map((d) => [d.workstationId!, d]));
  const stations = new Map<string, Station & { blockCode: string | null; rowLabel: string | null }>();

  for (const c of checks) {
    const desk = c.workstationId ? deskByWs.get(c.workstationId) : c.seatId ? deskBySeat.get(c.seatId) : undefined;
    const key = c.workstationId ?? (c.seatId ? `S:${c.seatId}` : `E:${c.equipmentId}`);
    let station = stations.get(key);
    if (!station) {
      station = {
        key,
        label: c.stationLabel ?? (c.targetKind === "SEAT" ? c.typeName : c.itemCode),
        positionCode: c.positionCode,
        seatId: desk?.seatId ?? null,
        blockCode: desk?.blockCode ?? null,
        rowLabel: desk?.rowLabel ?? null,
        checks: [],
      };
      stations.set(key, station);
    }
    station.checks.push(c);
  }

  const sections: Section[] = audit.plan.blocks.map((b) => ({
    key: b.code,
    title: `${b.code} · ${b.name}`,
    rows: audit.plan.rows
      .filter((r) => r.blockId === b.id)
      .map((r) => ({ key: r.id, label: `Row ${r.label}`, stations: [...stations.values()].filter((s) => s.blockCode === b.code && s.rowLabel === r.label) }))
      .filter((r) => r.stations.length),
  }));
  const fixtures = [...stations.values()].filter((s) => !s.blockCode && s.key.startsWith("E:") && !s.checks[0]?.workstationId);
  const others = [...stations.values()].filter((s) => !s.blockCode && !fixtures.includes(s));
  if (fixtures.length) sections.push({ key: "room", title: "Room items", rows: [{ key: "room", label: "", stations: fixtures }] });
  if (others.length) sections.push({ key: "other", title: "Not on a desk", rows: [{ key: "other", label: "", stations: others }] });
  return sections.filter((s) => s.rows.length);
}

const statusOf = (s: Station) => worstStatus(s.checks.map((c) => c.status)) ?? "NOT_CHECKED";

export function AuditRunner({ audit, user, reasons, types }: { audit: LabAuditDetail; user: User; reasons: FaultReason[]; types: EquipmentType[] }) {
  const editable = (audit.status === "DRAFT" || audit.status === "RETURNED") && AUDITORS.has(user.role);
  const outbox = useAuditOutbox(audit.id, audit.checks, editable);
  const { checks, record } = outbox;
  const [view, setView] = useState<"list" | "plan">("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const sections = useMemo(() => buildSections(audit, checks), [audit, checks]);
  const allStations = useMemo(() => sections.flatMap((s) => s.rows.flatMap((r) => r.stations)), [sections]);
  const visible = useCallback(
    (s: Station) => filter === "all" || (filter === "todo" ? s.checks.some((c) => c.status === "NOT_CHECKED") : s.checks.some((c) => FAULTS.has(c.status))),
    [filter],
  );
  const order = useMemo(() => allStations.filter(visible), [allStations, visible]);
  const current = open ? allStations.find((s) => s.key === open) : undefined;
  const index = current ? order.findIndex((s) => s.key === current.key) : -1;

  const reasonsFor = useMemo(() => {
    const typeId = new Map(types.map((t) => [t.code, t.id]));
    const cache = new Map<string, FaultReason[]>();
    return (typeCode: string) => {
      let list = cache.get(typeCode);
      if (!list) {
        const id = typeId.get(typeCode);
        list = reasons.filter((r) => r.isActive && (r.typeId === null || r.typeId === id)).sort((a, b) => Number(a.typeId === null) - Number(b.typeId === null) || a.sortOrder - b.sortOrder);
        cache.set(typeCode, list);
      }
      return list;
    };
  }, [reasons, types]);

  const progress = useMemo(() => {
    const byStatus = Object.fromEntries(Object.keys(checkStatus).map((s) => [s, 0])) as Record<LabCheckStatus, number>;
    for (const c of checks) byStatus[c.status]++;
    const total = checks.length;
    const checked = total - byStatus.NOT_CHECKED;
    return { total, checked, byStatus, pct: total ? Math.round((checked / total) * 100) : 100 };
  }, [checks]);

  const deskStatus = useMemo(() => {
    const out: Record<string, LabCheckStatus> = {};
    for (const s of allStations) if (s.seatId) out[s.seatId] = statusOf(s);
    return out;
  }, [allStations]);
  const fixtureStatus = useMemo(() => {
    const out: Record<string, LabCheckStatus> = {};
    for (const c of checks) if (c.equipmentId && !c.workstationId) out[c.equipmentId] = c.status;
    return out;
  }, [checks]);

  const markWorking = useCallback(
    (list: LabCheck[], includeUps = false) => {
      for (const c of list) if (includeUps ? workable(c) : quickWorkable(c)) record(c.id, { status: "WORKING" });
    },
    [record],
  );

  // Only the monitor is left at this PC: monitor working, CPU/keyboard/mouse
  // missing, UPS and anything else left unchecked. Unchecked items only.
  const markMonitorOnly = useCallback(
    (list: LabCheck[]) => {
      for (const c of list) {
        if (c.status !== "NOT_CHECKED" || c.targetRetiredAfterStart) continue;
        if (c.typeCode === MONITOR) record(c.id, { status: "WORKING" });
        else if (GONE_WITHOUT_MONITOR.has(c.typeCode)) record(c.id, { status: "MISSING", faultReasonId: null, reasonText: "Not at the PC" });
      }
    },
    [record],
  );

  const go = (delta: number) => {
    const next = order[index + delta];
    if (next) setOpen(next.key);
  };

  // Jump from the submit problems list to an item.
  const focusCheck = (checkId: string) => {
    const station = allStations.find((s) => s.checks.some((c) => c.id === checkId));
    if (station) setOpen(station.key);
  };

  return (
    <>
      <PageHeader
        title={audit.location.name}
        subtitle={
          <>
            {formatPeriod(audit.period)} · <span className="font-mono">{audit.reference}</span>
          </>
        }
        backHref="/audit"
        action={<Badge className={`badge-md ${auditStatusBadge[audit.status].className}`}>{auditStatusBadge[audit.status].label}</Badge>}
      />

      <div className="sticky top-16 z-20 -mx-4 mb-3 lg:top-0 lg:-mx-8 lg:px-8 border-b border-base-300 bg-base-100/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <progress className="progress progress-primary h-2.5 flex-1" value={progress.checked} max={progress.total || 1} aria-label="Audit progress" />
          <span className="text-sm font-semibold tabular-nums">
            {progress.checked}/{progress.total}
          </span>
          <SaveIndicator state={outbox.state} unsaved={outbox.unsaved} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-base-content/70">
          {(["WORKING", "NOT_WORKING", "NEEDS_REPAIR", "MISSING", "REMOVED"] as const).map((s) =>
            progress.byStatus[s] ? (
              <span key={s}>
                {checkStatus[s].symbol} {progress.byStatus[s]} {checkStatus[s].label.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {outbox.lockedMessage && <div className="alert alert-error alert-soft mb-3 text-sm">{outbox.lockedMessage}. Reload to see the latest.</div>}
      {editable && <TargetSyncBanner audit={audit} />}

      {outbox.conflicts.length > 0 && (
        <div className="alert alert-warning mb-3 flex-col items-stretch text-sm">
          <p className="font-semibold">Someone else changed {outbox.conflicts.length} item(s) at the same time</p>
          <ul className="flex flex-col gap-2">
            {outbox.conflicts.map((c) => (
              <li key={c.checkId} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  <b className="font-mono">{c.theirs.itemCode}</b>: they set {checkStatus[c.theirs.status].label}
                  {c.theirs.checkedBy && ` (${c.theirs.checkedBy.name})`}, you set {checkStatus[c.mine.status].label}
                </span>
                <button type="button" className="btn btn-xs" onClick={() => outbox.resolve(c.checkId, "theirs")}>
                  Keep theirs
                </button>
                <button type="button" className="btn btn-xs btn-neutral" onClick={() => outbox.resolve(c.checkId, "mine")}>
                  Use mine
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" className="tabs tabs-box tabs-sm">
          {(["list", "plan"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={`tab ${view === v ? "tab-active" : ""}`} onClick={() => setView(v)}>
              {v === "list" ? "List" : "Room plan"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1" role="group" aria-label="Filter">
          {(
            [
              ["all", "All"],
              ["todo", `To do ${progress.byStatus.NOT_CHECKED || ""}`],
              ["faults", "Faults"],
            ] as const
          ).map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} className={`btn btn-xs rounded-full ${filter === f ? "btn-neutral" : "btn-ghost"}`} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "plan" ? (
        <div className="animate-in flex flex-col gap-2">
          <RoomPlan
            plan={audit.plan}
            deskStatus={deskStatus}
            fixtureStatus={fixtureStatus}
            selectedId={current?.seatId ?? null}
            highlightIds={filter === "all" ? undefined : new Set(order.flatMap((s) => [s.seatId ?? "", s.key.startsWith("E:") ? s.key.slice(2) : ""]).filter(Boolean))}
            onSelectDesk={(d) => {
              const s = allStations.find((x) => x.seatId === d.seatId);
              if (s) setOpen(s.key);
            }}
            onSelectFixture={(f) => setOpen(`E:${f.equipmentId}`)}
          />
          <StatusLegend />
        </div>
      ) : (
        <div className="animate-in flex flex-col gap-5">
          {sections.map((section) => {
            const rows = section.rows.map((r) => ({ ...r, stations: r.stations.filter(visible) })).filter((r) => r.stations.length);
            if (!rows.length) return null;
            return (
              <section key={section.key}>
                <h2 className="mb-2 text-sm font-bold tracking-wide text-base-content/70 uppercase">{section.title}</h2>
                <div className="flex flex-col gap-3">
                  {rows.map((row) => {
                    const unchecked = row.stations.flatMap((s) => s.checks).filter(quickWorkable);
                    return (
                      <div key={row.key}>
                        {row.label && (
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-semibold text-base-content/60">{row.label}</span>
                            {editable && unchecked.length > 0 && (
                              <ConfirmButton className="btn-ghost btn-xs ml-auto" confirmLabel={`Mark ${unchecked.length} working?`} onConfirm={() => markWorking(unchecked)}>
                                ✓ Rest of row working
                              </ConfirmButton>
                            )}
                          </div>
                        )}
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                          {row.stations.map((s) => (
                            <li key={s.key}>
                              <StationCard
                                station={s}
                                onOpen={() => setOpen(s.key)}
                                onAllWorking={editable ? () => markWorking(s.checks) : undefined}
                                onMonitorOnly={editable ? () => markMonitorOnly(s.checks) : undefined}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {order.length === 0 && <p className="py-8 text-center text-sm text-base-content/60">{filter === "todo" ? "Everything has been checked." : "No faults recorded."}</p>}
        </div>
      )}

      <AuditPanels audit={audit} user={user} progress={progress} editable={editable} flush={outbox.flush} onFocusCheck={focusCheck} />

      <Sheet
        open={Boolean(current)}
        onClose={() => setOpen(null)}
        title={current?.label ?? ""}
        subtitle={current?.positionCode && <span className="font-mono">{current.positionCode}</span>}
        wide
        footer={
          current && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" disabled={index <= 0} onClick={() => go(-1)} aria-label="Previous">
                ← Prev
              </button>
              {editable && current.checks.some(workable) ? (
                <button
                  type="button"
                  className="btn btn-success flex-1"
                  onClick={() => {
                    markWorking(current.checks, true);
                    if (index >= 0 && index < order.length - 1) go(1);
                  }}
                >
                  ✓ All working{index < order.length - 1 && " · next"}
                </button>
              ) : (
                <span className="flex-1 text-center text-sm text-base-content/60 tabular-nums">
                  {index + 1} of {order.length}
                </span>
              )}
              <button type="button" className="btn btn-primary btn-sm" disabled={index < 0 || index >= order.length - 1} onClick={() => go(1)}>
                Next →
              </button>
            </div>
          )
        }
      >
        {current && (
          <div key={current.key} className="animate-in flex flex-col gap-3">
            {editable && canMonitorOnly(current.checks) && (
              <button type="button" className="btn btn-outline btn-sm self-start" onClick={() => markMonitorOnly(current.checks)}>
                Monitor only · CPU, keyboard, mouse missing
              </button>
            )}
            {current.checks.map((c) => (
              <CheckItem key={c.id} check={c} reasons={reasonsFor(c.typeCode)} editable={editable} error={outbox.errors[c.id]} onRecord={record} />
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

function StationCard({
  station,
  onOpen,
  onAllWorking,
  onMonitorOnly,
}: {
  station: Station;
  onOpen: () => void;
  onAllWorking?: () => void;
  onMonitorOnly?: () => void;
}) {
  const status = statusOf(station);
  const meta = checkStatus[status];
  const done = station.checks.filter((c) => c.status !== "NOT_CHECKED").length;
  // Quick tick: marks every unchecked item on this PC (except the UPS) working without opening it.
  const canTick = onAllWorking && station.checks.some(quickWorkable);
  const canMonOnly = onMonitorOnly && canMonitorOnly(station.checks);
  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={onOpen}
        className={`flex h-full w-full flex-col gap-1 rounded-box border-2 bg-base-100 p-2.5 text-left ${canTick || canMonOnly ? "pb-10" : ""} transition-[transform,border-color] duration-150 active:scale-[0.98] ${
          status === "NOT_CHECKED" ? "border-base-300" : status === "WORKING" ? "border-success/60" : FAULTS.has(status) ? "border-error/70" : "border-base-content/30"
        }`}
      >
        <span className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-semibold">{station.label}</span>
          <span className={`badge badge-sm ${meta.badge}`} aria-label={meta.label}>
            {meta.symbol}
          </span>
        </span>
        <span className="font-mono text-[11px] text-base-content/50">{station.positionCode ?? "—"}</span>
        <span className="flex flex-wrap gap-0.5" aria-hidden>
          {station.checks.map((c) => (
            <span key={c.id} title={`${c.itemCode}: ${checkStatus[c.status].label}`} className={`badge badge-xs ${checkStatus[c.status].badge}`}>
              {c.typeCode === "SEAT" ? "TBL" : c.typeCode}
            </span>
          ))}
        </span>
        <span className="text-[11px] text-base-content/60 tabular-nums">
          {done}/{station.checks.length} checked
        </span>
      </button>
      {(canTick || canMonOnly) && (
        <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1">
          {canMonOnly && (
            <button
              type="button"
              onClick={onMonitorOnly}
              className="btn btn-outline btn-xs"
              aria-label={`${station.label}: monitor working, CPU, keyboard and mouse missing`}
              title="Monitor only: CPU, keyboard and mouse missing; UPS left unchecked"
            >
              MON only
            </button>
          )}
          {canTick && (
            <button type="button" onClick={onAllWorking} className="btn btn-success btn-xs" aria-label={`Mark all items on ${station.label} working`} title="All working (UPS left unchecked)">
              ✓ All
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state, unsaved }: { state: SaveState; unsaved: number }) {
  const label =
    state === "saving" ? "Saving…" : state === "offline" ? `Offline · ${unsaved} waiting` : state === "error" ? "Needs attention" : unsaved ? `${unsaved} unsaved` : "Saved";
  const tone = state === "offline" || state === "error" ? "text-warning" : state === "saved" && !unsaved ? "text-success" : "text-base-content/60";
  return (
    <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${tone}`} role="status" aria-live="polite">
      {state === "saving" && <span className="loading loading-spinner loading-xs" />}
      {label}
    </span>
  );
}

/** Two taps: the first arms it for 3 seconds. Prevents accidental bulk changes. */
export function ConfirmButton({ children, confirmLabel, onConfirm, className = "" }: { children: React.ReactNode; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn ${armed ? "btn-warning" : ""} ${className}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
