"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  FileText,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { resumeApi } from "@/lib/api";
import { pageVariants, containerVariants, cardVariants, hoverLift, tapScale, fadeInVariants } from "@/lib/motion";

interface StoredResume {
  id: string;
  created_at: string;
  parsed_data: {
    contact?: { full_name?: string };
  };
}

interface TailoredExperience {
  original_title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  rewritten_bullets: string[];
}

interface TailorResult {
  resume_id: string;
  target_role: string;
  tailored: {
    rewritten_summary: string;
    experience: TailoredExperience[];
    skills_to_emphasize: string[];
    keywords_added: string[];
    ats_match_estimate: number | null;
  };
  docx_base64: string;
  docx_filename: string;
}

function TailorPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const presetResumeId = searchParams.get("resume_id");

  // Resume selection
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);

  // Job description
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");

  // Tailor result
  const [result, setResult] = useState<TailorResult | null>(null);
  const [isTailoring, setIsTailoring] = useState(false);
  const [error, setError] = useState("");

  // Expanded experience
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  // -------------------------------------------------------------------------
  // Load resumes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await resumeApi.getAll(user!.user_id);
        const list = (data.resumes as unknown as StoredResume[]) ?? [];
        if (!cancelled) {
          setResumes(list);
          if (presetResumeId && list.some((r) => r.id === presetResumeId)) {
            setSelectedResumeId(presetResumeId);
          } else if (list.length > 0) {
            setSelectedResumeId(list[0].id);
          }
        }
      } catch {
        if (!cancelled) setResumes([]);
      } finally {
        if (!cancelled) setIsLoadingResumes(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, presetResumeId]);

  if (!user) return null;

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);

  // -------------------------------------------------------------------------
  // Tailor
  // -------------------------------------------------------------------------
  const handleTailor = async () => {
    if (!selectedResumeId) {
      setError("Please select a resume first.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste a job description.");
      return;
    }
    setIsTailoring(true);
    setError("");
    setResult(null);
    try {
      const data = await resumeApi.tailor(user.user_id, selectedResumeId, jobDescription);
      setResult(data as unknown as TailorResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to tailor resume.");
    } finally {
      setIsTailoring(false);
    }
  };

  // -------------------------------------------------------------------------
  // Download .docx
  // -------------------------------------------------------------------------
  const handleDownload = () => {
    if (!result) return;
    try {
      const binary = atob(result.docx_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.docx_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download .docx file.");
    }
  };

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
          — ATS RESUME BUILDER
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Target your <span className="text-tertiary">dream role</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg">
          Paste a job description and our AI rewrites your resume bullets for
          ATS compliance. Download a polished .docx ready to send.
        </p>
      </div>

      {/* Target Role + Resume Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border/60 rounded-3xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Target Role
          </p>
          {targetRole ? (
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-tertiary" />
              <span className="text-base font-bold text-foreground">{targetRole}</span>
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setTargetRole("")}
              >
                Change
              </button>
            </div>
          ) : (
            <Input
              placeholder="e.g. Data Analyst"
              className="h-9 bg-muted/50 border-border rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  setTargetRole(e.currentTarget.value.trim());
                }
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) setTargetRole(e.target.value.trim());
              }}
            />
          )}
        </Card>

        <Card className="bg-card border-border/60 rounded-3xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Resume
          </p>
          {isLoadingResumes ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : resumes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resumes yet.{" "}
              <a href="/resume" className="text-primary hover:underline">
                Upload one
              </a>{" "}
              first.
            </p>
          ) : (
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full h-9 bg-muted/50 border border-border rounded-xl text-sm text-foreground px-2"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.parsed_data?.contact?.full_name || "Resume"} —{" "}
                  {new Date(r.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
        </Card>
      </div>

      {/* Job Description Input */}
      <Card className="bg-card border-border/60 rounded-3xl p-5">
        <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-tertiary" />
          Job Description
        </h3>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here. The AI will rewrite your resume bullets to match the role's keywords and requirements."
          className="w-full min-h-[160px] rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-tertiary resize-y"
        />
        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
        <div className="flex justify-end mt-3">
          <Button
            onClick={handleTailor}
            disabled={isTailoring || !selectedResumeId}
            className="h-11 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
          >
            {isTailoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Tailoring with AI…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Tailor My Resume
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Result */}
      <AnimatePresence>
      {result && (
        <motion.div
          key={result.resume_id}
          variants={fadeInVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Top stat row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-primary text-primary-foreground border-none rounded-3xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Estimated ATS Match
              </p>
              <p className="text-3xl font-black mt-1">
                {result.tailored.ats_match_estimate ?? "—"}/100
              </p>
            </Card>
            </motion.div>
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-card border-border/60 rounded-3xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Keywords Added
              </p>
              <p className="text-3xl font-black text-tertiary mt-1">
                {result.tailored.keywords_added.length}
              </p>
            </Card>
            </motion.div>
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-card border-border/60 rounded-3xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bullets Rewritten
              </p>
              <p className="text-3xl font-black text-secondary mt-1">
                {result.tailored.experience.reduce(
                  (sum, e) => sum + e.rewritten_bullets.length,
                  0
                )}
              </p>
            </Card>
            </motion.div>
          </div>

          {/* Two side-by-side panels: Summary + Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Rewritten Summary + Keywords */}
            <Card className="bg-card border-border/60 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-tertiary" />
                AI Rewritten Content
              </h3>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary mb-1.5">
                  Professional Summary
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap border-l-2 border-tertiary pl-3">
                  {result.tailored.rewritten_summary}
                </p>
              </div>
              {result.tailored.keywords_added.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary mb-1.5">
                    Keywords Added
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tailored.keywords_added.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-tertiary/15 text-tertiary border border-tertiary/30"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.tailored.skills_to_emphasize.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary mb-1.5">
                    Skills to Emphasize
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tailored.skills_to_emphasize.map((s) => (
                      <span
                        key={s}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Right: Resume Preview */}
            <Card className="bg-card border-border/60 rounded-3xl p-5 space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-secondary" />
                Resume Preview
              </h3>
              <div className="space-y-3 text-sm">
                {selectedResume?.parsed_data?.contact?.full_name && (
                  <div className="text-center pb-2 border-b border-border/40">
                    <p className="font-bold text-foreground text-base">
                      {selectedResume.parsed_data.contact.full_name}
                    </p>
                  </div>
                )}

                {result.tailored.experience.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No experience entries were rewritten.
                  </p>
                )}

                {result.tailored.experience.map((exp, idx) => {
                  const isExpanded = expandedIdx === idx;
                  return (
                    <div key={idx} className="border border-border/40 rounded-xl p-3">
                      <button
                        className="w-full flex items-center justify-between text-left"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {exp.original_title} — {exp.company}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {[exp.start_date, exp.end_date || (exp.is_current ? "Present" : "")]
                              .filter(Boolean)
                              .join(" – ")}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <ul className="mt-2 space-y-1.5">
                          {exp.rewritten_bullets.map((b, bi) => (
                            <li
                              key={bi}
                              className="text-xs text-foreground flex items-start gap-2"
                            >
                              <CheckCircle2 className="h-3 w-3 text-secondary mt-0.5 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Export DOCX button (the prominent CTA from the design) */}
          <motion.div whileHover={hoverLift} whileTap={tapScale} className="flex justify-center pt-2">
            <Button
              onClick={handleDownload}
              className="h-12 px-8 bg-tertiary hover:opacity-90 text-tertiary-foreground font-bold rounded-2xl shadow-lg shadow-tertiary/25 flex items-center gap-2"
            >
              <Download className="h-5 w-5" />
              Export DOCX
            </Button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TailorResumePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <TailorPageInner />
    </Suspense>
  );
}
