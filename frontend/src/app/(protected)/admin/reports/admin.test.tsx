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
  noIssue: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mock.router }));
vi.mock("@/lib/reports-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reports-api")>()),
  getAdminReports: mock.list,
  getAdminQuestion: mock.detail,
  createAIRevision: mock.ai,
  resolveNoIssue: mock.noIssue,
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

test("고칠 필요 없는 이유를 편집해 닫고 수정 부분을 표시한다", async () => {
  const choices = [
    {
      no: 1,
      text: "원래 보기",
      is_correct: true,
      misconception_id: null,
      figure: null,
    },
  ];
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "multiple_choice",
    body: "원래 본문",
    explanation: "원래 해설",
    figure: null,
    model_answer: null,
    hard_condition: null,
    hard_condition_reason: null,
    choices,
    rubric: [],
  };
  mock.detail.mockResolvedValue({
    question,
    choices,
    rubric: [],
    rubric_links: [],
    reports: [],
    unit: null,
    assessment_item: { id: "a", name: "항목" },
    revisions: [
      {
        id: "none",
        source: "ai",
        status: "discarded",
        payload: question,
        checks: [{ decision: "no_change", reason: "오류가 없어요." }],
      },
      {
        id: "changed",
        source: "ai",
        status: "passed",
        payload: {
          ...question,
          body: "새 본문",
          explanation: "새 해설",
          choices: [{ ...choices[0], text: "새 보기" }],
        },
        checks: [
          { decision: "revise", reason: "오류 수정" },
          { number: 1, issues: [] },
        ],
      },
    ],
  });
  mock.noIssue.mockResolvedValue({});
  render(<AdminQuestionView id="q" />);
  expect(await screen.findByText("AI 판단: 고칠 필요 없음")).toBeTruthy();
  expect(screen.getByText("본문 바뀜")).toBeTruthy();
  expect(screen.getByText("보기 1 바뀜")).toBeTruthy();
  expect(screen.getByText("해설 바뀜")).toBeTruthy();
  const notes = screen.getAllByLabelText("문제 없음 메모");
  expect((notes[1] as HTMLTextAreaElement).value).toBe("오류가 없어요.");
  fireEvent.change(notes[1], { target: { value: "확인했어요." } });
  fireEvent.click(screen.getByRole("button", { name: "문제 없음으로 닫기" }));
  await waitFor(() =>
    expect(mock.noIssue).toHaveBeenCalledWith("q", "확인했어요."),
  );
});

test("상태 탭은 문항 수를 표시하고 해당 상태로 거른다", async () => {
  const base = {
    unit: { grade: "중1", number: 1, name: "단원" },
    assessment_item: { id: "a", name: "항목" },
    latest_report_at: "2026-01-01",
    report_count: 1,
  };
  const all = [
    {
      ...base,
      question_id: "one",
      body_summary: "첫 문제",
      statuses: ["received", "in_review"],
    },
    {
      ...base,
      question_id: "two",
      body_summary: "둘째 문제",
      statuses: ["fixed"],
    },
  ];
  mock.list.mockImplementation(async (status?: string) =>
    status ? all.filter((row) => row.statuses.includes(status)) : all,
  );
  render(<AdminReportsPage />);
  const allTab = await screen.findByRole("tab", { name: /전체/ });
  expect(allTab.textContent).toContain("2");
  const received = screen.getByRole("tab", { name: /접수/ });
  expect(received.textContent).toContain("1");
  expect(screen.getByRole("tab", { name: /처리 중/ }).textContent).toContain(
    "1",
  );
  fireEvent.click(received);
  await waitFor(() => expect(mock.list).toHaveBeenCalledWith("received"));
  expect(await screen.findByText("첫 문제")).toBeTruthy();
  expect(screen.queryByText("둘째 문제")).toBeNull();
  expect(received.getAttribute("aria-selected")).toBe("true");
});
