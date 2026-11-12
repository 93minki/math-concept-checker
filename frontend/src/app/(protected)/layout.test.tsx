import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ProtectedLayout from "./layout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { signup_status: "completed" },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
afterEach(cleanup);
test.each(["지난 기록 화면", "진단 화면"])(
  "%s 보호 레이아웃에 메뉴가 표시된다",
  async (page) => {
    render(await ProtectedLayout({ children: <main>{page}</main> }));
    expect(
      screen.getByRole("link", { name: "수학 개념 체커" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "지난 기록" }).getAttribute("href"),
    ).toBe("/history");
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe(page);
  },
);
