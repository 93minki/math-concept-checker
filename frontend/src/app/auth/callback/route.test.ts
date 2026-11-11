import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

beforeEach(() => vi.clearAllMocks());

test("인증 코드는 세션으로 교환하고 가입 완료로 보낸다", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(
    new NextRequest("http://localhost:3000/auth/callback?code=test-code"),
  );
  expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/signup/complete",
  );
});

test.each([
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/auth/callback?code=bad",
])("코드 없음 또는 교환 실패 시 로그인으로 보낸다: %s", async (url) => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error("internal") });
  const response = await GET(new NextRequest(url));
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/login?error=callback",
  );
});
