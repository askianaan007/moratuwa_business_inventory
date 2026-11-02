import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon, DownloadIcon } from "@/components/icons";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import { formatDate } from "@/lib/format";
import type { Department, SerialListSummary, User } from "@/lib/types";
import { NewSerialList } from "./new-list";

export const metadata: Metadata = { title: "Serial capture" };

export default function SerialListsPage() {
  return (
    <>
      <PageHeader title="Serial capture" subtitle="Scan product and serial numbers with a barcode reader, then download the list as a PDF" />
      <Suspense fallback={<CardSkeleton rows={4} />}>
        <Lists />
      </Suspense>
    </>
  );
}

async function Lists() {
  const [{ data: me }, { data: lists }] = await Promise.all([
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: SerialListSummary[] }>("/serial-lists"),
  ]);
  const canEdit = me.user.role !== "VIEWER";
  // Admins without a department pick one for the new list.
  const departments = canEdit && !me.user.departmentId ? (await apiGet<{ data: Department[] }>("/departments")).data : [];

  return (
    <div className={`flex flex-col gap-3 ${canEdit ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6" : ""}`}>
      {canEdit && (
        <div className="lg:sticky lg:top-8 lg:order-last">
          <NewSerialList departments={departments} />
        </div>
      )}

      {lists.length === 0 ? (
        <EmptyState title="No serial lists yet">
          {canEdit ? "Create one, e.g. “Lab 02 PCs”, then start scanning." : "Nothing has been captured yet."}
        </EmptyState>
      ) : (
        <ul className={`grid gap-2 lg:gap-3 ${canEdit ? "xl:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3"}`}>
          {lists.map((list) => (
            <li key={list.id} className="flex overflow-hidden rounded-box border border-base-300 bg-base-100">
              <Link href={`/serials/${list.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-4 hover:bg-base-200/50 active:bg-base-200">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{list.title}</p>
                  <p className="text-sm text-base-content/60">
                    {list.units} unit{list.units === 1 ? "" : "s"} · {list.parts} serial{list.parts === 1 ? "" : "s"}
                    {list.location && ` · ${list.location}`}
                  </p>
                  <p className="text-xs text-base-content/50">
                    Updated {formatDate(list.updatedAt)}
                    {list.createdBy && ` · by ${list.createdBy.name}`}
                  </p>
                </div>
                <ChevronRightIcon className="size-5 opacity-50" />
              </Link>
              <a
                href={`/api/v1/serial-lists/${list.id}/report.pdf`}
                download
                className="flex items-center border-l border-base-300 px-4 text-base-content/70 hover:bg-base-200/50 hover:text-base-content"
                aria-label={`Download ${list.title} as PDF`}
                title="Download PDF"
              >
                <DownloadIcon className="size-5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
