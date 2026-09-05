"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, FileText, Briefcase, User, Bell, LogOut, Map, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tapScale, hoverScale } from "@/lib/motion";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Resume Analysis", href: "/resume", icon: FileText },
  { label: "Roadmap", href: "/roadmap", icon: Map },
  { label: "Interview", href: "/interview", icon: MessageSquare },
  { label: "Tracker", href: "/jobs", icon: Briefcase },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isHydrated, logout } = useAuth();

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace("/login");
    }
  }, [user, isHydrated, router]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.full_name || user.email.split("@")[0];
  const firstName = displayName.split(" ")[0];

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center">
      <header className="w-full max-w-5xl flex items-center justify-between py-3 px-4 md:px-0 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <motion.div whileHover={{ rotate: 8 }} whileTap={tapScale} className="shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-base tracking-tight">
            <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              ⚡
            </div>
            <span className="hidden sm:inline">Career Co-Pilot</span>
          </Link>
        </motion.div>

        <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/50 relative">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            whileHover={hoverScale}
            whileTap={tapScale}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="h-4 w-4" />
          </motion.button>
          <motion.div whileHover={hoverScale} whileTap={tapScale}>
            <Link
              href="/profile"
              className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                pathname === "/profile"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:opacity-90"
              }`}
              title={displayName}
            >
              <User className="h-4 w-4" />
            </Link>
          </motion.div>
          <motion.button
            whileHover={hoverScale}
            whileTap={tapScale}
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </motion.button>
        </div>
      </header>

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-5xl p-4 md:p-8 flex-1"
      >
        {children}
      </motion.main>
    </div>
  );
}