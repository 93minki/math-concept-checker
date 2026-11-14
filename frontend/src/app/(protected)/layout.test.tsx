import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ProtectedLayout from "./layout";

const mockPath = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath.value,
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
    mockPath.value = page === "지난 기록 화면" ? "/history" : "/";
    const { container } = render(
      await ProtectedLayout({ children: <main>{page}</main> }),
    );
    const sidebar = within(
      container.querySelector(".study-sidebar") as HTMLElement,
    );
    expect(
      sidebar
        .getByRole("link", { name: "수학 개념 체커" })
        .getAttribute("href"),
    ).toBe("/");
    expect(
      sidebar
        .getByRole("link", { name: "학습하기" })
        .getAttribute("aria-current"),
    ).toBe(mockPath.value === "/" ? "page" : null);
    expect(
      sidebar
        .getByRole("link", { name: "지난 기록" })
        .getAttribute("aria-current"),
    ).toBe(mockPath.value === "/history" ? "page" : null);
    expect(sidebar.queryByText("랭킹")).toBeNull();
    expect(sidebar.queryByText("내 정보")).toBeNull();
    // The icon is decorative: the link is still named by its text.
    expect(
      sidebar
        .getByRole("link", { name: "수학 개념 체커" })
        .querySelector('svg.brand-mark[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(
      sidebar.getByRole("link", { name: "지난 기록" }).getAttribute("href"),
    ).toBe("/history");
    expect(sidebar.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe(page);
  },
);
