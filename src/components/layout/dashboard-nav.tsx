"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  ListTree,
  Dumbbell,
  RotateCcw,
  Map,
  FileText,
  Bot,
  Target,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, enabled: false },
  { href: "/topics", label: "Topics", icon: ListTree, enabled: false },
  { href: "/practice", label: "Practice", icon: Dumbbell, enabled: false },
  { href: "/revision", label: "Revision", icon: RotateCcw, enabled: true },
  { href: "/roadmap", label: "Roadmap", icon: Map, enabled: true },
  { href: "/reports", label: "Reports", icon: FileText, enabled: true },
  { href: "/mentor", label: "AI Mentor", icon: Bot, enabled: true },
  { href: "/interview", label: "Interview Prep", icon: Target, enabled: true },
  { href: "/profile", label: "Profile", icon: UserCircle, enabled: false },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        if (!item.enabled) {
          return (
            <div
              key={item.href}
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-foreground-muted/60"
              title="Coming in a later phase"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-subtle text-brand"
                : "text-foreground hover:bg-surface-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
