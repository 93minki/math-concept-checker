import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ThemeButton from "./theme-button";
let dark = false;
let change = () => {};
const media = {
  get matches() {
    return dark;
  },
  addEventListener: (_: string, callback: () => void) => {
    change = callback;
  },
  removeEventListener: () => {},
};
vi.stubGlobal("matchMedia", () => media);
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.cookie = "theme=; path=/; max-age=0";
  delete document.documentElement.dataset.theme;
  dark = false;
  vi.restoreAllMocks();
});
test("저장된 선택이 없으면 시스템을 따르고 전환하면 저장한다", () => {
  render(<ThemeButton />);
  expect(
    screen.getByRole("button", { name: "다크 모드로 바꾸기" }),
  ).toBeTruthy();
  dark = true;
  act(() => change());
  fireEvent.click(screen.getByRole("button", { name: "라이트 모드로 바꾸기" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("theme")).toBe("light");
  expect(document.cookie).toContain("theme=light");
  expect(
    screen.getByRole("button", { name: "다크 모드로 바꾸기" }),
  ).toBeTruthy();
});
test("저장에 실패해도 화면 테마가 바뀐다", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole("button", { name: "다크 모드로 바꾸기" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.cookie).toContain("theme=dark");
  expect(
    screen.getByRole("button", { name: "라이트 모드로 바꾸기" }),
  ).toBeTruthy();
});
