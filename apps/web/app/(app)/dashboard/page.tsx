"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, MessageSquare, Briefcase, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { resumeApi, roadmapApi } from "@/lib/api";
import { pageVariants, containerVariants, cardVariants, tapScale, hoverLift } from "@/lib/motion";

interface DashboardStats {
  resumeCount: number;
  hasRoadmap: boolean;
  lastResumeDate: string | null;
  readinessPct: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadStats() {
      try {
        // 1. Try to load resumes
        let resumeCount = 0;
        let lastResumeDate: string | null = null;
        try {
          const data = await resumeApi.getAll(user!.user_id);
          if (!cancelled) {
            resumeCount = data.resumes?.length ?? 0;
            lastResumeDate = data.resumes?.[0]?.created_at ?? null;
          }
        } catch {
          // Endpoint might fail (no resumes, etc.) — treat as zero
        }

        // 2. Try to load roadmap
        let hasRoadmap = false;
        try {
          const data = await roadmapApi.getByUser(user!.user_id);
          if (!cancelled) {
            hasRoadmap = Array.isArray(data.data) && data.data.length > 0;
          }
        } catch {
          // 444 / no roadmap — treat as no roadmap
        }

        // Simple readiness heuristic: resume (40%) + skills present (40%) + roadmap (20%)
        const readinessPct = Math.min(
          100,
          (resumeCount > 0 ? 40 : 0) + (resumeCount > 0 ? 40 : 0) + (hasRoadmap ? 20 : 0)
        );

        if (!cancelled) {
          setStats({ resumeCount, hasRoadmap, lastResumeDate, readinessPct });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const displayName = user.full_name || user.email.split("@")[0];
  const firstName = displayName.split(" ")[0];
  const needsResume = !stats || stats.resumeCount === 0;

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Welcome Header & Readiness Metric */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
            — CAREER OVERVIEW
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, <span className="text-tertiary">{firstName}</span>!
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            {needsResume
              ? "Get started by uploading your resume to unlock AI-powered career insights."
              : "Your career trajectory is looking strong. Keep building momentum."}
          </p>
        </div>

        {/* Profile Readiness Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
          className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 shadow-sm w-fit shrink-0"
        >
          <div className="text-right">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Profile Readiness
            </div>
            <div className="text-xl font-extrabold text-secondary">
              {isLoading ? "—" : `${stats?.readinessPct ?? 0}%`}
            </div>
          </div>
          <div className="relative h-10 w-10 flex items-center justify-center">
            <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-muted/40"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <motion.path
                className="text-secondary"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: (stats?.readinessPct ?? 0) / 100 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </motion.div>
      </section>

      {/* Primary Hero Action Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Card 1: Resume Analysis (Primary Accent) */}
        <motion.div variants={cardVariants} className="md:col-span-2">
          <Card className="h-full bg-primary text-primary-foreground border-none rounded-3xl p-6 shadow-lg shadow-primary/10 flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-2xl bg-black/10 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black/15 text-primary-foreground">
                {needsResume ? "● Get Started" : "● Up to Date"}
              </span>
            </div>

            <div className="space-y-1 my-4">
              <h2 className="text-2xl font-bold">Resume Analysis</h2>
              <p className="text-xs opacity-90 max-w-sm">
                {needsResume
                  ? "Upload your resume to unlock AI-powered keyword analysis and job matching."
                  : "Re-upload or compare your latest draft. Our AI analyzes keywords, format, and impact against your target roles."}
              </p>
            </div>

            <div className="flex justify-end">
              <motion.div whileHover={hoverLift} whileTap={tapScale}>
                <Link
                  href="/resume"
                  className="h-10 w-10 rounded-full bg-black/15 hover:bg-black/25 transition-colors flex items-center justify-center"
                >
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </motion.div>
            </div>
          </Card>
        </motion.div>

        {/* Card 2: Mock Interview (Tertiary Accent) */}
        <motion.div variants={cardVariants}>
          <Card className="h-full bg-tertiary/20 border-tertiary/30 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="h-10 w-10 rounded-2xl bg-tertiary/20 flex items-center justify-center text-tertiary">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div className="space-y-1 my-4">
              <h2 className="text-xl font-bold text-foreground">Mock Interview</h2>
              <p className="text-xs text-muted-foreground">
                Practice real interview questions and get instant AI feedback.
              </p>
            </div>

            <div className="flex justify-end">
              <motion.div whileHover={hoverLift} whileTap={tapScale}>
                <Link
                  href="/interview"
                  className="h-10 w-10 rounded-full bg-tertiary/20 hover:bg-tertiary/30 text-tertiary transition-colors flex items-center justify-center"
                >
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Secondary Information Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Resume Stat Card */}
        <motion.div variants={cardVariants} whileHover={hoverLift}>
          <Card className="h-full bg-secondary/20 border-secondary/30 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-foreground leading-tight">
                  {isLoading ? "—" : (stats?.resumeCount ?? 0)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-secondary">Resumes</div>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Resumes on File</h3>
              <p className="text-xs text-muted-foreground">
                {stats?.lastResumeDate
                  ? `Last updated ${new Date(stats.lastResumeDate).toLocaleDateString()}`
                  : "No resumes uploaded yet."}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Roadmap Quick Action */}
        <motion.div variants={cardVariants} whileHover={hoverLift}>
          <Card className="h-full bg-card border-border/80 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Skill Roadmap</h4>
                <p className="text-[11px] text-muted-foreground">
                  {stats?.hasRoadmap ? "Active" : "Not started"}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-2xl p-2.5 space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground text-center">
                {stats?.hasRoadmap
                  ? "Review your personalized learning path"
                  : "Generate a personalized learning path"}
              </div>
              <Link href="/roadmap" className="block">
                <Button className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl">
                  {stats?.hasRoadmap ? "View Roadmap" : "Build Roadmap"}
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>

        {/* Recent Activity Card */}
        <motion.div variants={cardVariants} whileHover={hoverLift}>
          <Card className="h-full bg-card border-border/80 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
            <h4 className="text-xs font-bold text-foreground">Recent Activity</h4>
            <div className="space-y-2 text-xs">
              {stats?.lastResumeDate ? (
                <div className="flex items-start gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Resume uploaded</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(stats.lastResumeDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-muted-foreground">No activity yet</p>
                    <p className="text-[10px] text-muted-foreground">Upload a resume to begin.</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Account created</p>
                  <p className="text-[10px] text-muted-foreground">Welcome to Career Co-Pilot!</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}