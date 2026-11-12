"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowsIcon, CheckIcon, PencilIcon, PrinterIcon } from "@/components/icons";
import { FindingSheet, TransferSheet } from "@/components/inventory/transfer-sheet";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api-client";
import { conditionBadge } from "@/lib/format";
import { itemStatusBadge, type InventoryAssetDetail, type RoomRef } from "@/lib/inventory";
import { useAction } from "@/lib/use-action";
import type { ItemCondition, ItemStatus, Role } from "@/lib/types";

type Panel = "edit" | "transfer" | "seen" | "dispose" | "delete" | null;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;

/** Everything an authorised user can do to one asset. */
export function AssetActions({ asset, rooms, role }: { asset: InventoryAssetDetail; rooms: RoomRef[]; role: Role }) {
  const [panel, setPanel] = useState<Panel>(null);
  const canEdit = role !== "VIEWER";
  const canDispose = role === "ADMIN" || role === "HOD";
  const disposed = asset.status === "DISPOSED";
  const picked = { id: asset.id, tagCode: asset.tagCode, locationId: asset.location?.id ?? null };
  const close = () => setPanel(null);

  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {canEdit && !disposed && (
          <>
            <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => setPanel("transfer")}>
              <ArrowsIcon className="size-4" /> Transfer
            </button>
            <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setPanel("edit")}>
              <PencilIcon className="size-4" /> Edit
            </button>
            <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setPanel("seen")}>
              <CheckIcon className="size-4" /> Seen it
            </button>
          </>
        )}
        <a href={`/api/v1/inventory/labels.pdf?ids=${asset.id}&size=large`} target="_blank" rel="noopener" className="btn btn-outline btn-sm shrink-0">
          <PrinterIcon className="size-4" /> QR label
        </a>
        {canDispose && !disposed && (
          <button type="button" className="btn btn-ghost btn-sm shrink-0 text-error" onClick={() => setPanel("dispose")}>
            Dispose
          </button>
        )}
        {role === "ADMIN" && (
          <button type="button" className="btn btn-ghost btn-sm shrink-0 text-error" onClick={() => setPanel("delete")}>
            Delete
          </button>
        )}
      </div>

      <EditSheet asset={asset} open={panel === "edit"} onClose={close} />
      <TransferSheet open={panel === "transfer"} onClose={close} items={[picked]} rooms={rooms} />
      <FindingSheet open={panel === "seen"} onClose={close} item={picked} rooms={rooms} />
      <DisposeSheet asset={asset} open={panel === "dispose"} onClose={close} />
      <DeleteSheet asset={asset} open={panel === "delete"} onClose={close} />
    </>
  );
}

function EditSheet({ asset, open, onClose }: { asset: InventoryAssetDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await run(() =>
      api(`/inventory/assets/${asset.id}`, {
        method: "PATCH",
        body: {
          expectedUpdatedAt: asset.updatedAt,
          ...(!asset.isBulk && { serialNo: text(form, "serialNo") }),
          ...(asset.isBulk && { bulkQty: Number(form.get("bulkQty")) }),
          custodian: text(form, "custodian"),
          condition: form.get("condition"),
          status: form.get("status"),
          note: text(form, "note"),
        },
      }),
    );
    if (res) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit asset"
      subtitle={asset.tagCode}
      footer={
        <button type="submit" form="asset-edit" className="btn btn-primary w-full" disabled={pending}>
          {pending && <span className="loading loading-spinner loading-sm" />}
          Save changes
        </button>
      }
    >
      <form id="asset-edit" onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {error && <div className="alert alert-error alert-soft text-sm">{error}</div>}
        {asset.isBulk ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Quantity counted</span>
            <input name="bulkQty" type="number" inputMode="numeric" min={1} max={100000} required defaultValue={asset.bulkQty ?? 1} className={`input w-full ${fieldErrors.bulkQty ? "input-error" : ""}`} />
            {fieldErrors.bulkQty && <span className="text-sm text-error">{fieldErrors.bulkQty}</span>}
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Manufacturer serial number</span>
            <input name="serialNo" defaultValue={asset.serialNo ?? ""} maxLength={120} placeholder="Leave blank if none (e.g. chairs)" className="input w-full" />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Custodian</span>
          <input name="custodian" defaultValue={asset.custodian ?? ""} maxLength={120} placeholder="Person responsible" className="input w-full" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Condition</span>
            <select name="condition" defaultValue={asset.condition} className="select w-full">
              {(Object.keys(conditionBadge) as ItemCondition[]).map((c) => (
                <option key={c} value={c}>
                  {conditionBadge[c].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Status</span>
            <select name="status" defaultValue={asset.status} className="select w-full">
              {(Object.keys(itemStatusBadge) as ItemStatus[])
                .filter((s) => s !== "DISPOSED")
                .map((s) => (
                  <option key={s} value={s}>
                    {itemStatusBadge[s].label}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Note for the history (optional)</span>
          <input name="note" maxLength={500} placeholder="e.g. Screen crack noticed during audit" className="input w-full" />
        </label>
        <p className="text-xs text-base-content/60">To change the room, use Transfer. Book details (description, price, page) are edited on the ledger entry.</p>
      </form>
    </Sheet>
  );
}

function DisposeSheet({ asset, open, onClose }: { asset: InventoryAssetDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await run(() =>
      api(`/inventory/assets/${asset.id}/dispose`, { method: "POST", body: { expectedUpdatedAt: asset.updatedAt, reason: text(form, "reason") ?? "", boardRef: text(form, "boardRef") } }),
    );
    if (res) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Dispose asset" subtitle={asset.tagCode}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <p className="text-sm text-base-content/70">The item stays searchable with its full history. Record the disposal in the handwritten register as well.</p>
        {error && <div className="alert alert-error alert-soft text-sm">{error}</div>}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Reason</span>
          <textarea name="reason" required minLength={3} maxLength={500} rows={2} className={`textarea w-full ${fieldErrors.reason ? "textarea-error" : ""}`} />
          {fieldErrors.reason && <span className="text-sm text-error">{fieldErrors.reason}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Board of Survey / authorisation ref. (optional)</span>
          <input name="boardRef" maxLength={80} className="input w-full" />
        </label>
        <button type="submit" className="btn btn-error" disabled={pending}>
          {pending && <span className="loading loading-spinner loading-sm" />}
          Dispose {asset.tagCode}
        </button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ asset, open, onClose }: { asset: InventoryAssetDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, fieldErrors, run } = useAction();
  const [confirm, setConfirm] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await run(async () => {
      await api(`/inventory/assets/${asset.id}`, { method: "DELETE", body: { reason: text(new FormData(event.currentTarget), "reason") ?? "" } });
      return true;
    });
    if (res) {
      onClose();
      router.replace("/inventory/assets");
      router.refresh();
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Delete record" subtitle={asset.tagCode}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <p className="text-sm text-base-content/70">
          Only for records created by mistake. Items with transfers, audits, lab use or an approved book entry cannot be deleted. Dispose them instead.
        </p>
        {error && <div className="alert alert-error alert-soft text-sm">{error}</div>}
        <input name="reason" required minLength={3} maxLength={500} placeholder="Why is this record wrong?" aria-label="Reason" className={`input w-full ${fieldErrors.reason ? "input-error" : ""}`} />
        <label className="flex flex-col gap-1 text-sm">
          Type <b className="font-mono">{asset.tagCode}</b> to confirm
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="input w-full font-mono" aria-label="Confirm tag" />
        </label>
        <button type="submit" className="btn btn-error" disabled={pending || confirm.trim().toUpperCase() !== asset.tagCode}>
          {pending && <span className="loading loading-spinner loading-sm" />}
          Delete permanently
        </button>
      </form>
    </Sheet>
  );
}
