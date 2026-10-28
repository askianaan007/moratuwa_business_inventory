import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { Department, Location } from "@/lib/types";
import { EntryForm } from "./entry-form";

export const metadata: Metadata = { title: "New entry" };

export default function NewEntryPage() {
  return (
    <>
      <PageHeader title="New ledger entry" subtitle="Same order as the ledger book" backHref="/ledger" />
      <Suspense fallback={<CardSkeleton rows={6} />}>
        <FormLoader />
      </Suspense>
    </>
  );
}

async function FormLoader() {
  const [departments, locations] = await Promise.all([
    apiGet<{ data: Department[] }>("/departments"),
    apiGet<{ data: Location[] }>("/locations"),
  ]);
  return <EntryForm departments={departments.data} locations={locations.data} />;
}
