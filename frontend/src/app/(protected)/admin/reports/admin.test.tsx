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
const openReport = {
  id: "open",
  kind: "text",
  description: "오류 신고",
  status: "received",
  created_at: "2026-01-01T00:00:00Z",
  resolved_at: null,
  resolution_note: null,
};
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
    reports: [openReport],
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
  fireEvent.click(screen.getByText("이전 수정안 1개"));
  fireEvent.click(screen.getByRole("button", { name: /직접.*검사 실패/ }));
  expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "최신 수정안으로" }));
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
    reports: [openReport],
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
  fireEvent.click(screen.getByText("이전 수정안 1개"));
  fireEvent.click(screen.getByRole("button", { name: /AI.*검사 통과/ }));
  expect(screen.getByText("본문 바뀜")).toBeTruthy();
  expect(screen.getByText("보기 1 바뀜")).toBeTruthy();
  expect(screen.getByText("해설 바뀜")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "최신 수정안으로" }));
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

test("열린 신고를 최신 5개 표시하고 유형·지난 신고·설명을 펼친다", async () => {
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "written",
    body: "원문",
    explanation: "원래 해설",
    figure: null,
    model_answer: "답안",
    hard_condition: null,
    hard_condition_reason: null,
    choices: [],
    rubric: [{ no: 1, description: "기준", points: 1, required: true }],
  };
  const reports = Array.from({ length: 7 }, (_, i) => ({
    id: `r${i}`,
    kind: i === 0 ? "figure" : "text",
    description: `설명 ${i} ` + "가".repeat(120),
    status: i === 6 ? "fixed" : "received",
    created_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    resolved_at: null,
  }));
  mock.detail.mockResolvedValue({
    question,
    choices: [],
    rubric: question.rubric,
    rubric_links: [],
    reports,
    unit: null,
    assessment_item: { id: "a", name: "항목" },
    revisions: [],
  });
  render(<AdminQuestionView id="q" />);
  await screen.findByRole("heading", { name: "원래 문제" });
  expect(screen.getByText("원래 해설")).toBeTruthy();
  expect(screen.getByText("모범 답안: 답안")).toBeTruthy();
  expect(screen.getByText(/1\. 기준/)).toBeTruthy();
  expect(screen.queryByText("정답·해설·채점 기준")?.tagName).toBe("H3");
  expect(screen.getByText(/^설명 5 /)).toBeTruthy();
  expect(screen.queryByText(/^설명 0 /)).toBeNull();
  expect(screen.queryByText(/^설명 6 /)).toBeNull();
  const expand = screen.getAllByRole("button", { name: "설명 펼치기" })[0];
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expand);
  expect(
    screen
      .getByRole("button", { name: "설명 접기" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
  expect(screen.getByText(/^설명 0 /)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "지난 신고 1개 보기" }));
  expect(screen.getByText(/^설명 6 /)).toBeTruthy();
  const figure = screen.getByRole("button", { name: "그림 오류 1" });
  fireEvent.click(figure);
  expect(figure.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/^설명 0 /)).toBeTruthy();
  expect(screen.queryByText(/^설명 5 /)).toBeNull();
  fireEvent.click(figure);
  expect(figure.getAttribute("aria-pressed")).toBe("false");
});

test("최신 수정안만 비교하고 이전 선택과 승인 기록을 보여 준다", async () => {
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "written",
    body: "원래",
    explanation: "해설",
    figure: null,
    model_answer: "답",
    hard_condition: null,
    hard_condition_reason: null,
    choices: [],
    rubric: [],
  };
  const revisions = [
    {
      id: "old",
      source: "ai",
      status: "approved",
      created_at: "2026-01-01",
      checks: [],
      payload: { ...question, body: "옛 수정" },
    },
    {
      id: "new",
      source: "manual",
      status: "passed",
      created_at: "2026-01-03",
      checks: [],
      payload: { ...question, body: "최신 수정" },
    },
    {
      id: "middle",
      source: "ai",
      status: "failed",
      created_at: "2026-01-02",
      checks: [{ number: 1, issues: ["오류"] }],
      payload: { ...question, body: "중간 수정" },
    },
  ];
  mock.detail.mockResolvedValue({
    question,
    choices: [],
    rubric: [],
    rubric_links: [],
    reports: [openReport],
    unit: null,
    assessment_item: { id: "a", name: "항목" },
    revisions,
  });
  render(<AdminQuestionView id="q" />);
  expect(await screen.findByText("최신 수정")).toBeTruthy();
  expect(screen.queryByText("옛 수정")).toBeNull();
  expect(screen.queryByText("중간 수정")).toBeNull();
  expect(screen.getByText("승인됨 — 새 문제로 교체됨")).toBeTruthy();
  expect(screen.getByRole("button", { name: "승인" })).toBeTruthy();
  fireEvent.click(screen.getByText("이전 수정안 2개"));
  fireEvent.click(screen.getByRole("button", { name: /AI.*검사 실패/ }));
  expect(screen.getByText("중간 수정")).toBeTruthy();
  expect(screen.queryByText("최신 수정")).toBeNull();
  expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "최신 수정안으로" }));
  expect(screen.getByText("최신 수정")).toBeTruthy();
});

test("문제 없음 처리 후 패널 알림과 처리 완료 요약을 표시한다", async () => {
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "multiple_choice",
    body: "문제",
    explanation: "해설",
    figure: null,
    model_answer: null,
    hard_condition: null,
    hard_condition_reason: null,
    choices: [],
    rubric: [],
  };
  const revision = {
    id: "r",
    source: "ai",
    status: "discarded",
    payload: question,
    checks: [{ decision: "no_change", reason: "오류가 없어요." }],
  };
  const base = {
    question,
    choices: [],
    rubric: [],
    rubric_links: [],
    unit: null,
    assessment_item: { id: "a", name: "항목" },
    revisions: [revision],
  };
  const closed = {
    ...openReport,
    status: "no_issue",
    resolved_at: "2026-01-02T03:04:00Z",
    resolution_note: "확인 후 수정한 메모",
  };
  mock.detail
    .mockReset()
    .mockResolvedValueOnce({ ...base, reports: [openReport] })
    .mockResolvedValue({ ...base, reports: [closed] });
  let finish: () => void = () => {};
  mock.noIssue.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<AdminQuestionView id="q" />);
  const closeButton = await screen.findByRole("button", {
    name: "문제 없음으로 닫기",
  });
  const revisionNote = screen.getAllByLabelText("문제 없음 메모")[1];
  fireEvent.change(revisionNote, { target: { value: "확인 후 수정한 메모" } });
  fireEvent.click(closeButton);
  expect(
    screen
      .getByRole("button", { name: "처리 중으로" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  finish();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "문제 없음으로 닫았어요",
    ),
  );
  expect(screen.getByRole("heading", { name: "처리 완료" })).toBeTruthy();
  expect(screen.getByText("처리 메모: 확인 후 수정한 메모")).toBeTruthy();
  expect(screen.getByText(/처리 2026/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "AI 수정안 만들기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "직접 수정" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "문제 없음으로 닫기" }),
  ).toBeNull();
  expect(screen.getByText("이 판단으로 닫았어요")).toBeTruthy();
});

test("닫힌 신고만 있으면 승인과 닫기 버튼이 없고 빈 객관식 채점 기준을 설명한다", async () => {
  const question = {
    id: "q",
    assessment_item_id: "a",
    difficulty: "normal",
    variant: 1,
    question_type: "multiple_choice",
    body: "문제",
    explanation: "해설",
    figure: null,
    model_answer: null,
    hard_condition: null,
    hard_condition_reason: null,
    choices: [],
    rubric: [],
  };
  const reports = [
    {
      ...openReport,
      status: "fixed",
      resolved_at: "2026-01-02T00:00:00Z",
      resolution_note: null,
    },
  ];
  mock.detail.mockReset().mockResolvedValue({
    question,
    choices: [],
    rubric: [],
    rubric_links: [],
    reports,
    unit: null,
    assessment_item: { id: "a", name: "항목" },
    revisions: [
      {
        id: "pass",
        source: "ai",
        status: "passed",
        payload: question,
        checks: [],
      },
      {
        id: "nochange",
        source: "ai",
        status: "discarded",
        payload: question,
        checks: [{ decision: "no_change", reason: "오류 없어요" }],
      },
    ],
  });
  render(<AdminQuestionView id="q" />);
  expect(
    (await screen.findAllByText("객관식 문제라 채점 기준이 없어요")).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
  fireEvent.click(screen.getByText("이전 수정안 1개"));
  fireEvent.click(screen.getByRole("button", { name: /AI.*수정 없음/ }));
  expect(
    screen.queryByRole("button", { name: "문제 없음으로 닫기" }),
  ).toBeNull();
  expect(screen.queryByText("이 판단으로 닫았어요")).toBeNull();
});
