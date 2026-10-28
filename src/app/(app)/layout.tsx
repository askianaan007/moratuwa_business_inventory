import Link from "next/link";
import { cache, Suspense } from "react";
import { BottomDock, DockLinks } from "@/components/bottom-dock";
import { Logo } from "@/components/logo";
import { SideNav, SideNavLinks, SideSearch } from "@/components/side-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { apiGet } from "@/lib/api-server";
import type { User } from "@/lib/types";

// The header (phones) and sidebar (desktop) both show the user; fetch once per request.
const getMe = cache(() => apiGet<{ data: { user: User } }>("/auth/me"));

async function CurrentUser({ expanded }: { expanded?: boolean }) {
  const { data } = await getMe();
  return <UserMenu user={data.user} expanded={expanded} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="pb-dock min-h-dvh lg:pl-64">
      <a href="#main" className="btn btn-primary btn-sm fixed top-2 left-2 z-50 -translate-y-20 focus:translate-y-0">
        Skip to content
      </a>

      {/* Desktop: fixed sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-5 border-r border-base-300 bg-base-100 px-3 py-4 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">LabLedger</span>
        </Link>
        <Suspense fallback={<div className="skeleton h-8 w-full" />}>
          <SideSearch />
        </Suspense>
        <div className="-mx-3 flex-1 overflow-y-auto px-3">
          <Suspense fallback={<SideNavLinks pathname={null} />}>
            <SideNav />
          </Suspense>
        </div>
        <div className="flex items-center gap-1 border-t border-base-300 pt-3">
          <div className="min-w-0 flex-1">
            <Suspense fallback={<div className="skeleton h-12 w-full" />}>
              <CurrentUser expanded />
            </Suspense>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Phones and tablets: top bar + bottom dock. */}
      <header className="navbar sticky top-0 z-30 gap-2 border-b border-base-300 bg-base-100/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Link href="/" className="flex flex-1 items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">LabLedger</span>
        </Link>
        <ThemeToggle />
        <Suspense fallback={<div className="skeleton size-10 rounded-full" />}>
          <CurrentUser />
        </Suspense>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-4 lg:max-w-7xl lg:px-8 lg:py-8">
        {children}
      </main>

      <Suspense fallback={<DockLinks pathname={null} />}>
        <BottomDock />
      </Suspense>
    </div>
  );
}
