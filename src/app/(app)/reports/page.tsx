import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      phase="Phase 1 · week 4"
      features={[
        "Ledger report in the exact book columns (Excel & PDF)",
        "Pending book entries — print and copy into the book",
        "Location inventory and category summary",
        "Missing & damaged items",
        "QR tag sticker sheets (A4)",
      ]}
    />
  );
}
