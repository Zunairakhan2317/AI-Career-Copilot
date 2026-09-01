"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileText, 
  Compass, 
  Sparkles, 
  Map, 
  MessageSquare, 
  Briefcase, 
  User 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Resume Analysis", href: "/resume", icon: FileText },
  { name: "Career Assessment", href: "/assessment", icon: Compass },
  { name: "ATS Tailor", href: "/resume/tailor", icon: Sparkles },
  { name: "Skill Roadmap", href: "/roadmap", icon: Map },
  { name: "Mock Interview", href: "/interview", icon: MessageSquare },
  { name: "Job Tracker", href: "/jobs", icon: Briefcase },
  { name: "Profile", href: "/profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex flex-col min-h-screen border-r border-border/10">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center font-bold text-white">
          AI
        </div>
        <div>
          <h2 className="font-bold text-sm leading-none">Career Co-Pilot</h2>
          <span className="text-[10px] text-muted-foreground">Version 1.0</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "text-slate-300 hover:bg-[hsl(var(--sidebar-hover))] hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}