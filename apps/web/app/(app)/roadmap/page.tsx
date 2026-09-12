"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Map,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  BookOpen,
  Rocket,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { roadmapApi } from "@/lib/api";
import { pageVariants, containerVariants, cardVariants, hoverLift, tapScale, fadeInVariants, heightAutoVariants } from "@/lib/motion";

// ---------------------------------------------------------------------------
// Types — mirror backend roadmap_data jsonb shape
// ---------------------------------------------------------------------------

interface Milestone {
  milestone: string;
  target_timeline?: string;
  topics?: string[];
  resource_links?: string[];
}

interface RoadmapData {
  missing_skills?: string[];
  roadmap?: Milestone[];
  completed_milestones?: number[];
  raw_output?: string;
}

interface RoadmapRecord {
  id: string;
  user_id: string;
  target_role: string;
  roadmap_data: RoadmapData;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeReadinessPct(roadmap: RoadmapData): number {
  const total = roadmap.roadmap?.length ?? 0;
  if (total === 0) return 0;
  const done = (roadmap.completed_milestones ?? []).length;
  return Math.round((done / total) * 100);
}

function computeReadinessColor(pct: number) {
  if (pct >= 75) return "text-secondary";
  if (pct >= 40) return "text-primary";
  return "text-tertiary";
}

function computeReadinessStroke(pct: number) {
  if (pct >= 75) return "stroke-secondary";
  if (pct >= 40) return "stroke-primary";
  return "stroke-tertiary";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RoadmapPage() {
  const { user } = useAuth();

  // Existing roadmaps for this user
  const [roadmaps, setRoadmaps] = useState<RoadmapRecord[]>([]);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapRecord | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingActive, setIsLoadingActive] = useState(false);

  // Generation
  const [targetRole, setTargetRole] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Expanded milestone
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);

  // Toggling milestone completion
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Load list of roadmaps on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await roadmapApi.getByUser(user!.user_id);
        const list = (res.data as RoadmapRecord[]) ?? [];
        if (!cancelled) {
          setRoadmaps(list);
          // Auto-select the most recent
          if (list.length > 0) {
            setActiveRoadmapId(list[0].id);
          }
        }
      } catch {
        if (!cancelled) setRoadmaps([]);
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // -------------------------------------------------------------------------
  // Load active roadmap details
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user || !activeRoadmapId) return;
    let cancelled = false;
    async function load() {
      setIsLoadingActive(true);
      try {
        const res = await roadmapApi.getById(user!.user_id, activeRoadmapId!);
        if (!cancelled) {
          setActiveRoadmap(res.data as RoadmapRecord);
        }
      } catch {
        if (!cancelled) setActiveRoadmap(null);
      } finally {
        if (!cancelled) setIsLoadingActive(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, activeRoadmapId]);

  // -------------------------------------------------------------------------
  // Generate a new roadmap
  // -------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!user) return;
    const role = targetRole.trim();
    if (!role) {
      setError("Please enter a target role.");
      return;
    }
    setIsGenerating(true);
    setError("");
    try {
      const res = await roadmapApi.generate(user.user_id, role);
      const list = (res.data as RoadmapRecord[]) ?? [];
      // Refresh list and select new one
      const refreshed = await roadmapApi.getByUser(user.user_id);
      const refreshedList = (refreshed.data as RoadmapRecord[]) ?? [];
      setRoadmaps(refreshedList);
      // Find the newly created one (most recent matching target_role)
      const created = refreshedList.find(
        (r) => r.target_role === role && r.id === list[0]?.id
      ) ?? refreshedList[0];
      if (created) {
        setActiveRoadmapId(created.id);
        setActiveRoadmap(created);
      }
      setTargetRole("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate roadmap.");
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Toggle milestone completion
  // -------------------------------------------------------------------------
  const toggleMilestone = async (idx: number) => {
    if (!activeRoadmap) return;
    const current = activeRoadmap.roadmap_data.completed_milestones ?? [];
    const isDone = current.includes(idx);
    const next = isDone ? current.filter((i) => i !== idx) : [...current, idx];

    // Optimistic update
    setActiveRoadmap({
      ...activeRoadmap,
      roadmap_data: {
        ...activeRoadmap.roadmap_data,
        completed_milestones: next,
      },
    });
    setTogglingIndex(idx);

    try {
      await roadmapApi.updateCompletedMilestones(activeRoadmap.id, next);
    } catch (err: unknown) {
      // Revert on failure
      setActiveRoadmap({
        ...activeRoadmap,
        roadmap_data: {
          ...activeRoadmap.roadmap_data,
          completed_milestones: current,
        },
      });
      setError(err instanceof Error ? err.message : "Failed to update milestone.");
    } finally {
      setTogglingIndex(null);
    }
  };

  if (!user) return null;

  const roadmapData = activeRoadmap?.roadmap_data;
  const milestones = roadmapData?.roadmap ?? [];
  const missingSkills = roadmapData?.missing_skills ?? [];
  const completed = roadmapData?.completed_milestones ?? [];
  const readinessPct = computeReadinessPct(roadmapData ?? {});

  // Stat cards
  const completedTopics = milestones.reduce(
    (sum, m) => sum + (m.topics?.length ?? 0) * (completed.includes(milestones.indexOf(m)) ? 1 : 0),
    0
  );
  const totalTopics = milestones.reduce(
    (sum, m) => sum + (m.topics?.length ?? 0),
    0
  );
  const remainingMilestones = milestones.length - completed.length;

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
          — LEARNING ROADMAP
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Bridge the gap to your <span className="text-tertiary">next dream role</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg">
          Ladder a target role to generate a personalized AI roadmap. Check off milestones as you progress.
        </p>
      </div>

      {/* Generate / Target Role Card */}
      <Card className="bg-card border-border/60 rounded-3xl p-5">
        <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-tertiary" />
          {activeRoadmap ? "Generate Another Roadmap" : "Create Your Roadmap"}
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Data Scientist, Full Stack Engineer, Product Manager"
            className="h-11 bg-muted/50 border-border rounded-xl text-sm flex-1"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGenerate();
            }}
          />
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-11 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
      </Card>

      {/* Loading state */}
      {(isLoadingList || isLoadingActive) && !activeRoadmap && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading your roadmap…
        </div>
      )}

      {/* No roadmap yet */}
      {!isLoadingList && !isLoadingActive && roadmaps.length === 0 && (
        <Card className="bg-card border-border/60 rounded-3xl p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-tertiary/15 flex items-center justify-center text-tertiary mx-auto mb-3">
            <Map className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-base mb-1">No roadmap yet</h3>
          <p className="text-sm text-muted-foreground">
            Enter a target role above to generate your personalized learning path.
          </p>
        </Card>
      )}

      {/* Active roadmap display */}
      {activeRoadmap && (
        <>
          {/* Candidate Profile Card + Readiness Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="md:col-span-2 bg-card border-border/60 rounded-3xl p-6 flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Candidate
                </p>
                <h2 className="text-xl font-bold text-foreground">
                  {user.full_name || user.email.split("@")[0]}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-semibold text-tertiary">{activeRoadmap.target_role}</span>
                </p>
              </div>
              {roadmaps.length > 1 && (
                <div className="ml-auto">
                  <select
                    className="text-xs bg-muted/50 border border-border rounded-lg px-2 py-1 text-foreground"
                    value={activeRoadmapId ?? ""}
                    onChange={(e) => setActiveRoadmapId(e.target.value)}
                  >
                    {roadmaps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.target_role} — {new Date(r.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Card>

            {/* Readiness Score Ring */}
            <Card className="bg-card border-border/60 rounded-3xl p-6 flex flex-col items-center justify-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Readiness Score
              </p>
              <div className="relative h-24 w-24 flex items-center justify-center">
                <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-muted/30"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={computeReadinessStroke(readinessPct)}
                    strokeDasharray={`${readinessPct}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black ${computeReadinessColor(readinessPct)}`}>
                    {readinessPct}%
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {completed.length} of {milestones.length} milestones complete
              </p>
            </Card>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-secondary/15 border-secondary/30 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-secondary">Skill Score</p>
              <p className={`text-lg font-black ${computeReadinessColor(readinessPct)}`}>
                {readinessPct}%
              </p>
            </Card>
            <Card className="bg-card border-border/60 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Topics</p>
              <p className="text-lg font-black text-foreground">
                {completedTopics}/{totalTopics}
              </p>
            </Card>
            <Card className="bg-card border-border/60 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Remaining</p>
              <p className="text-lg font-black text-foreground">{remainingMilestones}</p>
            </Card>
            <Card className="bg-card border-border/60 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-lg font-black text-foreground">{milestones.length}</p>
            </Card>
            <Card className="bg-card border-border/60 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gaps</p>
              <p className="text-lg font-black text-tertiary">{missingSkills.length}</p>
            </Card>
          </div>

          {/* Missing Skills Chips */}
          {missingSkills.length > 0 && (
            <Card className="bg-card border-border/60 rounded-3xl p-5">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-tertiary" />
                Skills to Learn
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-tertiary/15 text-tertiary border border-tertiary/30"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Milestones List */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold tracking-tight">Your Milestones</h2>
            {milestones.length === 0 ? (
              <Card className="bg-card border-border/60 rounded-3xl p-8 text-center text-sm text-muted-foreground">
                No milestones in this roadmap.
              </Card>
            ) : (
              <motion.div
                className="space-y-3"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
              {milestones.map((m, idx) => {
                const isDone = completed.includes(idx);
                const isExpanded = expandedMilestone === idx;
                return (
                  <motion.div
                    key={idx}
                    variants={cardVariants}
                    whileHover={hoverLift}
                    layout
                  >
                  <Card
                    className={`rounded-2xl p-5 transition-all ${
                      isDone ? "bg-secondary/10 border-secondary/30" : "bg-card border-border/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleMilestone(idx)}
                        disabled={togglingIndex === idx}
                        className="mt-0.5 shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                      >
                        {togglingIndex === idx ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : isDone ? (
                          <CheckCircle2 className="h-6 w-6 text-secondary" />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3
                              className={`font-bold text-base ${
                                isDone ? "line-through text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {m.milestone || `Milestone ${idx + 1}`}
                            </h3>
                            {m.target_timeline && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                ⏱ {m.target_timeline}
                              </p>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-3">
                            {m.topics && m.topics.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground mb-1.5 flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" /> Topics
                                </p>
                                <ul className="space-y-1">
                                  {m.topics.map((t, ti) => (
                                    <li
                                      key={ti}
                                      className="text-sm text-muted-foreground flex items-start gap-2"
                                    >
                                      <span className="text-tertiary mt-1">•</span>
                                      {t}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {m.resource_links && m.resource_links.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground mb-1.5 flex items-center gap-1">
                                  <Rocket className="h-3 w-3" /> Resources
                                </p>
                                <ul className="space-y-1">
                                  {m.resource_links.map((link, li) => (
                                    <li key={li}>
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline flex items-center gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        {(() => {
                                          try {
                                            return new URL(link).hostname.replace("www.", "");
                                          } catch {
                                            return link;
                                          }
                                        })()}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {!m.topics?.length && !m.resource_links?.length && (
                              <p className="text-xs text-muted-foreground italic">
                                No additional details.
                              </p>
                            )}
                          </div>
                        )}

                        <button
                          className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => setExpandedMilestone(isExpanded ? null : idx)}
                        >
                          {isExpanded ? (
                            <>Hide details <ChevronUp className="h-3 w-3" /></>
                          ) : (
                            <>View details <ChevronDown className="h-3 w-3" /></>
                          )}
                        </button>
                      </div>
                    </div>
                  </Card>
                  </motion.div>
                );
              })}
              </motion.div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
