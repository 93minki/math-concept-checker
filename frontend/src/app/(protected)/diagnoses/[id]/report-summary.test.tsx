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
