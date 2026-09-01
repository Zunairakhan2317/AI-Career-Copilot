"use client";

import Link from "next/link";
import { Bell, User } from "lucide-react";

export function Navbar() {
  return (
    <header className="w-full max-w-5xl flex items-center justify-between py-4 px-4 md:px-0 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
        <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
          ⚡
        </div>
        <span>Career Co-Pilot</span>
      </Link>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <Link href="/profile" className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden hover:opacity-90">
          <User className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>
    </header>
  );
}