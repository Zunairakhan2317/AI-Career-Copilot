"use client";

import Link from "next/link";
import { FileText, Compass, Briefcase, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      
      {/* Welcome Header & Readiness Metric */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
            — CAREER OVERVIEW
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, <span className="text-tertiary">Sarah</span>!
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Your career trajectory is looking strong. You have 3 pending tasks and an upcoming interview prep session.
          </p>
        </div>

        {/* Profile Readiness Badge */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 shadow-sm w-fit shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Profile Readiness
            </div>
            <div className="text-xl font-extrabold text-secondary">85%</div>
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
              <path
                className="text-secondary"
                strokeDasharray="85, 100"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Primary Hero Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Resume Analysis (Primary Accent) */}
        <Card className="md:col-span-2 bg-primary text-primary-foreground border-none rounded-3xl p-6 shadow-lg shadow-primary/10 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-2xl bg-black/10 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black/15 text-primary-foreground">
              ● Needs Update
            </span>
          </div>

          <div className="space-y-1 my-4">
            <h2 className="text-2xl font-bold">Resume Analysis</h2>
            <p className="text-xs opacity-90 max-w-sm">
              Upload your latest draft. Our AI will analyze keywords, format, and impact against your target roles.
            </p>
          </div>

          <div className="flex justify-end">
            <Link 
              href="/resume" 
              className="h-10 w-10 rounded-full bg-black/15 hover:bg-black/25 transition-colors flex items-center justify-center"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </Card>

        {/* Card 2: Career Assessment (Tertiary Accent) */}
        <Card className="bg-tertiary/20 border-tertiary/30 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="h-10 w-10 rounded-2xl bg-tertiary/20 flex items-center justify-center text-tertiary">
            <Compass className="h-5 w-5" />
          </div>

          <div className="space-y-1 my-4">
            <h2 className="text-xl font-bold text-foreground">Career Assessment</h2>
            <p className="text-xs text-muted-foreground">
              Discover your strengths and ideal career paths.
            </p>
          </div>

          <div className="flex justify-end">
            <Link 
              href="/assessment" 
              className="h-10 w-10 rounded-full bg-tertiary/20 hover:bg-tertiary/30 text-tertiary transition-colors flex items-center justify-center"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Secondary Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Job Tracker (Secondary Accent) */}
        <Card className="bg-secondary/20 border-secondary/30 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-foreground leading-tight">12</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-secondary">Active Apps</div>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Job Tracker</h3>
            <p className="text-xs text-muted-foreground">Manage your applications and upcoming interviews.</p>
          </div>
        </Card>

        {/* Upcoming Interview Card */}
        <Card className="bg-card border-border/80 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Upcoming Interview</h4>
              <p className="text-[11px] text-muted-foreground">Tomorrow, 10:00 AM</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-2xl p-2.5 space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground text-center">
              Product Designer @ TechCorp
            </div>
            <Button className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl">
              Start Prep Session
            </Button>
          </div>
        </Card>

        {/* Recent Activity Card */}
        <Card className="bg-card border-border/80 rounded-3xl p-5 flex flex-col justify-between min-h-[160px]">
          <h4 className="text-xs font-bold text-foreground">Recent Activity</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Updated Resume Draft v2</p>
                <p className="text-[10px] text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-secondary mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Completed Values Assessment</p>
                <p className="text-[10px] text-muted-foreground">Yesterday</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}