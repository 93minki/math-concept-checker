import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MathText } from "./math-text";
afterEach(cleanup);
test("글과 수식, 줄바꿈을 함께 표시한다", () => {
  const { container } = render(<MathText text={"첫 줄\n$x^2$ 다음"} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector(".math-text")?.textContent).toContain(
    "첫 줄\n",
  );
  expect(container.querySelector(".math-text")?.className).toContain(
    "math-text",
  );
});
test.each(["홀수 $x", "$\\badcommand$", "$$x$$"])(
  "잘못된 수식은 원문과 오류를 표시한다: %s",
  (text) => {
    const { container } = render(<MathText text={text} />);
    expect(container.textContent).toContain(text);
    expect(screen.getByRole("status").textContent).toContain(
      "수식을 표시하지 못했어요",
    );
  },
);
test("일반 글의 HTML과 수식의 href를 실행 가능한 요소로 만들지 않는다", () => {
  const { container } = render(
    <MathText
      text={"<script>alert(1)</script> $\\href{https://example.com}{x}$"}
    />,
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toContain("<script>");
});
