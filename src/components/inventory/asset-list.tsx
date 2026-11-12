"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowsIcon, PrinterIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { conditionBadge } from "@/lib/format";
import { bookRef, itemStatusBadge, qty, type InventoryAsset, type RoomRef } from "@/lib/inventory";
import { TransferSheet } from "./transfer-sheet";

/**
 * Assets as cards (phones) or a table (desktop). Editors can tick items to
 * transfer them together or print their QR labels.
 */
export function AssetList({ assets, rooms, canEdit, showRoom = true }: { assets: InventoryAsset[]; rooms: RoomRef[]; canEdit: boolean; showRoom?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);
  const picked = assets.filter((a) => selected.has(a.id));
  const selectable = assets.filter((a) => a.status !== "DISPOSED");
  const allOn = selectable.length > 0 && selectable.every((a) => selected.has(a.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const check = (a: InventoryAsset) =>
    canEdit && a.status !== "DISPOSED" ? (
      <input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.tagCode}`} />
    ) : (
      <span className="inline-block size-5" aria-hidden />
    );

  return (
    <>
      <ul className="flex flex-col gap-2 lg:hidden">
        {assets.map((a) => (
          <li key={a.id} className={`flex items-stretch gap-2 rounded-box border bg-base-100 transition-colors ${selected.has(a.id) ? "border-primary" : "border-base-300"}`}>
            {canEdit && <label className="flex items-center pl-3">{check(a)}</label>}
            <Link href={`/inventory/assets/${a.id}`} className={`min-w-0 flex-1 py-3 pr-3 active:bg-base-200 ${canEdit ? "" : "pl-3"}`}>
              <p className="flex items-start gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{a.ledgerEntry.description}</span>
                {a.isBulk && <Badge className="badge-outline">× {qty(a)}</Badge>}
              </p>
              <p className="font-mono text-xs text-base-content/60">{a.tagCode}</p>
              <p className="mt-1 truncate text-sm text-base-content/70">
                {[showRoom && (a.location ? a.location.code : "No room"), a.serialNo && `S/N ${a.serialNo}`, a.equipment[0]?.code].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge className={conditionBadge[a.condition].className}>{conditionBadge[a.condition].label}</Badge>
                {a.status !== "IN_USE" && <Badge className={itemStatusBadge[a.status].className}>{itemStatusBadge[a.status].label}</Badge>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
        <table className="table">
          <thead>
            <tr>
              {canEdit && (
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allOn}
                    onChange={() => setSelected(allOn ? new Set() : new Set(selectable.map((a) => a.id)))}
                    aria-label="Select all on this page"
                  />
                </th>
              )}
              <th>Tag</th>
              <th>Description</th>
              <th>Category</th>
              <th>Serial</th>
              {showRoom && <th>Room</th>}
              <th>Book ref.</th>
              <th>Condition</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className={`hover:bg-base-200/50 ${selected.has(a.id) ? "bg-primary/5" : ""}`}>
                {canEdit && <td>{check(a)}</td>}
                <td className="font-mono text-xs whitespace-nowrap">
                  <Link href={`/inventory/assets/${a.id}`} className="link link-hover">
                    {a.tagCode}
                  </Link>
                </td>
                <td>
                  <Link href={`/inventory/assets/${a.id}`} className="font-medium hover:underline">
                    {a.ledgerEntry.description}
                  </Link>
                  <span className="block text-xs text-base-content/60">
                    {[a.ledgerEntry.brand, a.ledgerEntry.modelNo].filter(Boolean).join(" · ")}
                    {a.isBulk && ` · quantity ${qty(a)}`}
                    {a.equipment[0] && ` · fitted as ${a.equipment[0].code}`}
                  </span>
                </td>
                <td className="text-sm">{a.ledgerEntry.category?.name ?? "—"}</td>
                <td className="text-sm">{a.serialNo ?? "—"}</td>
                {showRoom && (
                  <td className="text-sm whitespace-nowrap">
                    {a.location ? (
                      <Link href={`/inventory/rooms/${a.location.id}`} className="link link-hover">
                        {a.location.code}
                      </Link>
                    ) : (
                      <span className="text-warning">No room</span>
                    )}
                  </td>
                )}
                <td className="text-sm whitespace-nowrap">{bookRef(a.ledgerEntry) ?? <span className="text-base-content/40">—</span>}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge className={conditionBadge[a.condition].className}>{conditionBadge[a.condition].label}</Badge>
                    {a.status !== "IN_USE" && <Badge className={itemStatusBadge[a.status].className}>{itemStatusBadge[a.status].label}</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {picked.length > 0 && (
        <div className="animate-in sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-3 flex items-center gap-2 rounded-box border border-primary bg-base-100 p-2 shadow-lg lg:bottom-4">
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <XIcon className="size-4" />
          </button>
          <span className="flex-1 text-sm font-medium">{picked.length} selected</span>
          <a href={`/api/v1/inventory/labels.pdf?ids=${picked.map((p) => p.id).join(",")}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline">
            <PrinterIcon className="size-4" />
            <span className="hidden sm:inline">Labels</span>
          </a>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setTransferring(true)}>
            <ArrowsIcon className="size-4" />
            Transfer
          </button>
        </div>
      )}

      <TransferSheet
        open={transferring}
        onClose={() => setTransferring(false)}
        items={picked.map((p) => ({ id: p.id, tagCode: p.tagCode, locationId: p.location?.id ?? null }))}
        rooms={rooms}
        onDone={() => setSelected(new Set())}
      />
    </>
  );
}
