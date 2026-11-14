import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "@/lib/diagnosis-api";
import ProtectedLayout from "./layout";

const mockPath = vi.hoisted(() => ({ value: "/" }));
const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
const getAdminMe = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath.value,
  useRouter: () => nav,
  redirect: vi.fn(),
}));
vi.mock("@/lib/reports-api", () => ({
  getAdminMe: () => getAdminMe(),
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
beforeEach(() => {
  nav.replace.mockReset();
  getAdminMe.mockReset();
  getAdminMe.mockRejectedValue(new ApiError(403));
});
afterEach(cleanup);
test.each(["지난 기록 화면", "진단 화면"])(
  "%s 보호 레이아웃에 메뉴가 표시된다",
  async (page) => {
    mockPath.value = page === "지난 기록 화면" ? "/history" : "/";
    const { container } = render(
      await ProtectedLayout({ children: <main>{page}</main> }),
    );
    expect(await screen.findByRole("main")).toHaveProperty("textContent", page);
    expect(nav.replace).not.toHaveBeenCalled();
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
    expect(
      within(sidebar.getByRole("navigation", { name: "주 메뉴" }))
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["학습하기", "지난 기록", "내 신고", "내 정보"]);
    expect(sidebar.queryByRole("link", { name: "신고 관리" })).toBeNull();
    expect(
      sidebar.getByRole("link", { name: "내 정보" }).getAttribute("href"),
    ).toBe("/account");
    expect(
      within(container.querySelector(".protected-header") as HTMLElement)
        .getByRole("link", { name: "내 정보" })
        .getAttribute("href"),
    ).toBe("/account");
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
  },
);

test("관리자는 신고 관리와 내 정보만 보고 학생 화면에서 이동한다", async () => {
  getAdminMe.mockResolvedValue({ admin: true });
  mockPath.value = "/";
  const { container } = render(
    await ProtectedLayout({ children: <main>학생 화면</main> }),
  );
  await waitFor(() =>
    expect(nav.replace).toHaveBeenCalledWith("/admin/reports"),
  );
  const sidebar = within(
    container.querySelector(".study-sidebar") as HTMLElement,
  );
  expect(
    within(sidebar.getByRole("navigation", { name: "주 메뉴" }))
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["신고 관리", "내 정보"]);
  expect(sidebar.queryByRole("link", { name: "학습하기" })).toBeNull();
  expect(sidebar.queryByRole("link", { name: "지난 기록" })).toBeNull();
  expect(sidebar.queryByRole("link", { name: "내 신고" })).toBeNull();
  const header = within(
    container.querySelector(".protected-header") as HTMLElement,
  );
  expect(header.queryByRole("link", { name: "지난 기록" })).toBeNull();
  expect(header.queryByRole("link", { name: "내 신고" })).toBeNull();
  expect(
    header.getByRole("link", { name: "신고 관리" }).getAttribute("href"),
  ).toBe("/admin/reports");
  expect(header.getByRole("link", { name: "내 정보" })).toBeTruthy();
  expect(sidebar.getByRole("button", { name: "로그아웃" })).toBeTruthy();
  expect(header.getByRole("button", { name: "로그아웃" })).toBeTruthy();
  expect(screen.queryByText("학생 화면")).toBeNull();
});

test("내 정보 메뉴의 현재 페이지 표시", async () => {
  mockPath.value = "/account";
  const { container } = render(
    await ProtectedLayout({ children: <main>내 정보</main> }),
  );
  for (const selector of [".study-sidebar", ".protected-header"]) {
    const nav = within(container.querySelector(selector) as HTMLElement);
    expect(
      nav.getByRole("link", { name: "내 정보" }).getAttribute("aria-current"),
    ).toBe("page");
  }
});
