"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api-client";
import { TRANSFER_TYPES, type RoomRef, type TransferType } from "@/lib/inventory";
import { useAction } from "@/lib/use-action";

interface Picked {
  id: string;
  tagCode: string;
  locationId: string | null;
}

/** Room picker grouped by building, with a filter box for long lists. */
export function RoomSelect({ rooms, name, exclude, defaultValue, label }: { rooms: RoomRef[]; name: string; exclude?: string | null; defaultValue?: string; label: string }) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const map = new Map<string, RoomRef[]>();
    for (const r of rooms) {
      if (r.id === exclude) continue;
      if (f && !`${r.code} ${r.name} ${r.building ?? ""}`.toLowerCase().includes(f)) continue;
      const key = r.building ?? "No building";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [rooms, exclude, filter]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {rooms.length > 12 && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter rooms" aria-label="Filter rooms" className="input input-sm w-full" />
      )}
      <select name={name} required defaultValue={defaultValue ?? ""} className="select w-full">
        <option value="" disabled>
          Choose a room
        </option>
        {groups.map(([building, list]) => (
          <optgroup key={building} label={building}>
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * Transfer one or many items. The registered location only changes here,
 * with a reason; every move is kept in the item's history.
 */
export function TransferSheet({ open, onClose, items, rooms, onDone, defaultRoomId }: { open: boolean; onClose: () => void; items: Picked[]; rooms: RoomRef[]; onDone?: () => void; defaultRoomId?: string }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();
  const [result, setResult] = useState<{ moved: number; skipped: string[]; to: { code: string } } | null>(null);
  const sameRoom = items.length > 0 && items.every((i) => i.locationId === items[0]!.locationId) ? items[0]!.locationId : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await run(() =>
      api<{ data: { moved: number; skipped: string[]; to: { code: string } } }>("/inventory/transfers", {
        method: "POST",
        body: { ids: items.map((i) => i.id), toLocationId: form.get("toLocationId"), type: form.get("type"), reason: String(form.get("reason") ?? "").trim() },
      }),
    );
    if (res) {
      setResult(res.data);
      router.refresh();
    }
  }

  const close = () => {
    if (result) onDone?.();
    setResult(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={items.length === 1 ? `Transfer ${items[0]!.tagCode}` : `Transfer ${items.length} items`}
      subtitle="Moves the registered location and keeps the history"
      footer={
        result ? (
          <button type="button" className="btn btn-primary w-full" onClick={close}>
            Done
          </button>
        ) : (
          <button type="submit" form="transfer-form" className="btn btn-primary w-full" disabled={pending || items.length === 0}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            Transfer
          </button>
        )
      }
    >
      {result ? (
        <div className="animate-in flex flex-col gap-2 py-2 text-center">
          <p className="text-lg font-semibold">
            {result.moved} item{result.moved === 1 ? "" : "s"} moved to {result.to.code}
          </p>
          {result.skipped.length > 0 && <p className="text-sm text-base-content/70">Already there: {result.skipped.join(", ")}</p>}
        </div>
      ) : (
        <form id="transfer-form" onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {error}
            </div>
          )}
          {items.length > 1 && (
            <p className="max-h-20 overflow-y-auto font-mono text-xs text-base-content/60">{items.map((i) => i.tagCode).join(", ")}</p>
          )}
          <RoomSelect rooms={rooms} name="toLocationId" exclude={sameRoom} defaultValue={defaultRoomId} label="To room" />
          {fieldErrors.toLocationId && <p className="text-sm text-error">{fieldErrors.toLocationId}</p>}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Type</span>
            <select name="type" defaultValue="ROOM_TO_ROOM" className="select w-full">
              {(Object.keys(TRANSFER_TYPES) as TransferType[]).map((t) => (
                <option key={t} value={t}>
                  {TRANSFER_TYPES[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Reason</span>
            <textarea name="reason" required minLength={3} maxLength={500} rows={2} placeholder="e.g. Moved for exam setup, approved by HOD" className={`textarea w-full ${fieldErrors.reason ? "textarea-error" : ""}`} />
            {fieldErrors.reason && <span className="text-sm text-error">{fieldErrors.reason}</span>}
          </label>
        </form>
      )}
    </Sheet>
  );
}

/**
 * Asset finder: "I saw this item here". Records a physical sighting without
 * changing the registered room; a mismatch shows up under Findings.
 */
export function FindingSheet({ open, onClose, item, rooms }: { open: boolean; onClose: () => void; item: Picked; rooms: RoomRef[] }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [result, setResult] = useState<"FOUND" | "FOUND_ELSEWHERE" | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await run(() =>
      api<{ data: { result: "FOUND" | "FOUND_ELSEWHERE" } }>(`/inventory/assets/${item.id}/findings`, {
        method: "POST",
        body: { observedLocationId: form.get("observedLocationId"), note: String(form.get("note") ?? "").trim() || null },
      }),
    );
    if (res) {
      setResult(res.data.result);
      router.refresh();
    }
  }

  const close = () => {
    setResult(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={`Seen ${item.tagCode}`} subtitle="Record where the item physically is">
      {result ? (
        <div className="animate-in flex flex-col gap-3 py-2 text-center">
          <p className={`text-lg font-semibold ${result === "FOUND" ? "text-success" : "text-warning"}`}>
            {result === "FOUND" ? "Verified in its registered room" : "Recorded as found in another room"}
          </p>
          {result === "FOUND_ELSEWHERE" && (
            <p className="text-sm text-base-content/70">The registered room was not changed. Transfer the item if the move was authorised, or return it.</p>
          )}
          <button type="button" className="btn btn-primary" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {error && <div className="alert alert-error alert-soft text-sm">{error}</div>}
          <RoomSelect rooms={rooms} name="observedLocationId" defaultValue={item.locationId ?? ""} label="Seen in room" />
          <input name="note" maxLength={500} placeholder="Note (optional), e.g. on the lecturer's desk" aria-label="Note" className="input w-full" />
          <p className="text-xs text-base-content/60">Scanning a tag alone does not prove the item works. Update its condition separately.</p>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            Record sighting
          </button>
        </form>
      )}
    </Sheet>
  );
}
