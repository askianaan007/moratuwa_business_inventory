import Link from "next/link";
import { Suspense } from "react";
import { BottomDock, DockLinks } from "@/components/bottom-dock";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { apiGet } from "@/lib/api-server";
import type { User } from "@/lib/types";

async function CurrentUser() {
  const { data } = await apiGet<{ data: { user: User } }>("/auth/me");
  return <UserMenu user={data.user} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="pb-dock min-h-dvh">
      <header className="navbar sticky top-0 z-30 gap-2 border-b border-base-300 bg-base-100/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link href="/" className="flex flex-1 items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">LabLedger</span>
        </Link>
        <ThemeToggle />
        <Suspense fallback={<div className="skeleton size-10 rounded-full" />}>
          <CurrentUser />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">{children}</main>

      <Suspense fallback={<DockLinks pathname={null} />}>
        <BottomDock />
      </Suspense>
    </div>
  );
}
