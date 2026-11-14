import type { Figure } from "@/lib/figures";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export type Unit = {
  id: number;
  grade: "중1" | "중2" | "중3";
  number: number;
  name: string;
  publisher: string;
  aliases: string[];
  concepts: string[];
  status: "full" | "partial" | "unavailable";
  in_progress_diagnosis_id: string | null;
  latest_result: {
    diagnosis_id: string;
    unit_stage: string | null;
    completed_at: string;
  } | null;
};
export type Answer = {
  selected_choice: number | null;
  written_text: string | null;
  updated_at: string;
};
export type AnswerInput =
  { selected_choice: number } | { written_text: string };
export type ItemResult = {
  passed: boolean;
  explanation: string;
  correct_choice?: number;
  model_answer?: string | null;
  elements?: { description: string; met: boolean; reason: string }[];
};
export type Report = {
  unit_stage: string | null;
  concepts: {
    name: string;
    stage: string | null;
    not_measured: boolean;
    deep_not_attempted: boolean;
    deep_not_measured: boolean;
    misconceptions: string[];
  }[];
  text: {
    not_understood: string;
    misconception_explanations: string;
    next_steps: string;
  };
};
export type Item = {
  result?: ItemResult | null;
  id: number;
  stage: number;
  position: number;
  question_type: "multiple_choice" | "written";
  body: string;
  figure: Figure | null;
  choices: {
    no: number;
    text: string;
    figure: Figure | null;
  }[];
  answer: Answer | null;
};
export type Diagnosis = {
  id: string;
  status: "stage1" | "stage2" | "completed" | "aborted";
  abort_reason: "expired" | "restarted" | null;
  started_at: string;
  stage1_submitted_at: string | null;
  unit: Pick<Unit, "id" | "grade" | "name" | "publisher" | "status">;
  items: Item[];
};
export type HistoryItem = {
  id: string;
  status: Diagnosis["status"];
  abort_reason: Diagnosis["abort_reason"];
  started_at: string;
  stage1_submitted_at: string | null;
  completed_at: string | null;
  aborted_at: string | null;
  unit: Pick<Unit, "grade" | "name" | "publisher">;
};
export type HistoryPage = { items: HistoryItem[]; next_before: string | null };

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown = null,
  ) {
    super(`API error ${status}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) throw new ApiError(401);
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const deleteAccount = () =>
  request<void>("/account", { method: "DELETE" });
export const getUnits = () => request<Unit[]>("/units");
export const getHistory = (limit = 20, before?: string) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before !== undefined) params.set("before", before);
  return request<HistoryPage>(`/diagnoses?${params}`);
};
export const startDiagnosis = (display_unit_id: number, restart: boolean) =>
  request<{ diagnosis_id: string }>("/diagnoses", {
    method: "POST",
    body: JSON.stringify({ display_unit_id, restart }),
  });
export const getDiagnosis = (id: string) =>
  request<Diagnosis>(`/diagnoses/${encodeURIComponent(id)}`);
export const saveAnswer = (
  id: string,
  itemId: number,
  answer: AnswerInput,
  keepalive = false,
) =>
  request<Answer>(
    `/diagnoses/${encodeURIComponent(id)}/items/${itemId}/answer`,
    { method: "PUT", body: JSON.stringify(answer), keepalive },
  );
export const submitStage = (id: string, stage: 1 | 2) =>
  request<{ status: "stage2" | "completed"; report_ready: boolean }>(
    `/diagnoses/${encodeURIComponent(id)}/stages/${stage}/submit`,
    { method: "POST" },
  );
export const getReport = (id: string) =>
  request<Report>(`/diagnoses/${encodeURIComponent(id)}/report`);
export function authRedirect(
  error: unknown,
  push: (path: string) => void,
): boolean {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    push(error.status === 401 ? "/login" : "/signup/complete");
    return true;
  }
  return false;
}
