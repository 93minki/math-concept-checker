import { request } from "./diagnosis-api";
import type { Figure } from "./figures";

export const reportKinds = {
  text: "문제 글 오류",
  choice_answer: "보기·정답 오류",
  figure: "그림 오류",
  out_of_curriculum: "배우지 않은 내용",
  other: "기타",
} as const;
export const reportStatuses = {
  received: "접수",
  in_review: "처리 중",
  fixed: "수정함",
  no_issue: "문제 없음",
} as const;
export type ReportKind = keyof typeof reportKinds;
export type ReportStatus = keyof typeof reportStatuses;
export type StudentReport = {
  id: string;
  kind: ReportKind;
  description: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  diagnosis_items: {
    stage: number;
    position: number;
    diagnoses: {
      display_units: { grade: string; number: number; name: string } | null;
    } | null;
  } | null;
};
export type Unit = { grade: string; number: number; name: string };
export type AssessmentItem = { id: string; name: string };
export type AdminGroup = {
  unit: Unit | null;
  assessment_item: AssessmentItem;
  body_summary: string;
  question_id: string;
  report_count: number;
  latest_report_at: string;
  statuses: ReportStatus[];
};
export type AdminChoice = {
  no: number;
  text: string;
  is_correct: boolean;
  misconception_id: string | null;
  figure: Figure | null;
};
export type AdminRubric = {
  id?: number;
  no: number;
  description: string;
  points: number;
  required: boolean;
  related_misconception_ids: string[];
};
export type AdminQuestion = {
  id?: string;
  assessment_item_id: string;
  difficulty: "normal" | "hard";
  variant: number;
  question_type: "written" | "multiple_choice";
  body: string;
  explanation: string;
  figure: Figure | null;
  model_answer: string | null;
  hard_condition: string | null;
  hard_condition_reason: string | null;
  choices: AdminChoice[];
  rubric: AdminRubric[];
};
export type Revision = {
  id: string;
  source: "ai" | "manual";
  status: "draft" | "passed" | "failed" | "approved" | "discarded";
  payload: AdminQuestion;
  checks: (
    | { number: number; issues: string[] }
    | { decision: "revise" | "no_change"; reason: string }
  )[];
  ai_cost: number | string;
  created_at: string;
};
export type AdminDetails = {
  unit: Unit | null;
  assessment_item: AssessmentItem;
  question: Omit<AdminQuestion, "choices" | "rubric">;
  choices: AdminChoice[];
  rubric: Omit<AdminRubric, "related_misconception_ids">[];
  rubric_links: { rubric_element_id: number; misconception_id: string }[];
  reports: Pick<
    StudentReport,
    "id" | "kind" | "description" | "status" | "created_at" | "resolved_at"
  >[];
  revisions: Revision[];
};
export const reportQuestion = (
  itemId: number,
  kind: ReportKind,
  description: string,
) =>
  request("/question-reports", {
    method: "POST",
    body: JSON.stringify({ diagnosis_item_id: itemId, kind, description }),
  });
export const getMyReports = () => request<StudentReport[]>("/question-reports");
export const getAdminMe = () => request<{ admin: true }>("/admin/me");
export const getAdminReports = (status?: ReportStatus) =>
  request<AdminGroup[]>(
    `/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ""}`,
  );
export const getAdminQuestion = (id: string) =>
  request<AdminDetails>(`/admin/questions/${encodeURIComponent(id)}`);
export const createAIRevision = (id: string) =>
  request<Revision>(`/admin/questions/${encodeURIComponent(id)}/revisions/ai`, {
    method: "POST",
  });
export const createManualRevision = (id: string, payload: AdminQuestion) =>
  request<Revision>(`/admin/questions/${encodeURIComponent(id)}/revisions`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
export const approveRevision = (id: string) =>
  request<{ replacement_question_id: string; export_needed: boolean }>(
    `/admin/revisions/${encodeURIComponent(id)}/approve`,
    { method: "POST" },
  );
export const resolveNoIssue = (id: string, note: string) =>
  request(`/admin/questions/${encodeURIComponent(id)}/no-issue`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
export const markInReview = (id: string) =>
  request(`/admin/questions/${encodeURIComponent(id)}/in-review`, {
    method: "POST",
  });
