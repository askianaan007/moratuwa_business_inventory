import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Badge, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { formatLKR } from "@/lib/format";
import type { CategorySummary, User } from "@/lib/types";
import { AddCategoryForm, CategoryAdminActions } from "./category-admin";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categories" subtitle="Each category has its own ledger" backHref="/ledger" />
      <Suspense fallback={<CardSkeleton rows={5} />}>
        <CategoryList />
      </Suspense>
    </>
  );
}

async function CategoryList() {
  const { data: me } = await apiGet<{ data: { user: User } }>("/auth/me");
  const isAdmin = me.user.role === "ADMIN";
  const { data: categories } = await apiGet<{ data: CategorySummary[] }>(
    `/categories${isAdmin ? "?includeInactive=true" : ""}`,
  );

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && <AddCategoryForm />}

      {categories.length === 0 ? (
        <EmptyState title="No categories yet">{isAdmin ? "Add the first one above." : "Ask an admin to add categories."}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className={`rounded-box border border-base-300 bg-base-100 ${category.isActive ? "" : "opacity-60"}`}
            >
              <Link href={`/ledger?categoryId=${category.id}`} className="flex items-center gap-3 p-4 active:bg-base-200">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {category.name}
                    <span className="font-mono text-xs text-base-content/50">{category.code}</span>
                    {!category.isActive && <Badge className="badge-ghost">Inactive</Badge>}
                  </p>
                  <p className="text-sm text-base-content/60">
                    {category.entries} entries · {category.receivedQuantity} received · {formatLKR(category.receivedValue)}
                  </p>
                  {category.description && <p className="mt-1 text-sm text-base-content/70">{category.description}</p>}
                </div>
                <ChevronRightIcon className="size-5 opacity-50" />
              </Link>
              {isAdmin && <CategoryAdminActions category={category} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
