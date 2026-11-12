import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import LoginPage from "./page";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
afterEach(cleanup);
test("로그인 페이지는 서버 렌더에 안전한 폼을 제공한다", () => {
  const html = renderToStaticMarkup(<LoginPage />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
  const { container } = render(<LoginPage />);
  expect(
    screen.getByRole("heading", { level: 1, name: "로그인" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("이메일")).toBeTruthy();
  expect(screen.getByLabelText("비밀번호")).toBeTruthy();
  expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
  expect(container.querySelector("form")?.getAttribute("method")).toBe("post");
});
