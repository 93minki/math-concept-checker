import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AppTheme from "./app-theme";
import ThemeButton from "./theme-button";

vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
test("저장된 테마를 읽고 버튼으로 Astryx 모드와 저장값을 함께 바꾼다", () => {
  localStorage.setItem("theme", "dark");
  document.documentElement.dataset.theme = localStorage.getItem("theme") ?? "";
  const result = render(
    <AppTheme>
      <ThemeButton />
      <p>본문</p>
    </AppTheme>,
  );
  const wrapper = result.container.querySelector(
    '[data-astryx-theme="concept"]',
  );
  expect(wrapper?.getAttribute("data-theme")).toBe("dark");
  expect(screen.getByText("본문")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "라이트 모드로 바꾸기" }));
  expect(localStorage.getItem("theme")).toBe("light");
  expect(wrapper?.getAttribute("data-theme")).toBe("light");
});
