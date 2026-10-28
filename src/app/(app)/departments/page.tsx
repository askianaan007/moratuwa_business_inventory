import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/api-server";
import type { DepartmentSummary, User } from "@/lib/types";
import { AddDepartmentForm, DepartmentAdminActions } from "./department-admin";

export const metadata: Metadata = { title: "Departments" };

export default function DepartmentsPage() {
  return (
    <>
      <PageHeader title="Departments" subtitle="Rooms, users and asset tags belong to a department" />
      <Suspense fallback={<CardSkeleton rows={4} />}>
        <DepartmentList />
      </Suspense>
    </>
  );
}

async function DepartmentList() {
  const [{ data: me }, { data: departments }] = await Promise.all([
    apiGet<{ data: { user: User } }>("/auth/me"),
    apiGet<{ data: DepartmentSummary[] }>("/departments"),
  ]);
  const isAdmin = me.user.role === "ADMIN";

  return (
    <div
      className={`flex flex-col gap-3 ${isAdmin ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6" : ""}`}
    >
      {isAdmin && (
        <div className="lg:sticky lg:top-8 lg:order-last">
          <AddDepartmentForm />
        </div>
      )}

      {departments.length === 0 ? (
        <EmptyState title="No departments yet">{isAdmin ? "Add the first one above." : "Ask an admin to add departments."}</EmptyState>
      ) : (
        <ul className="grid gap-2 lg:gap-3 xl:grid-cols-2">
          {departments.map((department) => (
            <li key={department.id} className="flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100">
              <div className="p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {department.name}
                  <span className="font-mono text-xs text-base-content/50">{department.code}</span>
                </p>
                <p className="text-sm text-base-content/60">
                  {department.locations} room{department.locations === 1 ? "" : "s"} · {department.users} user{department.users === 1 ? "" : "s"}
                </p>
              </div>
              {isAdmin && <DepartmentAdminActions department={department} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
