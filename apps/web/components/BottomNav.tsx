"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Compass, Briefcase, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Resume Analysis", href: "/resume", icon: FileText },
  { label: "Assessment", href: "/assessment", icon: Compass },
  { label: "Tracker", href: "/tracker", icon: Briefcase },
  { label: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur-xl border border-border/80 rounded-full px-3 py-2 shadow-xl flex items-center gap-1">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className={isActive ? "inline" : "hidden md:inline"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}