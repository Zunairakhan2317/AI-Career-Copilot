"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  FileText,
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { interviewApi, resumeApi } from "@/lib/api";
import { pageVariants, containerVariants, cardVariants, hoverLift, tapScale, fadeInVariants, chatMessageVariants } from "@/lib/motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatTurn {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  question_type?: "technical" | "behavioral" | "intro" | "followup";
}

interface Scorecard {
  overall_score: number;
  technical_knowledge: number;
  communication: number;
  confidence: number;
  problem_solving: number;
  strengths: string[];
  improvements: string[];
  per_question_feedback: Array<{
    question_type: string;
    score: number;
    note: string;
  }>;
  recommendation: string;
}

interface StoredResume {
  id: string;
  created_at: string;
  parsed_data: { contact?: { full_name?: string } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number) {
  if (score >= 80) return "text-secondary";
  if (score >= 60) return "text-primary";
  return "text-destructive";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-secondary";
  if (score >= 60) return "bg-primary";
  return "bg-destructive";
}

function questionTypeBadge(type?: string) {
  if (!type || type === "intro") return null;
  if (type === "technical")
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
        Technical
      </span>
    );
  if (type === "behavioral")
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary border border-tertiary/30">
        Behavioral
      </span>
    );
  return null;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function InterviewPage() {
  const { user } = useAuth();

  // Setup state
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [isComplete, setIsComplete] = useState(false);

  // Live chat
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scorecard
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Past sessions
  const [pastSessions, setPastSessions] = useState<Array<{
    id: string;
    target_role: string;
    created_at: string;
    feedback_scorecard: { overall_score?: number } | null;
  }>>([]);
  const [showPast, setShowPast] = useState(false);
  const [showPerQuestion, setShowPerQuestion] = useState(false);

  // -------------------------------------------------------------------------
  // Load resumes + past sessions
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await resumeApi.getAll(user!.user_id);
        if (!cancelled) {
          const list = (data.resumes as unknown as StoredResume[]) ?? [];
          setResumes(list);
          if (list.length > 0) setSelectedResumeId(list[0].id);
        }
      } catch {
        if (!cancelled) setResumes([]);
      }

      try {
        const past = await interviewApi.listSessions(user!.user_id);
        if (!cancelled) setPastSessions(past.data ?? []);
      } catch {
        if (!cancelled) setPastSessions([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isSending]);

  if (!user) return null;

  // -------------------------------------------------------------------------
  // Start interview
  // -------------------------------------------------------------------------
  const handleStart = async () => {
    if (!jobDescription.trim()) {
      setSetupError("Please paste a job description.");
      return;
    }
    setIsStarting(true);
    setSetupError("");
    try {
      const data = await interviewApi.start(user.user_id, jobDescription, {
        resumeId: selectedResumeId || undefined,
        totalQuestions,
      });
      setSessionId(data.session_id);
      setTargetRole(data.target_role);
      setChatHistory(data.chat_history);
      setQuestionNumber(data.question_number);
      setMaxQuestions(data.total_questions);
      setIsComplete(data.is_complete);
      setScorecard(null);
      setChatError("");
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : "Failed to start interview.");
    } finally {
      setIsStarting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    const msg = userMessage.trim();
    if (!msg || !sessionId) return;
    setUserMessage("");
    setIsSending(true);
    setChatError("");

    // Optimistic append
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: msg, timestamp: new Date().toISOString() },
    ]);

    try {
      const data = await interviewApi.sendMessage(sessionId, user.user_id, msg);
      setChatHistory(data.chat_history);
      setQuestionNumber(data.question_number);
      setMaxQuestions(data.total_questions);
      setIsComplete(data.is_complete);

      if (data.is_complete) {
        // Auto-trigger evaluation
        handleEnd(data.session_id);
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Failed to send message.");
      // Revert optimistic append
      setChatHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // End interview — get scorecard
  // -------------------------------------------------------------------------
  const handleEnd = async (id?: string) => {
    const sid = id ?? sessionId;
    if (!sid) return;
    setIsEvaluating(true);
    setChatError("");
    try {
      const data = await interviewApi.end(sid, user.user_id);
      setScorecard(data.scorecard);
      setIsComplete(true);
      // Refresh past sessions list
      const past = await interviewApi.listSessions(user.user_id);
      setPastSessions(past.data ?? []);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Failed to evaluate interview.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Reset to setup
  // -------------------------------------------------------------------------
  const handleReset = () => {
    setSessionId(null);
    setTargetRole("");
    setChatHistory([]);
    setQuestionNumber(1);
    setMaxQuestions(5);
    setIsComplete(false);
    setScorecard(null);
    setUserMessage("");
    setChatError("");
    setSetupError("");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const showSetup = !sessionId && !isComplete;

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
          — MOCK INTERVIEW COACH
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          AI Interview <span className="text-tertiary">Simulator</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg">
          Practice a real interview tailored to your resume and target role. Get instant feedback at the end.
        </p>
      </div>

      {/* SETUP SCREEN */}
      {showSetup && (
        <>
          <Card className="bg-card border-border/60 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-tertiary" />
              Setup Your Interview
            </h3>

            {/* Resume selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Your Resume (optional, but recommended)
              </label>
              {resumes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No resumes uploaded. The interviewer will work from the JD only.{" "}
                  <a href="/resume" className="text-primary hover:underline">Upload one</a> for better questions.
                </p>
              ) : (
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full h-10 bg-muted/50 border border-border rounded-xl text-sm text-foreground px-3"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.parsed_data?.contact?.full_name || "Resume"} — {new Date(r.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* JD input */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description. The interviewer will ask questions grounded in this role and your resume."
                className="w-full min-h-[140px] rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-tertiary resize-y"
              />
            </div>

            {/* Number of questions */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Number of Questions
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Math.max(1, Math.min(15, Number(e.target.value) || 5)))}
                  className="w-24 h-10 bg-muted/50 border-border rounded-xl text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  Recommended: 5–8 questions
                </span>
              </div>
            </div>

            {setupError && (
              <p className="text-xs text-destructive">{setupError}</p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleStart}
                disabled={isStarting}
                className="h-11 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Start Interview
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Past sessions */}
          {pastSessions.length > 0 && (
            <Card className="bg-card border-border/60 rounded-3xl p-5">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowPast((v) => !v)}
              >
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Past Sessions ({pastSessions.length})
                </h3>
                {showPast ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showPast && (
                <div className="mt-3 space-y-2">
                  {pastSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-muted/30 rounded-xl p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {s.target_role}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(s.created_at).toLocaleString()}
                        </p>
                      </div>
                      {s.feedback_scorecard?.overall_score != null && (
                        <span
                          className={`text-sm font-bold ${scoreColor(s.feedback_scorecard.overall_score)}`}
                        >
                          {s.feedback_scorecard.overall_score}/100
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* CHAT SCREEN */}
      {sessionId && !isComplete && (
        <>
          {/* Header with role + question counter */}
          <Card className="bg-card border-border/60 rounded-3xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Interviewing for
              </p>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-tertiary" />
                {targetRole}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Question
                </p>
                <p className="text-base font-bold text-foreground">
                  {questionNumber} / {maxQuestions}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleEnd()}
                className="h-9 px-3 text-xs"
              >
                End Early
              </Button>
            </div>
          </Card>

          {/* Chat history */}
          <Card className="bg-card border-border/60 rounded-3xl p-5 space-y-4 max-h-[55vh] overflow-y-auto">
            <AnimatePresence>
            {chatHistory.map((turn, idx) => {
              const isAssistant = turn.role === "assistant";
              return (
                <motion.div
                  key={idx}
                  variants={isAssistant ? chatMessageVariants.fromLeft : chatMessageVariants.fromRight}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      isAssistant
                        ? "bg-tertiary/20 text-tertiary"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {isAssistant ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">
                        {(user.full_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 ${
                      isAssistant
                        ? "bg-muted/50 border border-border/40"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {isAssistant && questionTypeBadge(turn.question_type) && (
                      <div className="mb-1.5">{questionTypeBadge(turn.question_type)}</div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>

            {isSending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-muted/50 border border-border/40 rounded-2xl p-3">
                  <p className="text-sm text-muted-foreground italic">
                    Interviewer is thinking…
                  </p>
                </div>
              </div>
            )}

            {isEvaluating && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Evaluating your interview…
              </div>
            )}

            <div ref={chatEndRef} />
          </Card>

          {chatError && (
            <p className="text-xs text-destructive">{chatError}</p>
          )}

          {/* Input */}
          <Card className="bg-card border-border/60 rounded-3xl p-3 flex items-center gap-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) handleSend();
                }
              }}
              placeholder="Type your answer…"
              disabled={isSending}
              className="h-10 bg-muted/50 border-border rounded-xl text-sm flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isSending || !userMessage.trim()}
              className="h-10 w-10 p-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center justify-center"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </Card>
        </>
      )}

      {/* SCORECARD SCREEN */}
      {isComplete && scorecard && (
        <>
          {/* Big overall score */}
          <Card className="bg-primary text-primary-foreground border-none rounded-3xl p-8 flex flex-col items-center text-center shadow-lg shadow-primary/10">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              Overall Interview Score
            </p>
            <p className="text-6xl font-black my-2">
              {scorecard.overall_score}
              <span className="text-2xl font-normal opacity-80">/100</span>
            </p>
            <p className="text-sm opacity-90 max-w-md">{scorecard.recommendation}</p>
          </Card>

          {/* Sub-scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: "Technical", value: scorecard.technical_knowledge },
              { label: "Communication", value: scorecard.communication },
              { label: "Confidence", value: scorecard.confidence },
              { label: "Problem Solving", value: scorecard.problem_solving },
            ] as const).map((m) => (
              <Card key={m.label} className="bg-card border-border/60 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                <p className={`text-2xl font-black mt-1 ${scoreColor(m.value)}`}>
                  {m.value}
                </p>
                <div className="w-full bg-muted/30 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreBarColor(m.value)} transition-all`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>

          {/* Strengths + Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-secondary/10 border-secondary/30 rounded-3xl p-5">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                Strengths
              </h3>
              <ul className="space-y-2">
                {scorecard.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="bg-tertiary/10 border-tertiary/30 rounded-3xl p-5">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-tertiary" />
                Areas to Improve
              </h3>
              <ul className="space-y-2">
                {scorecard.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <AlertCircle className="h-4 w-4 text-tertiary mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Per-question feedback (collapsible) */}
          {scorecard.per_question_feedback.length > 0 && (
            <Card className="bg-card border-border/60 rounded-3xl p-5">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowPerQuestion((v) => !v)}
              >
                <h3 className="font-bold text-sm text-foreground">
                  Per-Question Feedback ({scorecard.per_question_feedback.length})
                </h3>
                {showPerQuestion ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showPerQuestion && (
                <div className="mt-3 space-y-2">
                  {scorecard.per_question_feedback.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 bg-muted/30 rounded-xl p-3"
                    >
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Q{i + 1} — {q.question_type}
                        </p>
                        <p className="text-sm text-foreground mt-0.5">{q.note}</p>
                      </div>
                      <span
                        className={`text-base font-bold ${scoreColor(q.score)} shrink-0`}
                      >
                        {q.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleReset}
              className="h-11 px-6 bg-tertiary hover:opacity-90 text-tertiary-foreground font-semibold rounded-xl shadow-md shadow-tertiary/20 flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Start New Interview
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
              className="h-11 px-6 rounded-xl flex items-center gap-2"
            >
              Back to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
