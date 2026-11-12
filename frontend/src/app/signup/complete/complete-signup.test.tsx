import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CompleteSignup from "./complete-signup";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mocks }),
}));
vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:9" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("privacy-consent", "agreed");
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "fake-token" } },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("가입 완료 요청에 토큰을 보내고 홈으로 이동한다", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  render(<CompleteSignup />);
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:9/signup/complete",
      { method: "POST", headers: { Authorization: "Bearer fake-token" } },
    ),
  );
  expect(mocks.push).toHaveBeenCalledWith("/");
});

test("실패하면 다시 시도할 수 있다", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  render(<CompleteSignup />);
  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("동의 기록이 없으면 가입 완료 전에 동의를 받는다", async () => {
  sessionStorage.clear();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  render(<CompleteSignup />);
  expect(
    await screen.findByText(
      "가입을 마치려면 개인정보 수집·이용에 동의해 주세요.",
    ),
  ).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  const button = screen.getByRole("button", {
    name: "동의하고 가입 마치기",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "개인정보 수집·이용에 동의합니다 (필수)",
    }),
  );
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(sessionStorage.getItem("privacy-consent")).toBe("agreed");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(mocks.push).toHaveBeenCalledWith("/");
});
