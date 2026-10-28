"use client";

import { useState } from "react";
import { ZoomInIcon, ZoomOutIcon } from "@/components/icons";
import { checkStatus } from "@/lib/lab-status";
import type { LabCheckStatus, PlanGeometry } from "@/lib/types";

type Desk = PlanGeometry["desks"][number];
type Fixture = PlanGeometry["fixtures"][number];

const ZOOMS = [0, 1, 1.5, 2] as const; // 0 = fit to width

/**
 * Top view of a room, drawn from API geometry (the printed report uses the
 * same coordinates). Board at the top. Tap a desk or wall item to select it.
 * On phones the plan starts fitted to the width; zoom in and scroll sideways.
 */
export function RoomPlan({
  plan,
  deskStatus = {},
  fixtureStatus = {},
  selectedId,
  highlightIds,
  showGaps = false,
  onSelectDesk,
  onSelectFixture,
  className = "",
}: {
  plan: PlanGeometry;
  deskStatus?: Record<string, LabCheckStatus | undefined>;
  fixtureStatus?: Record<string, LabCheckStatus | undefined>;
  selectedId?: string | null;
  highlightIds?: Set<string>;
  showGaps?: boolean;
  onSelectDesk?: (desk: Desk) => void;
  onSelectFixture?: (fixture: Fixture) => void;
  className?: string;
}) {
  const [zoom, setZoom] = useState(0);
  const scale = ZOOMS[zoom]!;
  const interactive = Boolean(onSelectDesk || onSelectFixture);

  const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={`relative rounded-box border border-base-300 bg-base-100 ${className}`}>
      <div className="absolute top-2 right-2 z-10 join shadow-sm">
        <button type="button" className="btn btn-sm join-item" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out">
          <ZoomOutIcon className="size-4" />
        </button>
        <button type="button" className="btn btn-sm join-item tabular-nums" onClick={() => setZoom(0)} aria-label="Fit to width">
          {scale ? `${Math.round(scale * 100)}%` : "Fit"}
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">
          <ZoomInIcon className="size-4" />
        </button>
      </div>

      <div className="overflow-auto overscroll-contain rounded-box [scrollbar-width:thin]">
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          width={scale ? plan.width * scale : "100%"}
          className="block select-none transition-[width] duration-200"
          role="img"
          aria-label="Room plan, board at the top"
        >
          <rect x={1} y={1} width={plan.width - 2} height={plan.height - 2} rx={10} className="fill-base-200/40 stroke-base-300" strokeWidth={2} />
          <rect x={plan.board.x} y={plan.board.y} width={plan.board.w} height={plan.board.h} rx={4} className="fill-base-content" />
          <text x={plan.board.x + plan.board.w / 2} y={plan.board.y + 12} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-base-100">
            FRONT · BOARD
          </text>

          {plan.blocks.map((b) => (
            <text
              key={b.id}
              x={b.mirrored ? b.x + b.w - 28 : b.x + 28}
              y={b.y + 14}
              textAnchor={b.mirrored ? "end" : "start"}
              fontSize={11}
              fontWeight={700}
              className="fill-base-content"
            >
              {b.code} · {b.name}
            </text>
          ))}
          {plan.rows.map((r) => (
            <text key={r.id} x={r.x + 12} y={r.y + 4} fontSize={10} textAnchor="middle" className="fill-base-content/60">
              R{r.label}
            </text>
          ))}

          {plan.desks.map((d) => {
            if (d.kind === "NO_TABLE" && !showGaps) return null;
            const status = deskStatus[d.seatId];
            const selected = selectedId === d.seatId || (d.workstationId !== null && selectedId === d.workstationId);
            const highlighted = highlightIds?.has(d.seatId) || (d.workstationId !== null && highlightIds?.has(d.workstationId));
            const tone =
              d.kind === "NO_TABLE"
                ? "fill-transparent stroke-base-content/20"
                : status
                  ? checkStatus[status].plan
                  : d.kind === "EMPTY_TABLE"
                    ? "fill-base-100 stroke-base-content/40"
                    : "fill-base-100 stroke-base-content/60";
            const title = d.kind === "EMPTY_TABLE" ? "empty" : d.kind === "NO_TABLE" ? "gap" : (d.label ?? (d.kind === "INSTRUCTOR" ? "instr." : "PC"));
            const select = () => onSelectDesk?.(d);
            return (
              <g
                key={d.seatId}
                {...(onSelectDesk && {
                  role: "button",
                  tabIndex: 0,
                  onClick: select,
                  onKeyDown: keyActivate(select),
                  "aria-label": `${d.positionCode} ${title}${status ? `, ${checkStatus[status].label}` : ""}`,
                  "aria-pressed": selected,
                })}
                className={`${interactive ? "cursor-pointer outline-none [&:focus-visible>rect]:stroke-primary" : ""} ${highlighted ? "animate-pulse" : ""}`}
              >
                <rect
                  x={d.x}
                  y={d.y}
                  width={d.w}
                  height={d.h}
                  rx={6}
                  className={`${tone} transition-colors duration-200 ${selected ? "!stroke-primary" : ""}`}
                  strokeWidth={selected ? 3.5 : status === "NOT_WORKING" || status === "MISSING" ? 2.5 : 1.25}
                  strokeDasharray={d.kind === "EMPTY_TABLE" ? "5 3" : d.kind === "NO_TABLE" ? "2 4" : undefined}
                />
                <text x={d.x + d.w / 2} y={d.y + 18} textAnchor="middle" fontSize={11} fontWeight={700} className="pointer-events-none fill-base-content">
                  {title.length > 9 ? `${title.slice(0, 8)}…` : title}
                </text>
                <text x={d.x + d.w / 2} y={d.y + 33} textAnchor="middle" fontSize={9} className="pointer-events-none fill-base-content/70">
                  S{d.seatNumber}
                  {status ? ` ${checkStatus[status].symbol}` : ""}
                </text>
              </g>
            );
          })}

          {plan.fixtures.map((f) => {
            const status = fixtureStatus[f.equipmentId];
            const selected = selectedId === f.equipmentId;
            const select = () => onSelectFixture?.(f);
            return (
              <g
                key={f.equipmentId}
                {...(onSelectFixture && {
                  role: "button",
                  tabIndex: 0,
                  onClick: select,
                  onKeyDown: keyActivate(select),
                  "aria-label": `${f.code} ${f.typeName}${status ? `, ${checkStatus[status].label}` : ""}`,
                })}
                className={interactive ? "cursor-pointer outline-none" : ""}
              >
                <rect
                  x={f.x - 24}
                  y={f.y - 10}
                  width={48}
                  height={20}
                  rx={10}
                  className={`${status ? checkStatus[status].plan : "fill-base-100 stroke-base-content/60"} ${selected ? "!stroke-primary" : ""}`}
                  strokeWidth={selected ? 3 : 1.25}
                />
                <text x={f.x} y={f.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={600} className="pointer-events-none fill-base-content">
                  {f.code}
                  {status ? ` ${checkStatus[status].symbol}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Legend under the plan: symbol + colour for each status. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/70" aria-label="Legend">
      {(Object.keys(checkStatus) as LabCheckStatus[]).map((s) => (
        <li key={s} className="flex items-center gap-1">
          <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden>
            <rect x={1} y={1} width={12} height={12} rx={3} className={checkStatus[s].plan} strokeWidth={1.5} />
          </svg>
          {checkStatus[s].symbol} {checkStatus[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden>
          <rect x={1} y={1} width={12} height={12} rx={3} className="fill-base-100 stroke-base-content/40" strokeWidth={1.5} strokeDasharray="3 2" />
        </svg>
        Empty table
      </li>
    </ul>
  );
}
