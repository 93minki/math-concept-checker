import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AdminReportsPage from "./page";
import AdminQuestionView from "./[questionId]/view";
import { ApiError } from "@/lib/diagnosis-api";
const mock = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  ai: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mock.router }));
vi.mock("@/lib/reports-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reports-api")>()),
  getAdminReports: mock.list,
  getAdminQuestion: mock.detail,
  createAIRevision: mock.ai,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
test("관리자가 아니면 홈으로 이동", async () => {
  mock.list.mockRejectedValue(new ApiError(403));
  render(<AdminReportsPage />);
  await waitFor(() => expect(mock.router.replace).toHaveBeenCalledWith("/"));
});
test("통과한 수정안만 승인하고 AI 대화 상자 취소는 요청하지 않는다", async () => {
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "written",
    body: "문제",
    explanation: "해설",
    figure: null,
    model_answer: "답",
    hard_condition: null,
    hard_condition_reason: null,
    choices: [],
    rubric: [],
  };
  mock.detail.mockResolvedValue({
    question,
    choices: [],
    rubric: [],
    rubric_links: [],
    reports: [],
    unit: { grade: "중1", number: 1, name: "단원" },
    assessment_item: { id: "a", name: "항목" },
    revisions: [
      {
        id: "pass",
        source: "manual",
        status: "passed",
        checks: [],
        payload: question,
      },
      {
        id: "fail",
        source: "manual",
        status: "failed",
        checks: [],
        payload: question,
      },
    ],
  });
  render(<AdminQuestionView id="q" />);
  await screen.findByText("검사 통과", { exact: false });
  expect(screen.getAllByRole("button", { name: "승인" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "AI 수정안 만들기" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(mock.ai).not.toHaveBeenCalled();
});
