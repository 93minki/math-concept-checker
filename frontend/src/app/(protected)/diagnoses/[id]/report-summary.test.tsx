import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { Report } from "@/lib/diagnosis-api";
import ReportSummary from "./report-summary";

afterEach(cleanup);

const report: Report = {
  unit_stage: "기본 이해",
  concepts: [
    {
      name: "등식의 뜻",
      stage: "깊이 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [],
    },
    {
      name: "등식의 성질",
      stage: null,
      not_measured: true,
      deep_not_attempted: false,
      deep_not_measured: true,
      misconceptions: ["한쪽에만 $x$를 더했을 수 있어요"],
    },
  ],
  text: {
    not_understood: "$x$가 있는 등식을 다시 살펴봐요.",
    misconception_explanations: "양변에 같은 연산을 해야 해요.",
    next_steps: "등식의 성질을 연습해요.",
  },
};

test("숫자 점수 없이 단원과 개념의 3단계 이해 상태를 표시한다", () => {
  render(<ReportSummary report={report} />);

  const unit = screen.getByRole("progressbar", {
    name: "단원 이해 단계: 기본 이해",
  });
  expect(unit.getAttribute("aria-valuenow")).toBe("2");
  expect(unit.getAttribute("aria-valuemax")).toBe("3");

  const deep = screen.getByRole("progressbar", {
    name: "등식의 뜻 이해 단계: 깊이 이해",
  });
  expect(deep.getAttribute("aria-valuenow")).toBe("3");

  const notMeasured = screen.getByRole("progressbar", {
    name: "등식의 성질 이해 단계: 아직 측정하지 못했어요",
  });
  expect(notMeasured.getAttribute("aria-valuenow")).toBe("0");
  expect(screen.getByText("심화 문제는 아직 준비 중이에요")).toBeTruthy();
  expect(screen.getByText(/한쪽에만/)).toBeTruthy();
  expect(screen.queryByText(/\d+\s*(점|%)/)).toBeNull();
});

test("리포트 문장 순서와 빈 문장 생략", () => {
  const { rerender } = render(<ReportSummary report={report} />);
  const headings = screen
    .getAllByRole("heading")
    .map((heading) => heading.textContent);
  expect(headings.indexOf("다음 학습 방향")).toBeLessThan(
    headings.indexOf("이해하지 못한 부분"),
  );
  expect(headings.indexOf("이해하지 못한 부분")).toBeLessThan(
    headings.indexOf("헷갈렸을 수 있는 부분"),
  );
  rerender(
    <ReportSummary
      report={{
        ...report,
        text: {
          next_steps: "",
          not_understood: "",
          misconception_explanations: "",
        },
      }}
    />,
  );
  for (const name of [
    "다음 학습 방향",
    "이해하지 못한 부분",
    "헷갈렸을 수 있는 부분",
  ])
    expect(screen.queryByRole("heading", { name })).toBeNull();
});

test.each([
  ["깊이 이해", "이 단원의 개념을 대부분 깊이 이해하고 있어요."],
  [
    "기본 이해",
    "이 단원의 기본 개념은 이해하고 있어요. 아래에서 더 확인할 개념을 살펴보세요.",
  ],
  [
    "아직 이해 못 함",
    "이 단원에서 다시 확인할 개념이 있어요. 아래 개념별 결과부터 살펴보세요.",
  ],
])("단원 단계 %s의 뜻을 표시한다", (stage, text) => {
  render(<ReportSummary report={{ ...report, unit_stage: stage }} />);
  expect(screen.getByText(text)).toBeTruthy();
});
