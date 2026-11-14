import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AppTheme from "./app-theme";
import { renderToString } from "react-dom/server";
import ThemeButton from "./theme-button";

vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.cookie = "theme=; path=/; max-age=0";
  delete document.documentElement.dataset.theme;
});
test("저장된 테마를 읽고 버튼으로 Astryx 모드와 저장값을 함께 바꾼다", () => {
  localStorage.setItem("theme", "dark");
  document.documentElement.dataset.theme = localStorage.getItem("theme") ?? "";
  const result = render(
    <AppTheme initialMode="dark">
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

test("서버 렌더링은 전달된 초기 모드를 쓴다", () => {
  const html = renderToString(
    <AppTheme initialMode="light">
      <p>본문</p>
    </AppTheme>,
  );
  expect(html).toContain('data-theme="light"');
});
test("기존 로컬 저장값은 쿠키로 옮기고 쿠키가 우선한다", () => {
  localStorage.setItem("theme", "dark");
  const result = render(
    <AppTheme initialMode="system">
      <p>본문</p>
    </AppTheme>,
  );
  expect(document.cookie).toContain("theme=dark");
  expect(
    result.container
      .querySelector('[data-astryx-theme="concept"]')
      ?.getAttribute("data-theme"),
  ).toBe("dark");
  cleanup();
  document.cookie = "theme=light; path=/";
  const next = render(
    <AppTheme initialMode="light">
      <p>본문</p>
    </AppTheme>,
  );
  expect(
    next.container
      .querySelector('[data-astryx-theme="concept"]')
      ?.getAttribute("data-theme"),
  ).toBe("light");
});
