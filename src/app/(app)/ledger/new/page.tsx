import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { ENTRY_TYPES } from "@/lib/format";
import type { CategorySummary, Department, LedgerEntryType, Location } from "@/lib/types";
import { EntryForm } from "./entry-form";

export const metadata: Metadata = { title: "New entry" };

export default function NewEntryPage({ searchParams }: PageProps<"/ledger/new">) {
  return (
    <>
      <PageHeader title="New ledger entry" subtitle="Same order as the ledger book" backHref="/ledger" />
      <Suspense fallback={<CardSkeleton rows={6} />}>
        <FormLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function FormLoader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams;
  const [departments, locations, categories] = await Promise.all([
    apiGet<{ data: Department[] }>("/departments"),
    apiGet<{ data: Location[] }>("/locations"),
    apiGet<{ data: CategorySummary[] }>("/categories"),
  ]);

  // Opened from a category ledger or type filter: preselect them.
  const type = ENTRY_TYPES.find((t) => t === search.entryType) ?? "RECEIPT";
  const categoryId = categories.data.some((c) => c.id === search.categoryId) ? (search.categoryId as string) : "";

  return (
    <EntryForm
      departments={departments.data}
      locations={locations.data}
      categories={categories.data}
      initialType={type as LedgerEntryType}
      initialCategoryId={categoryId}
    />
  );
}
