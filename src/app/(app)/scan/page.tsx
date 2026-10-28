import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ScanForm } from "./scan-form";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Find an item" subtitle="Enter the tag code printed on the QR label" />
      <ScanForm />
      <div className="mt-6 rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
        <p className="font-semibold text-base-content">Camera scanning — coming next</p>
        <p className="mt-1">
          The QR camera scanner is planned for Phase 1, week 3. Until then, type the tag code or a serial number here.
        </p>
      </div>
    </div>
  );
}
