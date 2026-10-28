"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { checkStatus, equipmentState, WALL_LABEL } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { EquipmentItem, EquipmentType, LabCheckStatus, RoomWorkstation, Wall } from "@/lib/types";

type Mode = "edit" | "replace" | "repair" | "return" | "retire" | "move" | "link" | "history" | null;

interface History {
  older: { id: string; code: string; serialNo: string | null; state: string; installedAt: string; retiredAt: string | null; retiredReason: string | null }[];
  newer: { id: string; code: string; serialNo: string | null; state: string; installedAt: string }[];
  checks: { id: string; status: LabCheckStatus; reasonText: string | null; faultReason: { label: string } | null; audit: { period: string; reference: string } }[];
  log: { id: string; action: string; at: string; actor: { name: string } | null }[];
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;

/** One item with its lifecycle actions: edit, replace, repair, retire, move, link a ledger tag, history. */
export function EquipmentEditor({ item, canEdit, workstations }: { item: EquipmentItem; canEdit: boolean; workstations: RoomWorkstation[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { pending, error, run } = useAction();

  async function submit(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    const result = await run(() => api<{ data: unknown; meta?: { warnings?: string[] } }>(path, { method, body: { expectedVersion: item.version, ...body } }));
    if (!result) return;
    setWarnings(result.meta?.warnings ?? []);
    setMode(null);
    router.refresh();
  }

  async function openHistory() {
    setMode(mode === "history" ? null : "history");
    if (!history) {
      const result = await run(() => api<{ data: History }>(`/equipment/${item.id}/history`));
      if (result) setHistory(result.data);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (mode === "edit") {
      const wall = text(form, "wall");
      void submit(
        `/equipment/${item.id}`,
        { code: text(form, "code") ?? undefined, brand: text(form, "brand"), modelNo: text(form, "modelNo"), serialNo: text(form, "serialNo"), notes: text(form, "notes"), ...(wall && { wall }) },
        "PATCH",
      );
    } else if (mode === "replace") {
      void submit(`/equipment/${item.id}/replace`, {
        reason: text(form, "reason"),
        oldState: form.get("oldState"),
        code: text(form, "code") ?? undefined,
        brand: text(form, "brand"),
        modelNo: text(form, "modelNo"),
        serialNo: text(form, "serialNo"),
      });
    } else if (mode === "repair" || mode === "retire") {
      void submit(`/equipment/${item.id}/${mode}`, { reason: text(form, "reason") });
    } else if (mode === "return") {
      void submit(`/equipment/${item.id}/return`, { reason: text(form, "reason") ?? undefined });
    } else if (mode === "move") {
      const target = text(form, "workstationId");
      void submit(`/equipment/${item.id}/move`, { workstationId: target, slot: Number(form.get("slot") ?? 1), reason: text(form, "reason") });
    } else if (mode === "link") {
      void linkTag(text(form, "tag"));
    }
  }

  async function linkTag(tag: string | null) {
    if (!tag) return;
    const found = await run(() => api<{ data: { id: string } }>(`/items/by-tag/${encodeURIComponent(tag.toUpperCase())}`));
    if (found) await submit(`/equipment/${item.id}/link-asset`, { assetItemId: found.data.id });
  }

  const actions: { mode: Exclude<Mode, null>; label: string; show: boolean }[] = [
    { mode: "edit", label: "Edit", show: canEdit },
    { mode: "replace", label: "Replace", show: canEdit },
    { mode: "repair", label: "Send to repair", show: canEdit && item.state === "IN_SERVICE" },
    { mode: "return", label: "Back from repair", show: canEdit && item.state === "AT_REPAIR" },
    { mode: "move", label: "Move", show: canEdit && item.type.scope !== "ROOM" },
    { mode: "link", label: item.assetItem ? "Change ledger tag" : "Link ledger tag", show: canEdit },
    { mode: "retire", label: "Retire", show: canEdit },
  ];

  return (
    <div className="rounded-box border border-base-300 bg-base-100">
      <div className="flex items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{item.code}</span>
            <span className="text-sm text-base-content/70">{item.type.name}</span>
            {item.state !== "IN_SERVICE" && <Badge className={equipmentState[item.state].className}>{equipmentState[item.state].label}</Badge>}
          </p>
          <p className="text-sm text-base-content/60">
            {[item.brand, item.modelNo, item.serialNo && `S/N ${item.serialNo}`].filter(Boolean).join(" · ") || "No serial recorded"}
          </p>
          {item.assetItem && <p className="font-mono text-xs text-base-content/60">Ledger tag {item.assetItem.tagCode}</p>}
          {!item.workstationId && item.wall && <p className="text-xs text-base-content/60">{WALL_LABEL[item.wall]}</p>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void openHistory()}>
          History
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="alert alert-warning alert-soft mx-3 mb-3 text-sm">
          <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-1 overflow-x-auto border-t border-base-200 px-2 py-2 [scrollbar-width:none]">
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <button
                key={a.mode}
                type="button"
                className={`btn btn-sm shrink-0 ${mode === a.mode ? "btn-secondary" : a.mode === "retire" ? "btn-ghost text-error" : "btn-ghost"}`}
                onClick={() => setMode(mode === a.mode ? null : a.mode)}
              >
                {a.label}
              </button>
            ))}
        </div>
      )}

      {error && <p className="px-3 pb-2 text-sm text-error">{error}</p>}

      {mode && mode !== "history" && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-base-200 p-3" noValidate>
          {(mode === "edit" || mode === "replace") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input name="code" defaultValue={item.code} aria-label="Code" placeholder="Code" className="input input-sm w-full font-mono uppercase" />
                <input name="serialNo" defaultValue={mode === "edit" ? (item.serialNo ?? "") : ""} aria-label="Serial number" placeholder="Serial number" className="input input-sm w-full" />
                <input name="brand" defaultValue={mode === "edit" ? (item.brand ?? "") : ""} aria-label="Brand" placeholder="Brand" className="input input-sm w-full" />
                <input name="modelNo" defaultValue={mode === "edit" ? (item.modelNo ?? "") : ""} aria-label="Model" placeholder="Model" className="input input-sm w-full" />
              </div>
              {mode === "edit" && !item.workstationId && (
                <select name="wall" defaultValue={item.wall ?? "FRONT"} aria-label="Wall" className="select select-sm w-full">
                  {(Object.keys(WALL_LABEL) as Wall[]).map((w) => (
                    <option key={w} value={w}>
                      {WALL_LABEL[w]}
                    </option>
                  ))}
                </select>
              )}
              {mode === "edit" && <textarea name="notes" defaultValue={item.notes ?? ""} placeholder="Notes" aria-label="Notes" className="textarea textarea-sm w-full" rows={2} />}
              {mode === "replace" && (
                <>
                  <select name="oldState" className="select select-sm w-full" aria-label="What happens to the old unit">
                    <option value="RETIRED">Old unit is written off (retired)</option>
                    <option value="AT_REPAIR">Old unit is at repair and may come back</option>
                  </select>
                  <p className="text-xs text-base-content/60">The new unit keeps the code above unless you change it. The old unit&apos;s history is kept.</p>
                </>
              )}
            </>
          )}
          {mode === "move" && (
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <select name="workstationId" className="select select-sm w-full" aria-label="Move to PC" defaultValue="">
                {item.type.scope !== "WORKSTATION" && <option value="">Not on a PC (room item)</option>}
                {workstations
                  .filter((w) => w.id !== item.workstationId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} · {w.positionCode ?? "not placed"}
                    </option>
                  ))}
              </select>
              <select name="slot" className="select select-sm" aria-label="Slot" defaultValue="1">
                <option value="1">Slot 1</option>
                <option value="2">Slot 2</option>
              </select>
            </div>
          )}
          {mode === "link" && <input name="tag" required placeholder="Ledger tag code, e.g. UOM-ELEC-2026-00012" aria-label="Ledger tag code" className="input input-sm w-full font-mono uppercase" />}
          {mode !== "edit" && mode !== "link" && (
            <input name="reason" required={mode !== "return"} placeholder={mode === "return" ? "Note (optional)" : "Reason (required)"} aria-label="Reason" className="input input-sm w-full" />
          )}
          <button type="submit" className={`btn btn-sm ${mode === "retire" ? "btn-error" : "btn-primary"}`} disabled={pending}>
            {pending && <span className="loading loading-spinner loading-xs" />}
            {mode === "retire" ? "Retire item" : "Save"}
          </button>
        </form>
      )}

      {mode === "history" && (
        <div className="border-t border-base-200 p-3 text-sm">
          {!history ? (
            <span className="loading loading-dots loading-sm" />
          ) : (
            <div className="flex flex-col gap-2">
              {history.older.length > 0 && (
                <div>
                  <p className="font-medium">Replaced units</p>
                  <ul className="text-base-content/70">
                    {history.older.map((o) => (
                      <li key={o.id}>
                        {o.code} {o.serialNo && `(S/N ${o.serialNo})`} · installed {formatDate(o.installedAt)}
                        {o.retiredAt && ` · retired ${formatDate(o.retiredAt)}: ${o.retiredReason ?? ""}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="font-medium">Audit results</p>
                {history.checks.length === 0 ? (
                  <p className="text-base-content/60">Not audited yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {history.checks.map((c) => (
                      <li key={c.id}>
                        <Badge className={checkStatus[c.status].badge}>
                          {c.audit.period.slice(0, 7)} {checkStatus[c.status].symbol} {checkStatus[c.status].label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium">Changes</p>
                <ul className="text-base-content/70">
                  {history.log.slice(0, 8).map((l) => (
                    <li key={l.id}>
                      {formatDate(l.at)} · {l.action.replace(/_/g, " ")} {l.actor && `by ${l.actor.name}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Add a PC part (to `workstationId`) or a room item (no workstation). */
export function AddEquipmentForm({
  roomId,
  workstationId,
  types,
  onDone,
}: {
  roomId: string;
  workstationId: string | null;
  types: EquipmentType[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const usable = types.filter((t) => t.isActive && (workstationId ? t.scope !== "ROOM" : t.scope !== "WORKSTATION"));
  const [typeId, setTypeId] = useState(usable[0]?.id ?? "");
  const type = usable.find((t) => t.id === typeId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run(() =>
      api(`/rooms/${roomId}/equipment`, {
        method: "POST",
        body: {
          typeId,
          workstationId,
          slot: Number(form.get("slot") ?? 1),
          code: text(form, "code") ?? undefined,
          serialNo: text(form, "serialNo"),
          brand: text(form, "brand"),
          ...(!workstationId && { wall: form.get("wall") }),
        },
      }),
    );
    if (result !== undefined) {
      router.refresh();
      onDone();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-box border-2 border-primary p-3" noValidate>
      <p className="font-semibold">{workstationId ? "Add item to this PC" : "Add room item"}</p>
      {error && <p className="text-sm text-error">{error}</p>}
      <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="select w-full" aria-label="Type">
        {usable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="code" placeholder="Code (auto)" aria-label="Code" className="input w-full font-mono uppercase" />
        <input name="serialNo" placeholder="Serial number" aria-label="Serial number" className="input w-full" />
        <input name="brand" placeholder="Brand" aria-label="Brand" className="input w-full" />
        {workstationId ? (
          <select name="slot" defaultValue={1} className="select w-full" aria-label="Slot">
            {Array.from({ length: type?.maxPerWorkstation ?? 1 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i === 0 ? "First" : `#${i + 1} (extra)`}
              </option>
            ))}
          </select>
        ) : (
          <select name="wall" defaultValue="FRONT" className="select w-full" aria-label="Wall">
            {(Object.keys(WALL_LABEL) as Wall[]).map((w) => (
              <option key={w} value={w}>
                {WALL_LABEL[w]}
              </option>
            ))}
          </select>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending || !typeId}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        Add
      </button>
    </form>
  );
}
