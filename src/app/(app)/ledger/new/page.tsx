import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { ENTRY_TYPES } from "@/lib/format";
import type { CategorySummary, Department, Location } from "@/lib/types";
import { EntryForm } from "./entry-form";

export const metadata: Metadata = { title: "New entry" };

export default function NewEntryPage({ searchParams }: PageProps<"/ledger/new">) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="New ledger entry" subtitle="Same order as the ledger book" backHref="/ledger" />
      <Suspense fallback={<CardSkeleton rows={6} />}>
        <FormLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FormLoader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams;
  const [departments, locations, categories] = await Promise.all([
    apiGet<{ data: Department[] }>("/departments"),
    apiGet<{ data: Location[] }>("/locations"),
    apiGet<{ data: CategorySummary[] }>("/categories"),
  ]);

  // Opened from a category ledger or type filter: preselect them (otherwise the form uses the last entry's).
  const type = ENTRY_TYPES.find((t) => t === search.entryType);
  const categoryId = categories.data.find((c) => c.id === search.categoryId)?.id;

  return (
    <EntryForm
      departments={departments.data}
      locations={locations.data}
      categories={categories.data}
      initialType={type}
      initialCategoryId={categoryId}
    />
  );
}
