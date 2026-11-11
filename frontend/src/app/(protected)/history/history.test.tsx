import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError, type HistoryItem } from "@/lib/diagnosis-api";
import HomeActions from "../home-actions";
import DiagnosisView from "../diagnoses/[id]/diagnosis-view";
import History from "./history";

const mocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  getDiagnosis: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => {
  const router = { push: mocks.push, refresh: vi.fn() };
  return { useRouter: () => router };
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}));
vi.mock("@/lib/diagnosis-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/diagnosis-api")>()),
  ...mocks,
}));

const item: HistoryItem = {
  id: "1",
  status: "stage1",
  abort_reason: null,
  started_at: "2026-11-11T00:30:00Z",
  completed_at: null,
  aborted_at: null,
  unit: { grade: "중1", name: "문자와 식", publisher: "출판사" },
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

test("상태와 한국 시각을 표시하고 진단으로 연결한다", async () => {
  mocks.getHistory.mockResolvedValue({
    items: [
      item,
      { ...item, id: "2", status: "stage2" },
      { ...item, id: "3", status: "completed" },
      { ...item, id: "4", status: "aborted", abort_reason: "expired" },
      { ...item, id: "5", status: "aborted", abort_reason: "restarted" },
    ],
    next_before: null,
  });
  render(<History />);
  expect(await screen.findAllByText("진행 중")).toHaveLength(2);
  expect(screen.getByText("완료")).toBeTruthy();
  expect(screen.getByText("중단 (기간 만료)")).toBeTruthy();
  expect(screen.getByText("중단 (새로 시작)")).toBeTruthy();
  expect(screen.getAllByText(/2026년 11월 11일 오전 9:30/)).toHaveLength(5);
  expect(screen.getAllByText("이어서 풀기")).toHaveLength(2);
  expect(
    screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href") === "/diagnoses/1"),
  ).toBeTruthy();
});

test("빈 목록에서 단원 선택으로 이동한다", async () => {
  mocks.getHistory.mockResolvedValue({ items: [], next_before: null });
  render(<History />);
  expect(await screen.findByText("아직 진단 기록이 없어요")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /단원 선택으로/ }).getAttribute("href"),
  ).toBe("/");
});

test("더 보기로 이어 붙이고 마지막에 버튼을 숨긴다", async () => {
  mocks.getHistory
    .mockResolvedValueOnce({ items: [item], next_before: "cursor+/=" })
    .mockResolvedValueOnce({
      items: [{ ...item, id: "2", unit: { ...item.unit, name: "도형" } }],
      next_before: null,
    });
  render(<History />);
  fireEvent.click(await screen.findByRole("button", { name: "더 보기" }));
  expect(await screen.findByText(/도형/)).toBeTruthy();
  expect(screen.getByText(/문자와 식/)).toBeTruthy();
  expect(mocks.getHistory).toHaveBeenLastCalledWith(20, "cursor+/=");
  expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
});

test("불러오기 실패 후 다시 시도한다", async () => {
  mocks.getHistory
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ items: [item], next_before: null });
  render(<History />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText(/문자와 식/)).toBeTruthy();
});

test.each([
  [401, "/login"],
  [403, "/signup/complete"],
])("인증 오류 %i 이동", async (status, path) => {
  mocks.getHistory.mockRejectedValue(new ApiError(status));
  render(<History />);
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(path));
});

test("첫 화면과 진단 화면에 지난 기록 링크가 있다", () => {
  mocks.getDiagnosis.mockReturnValue(new Promise(() => {}));
  render(
    <>
      <HomeActions />
      <DiagnosisView id="1" />
    </>,
  );
  expect(
    screen.getByRole("link", { name: "지난 기록" }).getAttribute("href"),
  ).toBe("/history");
  expect(
    screen.getByRole("link", { name: "지난 기록으로" }).getAttribute("href"),
  ).toBe("/history");
});
