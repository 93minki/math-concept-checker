import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import UnitSelection from "./unit-selection";
import DiagnosisView from "./diagnoses/[id]/diagnosis-view";
import { ApiError, type Diagnosis, type Unit } from "@/lib/diagnosis-api";

const mocks = vi.hoisted(() => ({
  getUnits: vi.fn(),
  startDiagnosis: vi.fn(),
  getDiagnosis: vi.fn(),
  saveAnswer: vi.fn(),
  submitStage: vi.fn(),
  getReport: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => {
  const router = { push: mocks.push, replace: vi.fn() };
  return {
    useRouter: () => router,
    useSearchParams: () => new URLSearchParams(),
  };
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test" } } }),
    },
  }),
}));
vi.mock("@/lib/diagnosis-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/diagnosis-api")>()),
  ...mocks,
}));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_REPLACE_ME",
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
  },
}));
const units: Unit[] = [
  {
    id: 1,
    grade: "중1",
    number: 1,
    name: "문자와 식",
    publisher: "동아출판",
    aliases: ["문자식"],
    status: "partial",
    in_progress_diagnosis_id: "old",
    latest_result: null,
  },
  {
    id: 2,
    grade: "중2",
    number: 2,
    name: "도형",
    publisher: "동아출판",
    aliases: [],
    status: "unavailable",
    in_progress_diagnosis_id: null,
    latest_result: null,
  },
];
const threeGrades: Unit[] = [
  ...units,
  { ...units[1], id: 3, grade: "중3", name: "도형과 식", status: "full" },
];
test("학년 탭과 검색 및 진행 상태", async () => {
  mocks.getUnits.mockResolvedValue(threeGrades);
  render(<UnitSelection />);
  expect(await screen.findByText("진행 중")).toBeTruthy();
  expect(screen.getByRole("link", { name: "이어서 풀기" })).toBeTruthy();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(document.querySelector(".grade-chip")).toBeNull();
  expect(screen.getByText("동아출판 기준")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "2. 도형" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "중2" }));
  expect(screen.getByRole("heading", { name: "2. 도형" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "1. 문자와 식" })).toBeNull();
  fireEvent.change(screen.getByLabelText("단원 검색"), {
    target: { value: "식" },
  });
  expect(screen.getByRole("heading", { name: "1. 문자와 식" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "2. 도형과 식" })).toBeTruthy();
  // One results card: count, grade subheadings, no chips, no tab selected.
  const results = screen.getByRole("region", { name: "검색 결과" });
  expect(results.textContent).toContain("검색 결과 2개");
  expect(
    [...results.querySelectorAll("h3")].map((node) => node.textContent),
  ).toEqual(["중1", "중3"]);
  expect(document.querySelector(".grade-chip")).toBeNull();
  expect(
    screen
      .getAllByRole("tab")
      .every((tab) => tab.getAttribute("aria-selected") === "false"),
  ).toBe(true);
});
const diagnosis: Diagnosis = {
  id: "d",
  status: "stage1",
  abort_reason: null,
  started_at: "",
  stage1_submitted_at: null,
  unit: units[0],
  items: [
    {
      id: 1,
      stage: 1,
      position: 1,
      question_type: "multiple_choice",
      body: "$x$",
      figure: null,
      choices: [
        { no: 1, text: "하나", figure: null },
        { no: 2, text: "둘", figure: null },
      ],
      answer: null,
    },
    {
      id: 2,
      stage: 1,
      position: 2,
      question_type: "written",
      body: "설명해요",
      figure: null,
      choices: [],
      answer: null,
    },
  ],
};
const dialogProto = HTMLDialogElement.prototype;
const showModal = dialogProto.showModal;
const closeDialog = dialogProto.close;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUnits.mockResolvedValue(units);
  mocks.getDiagnosis.mockResolvedValue(diagnosis);
  mocks.saveAnswer.mockResolvedValue({});
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  dialogProto.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  if (typeof showModal === "function") {
    dialogProto.showModal = showModal;
  }
  if (typeof closeDialog === "function") {
    dialogProto.close = closeDialog;
  } else {
    dialogProto.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  }
  cleanup();
});
test("학년과 상태를 표시하고 별칭으로 검색한다", async () => {
  render(<UnitSelection />);
  expect(await screen.findByText("동아출판 기준")).toBeTruthy();
  expect(screen.getByText("이 단원은 일부 내용만 진단해요")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "중2" }));
  const unavailable = screen.getByRole("button", { name: "준비 중" });
  expect(unavailable.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(unavailable);
  expect(mocks.startDiagnosis).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "중1" }));
  expect(
    screen.getByRole("link", { name: "이어서 풀기" }).getAttribute("href"),
  ).toBe("/diagnoses/old");
  fireEvent.change(screen.getByLabelText("단원 검색"), {
    target: { value: "문자식" },
  });
  expect(screen.queryByRole("heading", { name: "2. 도형" })).toBeNull();
});
test("진행 중 충돌이면 계속 또는 새로 시작을 고른다", async () => {
  mocks.startDiagnosis
    .mockRejectedValueOnce(
      new ApiError(409, { code: "in_progress", diagnosis_id: "old" }),
    )
    .mockResolvedValueOnce({ diagnosis_id: "new" });
  render(<UnitSelection />);
  fireEvent.click(
    await screen.findByRole("button", { name: "문자와 식 더보기" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "새로 시작하기" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    screen
      .getByRole("heading", { name: "1. 문자와 식" })
      .closest("article")
      ?.contains(dialog),
  ).toBe(true);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "새로 시작하기" }),
  );
  await waitFor(() =>
    expect(mocks.startDiagnosis).toHaveBeenCalledWith(1, true),
  );
  expect(mocks.push).toHaveBeenCalledWith("/diagnoses/new");
});
test("객관식 저장 상태 줄은 항상 있고 선택하면 저장됨이 보인다", async () => {
  render(<DiagnosisView id="d" />);
  await screen.findByRole("radio", { name: /하나/ });
  expect(
    screen
      .getByRole("status", { name: "답안 저장 상태" })
      .closest(".diagnosis-progress"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /하나/ }));
  expect(await screen.findByText("저장 중…")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("저장됨")).toBeTruthy());
});
test("서술형은 글자 수와 위쪽 저장 상태를 표시한다", async () => {
  let finishSave: () => void = () => {};
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalled());
  fireEvent.click(await screen.findByRole("button", { name: "다음" }));
  const count = await screen.findByText("0 / 1000자");
  mocks.saveAnswer.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
  );
  expect(count.closest(".problem-sheet")).toBeNull();
  expect(
    screen
      .getByRole("status", { name: "답안 저장 상태" })
      .closest(".diagnosis-header"),
  ).toBeTruthy();
  vi.useFakeTimers();
  await act(async () => {
    fireEvent.change(screen.getByLabelText("풀이와 답"), {
      target: { value: "답" },
    });
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("저장 중…")).toBeTruthy();
  await act(async () => {
    finishSave();
  });
  vi.useRealTimers();
  await waitFor(() => expect(screen.getByText("저장됨")).toBeTruthy());
});
test("제출 확인 모달에서 계속 풀기는 제출하지 않는다", async () => {
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(await screen.findByRole("button", { name: "다음" }));
  const input = await screen.findByLabelText("풀이와 답");
  fireEvent.change(input, { target: { value: "답" } });
  fireEvent.click(screen.getByRole("button", { name: "제출하기" }));
  const modal = screen.getByRole("dialog", {
    name: "제출 확인",
  }) as HTMLDialogElement;
  expect(modal.open).toBe(true);
  const confirm = screen.getByRole("button", { name: "제출할게요" });
  await waitFor(() => expect(document.activeElement).toBe(confirm));
  const keepSolving = screen.getByRole("button", { name: "계속 풀기" });
  fireEvent.click(keepSolving);
  await waitFor(() => expect(modal.open).toBe(false));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "제출하기" }),
    ),
  );
  expect(mocks.submitStage).not.toHaveBeenCalled();
});
test("객관식은 답하기 전에는 다음이 꺼져 있고 안내가 보인다", async () => {
  render(<DiagnosisView id="d" />);
  const next = await screen.findByRole("button", { name: "다음" });
  expect(next.getAttribute("aria-disabled")).toBe("true");
  const status = screen.getByRole("status", { name: "답안 저장 상태" });
  expect(
    screen.getByText("답을 고르면 다음 문제로 넘어갈 수 있어요")
      .previousElementSibling?.className,
  ).toContain("diagnosis-actions");
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  expect(
    screen.getByRole("button", { name: "다음" }).getAttribute("aria-disabled"),
  ).toBeNull();
  expect(status.textContent).toBe("저장 중…");
  await waitFor(() => expect(status.textContent).toContain("저장됨"));
  expect(
    screen.queryByText("답을 고르면 다음 문제로 넘어갈 수 있어요"),
  ).toBeNull();
});
const twoWritten: Diagnosis = {
  ...diagnosis,
  items: [
    { ...diagnosis.items[1], id: 1, position: 1, body: "첫 서술" },
    { ...diagnosis.items[1], id: 2, position: 2, body: "둘 서술" },
  ],
};
test("서술형은 공백만이면 다음이 꺼지고 글자를 쓰면 켜진다", async () => {
  mocks.getDiagnosis.mockResolvedValue(twoWritten);
  render(<DiagnosisView id="d" />);
  await screen.findByText("1 / 2");
  expect(
    screen.getByRole("button", { name: "다음" }).getAttribute("aria-disabled"),
  ).toBe("true");
  expect(
    screen.getByText("답을 쓰면 다음 문제로 넘어갈 수 있어요"),
  ).toBeTruthy();
  const input = screen.getByLabelText("풀이와 답");
  fireEvent.change(input, { target: { value: "   " } });
  expect(
    screen.getByRole("button", { name: "다음" }).getAttribute("aria-disabled"),
  ).toBe("true");
  fireEvent.change(input, { target: { value: "답" } });
  expect(
    screen.getByRole("button", { name: "다음" }).getAttribute("aria-disabled"),
  ).toBeNull();
  expect(
    screen.queryByText("답을 쓰면 다음 문제로 넘어갈 수 있어요"),
  ).toBeNull();
});
test("마지막 문제는 답하기 전 제출이 꺼지고 안내가 보인다", async () => {
  mocks.getDiagnosis.mockResolvedValue(twoWritten);
  render(<DiagnosisView id="d" />);
  const input = await screen.findByLabelText("풀이와 답");
  fireEvent.change(input, { target: { value: "첫 답" } });
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByText("2 / 2");
  const submit = screen.getByRole("button", { name: "제출하기" });
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("답을 쓰면 제출할 수 있어요")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("풀이와 답"), {
    target: { value: "둘째" },
  });
  expect(submit.getAttribute("aria-disabled")).toBeNull();
  expect(screen.queryByText("답을 쓰면 제출할 수 있어요")).toBeNull();
});
test("첫 문제에는 다음만 있고 마지막 문제에는 제출하기만 있다", async () => {
  render(<DiagnosisView id="d" />);
  await screen.findByRole("button", { name: "다음" });
  expect(screen.queryByRole("button", { name: "제출하기" })).toBeNull();
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(await screen.findByRole("button", { name: "제출하기" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "이전" }));
  await screen.findByRole("button", { name: "다음" });
});
test("답을 저장하고 모두 답해야 제출한다", async () => {
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  await waitFor(() =>
    expect(mocks.saveAnswer).toHaveBeenCalledWith("d", 1, {
      selected_choice: 1,
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "다음" }));
  await screen.findByText("2 / 2");
  const submit = screen.getByRole("button", { name: "제출하기" });
  const input = screen.getByLabelText("풀이와 답");
  fireEvent.change(input, { target: { value: "  " } });
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("답을 쓰면 제출할 수 있어요")).toBeTruthy();
  fireEvent.change(input, { target: { value: "답이에요" } });
  expect(submit.getAttribute("aria-disabled")).toBeNull();
  expect(screen.queryByText("답을 쓰면 제출할 수 있어요")).toBeNull();
  mocks.submitStage.mockResolvedValue({
    status: "stage2",
    report_ready: false,
  });
  mocks.getDiagnosis.mockResolvedValue({
    ...diagnosis,
    status: "stage2",
    stage1_submitted_at: "now",
    items: [
      ...diagnosis.items,
      { ...diagnosis.items[0], id: 3, stage: 2, body: "심화 문제" },
    ],
  });
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole("button", { name: "제출할게요" }));
  expect(
    await screen.findByText(
      "기본 문제를 잘 풀었어요. 심화 문제 1개를 풀어 볼까요?",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("심화 문제", { selector: ".question span span" }),
  ).toBeTruthy();
  expect(mocks.submitStage).toHaveBeenCalledWith("d", 1);
});
test("중단된 진단은 수정할 수 없다", async () => {
  mocks.getDiagnosis.mockResolvedValue({
    ...diagnosis,
    status: "aborted",
    abort_reason: "expired",
  });
  render(<DiagnosisView id="d" />);
  expect(await screen.findByText("기간이 지나 중단된 진단이에요")).toBeTruthy();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(mocks.getReport).not.toHaveBeenCalled();
  // Stage-1 abort: full mascot screen with a way out (user 2026-11-13).
  expect(document.querySelector(".status-screen .mascot-resting")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "단원 선택으로" }).getAttribute("href"),
  ).toBe("/");
});
test("저장에 실패하면 다시 시도할 수 있다", async () => {
  mocks.saveAnswer
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({});
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("저장됨")).toBeTruthy();
  expect(mocks.saveAnswer).toHaveBeenCalledTimes(2);
});
test("저장된 답은 이어서 보여 주고 답하지 않은 첫 문제에서 시작한다", async () => {
  mocks.getDiagnosis.mockResolvedValue({
    ...diagnosis,
    items: [
      {
        ...diagnosis.items[0],
        answer: { selected_choice: 2, written_text: null, updated_at: "now" },
      },
      diagnosis.items[1],
    ],
  });
  render(<DiagnosisView id="d" />);
  expect(await screen.findByText("2 / 2")).toBeTruthy();
  expect(screen.getByLabelText("풀이와 답")).toBeTruthy();
});

const report = {
  unit_stage: "기본 이해",
  concepts: [
    {
      name: "등식",
      stage: "기본 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: true,
      misconceptions: ["한쪽에만 $x$를 더했을 수 있어요"],
    },
  ],
  text: {
    not_understood: "등식을 살펴봐요",
    misconception_explanations: "헷갈릴 수 있어요",
    next_steps: "다시 연습해요",
  },
};
const completed: Diagnosis = {
  ...diagnosis,
  status: "completed",
  stage1_submitted_at: "now",
  items: [
    {
      ...diagnosis.items[0],
      answer: { selected_choice: 1, written_text: null, updated_at: "now" },
      result: { passed: true, explanation: "풀이 설명", correct_choice: 1 },
    },
    { ...diagnosis.items[1], result: null },
  ],
};

test("보기와 선택한 답의 표를 번호와 함께 표시한다", async () => {
  const table = "| $x$ | $7$ |\n|---|---|\n| $y$ | $2$ |";
  const item = {
    ...diagnosis.items[0],
    choices: [{ no: 1, text: table, figure: null }],
  };
  mocks.getDiagnosis.mockResolvedValue({ ...diagnosis, items: [item] });
  const { container, unmount } = render(<DiagnosisView id="d" />);
  await screen.findByRole("radio");
  expect(container.querySelector(".choice .problem-table")).toBeTruthy();
  expect(container.querySelector(".choice .choice-number")?.textContent).toBe(
    "1",
  );
  expect(screen.getByRole("radio", { name: /1/ })).toBeTruthy();
  expect(
    container.querySelector(".choice .problem-text")?.textContent,
  ).not.toContain("1.");
  unmount();

  const figure = {
    kind: "number_line" as const,
    min: 0,
    max: 2,
    tick_step: 1,
    label_step: 1,
    points: [],
    rays: [],
    segments: [],
  };
  mocks.getDiagnosis.mockResolvedValue({
    ...completed,
    items: [
      {
        ...item,
        choices: [{ ...item.choices[0], figure }],
        answer: { selected_choice: 1, written_text: null, updated_at: "now" },
        result: { passed: true, explanation: "풀이", correct_choice: 1 },
      },
    ],
  });
  mocks.getReport.mockResolvedValue(report);
  const result = render(<DiagnosisView id="d" />);
  await screen.findByText("맞았어요");
  expect(result.container.querySelector(".choice .problem-table")).toBeTruthy();
  expect(
    result.container.querySelector(".choice .choice-number")?.textContent,
  ).toBe("1");
  expect(
    result.container.querySelector(".choice .problem-text")?.textContent,
  ).not.toContain("1.");
  expect(result.container.querySelectorAll(".problem-table")).toHaveLength(3);
  expect(result.container.querySelectorAll(".figure")).toHaveLength(3);
});

test("글 보기 전부와 내 답 및 정답을 번호와 내용으로 표시한다", async () => {
  const item = {
    ...diagnosis.items[0],
    choices: [
      { no: 1, text: "첫 보기", figure: null },
      { no: 2, text: "둘째 보기", figure: null },
      { no: 3, text: "셋째 보기", figure: null },
    ],
    answer: { selected_choice: 2, written_text: null, updated_at: "now" },
    result: { passed: false, explanation: "풀이", correct_choice: 3 },
  };
  mocks.getDiagnosis.mockResolvedValue({ ...completed, items: [item] });
  mocks.getReport.mockResolvedValue(report);
  const result = render(<DiagnosisView id="d" />);
  await screen.findByText("틀렸어요");
  const choices = result.container.querySelectorAll(".report-choice");
  expect(choices).toHaveLength(3);
  expect(choices[1].textContent).toContain("내 답");
  expect(choices[2].textContent).toContain("정답");
  const answers = result.container.querySelectorAll(".answer-choice");
  expect(answers[0].textContent).toContain("내 답:2둘째 보기");
  expect(answers[1].textContent).toContain("정답:3셋째 보기");
});

test("완료된 진단은 리포트와 문제별 결과를 표시한다", async () => {
  mocks.getDiagnosis.mockResolvedValue(completed);
  mocks.getReport.mockResolvedValue(report);
  render(<DiagnosisView id="d" />);
  expect(
    await screen.findByRole("heading", { name: "이해도 리포트" }),
  ).toBeTruthy();
  expect(
    await screen.findByText("심화 문제는 아직 준비 중이에요"),
  ).toBeTruthy();
  expect(screen.getByText("등식을 살펴봐요")).toBeTruthy();
  expect(screen.getByText("맞았어요")).toBeTruthy();
  expect(screen.getByText("풀지 않은 문제")).toBeTruthy();
  expect(screen.queryByText(/\d+\s*(점|%)/)).toBeNull();
});

test("채점 실패는 답을 유지하며 안내한다", async () => {
  mocks.submitStage.mockRejectedValue(
    new ApiError(503, { code: "grading_failed" }),
  );
  mocks.getDiagnosis.mockResolvedValue({
    ...diagnosis,
    items: [diagnosis.items[0]],
  });
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(await screen.findByRole("button", { name: "제출하기" }));
  fireEvent.click(screen.getByRole("button", { name: "제출할게요" }));
  expect(
    await screen.findByText("채점을 하지 못했어요. 잠시 후 다시 제출해 주세요"),
  ).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: /하나/ }) as HTMLInputElement).checked,
  ).toBe(true);
});

test("답안 충돌이면 최신 답을 다시 읽는다", async () => {
  const updated = {
    ...diagnosis,
    items: [
      {
        ...diagnosis.items[0],
        answer: { selected_choice: 2, written_text: null, updated_at: "later" },
      },
    ],
  };
  mocks.getDiagnosis
    .mockResolvedValueOnce({ ...diagnosis, items: [diagnosis.items[0]] })
    .mockResolvedValueOnce(updated);
  mocks.submitStage.mockRejectedValue(
    new ApiError(409, { code: "answers_changed" }),
  );
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(await screen.findByRole("button", { name: "제출하기" }));
  fireEvent.click(screen.getByRole("button", { name: "제출할게요" }));
  expect(
    await screen.findByText("답이 바뀌었어요. 다시 제출해 주세요"),
  ).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: /둘/ }) as HTMLInputElement).checked,
  ).toBe(true);
});

test("리포트 오류 후 다시 불러올 수 있다", async () => {
  mocks.getDiagnosis.mockResolvedValue(completed);
  mocks.getReport
    .mockRejectedValueOnce(new ApiError(503))
    .mockResolvedValueOnce(report);
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("등식을 살펴봐요")).toBeTruthy();
  expect(mocks.getReport).toHaveBeenCalledTimes(2);
});

test("심화 제출 중 입력을 막고 완료되면 리포트를 연다", async () => {
  const stage2: Diagnosis = {
    ...diagnosis,
    status: "stage2",
    stage1_submitted_at: "now",
    items: [
      ...diagnosis.items,
      { ...diagnosis.items[0], id: 3, stage: 2, body: "심화 문제" },
    ],
  };
  mocks.getDiagnosis
    .mockResolvedValueOnce(stage2)
    .mockResolvedValueOnce(completed);
  mocks.getReport.mockResolvedValue(report);
  let resolveSubmit: (value: {
    status: string;
    report_ready: boolean;
  }) => void = () => {};
  mocks.submitStage.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
  );
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole("radio", { name: /하나/ }));
  fireEvent.click(await screen.findByRole("button", { name: "제출하기" }));
  fireEvent.click(screen.getByRole("button", { name: "제출할게요" }));
  expect(await screen.findByText("채점하고 있어요")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /하나/ }).matches(":disabled")).toBe(
    true,
  );
  resolveSubmit({ status: "completed", report_ready: true });
  expect(await screen.findByText("등식을 살펴봐요")).toBeTruthy();
  expect(mocks.submitStage).toHaveBeenCalledWith("d", 2);
});

test("2단계 중단 리포트 생성 뒤 갱신된 문제 결과를 보여 준다", async () => {
  const aborted: Diagnosis = {
    ...diagnosis,
    status: "aborted",
    abort_reason: "expired",
    stage1_submitted_at: "now",
    items: [{ ...diagnosis.items[0], stage: 2, result: null }],
  };
  const updated: Diagnosis = {
    ...aborted,
    items: [
      {
        ...aborted.items[0],
        answer: { selected_choice: 1, written_text: null, updated_at: "now" },
        result: { passed: true, explanation: "풀이 설명", correct_choice: 1 },
      },
    ],
  };
  mocks.getDiagnosis
    .mockResolvedValueOnce(aborted)
    .mockResolvedValueOnce(updated);
  mocks.getReport.mockResolvedValue(report);
  render(<DiagnosisView id="d" />);
  expect(await screen.findByText("맞았어요")).toBeTruthy();
  expect(screen.getByText("기간이 지나 중단된 진단이에요")).toBeTruthy();
});

test("그림 보기는 선택 가능한 2열 배치 영역에 표시한다", async () => {
  const figure = {
    kind: "number_line" as const,
    min: 0,
    max: 2,
    tick_step: 1,
    label_step: 1,
    points: [],
    rays: [],
    segments: [],
  };
  mocks.getDiagnosis.mockResolvedValue({
    ...diagnosis,
    items: [
      {
        ...diagnosis.items[0],
        figure,
        choices: diagnosis.items[0].choices.map((c) => ({ ...c, figure })),
      },
    ],
  });
  const { container } = render(<DiagnosisView id="d" />);
  await screen.findByText("기본 문제");
  expect(container.querySelector("fieldset.choice-grid")).toBeTruthy();
  expect(screen.getAllByRole("img", { name: "문제 그림" })).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("radio")[0]);
  expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(
    true,
  );
});
