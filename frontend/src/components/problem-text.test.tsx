import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ProblemText } from "./problem-text";
afterEach(cleanup);
test("수식 안 세로선은 칸을 나누지 않고 HTML은 글로 남는다", () => {
  const { container } = render(
    <ProblemText
      text={"머리\n| 값 | 설명 |\n|---|:---:|\n| $|x|$ | <b>글</b> |\n끝"}
    />,
  );
  expect(container.querySelectorAll("th")).toHaveLength(2);
  expect(container.querySelectorAll("td")).toHaveLength(2);
  expect(container.querySelector(".katex")).toBeTruthy();
  expect(container.querySelector("b")).toBeNull();
  expect(container.textContent).toContain("<b>글</b>");
  expect(container.textContent).toContain("끝");
});
test("표가 아닌 세로선 줄은 글로 남는다", () => {
  const { container } = render(<ProblemText text={"a | b\n다음 줄"} />);
  expect(container.querySelector("table")).toBeNull();
  expect(container.textContent).toContain("a | b");
});
