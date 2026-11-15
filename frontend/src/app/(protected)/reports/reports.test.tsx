import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ReportsPage from "./page";
const mock = vi.hoisted(() => ({ get: vi.fn(), router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mock.router }));
vi.mock("@/lib/reports-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reports-api")>()),
  getMyReports: mock.get,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
afterEach(cleanup);
test("빈 신고 목록", async () => {
  mock.get.mockResolvedValue([]);
  render(<ReportsPage />);
  expect(await screen.findByText("아직 신고한 문제가 없어요")).toBeTruthy();
});
test("내 신고는 유형과 상태와 내용을 글로 보여 준다", async () => {
  mock.get.mockResolvedValue([
    {
      id: "r",
      kind: "text",
      description: "<b>오류</b>",
      status: "received",
      created_at: "2026-01-01",
      resolved_at: null,
      diagnosis_items: {
        stage: 1,
        position: 2,
        diagnoses: { display_units: { grade: "중1", number: 3, name: "문자" } },
      },
    },
  ]);
  render(<ReportsPage />);
  expect(await screen.findByText("<b>오류</b>")).toBeTruthy();
  expect(screen.getByText(/1단계 · 2번/)).toBeTruthy();
  expect(screen.getByText("접수")).toBeTruthy();
});
