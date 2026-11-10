import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export type Unit = { id: number; grade: "중1" | "중2" | "중3"; number: number; name: string; publisher: string; aliases: string[]; status: "full" | "partial" | "unavailable"; in_progress_diagnosis_id: string | null };
export type Answer = { selected_choice: number | null; written_text: string | null; updated_at: string };
export type AnswerInput = { selected_choice: number } | { written_text: string };
export type Item = { id: number; stage: number; position: number; question_type: "multiple_choice" | "written"; body: string; choices: { no: number; text: string }[]; answer: Answer | null };
export type Diagnosis = { id: string; status: "stage1" | "stage2" | "completed" | "aborted"; abort_reason: "expired" | "restarted" | null; started_at: string; stage1_submitted_at: string | null; unit: Pick<Unit, "id" | "grade" | "name" | "publisher" | "status">; items: Item[] };

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown = null) { super(`API error ${status}`); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session) throw new ApiError(401);
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}
export const getUnits = () => request<Unit[]>("/units");
export const startDiagnosis = (display_unit_id: number, restart: boolean) => request<{ diagnosis_id: string }>("/diagnoses", { method: "POST", body: JSON.stringify({ display_unit_id, restart }) });
export const getDiagnosis = (id: string) => request<Diagnosis>(`/diagnoses/${encodeURIComponent(id)}`);
export const saveAnswer = (id: string, itemId: number, answer: AnswerInput, keepalive = false) => request<Answer>(`/diagnoses/${encodeURIComponent(id)}/items/${itemId}/answer`, { method: "PUT", body: JSON.stringify(answer), keepalive });
export const submitDiagnosis = (id: string) => request<{ stage1_submitted_at: string }>(`/diagnoses/${encodeURIComponent(id)}/stages/1/submit`, { method: "POST" });
export function authRedirect(error: unknown, push: (path: string) => void): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { push(error.status === 401 ? "/login" : "/signup/complete"); return true; }
  return false;
}
