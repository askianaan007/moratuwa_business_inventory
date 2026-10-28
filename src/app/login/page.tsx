import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex justify-end p-3">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="size-16" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">LabLedger</h1>
            <p className="text-base-content/70">Inventory ledger &amp; audit</p>
          </div>
        </div>
        <div className="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <Suspense fallback={<div className="skeleton h-56 w-full" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
