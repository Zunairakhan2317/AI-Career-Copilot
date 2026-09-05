"use client";

import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";
import { pageVariants } from "@/lib/motion";

export default function JobsPage() {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
          — JOB TRACKER
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Track your <span className="text-tertiary">opportunities</span>
        </h1>
      </div>

      <Card className="rounded-3xl p-10 text-center space-y-4 bg-card border-border/60 animate-gradient-shift overflow-hidden relative">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-tertiary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary mx-auto mb-3">
            <Briefcase className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Job tracking is on the way. Soon you&apos;ll be able to manage applications, track interview progress, and get reminders for important deadlines.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
