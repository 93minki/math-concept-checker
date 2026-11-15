import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ReportButton from "./report-button";
import { ApiError } from "@/lib/diagnosis-api";
const mock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/reports-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reports-api")>()),
  reportQuestion: mock.send,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
beforeEach(() => {
  mock.send.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
test("유형 필수, 글자 제한과 요청 형태 및 정답 비노출", async () => {
  mock.send.mockResolvedValue({});
  render(<ReportButton itemId={42} />);
  fireEvent.click(screen.getByRole("button", { name: "오류 신고" }));
  expect(
    screen
      .getByRole("button", { name: "보내기" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(screen.getByLabelText("설명 (선택)").getAttribute("maxlength")).toBe(
    "500",
  );
  expect(screen.queryByText("정답", { exact: true })).toBeNull();
  fireEvent.click(screen.getByLabelText("문제 글 오류"));
  fireEvent.change(screen.getByLabelText("설명 (선택)"), {
    target: { value: "오류" },
  });
  expect(screen.getByText("498자 남음")).toBeTruthy();
  fireEvent.submit(screen.getByLabelText("설명 (선택)").closest("form")!);
  await waitFor(() =>
    expect(mock.send).toHaveBeenCalledWith(42, "text", "오류"),
  );
  expect(await screen.findByText("신고가 접수됐어요")).toBeTruthy();
});
test("중복 신고는 409 안내를 표시한다", async () => {
  mock.send.mockRejectedValue(new ApiError(409));
  render(<ReportButton itemId={1} />);
  fireEvent.click(screen.getByRole("button", { name: "오류 신고" }));
  fireEvent.click(screen.getByLabelText("기타"));
  fireEvent.submit(screen.getByLabelText("설명 (선택)").closest("form")!);
  expect(await screen.findByText("이미 신고한 문제예요")).toBeTruthy();
});

test("신고 유형은 포커스 가능한 같은 라디오 그룹이다", () => {
  render(<ReportButton itemId={7} />);
  fireEvent.click(screen.getByRole("button", { name: "오류 신고" }));
  const first = screen.getByRole("radio", {
    name: "문제 글 오류",
  }) as HTMLInputElement;
  const second = screen.getByRole("radio", {
    name: "보기·정답 오류",
  }) as HTMLInputElement;
  expect(first.type).toBe("radio");
  expect(first.name).toBe(second.name);
  first.focus();
  expect(document.activeElement).toBe(first);
  expect(fireEvent.keyDown(first, { key: "ArrowRight" })).toBe(true);
  fireEvent.click(second);
  expect(second.checked).toBe(true);
  expect(first.checked).toBe(false);
});
