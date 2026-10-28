"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { GridIcon, SearchIcon } from "@/components/icons";
import { AddEquipmentForm, EquipmentEditor } from "@/components/room/equipment-editor";
import { RoomPlan } from "@/components/room/room-plan";
import { Sheet } from "@/components/sheet";
import { Badge, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { auditStatusBadge, formatPeriod, roomTypeLabel, seatKind } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { EquipmentType, RoomDetail, RoomWorkstation } from "@/lib/types";

type Selection = { kind: "desk"; seatId: string } | { kind: "fixture"; equipmentId: string } | null;

export function RoomView({ detail, types, canConfigure, canEdit }: { detail: RoomDetail; types: EquipmentType[]; canConfigure: boolean; canEdit: boolean }) {
  const { room, plan, workstations, fixtures, unassigned, openAudit } = detail;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toUpperCase());
  const [selection, setSelection] = useState<Selection>(null);
  const [adding, setAdding] = useState<"room" | null>(null);

  const wsById = useMemo(() => new Map(workstations.map((w) => [w.id, w])), [workstations]);

  // Search by PC label, position code (A-R3-S2), any item code or serial.
  const matches = useMemo(() => {
    if (!deferred) return null;
    const ids = new Set<string>();
    for (const d of plan.desks) {
      const ws = d.workstationId ? wsById.get(d.workstationId) : undefined;
      const hay = [d.positionCode, d.label ?? "", ...(ws?.equipment.flatMap((e) => [e.code, e.serialNo ?? "", e.assetItem?.tagCode ?? ""]) ?? [])];
      if (hay.some((h) => h.toUpperCase().includes(deferred))) ids.add(d.seatId);
    }
    for (const f of fixtures) if ([f.code, f.serialNo ?? ""].some((h) => h.toUpperCase().includes(deferred))) ids.add(f.id);
    return ids;
  }, [deferred, plan.desks, fixtures, wsById]);

  const firstMatch = matches && matches.size === 1 ? [...matches][0] : null;
  const seat = selection?.kind === "desk" ? plan.desks.find((d) => d.seatId === selection.seatId) : undefined;
  const ws = seat?.workstationId ? wsById.get(seat.workstationId) : undefined;
  const fixture = selection?.kind === "fixture" ? fixtures.find((f) => f.id === selection.equipmentId) : undefined;

  function openMatch(event: FormEvent) {
    event.preventDefault();
    if (!firstMatch) return;
    if (plan.desks.some((d) => d.seatId === firstMatch)) setSelection({ kind: "desk", seatId: firstMatch });
    else setSelection({ kind: "fixture", equipmentId: firstMatch });
  }

  const pcCount = workstations.filter((w) => w.seatId).length;
  const emptyTables = plan.desks.filter((d) => d.kind === "EMPTY_TABLE").length;

  return (
    <>
      <PageHeader
        title={room.name}
        subtitle={
          <>
            <span className="font-mono">{room.code}</span> · {roomTypeLabel[room.roomType]}
            {room.building && ` · ${room.building}`}
          </>
        }
        backHref="/audit/rooms"
        action={
          canConfigure && (
            <Link href={`/audit/rooms/${room.id}/layout`} className="btn btn-sm btn-outline">
              <GridIcon className="size-4" />
              <span className="hidden sm:inline">Edit layout</span>
              <span className="sm:hidden">Layout</span>
            </Link>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge className="badge-ghost">{pcCount} PCs</Badge>
        <Badge className="badge-ghost">{emptyTables} empty tables</Badge>
        <Badge className="badge-ghost">{fixtures.length} room items</Badge>
        {openAudit && (
          <Link href={`/audit/runs/${openAudit.id}`} className="badge badge-sm gap-1 border-info">
            <span className={`badge badge-xs ${auditStatusBadge[openAudit.status].className}`} />
            {formatPeriod(openAudit.period)} audit · {auditStatusBadge[openAudit.status].label}
          </Link>
        )}
      </div>

      {plan.desks.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 p-6 text-center">
          <p className="font-semibold">No layout yet</p>
          <p className="mb-3 text-sm text-base-content/60">Set the blocks, rows and seats to draw the room.</p>
          {canConfigure && (
            <Link href={`/audit/rooms/${room.id}/layout`} className="btn btn-primary">
              Set up layout
            </Link>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={openMatch} className="mb-2">
            <label className="input w-full">
              <SearchIcon className="size-4 opacity-50" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find PC, position (A-R3-S2), code or serial"
                aria-label="Find equipment"
                className="grow"
                enterKeyHint="search"
              />
              {matches && <span className="text-xs text-base-content/60 tabular-nums">{matches.size} found</span>}
            </label>
          </form>
          <RoomPlan
            plan={plan}
            highlightIds={matches ?? undefined}
            selectedId={seat?.seatId ?? fixture?.id ?? null}
            onSelectDesk={(d) => setSelection({ kind: "desk", seatId: d.seatId })}
            onSelectFixture={(f) => setSelection({ kind: "fixture", equipmentId: f.equipmentId })}
          />
          <p className="mt-1 text-xs text-base-content/60">Tap a desk or wall item for details. Dashed desks are empty tables.</p>
        </>
      )}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Room items</h2>
          {canEdit && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdding(adding ? null : "room")}>
              {adding ? "Cancel" : "+ Add item"}
            </button>
          )}
        </div>
        {adding && (
          <div className="mb-2">
            <AddEquipmentForm roomId={room.id} workstationId={null} types={types} onDone={() => setAdding(null)} />
          </div>
        )}
        {fixtures.length === 0 ? (
          <p className="text-sm text-base-content/60">No AC, TV or other room items recorded.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {fixtures.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "fixture", equipmentId: f.id })}
                  className="flex w-full items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 text-left transition-colors active:bg-base-200"
                >
                  <span className="font-mono font-semibold">{f.code}</span>
                  <span className="flex-1 truncate text-sm text-base-content/70">{f.type.name}</span>
                  {f.state === "AT_REPAIR" && <Badge className="badge-warning">At repair</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unassigned.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 font-semibold">Spares not on a PC</h2>
          <p className="mb-2 text-sm text-base-content/60">Kept in the room. Use Move to put one on a PC.</p>
          <div className="flex flex-col gap-2">
            {unassigned.map((e) => (
              <EquipmentEditor key={e.id} item={e} canEdit={canEdit} workstations={workstations} />
            ))}
          </div>
        </section>
      )}

      <Sheet
        open={Boolean(seat)}
        onClose={() => setSelection(null)}
        title={seat ? (ws?.label ?? seatKind[seat.kind].label) : ""}
        subtitle={seat && <span className="font-mono">{seat.positionCode}</span>}
        wide
      >
        {seat && (
          <DeskPanel
            key={seat.seatId}
            roomId={room.id}
            seatId={seat.seatId}
            seatKindLabel={seatKind[seat.kind].label}
            isPcSeat={seat.kind === "PC" || seat.kind === "INSTRUCTOR"}
            workstation={ws}
            workstations={workstations}
            types={types}
            canEdit={canEdit}
            canConfigure={canConfigure}
            onClose={() => setSelection(null)}
          />
        )}
      </Sheet>

      <Sheet open={Boolean(fixture)} onClose={() => setSelection(null)} title={fixture?.type.name ?? ""} subtitle={fixture && <span className="font-mono">{fixture.code}</span>}>
        {fixture && <EquipmentEditor key={fixture.id} item={fixture} canEdit={canEdit} workstations={workstations} />}
      </Sheet>
    </>
  );
}

function DeskPanel({
  roomId,
  seatId,
  seatKindLabel,
  isPcSeat,
  workstation,
  workstations,
  types,
  canEdit,
  canConfigure,
  onClose,
}: {
  roomId: string;
  seatId: string;
  seatKindLabel: string;
  isPcSeat: boolean;
  workstation: RoomWorkstation | undefined;
  workstations: RoomWorkstation[];
  types: EquipmentType[];
  canEdit: boolean;
  canConfigure: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<"rename" | "retire" | null>(null);
  const { pending, error, run } = useAction();

  async function call(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST", close = false) {
    const result = await run(() => api(path, { method, body }));
    if (result === undefined) return;
    setPanel(null);
    router.refresh();
    if (close) onClose();
  }

  if (!workstation) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-base-content/70">{isPcSeat ? "This seat is set for a PC but no PC is placed here." : `${seatKindLabel}. Nothing to record here.`}</p>
        {error && <p className="text-sm text-error">{error}</p>}
        {isPcSeat && canConfigure && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void call("/workstations", { seatId, generateEquipment: true })}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            Place a PC here
          </button>
        )}
        {isPcSeat && <MovePcHere seatId={seatId} workstations={workstations.filter((w) => !w.seatId)} canConfigure={canConfigure} />}
      </div>
    );
  }

  const parts = [...workstation.equipment].sort((a, b) => a.type.sortOrder - b.type.sortOrder || a.slot - b.slot);
  const missing = types.filter((t) => t.isActive && t.isDefault && t.scope !== "ROOM" && !parts.some((p) => p.type.id === t.id));

  function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label") ?? "").trim();
    void call(`/workstations/${workstation!.id}`, { expectedVersion: workstation!.version, labelOverride: label || null }, "PATCH");
  }

  function onRetire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void call(
      `/workstations/${workstation!.id}/retire`,
      { expectedVersion: workstation!.version, reason: String(form.get("reason") ?? "").trim(), retireEquipment: form.get("retireEquipment") === "on" },
      "POST",
      true,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-base-content/70">
        PC #{workstation.number} · {parts.length} item{parts.length === 1 ? "" : "s"}
        {workstation.labelOverride && " · custom name"}
      </p>
      {missing.length > 0 && (
        <div className="alert alert-warning alert-soft py-2 text-sm">Missing from the record: {missing.map((t) => t.name).join(", ")}</div>
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-col gap-2">
        {parts.map((e) => (
          <EquipmentEditor key={e.id} item={e} canEdit={canEdit} workstations={workstations} />
        ))}
      </div>

      {canEdit &&
        (adding ? (
          <AddEquipmentForm roomId={roomId} workstationId={workstation.id} types={types} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(true)}>
            + Add item to this PC
          </button>
        ))}

      {canConfigure && (
        <div className="flex flex-wrap gap-2 border-t border-base-200 pt-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel(panel === "rename" ? null : "rename")}>
            Rename PC
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setPanel(panel === "retire" ? null : "retire")}>
            Remove PC
          </button>
        </div>
      )}
      {panel === "rename" && (
        <form onSubmit={onRename} className="flex gap-2">
          <input name="label" defaultValue={workstation.labelOverride ?? ""} placeholder="Blank = monitor code" aria-label="PC name" className="input input-sm flex-1" maxLength={30} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            Save
          </button>
        </form>
      )}
      {panel === "retire" && (
        <form onSubmit={onRetire} className="flex flex-col gap-2 rounded-box border border-error/40 p-3">
          <input name="reason" required minLength={2} placeholder="Reason (required)" aria-label="Reason" className="input input-sm w-full" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="retireEquipment" className="checkbox checkbox-sm" />
            Also retire its items (otherwise they stay as spares)
          </label>
          <button type="submit" className="btn btn-error btn-sm" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-xs" />}
            Remove PC from seat
          </button>
        </form>
      )}
    </div>
  );
}

function MovePcHere({ seatId, workstations, canConfigure }: { seatId: string; workstations: RoomWorkstation[]; canConfigure: boolean }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  if (!canConfigure || workstations.length === 0) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("ws"));
    const ws = workstations.find((w) => w.id === id);
    if (!ws) return;
    const result = await run(() => api(`/workstations/${ws.id}/move`, { method: "POST", body: { expectedVersion: ws.version, seatId } }));
    if (result !== undefined) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <select name="ws" className="select select-sm flex-1" aria-label="Unplaced PC">
        {workstations.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-sm" disabled={pending}>
        Move here
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
