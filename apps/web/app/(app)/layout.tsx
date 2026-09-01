"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Compass, Briefcase, User, Bell } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Resume Analysis", href: "/resume", icon: FileText },
  { label: "Assessment", href: "/assessment", icon: Compass },
  { label: "Tracker", href: "/jobs", icon: Briefcase },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center">
      <header className="w-full max-w-5xl flex items-center justify-between py-3 px-4 md:px-0 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-base tracking-tight shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            ⚡
          </div>
          <span className="hidden sm:inline">Career Co-Pilot</span>
        </Link>

        <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/50">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <Link 
            href="/profile" 
            className={`h-8 w-8 rounded-full border border-border flex items-center justify-center transition-colors ${
              pathname === "/profile" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:opacity-90"
            }`}
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="w-full max-w-5xl p-4 md:p-8 flex-1">{children}</main>
    </div>
  );
}