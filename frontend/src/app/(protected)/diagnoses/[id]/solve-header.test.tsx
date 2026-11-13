import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import SolveHeader from "./solve-header";
afterEach(cleanup);
test.each([
  [1, "기본 문제"],
  [2, "심화 문제"],
])("%i단계와 진행 상태를 표시한다", (stage, label) => {
  render(
    <section>
      <SolveHeader
        unit="문자의 사용과 식"
        stage={stage}
        index={1}
        total={9}
        status={<span role="status">저장됨</span>}
      />
    </section>,
  );
  expect(screen.getByText(`${stage}단계 ·`)).toBeTruthy();
  expect(screen.getByRole("heading", { name: label })).toBeTruthy();
  expect(screen.getByText("2 / 9").closest("section")).toBeTruthy();
  expect(
    screen
      .getByRole("progressbar", { name: "전체 9문제 중 2번째 문제" })
      .getAttribute("aria-valuenow"),
  ).toBe("2");
  expect(screen.getByRole("status").textContent).toBe("저장됨");
});

test("이미 답한 문제가 있어도 첫 문제에서는 막대가 1/9이다", () => {
  render(
    <SolveHeader
      unit="식"
      stage={1}
      index={0}
      total={9}
      status={<span role="status" />}
    />,
  );
  const bar = screen.getByRole("progressbar", {
    name: "전체 9문제 중 1번째 문제",
  });
  expect(bar.getAttribute("aria-valuenow")).toBe("1");
  expect(bar.firstElementChild?.getAttribute("style")).toContain("11.111");
});
