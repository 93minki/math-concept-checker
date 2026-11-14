import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AccountPage from "./page";
import PrivacyConsent from "@/app/privacy-consent";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  signIn: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push, refresh: mock.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mock.getUser,
      signInWithPassword: mock.signIn,
      updateUser: mock.update,
      signOut: mock.signOut,
    },
  }),
}));
vi.mock("@/lib/diagnosis-api", () => ({ deleteAccount: mock.remove }));

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({
    data: {
      user: {
        email: "student@example.test",
        created_at: "2026-01-02T00:00:00Z",
        app_metadata: { provider: "email" },
      },
    },
    error: null,
  });
  mock.signIn.mockResolvedValue({ error: null });
  mock.update.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.remove.mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
async function page() {
  render(<AccountPage />);
  await screen.findByText("student@example.test");
}
function fill() {
  fireEvent.change(screen.getByLabelText("현재 비밀번호"), {
    target: { value: "old-password" },
  });
  fireEvent.change(screen.getByLabelText("새 비밀번호", { exact: true }), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
    target: { value: "new-password" },
  });
}
test("카카오 가입자는 비밀번호 변경이 없다", async () => {
  mock.getUser.mockResolvedValue({
    data: {
      user: {
        email: "student@example.test",
        created_at: "2026-01-02T00:00:00Z",
        app_metadata: { provider: "kakao" },
      },
    },
    error: null,
  });
  await page();
  expect(screen.getByText("카카오")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "비밀번호 변경" })).toBeNull();
});
test("일치하고 유효한 세 칸에서만 변경을 켠다", async () => {
  await page();
  const button = screen.getByRole("button", {
    name: "변경",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fill();
  expect(button.disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
    target: { value: "다름" },
  });
  expect(button.disabled).toBe(true);
  expect(button.closest("form")?.getAttribute("method")).toBe("post");
});
test("현재 비밀번호가 틀리면 변경하지 않는다", async () => {
  mock.signIn.mockResolvedValue({ error: new Error("wrong") });
  await page();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "변경" }));
  expect(await screen.findByText("현재 비밀번호가 맞지 않아요")).toBeTruthy();
  expect(mock.update).not.toHaveBeenCalled();
});
test("현재 비밀번호 확인 뒤 변경하고 입력을 비운다", async () => {
  await page();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "변경" }));
  expect(await screen.findByText("비밀번호를 바꿨어요")).toBeTruthy();
  expect(mock.signIn).toHaveBeenCalledWith({
    email: "student@example.test",
    password: "old-password",
  });
  expect(mock.update).toHaveBeenCalledWith({
    password: "new-password",
    current_password: "old-password",
  });
  expect(mock.signIn.mock.invocationCallOrder[0]).toBeLessThan(
    mock.update.mock.invocationCallOrder[0],
  );
  expect(
    (screen.getByLabelText("현재 비밀번호") as HTMLInputElement).value,
  ).toBe("");
});
test("탈퇴 취소는 API를 부르지 않는다", async () => {
  await page();
  fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
  const dialog = screen.getByRole("dialog", { name: "정말 탈퇴하시겠어요?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(mock.remove).not.toHaveBeenCalled();
});
test("탈퇴 성공 시 로그아웃하고 이동한다", async () => {
  await page();
  fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
  fireEvent.click(
    within(
      screen.getByRole("dialog", { name: "정말 탈퇴하시겠어요?" }),
    ).getByRole("button", { name: "탈퇴" }),
  );
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/"));
  expect(mock.remove.mock.invocationCallOrder[0]).toBeLessThan(
    mock.signOut.mock.invocationCallOrder[0],
  );
});
test("탈퇴 실패 시 오류를 보여주고 로그아웃하지 않는다", async () => {
  mock.remove.mockRejectedValue(new Error("failed"));
  await page();
  fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
  const dialog = screen.getByRole("dialog", { name: "정말 탈퇴하시겠어요?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "탈퇴" }));
  expect(await within(dialog).findByRole("alert")).toBeTruthy();
  expect(mock.signOut).not.toHaveBeenCalled();
});
test("약관 대화 상자는 가입 동의와 같은 문구를 보인다", async () => {
  const signup = render(<PrivacyConsent checked={false} onChange={() => {}} />);
  const text = screen.getByRole("region", {
    name: "개인정보 수집·이용 동의 내용",
  }).textContent;
  signup.unmount();
  await page();
  fireEvent.click(screen.getByRole("button", { name: "동의 내용 보기" }));
  const dialog = screen.getByRole("dialog", {
    name: "개인정보 수집·이용 동의",
  });
  expect(
    within(dialog).getByRole("region", { name: "개인정보 수집·이용 동의 내용" })
      .textContent,
  ).toBe(text);
  expect(within(dialog).queryByRole("checkbox")).toBeNull();
});
