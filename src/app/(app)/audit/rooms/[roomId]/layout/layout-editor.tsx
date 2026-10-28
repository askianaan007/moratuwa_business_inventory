"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoomPlan } from "@/components/room/room-plan";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { SEAT_CYCLE, seatKind } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { PlanGeometry, RoomDetail, SeatKind } from "@/lib/types";

interface DraftSeat {
  key: string;
  id?: string;
  kind: SeatKind;
  note?: string | null;
  label?: string | null; // PC name, shown on existing seats
}
interface DraftRow {
  key: string;
  id?: string;
  label: string;
  seats: DraftSeat[];
}
interface DraftBlock {
  key: string;
  id?: string;
  code: string;
  name: string;
  rows: DraftRow[];
}
interface Preview {
  diff: { blocks: number; rows: number; seats: number; pcSeats: number; seatsAdded: number; seatsChanged: number; seatsRemoved: number; workstationsToCreate: number };
  blockers: string[];
  plan: PlanGeometry;
}

let keySeq = 0;
const k = () => `k${++keySeq}`;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const seats = (n: number, kind: SeatKind = "PC"): DraftSeat[] => Array.from({ length: n }, () => ({ key: k(), kind }));
const rows = (count: number, perRow: number, start = 1): DraftRow[] => Array.from({ length: count }, (_, i) => ({ key: k(), label: String(start + i), seats: seats(perRow) }));

function fromDetail(detail: RoomDetail): DraftBlock[] {
  const wsLabel = new Map(detail.workstations.map((w) => [w.id, w.label]));
  return detail.blocks.map((b) => ({
    key: k(),
    id: b.id,
    code: b.code,
    name: b.name,
    rows: b.rows.map((r) => ({
      key: k(),
      id: r.id,
      label: r.label,
      seats: r.seats.map((s) => ({ key: k(), id: s.id, kind: s.kind, note: s.note, label: s.workstationId ? wsLabel.get(s.workstationId) : null })),
    })),
  }));
}

const toInput = (blocks: DraftBlock[]) =>
  blocks.map((b) => ({
    ...(b.id && { id: b.id }),
    code: b.code.trim().toUpperCase(),
    name: b.name.trim() || `Block ${b.code}`,
    rows: b.rows.map((r) => ({
      ...(r.id && { id: r.id }),
      label: r.label.trim(),
      seats: r.seats.map((s) => ({ ...(s.id && { id: s.id }), kind: s.kind, note: s.note ?? null })),
    })),
  }));

/**
 * Blocks → rows → seats. Tap a seat to cycle PC → empty table → gap →
 * instructor. The Preview tab is drawn by the API,
 * so it matches the printed report exactly.
 */
export function LayoutEditor({ detail }: { detail: RoomDetail }) {
  const router = useRouter();
  const { room, openAudit } = detail;
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => fromDetail(detail));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [dirty, setDirty] = useState(false);
  const { pending, error, run, setError } = useAction();
  const body = useMemo(() => JSON.stringify(toInput(blocks)), [blocks]);
  const lastSent = useRef("");

  // Debounced preview. Ignores stale responses.
  useEffect(() => {
    if (blocks.length === 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      lastSent.current = body;
      setPreviewing(true);
      try {
        const res = await api<{ data: Preview }>(`/rooms/${room.id}/layout/preview`, {
          method: "POST",
          body: { expectedLayoutVersion: room.layoutVersion, blocks: JSON.parse(body) },
        });
        if (lastSent.current === body) setPreview(res.data);
      } catch {
        if (lastSent.current === body) setPreview(null);
      } finally {
        if (lastSent.current === body) setPreviewing(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [body, blocks.length, room.id, room.layoutVersion]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(fn: (draft: DraftBlock[]) => DraftBlock[]) {
    setBlocks((b) => fn(structuredClone(b)));
    setDirty(true);
    setError(null);
  }

  function quickSetup(form: FormData) {
    const count = Math.min(6, Math.max(1, Number(form.get("blocks")) || 2));
    const perBlock = Math.min(40, Math.max(1, Number(form.get("rows")) || 8));
    const perRow = Math.min(30, Math.max(1, Number(form.get("seats")) || 4));
    const next: DraftBlock[] = Array.from({ length: count }, (_, i) => ({
      key: k(),
      code: LETTERS[i]!,
      name: count === 2 ? (i === 0 ? "Left side" : "Right side") : `Block ${LETTERS[i]}`,
      rows: rows(perBlock, perRow),
    }));
    if (form.get("instructor") === "on") next.unshift({ key: k(), code: "T", name: "Instructor", rows: [{ key: k(), label: "1", seats: seats(1, "INSTRUCTOR") }] });
    update(() => next);
  }

  async function save() {
    const result = await run(() =>
      api<{ data: unknown }>(`/rooms/${room.id}/layout`, {
        method: "POST",
        body: { expectedLayoutVersion: room.layoutVersion, blocks: JSON.parse(body), createWorkstations: true, generateEquipment: true },
      }),
    );
    if (result) {
      setDirty(false);
      router.push(`/audit/rooms/${room.id}`);
      router.refresh();
    }
  }

  const blockers = preview?.blockers ?? [];
  const totals = useMemo(() => {
    const all = blocks.flatMap((b) => b.rows.flatMap((r) => r.seats));
    return { pcs: all.filter((s) => s.kind === "PC").length, empty: all.filter((s) => s.kind === "EMPTY_TABLE").length, seats: all.length };
  }, [blocks]);

  return (
    <>
      <PageHeader title="Room layout" subtitle={`${room.name} · ${room.code}`} backHref={`/audit/rooms/${room.id}`} />

      {openAudit && (
        <div className="alert alert-warning alert-soft mb-3 text-sm">
          The {openAudit.reference} audit is open. You can rename blocks and rows, but adding, removing or changing seats must wait until it is approved.
        </div>
      )}

      <div role="tablist" className="tabs tabs-box mb-3">
        <button type="button" role="tab" className={`tab flex-1 ${tab === "edit" ? "tab-active" : ""}`} aria-selected={tab === "edit"} onClick={() => setTab("edit")}>
          Edit
        </button>
        <button type="button" role="tab" className={`tab flex-1 ${tab === "preview" ? "tab-active" : ""}`} aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
          Preview {blockers.length > 0 && <span className="badge badge-error badge-xs ml-1">{blockers.length}</span>}
        </button>
      </div>

      <div className="pb-4">
        <div className={`flex flex-col gap-3 ${tab === "edit" ? "animate-in" : "hidden"}`}>
          {blocks.length === 0 ? (
            <QuickSetup onSubmit={quickSetup} />
          ) : (
            <details className="collapse-arrow collapse rounded-box border border-base-300 bg-base-100">
              <summary className="collapse-title text-sm font-medium">Start again from a grid</summary>
              <div className="collapse-content">
                <QuickSetup onSubmit={quickSetup} compact />
              </div>
            </details>
          )}

          <SeatLegend />

          {blocks.map((block, bi) => (
            <BlockEditor
              key={block.key}
              block={block}
              first={bi === 0}
              last={bi === blocks.length - 1}
              onChange={(fn) => update((d) => d.map((b, i) => (i === bi ? fn(b) : b)))}
              onMove={(dir) =>
                update((d) => {
                  const [b] = d.splice(bi, 1);
                  d.splice(bi + dir, 0, b!);
                  return d;
                })
              }
              onRemove={() => update((d) => d.filter((_, i) => i !== bi))}
            />
          ))}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              update((d) => {
                const used = new Set(d.map((b) => b.code));
                const code = [...LETTERS].find((c) => !used.has(c)) ?? "Z";
                const template = d.at(-1);
                return [
                  ...d,
                  {
                    key: k(),
                    code,
                    name: `Block ${code}`,
                    rows: template ? template.rows.map((r) => ({ key: k(), label: r.label, seats: seats(r.seats.length) })) : rows(8, 4),
                  },
                ];
              })
            }
          >
            + Add block (column)
          </button>
        </div>

        <div className={`flex flex-col gap-3 ${tab === "preview" ? "animate-in" : "hidden"}`}>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Preview</span>
            {previewing && <span className="loading loading-dots loading-xs" />}
            <span className="ml-auto text-base-content/60 tabular-nums">
              {totals.pcs} PCs · {totals.empty} empty · {totals.seats} seats
            </span>
          </div>
          {preview ? <RoomPlan plan={preview.plan} showGaps /> : <div className="skeleton h-48 w-full" />}
          {preview && (
            <ul className="text-sm text-base-content/70">
              {preview.diff.seatsAdded > 0 && <li>+ {preview.diff.seatsAdded} new seats</li>}
              {preview.diff.seatsChanged > 0 && <li>~ {preview.diff.seatsChanged} seats change type</li>}
              {preview.diff.seatsRemoved > 0 && <li>− {preview.diff.seatsRemoved} seats removed</li>}
              {preview.diff.workstationsToCreate > 0 && <li>{preview.diff.workstationsToCreate} new PCs get numbers and default items (monitor, CPU, UPS, keyboard, mouse)</li>}
            </ul>
          )}
          {blockers.length > 0 && (
            <div className="alert alert-error alert-soft text-sm">
              <ul className="list-disc pl-4">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 -mx-4 lg:bottom-0 lg:-mx-8 lg:px-8 border-t border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm">{error ? <span className="text-error">{error}</span> : dirty ? "Unsaved changes" : "No changes"}</p>
          <button type="button" className="btn btn-primary" disabled={!dirty || pending || blocks.length === 0 || blockers.length > 0} onClick={() => void save()}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            Save layout
          </button>
        </div>
      </div>
    </>
  );
}

function QuickSetup({ onSubmit, compact = false }: { onSubmit: (form: FormData) => void; compact?: boolean }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className={compact ? "flex flex-col gap-3" : "flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4"}
    >
      {!compact && (
        <div>
          <p className="font-semibold">Quick setup</p>
          <p className="text-sm text-base-content/60">Start from a grid, then change single seats to empty tables or gaps.</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Blocks (columns)
          <input name="blocks" type="number" inputMode="numeric" min={1} max={6} defaultValue={2} className="input w-full" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Rows per block
          <input name="rows" type="number" inputMode="numeric" min={1} max={40} defaultValue={8} className="input w-full" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Seats per row
          <input name="seats" type="number" inputMode="numeric" min={1} max={30} defaultValue={4} className="input w-full" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="instructor" defaultChecked className="checkbox checkbox-sm" />
        Add an instructor desk at the front
      </label>
      <button type="submit" className={`btn ${compact ? "btn-sm btn-outline" : "btn-primary"}`}>
        {compact ? "Replace with this grid" : "Create grid"}
      </button>
    </form>
  );
}

function SeatLegend() {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
      Tap a seat to change it:
      {SEAT_CYCLE.map((kind) => (
        <span key={kind} className={`btn btn-xs pointer-events-none ${seatKind[kind].className}`}>
          {seatKind[kind].short}
        </span>
      ))}
    </p>
  );
}

function BlockEditor({
  block,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  block: DraftBlock;
  first: boolean;
  last: boolean;
  onChange: (fn: (b: DraftBlock) => DraftBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const hasPcs = block.rows.some((r) => r.seats.some((s) => s.label));
  const setRow = (ri: number, fn: (r: DraftRow) => DraftRow) => onChange((b) => ({ ...b, rows: b.rows.map((r, i) => (i === ri ? fn(r) : r)) }));

  return (
    <section className="rounded-box border border-base-300 bg-base-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-base-200 p-3">
        <input
          value={block.code}
          onChange={(e) => onChange((b) => ({ ...b, code: e.target.value.toUpperCase().slice(0, 4) }))}
          aria-label="Block code"
          className="input input-sm w-14 text-center font-mono font-bold uppercase"
        />
        <input value={block.name} onChange={(e) => onChange((b) => ({ ...b, name: e.target.value }))} aria-label="Block name" placeholder="e.g. Window side" className="input input-sm min-w-0 flex-1" />
        <div className="join">
          <button type="button" className="btn btn-sm btn-ghost join-item" disabled={first} onClick={() => onMove(-1)} aria-label="Move block left">
            ←
          </button>
          <button type="button" className="btn btn-sm btn-ghost join-item" disabled={last} onClick={() => onMove(1)} aria-label="Move block right">
            →
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost join-item text-error"
            onClick={() => (!hasPcs || confirm(`Block ${block.code} has PCs. Remove it?`)) && onRemove()}
            aria-label={`Remove block ${block.code}`}
          >
            ✕
          </button>
        </div>
      </header>

      <ol className="flex flex-col divide-y divide-base-200">
        {block.rows.map((row, ri) => (
          <li key={row.key} className="flex items-center gap-2 px-3 py-2">
            <input
              value={row.label}
              onChange={(e) => setRow(ri, (r) => ({ ...r, label: e.target.value.slice(0, 4) }))}
              aria-label={`Row ${ri + 1} label`}
              className="input input-xs w-10 shrink-0 text-center font-mono"
            />
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 [scrollbar-width:none]">
              {row.seats.map((seat, si) => (
                <button
                  key={seat.key}
                  type="button"
                  onClick={() =>
                    setRow(ri, (r) => ({
                      ...r,
                      seats: r.seats.map((s, i) => (i === si ? { ...s, kind: SEAT_CYCLE[(SEAT_CYCLE.indexOf(s.kind) + 1) % SEAT_CYCLE.length]! } : s)),
                    }))
                  }
                  title={`${block.code}-R${row.label}-S${si + 1}${seat.label ? ` · ${seat.label}` : ""}`}
                  aria-label={`${block.code}-R${row.label}-S${si + 1}: ${seatKind[seat.kind].label}${seat.label ? `, ${seat.label}` : ""}`}
                  className={`btn btn-sm h-10 min-w-11 shrink-0 flex-col gap-0 px-1 text-[10px] leading-tight transition-transform active:scale-95 ${seatKind[seat.kind].className}`}
                >
                  <span className="font-semibold">{seatKind[seat.kind].short}</span>
                  <span className="opacity-70">{seat.label ? seat.label.replace(/^[A-Z]+-/, "") : `S${si + 1}`}</span>
                </button>
              ))}
            </div>
            <div className="join shrink-0">
              <button
                type="button"
                className="btn btn-xs join-item"
                disabled={row.seats.length === 0}
                onClick={() => setRow(ri, (r) => ({ ...r, seats: r.seats.slice(0, -1) }))}
                aria-label={`Remove last seat from row ${row.label}`}
              >
                −
              </button>
              <button
                type="button"
                className="btn btn-xs join-item"
                disabled={row.seats.length >= 30}
                onClick={() => setRow(ri, (r) => ({ ...r, seats: [...r.seats, ...seats(1)] }))}
                aria-label={`Add seat to row ${row.label}`}
              >
                +
              </button>
            </div>
            <div className="dropdown dropdown-end shrink-0">
              <button type="button" tabIndex={0} className="btn btn-ghost btn-xs" aria-label={`Row ${row.label} options`}>
                ⋯
              </button>
              <ul tabIndex={0} className="dropdown-content menu z-30 w-48 rounded-box bg-base-100 p-1 shadow-lg">
                <li>
                  <button type="button" onClick={() => setRow(ri, (r) => ({ ...r, seats: r.seats.map((s) => ({ ...s, kind: "PC" })) }))}>
                    All PCs
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setRow(ri, (r) => ({ ...r, seats: r.seats.map((s) => ({ ...s, kind: "EMPTY_TABLE" })) }))}>
                    All empty tables
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      onChange((b) => {
                        const copy = { key: k(), label: String(b.rows.length + 1), seats: row.seats.map((s) => ({ key: k(), kind: s.kind })) };
                        return { ...b, rows: [...b.rows.slice(0, ri + 1), copy, ...b.rows.slice(ri + 1)] };
                      })
                    }
                  >
                    Duplicate row
                  </button>
                </li>
                <li>
                  <button type="button" className="text-error" disabled={block.rows.length === 1} onClick={() => onChange((b) => ({ ...b, rows: b.rows.filter((_, i) => i !== ri) }))}>
                    Delete row
                  </button>
                </li>
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <div className="p-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() =>
            onChange((b) => {
              const lastRow = b.rows.at(-1);
              const n = Number(lastRow?.label);
              return { ...b, rows: [...b.rows, { key: k(), label: Number.isFinite(n) ? String(n + 1) : String(b.rows.length + 1), seats: seats(lastRow?.seats.length ?? 4) }] };
            })
          }
        >
          + Add row
        </button>
      </div>
    </section>
  );
}
