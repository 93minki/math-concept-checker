import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("첫 화면이 제목을 렌더링한다", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "수학 개념 체커" }),
  ).toBeDefined();
});
