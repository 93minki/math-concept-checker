import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import HomeActions from "./(protected)/home-actions";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mocks }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

test("로그인 제출과 실패 안내", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: new Error("internal") });
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
    email: "test@example.com", password: "password123",
  }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "이메일 또는 비밀번호를 확인해 주세요.");
});

test("로그인에 성공하면 보호된 첫 화면으로 간다", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("카카오 로그인은 콜백 주소를 전달한다", async () => {
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
  await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
    provider: "kakao",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  }));
});

test("회원가입은 확인 메일 콜백을 설정하고 안내한다", async () => {
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  render(<SignupPage />);
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "가입하기" }));
  await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
    email: "test@example.com",
    password: "password123",
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  }));
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "확인 메일을 보냈어요. 메일의 링크를 눌러 주세요.");
});

test("로그아웃 성공 시 로그인으로 이동한다", async () => {
  mocks.signOut.mockResolvedValue({ error: null });
  render(<HomeActions />);
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login"));
});

test("로그아웃 실패 시 쉬운 안내를 보여 준다", async () => {
  mocks.signOut.mockResolvedValue({ error: new Error("internal") });
  render(<HomeActions />);
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "로그아웃하지 못했어요. 다시 시도해 주세요.");
});
