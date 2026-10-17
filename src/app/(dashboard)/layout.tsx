import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Logo } from "@/components/layout/logo";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface md:block">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Logo />
        </div>
        <DashboardNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
          <DashboardMobileNav />
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu email={session.user.email ?? ""} />
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}