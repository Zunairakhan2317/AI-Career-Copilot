"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

function getErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const message = item.msg;
          return typeof message === "string" ? message : JSON.stringify(item);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return fallback;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers, ...fetchOptions } = options;

  const authHeaders = requiresAuth ? await getAuthHeaders() : {};

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...headers,
      },
    });
  } catch (networkErr) {
    // Network-level failure (server down, wrong port, CORS, etc.)
    const msg = networkErr instanceof Error ? networkErr.message : "Unknown network error";
    throw new Error(
      `Cannot reach backend at ${API_BASE}. ` +
      `Is the FastAPI server running? (${msg})`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(getErrorMessage(error.detail, `HTTP ${response.status}`));
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

// Auth
export const authApi = {
  signup: (data: { email: string; password: string; full_name?: string }) =>
    apiRequest<{ access_token: string; token_type: string; user_id: string; email: string; full_name?: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
      requiresAuth: false,
    }),

  login: (data: { email: string; password: string }) =>
    apiRequest<{ access_token: string; token_type: string; user_id: string; email: string; full_name?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      requiresAuth: false,
    }),
};

// Resume
export const resumeApi = {
  upload: async (userId: string, file: File, jobDescription?: string) => {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("file", file);
    if (jobDescription) formData.append("job_description", jobDescription);

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/resume/upload`, {
        method: "POST",
        body: formData,
        headers,
      });
    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : "Unknown network error";
      throw new Error(`Cannot reach backend at ${API_BASE}. Is the FastAPI server running? (${msg})`);
    }

    if (!response.ok) {
      const rawText = await response.text().catch(() => `HTTP ${response.status}`);
      let errorDetail = rawText;
      try {
        const parsed = JSON.parse(rawText);
        errorDetail = getErrorMessage(parsed.detail, rawText);
      } catch {
        // not JSON, use raw text
      }
      console.error(`[upload] ${response.status}:`, errorDetail);
      throw new Error(errorDetail);
    }

    return response.json();
  },

  getAll: (userId: string) =>
    apiRequest<{ user_id: string; resumes: Array<{ id: string; parsed_data: unknown; created_at: string }> }>(`/api/resume/${userId}`),

  tailor: (userId: string, resumeId: string, jobDescription: string) =>
    apiRequest<{
      success: boolean;
      resume_id: string;
      target_role: string;
      tailored: {
        rewritten_summary: string;
        experience: Array<{
          original_title: string;
          company: string;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean;
          rewritten_bullets: string[];
        }>;
        skills_to_emphasize: string[];
        keywords_added: string[];
        ats_match_estimate: number | null;
      };
      docx_base64: string;
      docx_filename: string;
    }>("/api/resume/tailor", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        resume_id: resumeId,
        job_description: jobDescription,
      }),
    }),
};

// Job Match
export const jobMatchApi = {
  match: (userId: string, jobDescription: string) =>
    apiRequest<{
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
    }>("/api/job-match/", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, job_description: jobDescription }),
    }),
};

// Roadmap
export const roadmapApi = {
  generate: (userId: string, targetRole: string) =>
    apiRequest<{ status: string; data: unknown }>("/api/roadmap/generate", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, target_role: targetRole }),
    }),

  getByUser: (userId: string) =>
    apiRequest<{ status: string; data: unknown }>(`/api/roadmap/${userId}`),

  getById: (userId: string, roadmapId: string) =>
    apiRequest<{ status: string; data: unknown }>(
      `/api/roadmap/${userId}/${roadmapId}`
    ),

  updateCompletedMilestones: (roadmapId: string, completedMilestones: number[]) =>
    apiRequest<{ status: string; data: unknown }>(
      `/api/roadmap/${roadmapId}/milestones`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed_milestones: completedMilestones }),
      }
    ),
};

// Interview
export const interviewApi = {
  start: (
    userId: string,
    jobDescription: string,
    options: { resumeId?: string; targetRole?: string; totalQuestions?: number } = {}
  ) =>
    apiRequest<{
      session_id: string;
      target_role: string;
      total_questions: number;
      question_number: number;
      is_complete: boolean;
      assistant_message: string;
      chat_history: Array<{
        role: "assistant" | "user";
        content: string;
        timestamp: string;
        question_type?: "technical" | "behavioral" | "intro" | "followup";
      }>;
    }>("/api/interview/start", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        job_description: jobDescription,
        resume_id: options.resumeId,
        target_role: options.targetRole,
        total_questions: options.totalQuestions ?? 5,
      }),
    }),

  sendMessage: (sessionId: string, userId: string, userMessage: string) =>
    apiRequest<{
      session_id: string;
      target_role: string;
      question_number: number;
      total_questions: number;
      is_complete: boolean;
      assistant_message: string;
      chat_history: Array<{
        role: "assistant" | "user";
        content: string;
        timestamp: string;
        question_type?: "technical" | "behavioral" | "intro" | "followup";
      }>;
    }>("/api/interview/message", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        user_message: userMessage,
      }),
    }),

  end: (sessionId: string, userId: string) =>
    apiRequest<{
      session_id: string;
      target_role: string;
      scorecard: {
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
      };
      chat_history: Array<{
        role: "assistant" | "user";
        content: string;
        timestamp: string;
        question_type?: string;
      }>;
    }>("/api/interview/end", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, user_id: userId }),
    }),

  listSessions: (userId: string) =>
    apiRequest<{
      status: string;
      data: Array<{
        id: string;
        user_id: string;
        target_role: string;
        created_at: string;
        feedback_scorecard: {
          overall_score?: number;
        } | null;
      }>;
    }>(`/api/interview/sessions/${userId}`),
};

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}