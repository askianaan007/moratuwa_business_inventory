import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Stock check" };

export default function StockCheckPage() {
  return (
    <ComingSoon
      title="Stock verification"
      phase="Phase 2 · yearly Board of Survey"
      features={[
        "Start an audit session for one or more labs",
        "See the items expected at each location",
        "Scan QR tags to tick items off",
        "Flag missing, misplaced, damaged and unregistered items",
        "Board of Survey report when the session is closed",
      ]}
    />
  );
}
