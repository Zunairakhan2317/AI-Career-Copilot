"use client";

import { useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { resumeApi, jobMatchApi } from "@/lib/api";
import { pageVariants, containerVariants, cardVariants, hoverLift, tapScale, fadeInVariants } from "@/lib/motion";

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

interface MatchAnalysis {
  user_id: string;
  resume_id: string;
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  gaps: string[];
  recommendation: string;
  tailored_suggestions: {
    tailored_summary: string;
    skills_to_add: string[];
    experience_to_enhance: string[];
    projects_to_include: string[];
    cover_letter_outline: string;
  };
}

interface ResumeResult {
  success: boolean;
  resume_id: string;
  parsed_data?: StoredResume["parsed_data"];
  analysis?: MatchAnalysis;
}

interface StoredResume {
  id: string;
  created_at: string;
  parsed_data: {
    contact?: {
      full_name?: string;
      email?: string;
      phone?: string;
      location?: string;
      linkedin?: string;
      github?: string;
      portfolio?: string;
    };
    summary?: string;
    experience?: Array<{
      title?: string;
      company?: string;
      start_date?: string;
      end_date?: string;
      description?: string;
      is_current?: boolean;
    }>;
    education?: Array<{
      institution?: string;
      degree?: string;
      field_of_study?: string;
      start_date?: string;
      end_date?: string;
      gpa?: string;
    }>;
    skills?: Array<{ name?: string; category?: string }>;
    certifications?: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number) {
  if (score >= 80) return "text-secondary";
  if (score >= 60) return "text-primary";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Strong Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Partial Match";
  return "Weak Match";
}

function getScoreBg(score: number) {

  if (score >= 80) return "bg-secondary";
  if (score >= 60) return "bg-primary";
  return "bg-destructive";
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ResumePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Analysis result
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Show parsed preview immediately after upload
  const [uploadedParsedData, setUploadedParsedData] = useState<StoredResume["parsed_data"] | null>(null);

  // Prior resumes list
  const [priorResumes, setPriorResumes] = useState<StoredResume[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Optional job description panel
  const [showJdPanel, setShowJdPanel] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Accordion toggles
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);

  // Load prior resumes on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const data = await resumeApi.getAll(user!.user_id);
        if (!cancelled) setPriorResumes(data.resumes as StoredResume[]);
      } catch {
        if (!cancelled) setPriorResumes([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setUploadError("Only PDF files are supported.");
        setSelectedFile(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File must be under 5MB.");
        setSelectedFile(null);
        return;
      }
      setUploadError("");
      setSelectedFile(file);
      setResult(null); // Clear previous result
    }
  }, []);

  // Handle drag-and-drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setUploadError("Only PDF files are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File must be under 5MB.");
        return;
      }
      setUploadError("");
      setSelectedFile(file);
      setResult(null);
    }
  }, []);

  // Upload (parse only — shows preview immediately)
  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadError("");
    setResult(null);
    setUploadedParsedData(null);

    try {
      const data = await resumeApi.upload(
        user.user_id,
        selectedFile,
        showJdPanel && jobDescription.trim() ? jobDescription.trim() : undefined
      );
      // Show parsed preview right away
      setUploadedParsedData(
        (data as ResumeResult).parsed_data as StoredResume["parsed_data"] | undefined ?? null
      );

      // If JD was provided, the backend also returns analysis in the same response
      const analysis = (data as ResumeResult).analysis;
      if (analysis) {
        setResult(data as ResumeResult);
      }

      // Refresh prior resumes list
      const historyData = await resumeApi.getAll(user.user_id);
      setPriorResumes(historyData.resumes as unknown as StoredResume[]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setIsLoadingResult(false);
    }
  };

  // Analyze (uses job-match endpoint for JD-only or no-JD ATS feedback)
  const handleAnalyze = async () => {
    if (!user) return;
    const latestResume = priorResumes[0] ?? result;
    const resumeId = (latestResume as { id?: string } | undefined)?.id
      ?? (result as ResumeResult | null)?.resume_id;
    if (!resumeId) {
      setUploadError("Upload a resume before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    setUploadError("");
    try {
      // Use job-match only if a JD is provided; otherwise call a no-JD analyze later
      if (jobDescription.trim()) {
        const data = await jobMatchApi.match(user.user_id, jobDescription);
        setResult({
          success: true,
          resume_id: resumeId,
          parsed_data: uploadedParsedData ?? undefined,
          analysis: {
            user_id: data.user_id,
            resume_id: data.resume_id,
            match_score: data.match_score,
            matching_skills: data.matching_skills,
            missing_skills: data.missing_skills,
            strengths: data.strengths,
            gaps: data.gaps,
            recommendation: data.recommendation,
            tailored_suggestions: data.tailored_suggestions,
          },
        });
      } else {
        // No JD: provide a basic ATS-style preview only
        setResult({
          success: true,
          resume_id: resumeId,
          parsed_data: uploadedParsedData ?? undefined,
        });
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysis = result?.analysis;
  const hasResult = !!analysis;
  const hasParsedPreview = !!uploadedParsedData || hasResult;

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
          — AI RESUME EVALUATOR
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Resume <span className="text-tertiary">Analysis</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg">
          Upload your latest resume to analyze ATS compatibility, identify missing keywords, and get instant recommendations.
        </p>
      </div>

      {/* Upload Zone */}
      <motion.div whileHover={{ y: -2 }} whileTap={tapScale}>
      <Card
        className="bg-card border-2 border-dashed border-border/80 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-3 shadow-sm hover:border-tertiary/50 transition-colors cursor-pointer animate-pulse-ring"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="h-12 w-12 rounded-2xl bg-tertiary/15 flex items-center justify-center text-tertiary">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        <div className="space-y-1">
          {selectedFile ? (
            <>
              <h3 className="font-bold text-base text-secondary flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
                {selectedFile.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — click to change
              </p>
            </>
          ) : (
            <>
              <h3 className="font-bold text-base">Drag and drop your resume here</h3>
              <p className="text-xs text-muted-foreground">Supports PDF (Up to 5MB)</p>
            </>
          )}
        </div>

        {!selectedFile && (
          <Button
            className="h-9 px-5 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold text-xs rounded-xl shadow-md shadow-tertiary/20"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse File
          </Button>
        )}
      </Card>
      </motion.div>

      {/* Error display */}
      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
          <button
            className="ml-auto"
            onClick={() => setUploadError("")}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Optional Job Description Panel */}
      <Card className="rounded-3xl p-5">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setShowJdPanel((v) => !v)}
        >
          <div>
            <h3 className="font-bold text-sm text-foreground">
              Compare Against a Job Description
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste a job posting to get personalized match analysis and tailored suggestions.
            </p>
          </div>
          {showJdPanel ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {showJdPanel && (
          <div className="mt-4 space-y-3">
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full min-h-30 rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-tertiary resize-y"
            />
            <p className="text-[10px] text-muted-foreground">
              The AI will analyze how well your resume matches the role requirements.
            </p>
          </div>
        )}
      </Card>

      {/* Upload + Analyze Buttons */}
      {selectedFile && !result && (
        <div className="flex justify-center">
          <Button
            onClick={handleUpload}
            disabled={isUploading || isLoadingResult}
            className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            {isUploading || isLoadingResult ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing Resume…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Upload & Parse
              </>
            )}
          </Button>
        </div>
      )}

      {/* Analyze (after upload) or Tailor (after analysis) */}
      {(uploadedParsedData || result) && !isUploading && !isLoadingResult && (
        <div className="flex justify-center gap-3 flex-wrap">
          {!result && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Resume
                </>
              )}
            </Button>
          )}
          {result && (
            <Button
              onClick={() => {
                if (result?.resume_id) {
                  window.location.href = `/resume/tailor?resume_id=${result.resume_id}`;
                }
              }}
              disabled={!result?.resume_id}
              className="h-11 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Tailor Resume
            </Button>
          )}
        </div>
      )}

      {/* Parsed Resume Preview — shown immediately after upload, with or without JD analysis */}
      {hasParsedPreview && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Your Parsed Resume</h2>
          <Card className="rounded-3xl p-5 space-y-4">
            {uploadedParsedData?.contact?.full_name && (
              <div className="text-center pb-2 border-b border-border/40">
                <p className="font-bold text-foreground text-base">
                  {uploadedParsedData.contact.full_name}
                </p>
                {uploadedParsedData.contact.email && (
                  <p className="text-xs text-muted-foreground">{uploadedParsedData.contact.email}</p>
                )}
                {uploadedParsedData.contact.location && (
                  <p className="text-xs text-muted-foreground">{uploadedParsedData.contact.location}</p>
                )}
                {(uploadedParsedData.contact.linkedin || uploadedParsedData.contact.github) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadedParsedData.contact.linkedin && `🔗 LinkedIn`}
                    {uploadedParsedData.contact.linkedin && uploadedParsedData.contact.github && " · "}
                    {uploadedParsedData.contact.github && `💻 GitHub`}
                  </p>
                )}
              </div>
            )}
            {uploadedParsedData?.summary && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Summary</h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">{uploadedParsedData.summary}</p>
              </div>
            )}
            {uploadedParsedData?.experience && uploadedParsedData.experience.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Experience</h4>
                {uploadedParsedData.experience.map((exp, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <p className="text-sm font-semibold text-foreground">
                      {exp.title ?? "Position"} — {exp.company ?? "Company"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[exp.start_date, exp.end_date ?? (exp.is_current ? "Present" : null)].filter(Boolean).join(" – ")}
                    </p>
                    {exp.description && (
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {uploadedParsedData?.education && uploadedParsedData.education.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Education</h4>
                {uploadedParsedData.education.map((edu, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-sm font-semibold text-foreground">{edu.institution ?? "Institution"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {uploadedParsedData?.skills && uploadedParsedData.skills.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {uploadedParsedData.skills.map((skill) => (
                    <span
                      key={skill.name}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted/40 text-foreground border border-muted/30"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Analysis Results */}
      {hasResult && analysis && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Analysis Insights</h2>
            <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
              Resume: <span className="font-mono text-[10px]">{result?.resume_id?.slice(0, 8)}…</span>
            </span>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >

            {/* ATS Score Card */}
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-primary text-primary-foreground border-none rounded-3xl p-6 shadow-lg shadow-primary/10 flex flex-col justify-between min-h-45">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/15">
                  ATS Match Score
                </span>
                <Sparkles className="h-5 w-5 opacity-80" />
              </div>
              <div className="my-2">
                <div className={`text-4xl font-black ${getScoreColor(analysis.match_score)}`}>
                  {analysis.match_score}
                  <span className="text-xl font-normal opacity-80">/100</span>
                </div>
                <p className="text-xs mt-1 opacity-90">
                  {getScoreLabel(analysis.match_score)} — {analysis.recommendation}
                </p>
              </div>
              <div className="w-full bg-black/15 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBg(analysis.match_score)} transition-all`}
                  style={{ width: `${analysis.match_score}%` }}
                />
              </div>
            </Card>
            </motion.div>

            {/* Matched Keywords Card */}
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-secondary/15 border-secondary/30 rounded-3xl p-5 flex flex-col justify-between min-h-45">
              <div className="flex items-center gap-2 text-secondary">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-bold text-sm text-foreground">Matched Keywords</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 my-2">
                {analysis.matching_skills.length > 0 ? (
                  analysis.matching_skills.slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-secondary/20 text-secondary border border-secondary/30"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No matching keywords found.</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {analysis.matching_skills.length} out of{" "}
                {analysis.matching_skills.length + analysis.missing_skills.length} targeted skills found.
              </p>
            </Card>
            </motion.div>

            {/* Missing Skills / Gaps Card */}
            <motion.div variants={cardVariants} whileHover={hoverLift}>
            <Card className="bg-tertiary/15 border-tertiary/30 rounded-3xl p-5 flex flex-col justify-between min-h-45">
              <div className="flex items-center gap-2 text-tertiary">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-bold text-sm text-foreground">Missing Skills</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 my-2">
                {analysis.missing_skills.length > 0 ? (
                  analysis.missing_skills.slice(0, 6).map((skill) => (
                    <span
                      key={skill}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-tertiary/20 text-tertiary border border-tertiary/30"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Great coverage!</p>
                )}
              </div>
              <Button
                className="w-full h-8 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold text-xs rounded-xl"
                onClick={() => setShowSuggestions((v) => !v)}
              >
                {showSuggestions ? "Hide" : "View"} Suggestions
              </Button>
            </Card>
            </motion.div>

          {/* Strengths & Gaps */}
          <Card className="rounded-3xl p-5 space-y-4">
            <h3 className="font-bold text-base text-foreground">Detailed Breakdown</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">
                  Strengths
                </h4>
                {analysis.strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific strengths identified.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-tertiary mb-2">
                  Gaps
                </h4>
                {analysis.gaps.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <AlertCircle className="h-4 w-4 text-tertiary mt-0.5 shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant gaps found.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Tailored Suggestions Accordion */}
          {showSuggestions && analysis.tailored_suggestions && (
            <Card className="rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-base text-foreground">Tailored Suggestions</h3>

              {analysis.tailored_suggestions.tailored_summary && (
                <p className="text-sm text-muted-foreground border-l-2 border-tertiary pl-3">
                  {analysis.tailored_suggestions.tailored_summary}
                </p>
              )}

              {analysis.tailored_suggestions.skills_to_add?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                    Skills to Add
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.tailored_suggestions.skills_to_add.map((s) => (
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

              {analysis.tailored_suggestions.experience_to_enhance?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                    Experience to Enhance
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.tailored_suggestions.experience_to_enhance.map((e, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-tertiary mt-1">•</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                className="flex items-center gap-2 text-sm font-semibold text-tertiary hover:underline"
                onClick={() => setShowCoverLetter((v) => !v)}
              >
                <FileText className="h-4 w-4" />
                {showCoverLetter ? "Hide" : "Show"} Cover Letter Outline
              </button>

              {showCoverLetter && analysis.tailored_suggestions.cover_letter_outline && (
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {analysis.tailored_suggestions.cover_letter_outline}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Tailor Resume CTA */}
          <div className="flex justify-center">
            <Button
              className="h-10 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
              onClick={() => {
                if (result?.resume_id) {
                  window.location.href = `/resume/tailor?resume_id=${result.resume_id}`;
                }
              }}
              disabled={!result?.resume_id}
            >
              <Sparkles className="h-4 w-4" />
              Tailor Resume for a Role
            </Button>
          </div>
        </motion.div>
        </div>
      )}

      {/* Prior Resumes */}
      {!isLoadingHistory && priorResumes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Prior Resumes</h2>
          <motion.div
            className="space-y-2"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {priorResumes.map((r) => {
              const isExpanded = expandedResumeId === r.id;
              const contact = r.parsed_data?.contact || {};
              const summary = r.parsed_data?.summary;
              const experience = r.parsed_data?.experience || [];
              const education = r.parsed_data?.education || [];
              const skills = r.parsed_data?.skills || [];

              return (
                <motion.div
                  key={r.id}
                  variants={cardVariants}
                  className="space-y-2"
                >
                  <motion.div whileHover={hoverLift} whileTap={tapScale}>
                  <Card
                    className="rounded-2xl p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedResumeId(isExpanded ? null : r.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {contact.full_name || "Resume"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                          {r.id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                  </Card>
                  </motion.div>

                  <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      key="details"
                      variants={fadeInVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                    >
                    <Card className="rounded-2xl p-5 mt-1">
                      {contact.full_name && (
                        <div className="mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                            Contact
                          </h4>
                          <p className="text-sm font-semibold text-foreground">{contact.full_name}</p>
                          {contact.email && <p className="text-sm text-muted-foreground">✉ {contact.email}</p>}
                          {contact.phone && <p className="text-sm text-muted-foreground">📱 {contact.phone}</p>}
                          {contact.location && <p className="text-sm text-muted-foreground">📍 {contact.location}</p>}
                          {contact.linkedin && (
                            <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block mt-1">
                              🔗 LinkedIn
                            </a>
                          )}
                          {contact.github && (
                            <a href={contact.github} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block mt-1">
                              💻 GitHub
                            </a>
                          )}
                        </div>
                      )}

                      {summary && (
                        <div className="mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                            Professional Summary
                          </h4>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{summary}</p>
                        </div>
                      )}

                      {experience.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                            Experience
                          </h4>
                          {experience.map((exp, idx) => (
                            <div key={idx} className="mb-3 last:mb-0">
                              <p className="text-sm font-semibold text-foreground">
                                {exp.title || "Position"} — {exp.company || "Company"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[exp.start_date, exp.end_date || (exp.is_current ? "Present" : null)].filter(Boolean).join(" – ")}
                              </p>
                              {exp.description && (
                                <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{exp.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {education.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                            Education
                          </h4>
                          {education.map((edu, idx) => (
                            <div key={idx} className="mb-3 last:mb-0">
                              <p className="text-sm font-semibold text-foreground">{edu.institution || "Institution"}</p>
                              <p className="text-xs text-muted-foreground">
                                {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[edu.start_date, edu.end_date].filter(Boolean).join(" – ")}
                              </p>
                              {edu.gpa && <p className="text-xs text-muted-foreground">GPA: {edu.gpa}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {skills.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                            Skills
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((skill) => (
                              <span
                                key={skill.name}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted/40 text-foreground border border-muted/30"
                              >
                                {skill.name}
                                {skill.category && skill.category !== "other" && (
                                  <span className="text-[10px] text-muted-foreground ml-1">({skill.category})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {!contact.full_name && !summary && experience.length === 0 && education.length === 0 && skills.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No parsed data available for this resume.
                        </p>
                      )}
                    </Card>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
