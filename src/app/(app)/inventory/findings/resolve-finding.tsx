"use client";

import { useState } from "react";
import { FindingSheet, TransferSheet } from "@/components/inventory/transfer-sheet";
import type { Finding, RoomRef } from "@/lib/inventory";

/** The two honest ways to close a mismatch: transfer it, or confirm it is back in its room. */
export function ResolveFinding({ finding, rooms }: { finding: Finding; rooms: RoomRef[] }) {
  const [panel, setPanel] = useState<"transfer" | "confirm" | null>(null);
  const item = { id: finding.asset.id, tagCode: finding.asset.tagCode, locationId: finding.asset.location?.id ?? null };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setPanel("transfer")}>
        Transfer to {finding.observedLocation?.code}
      </button>
      {finding.asset.location && (
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setPanel("confirm")}>
          Back in {finding.asset.location.code}
        </button>
      )}
      <TransferSheet open={panel === "transfer"} onClose={() => setPanel(null)} items={[item]} rooms={rooms} defaultRoomId={finding.observedLocation?.id} />
      <FindingSheet open={panel === "confirm"} onClose={() => setPanel(null)} item={item} rooms={rooms} />
    </div>
  );
}
