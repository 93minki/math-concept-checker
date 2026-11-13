import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { decideRoute, proxy } from "./proxy";

const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: mocks.updateSession }));

describe("decideRoute", () => {
  const cases = [
    ["/", false, { rewrite: "/landing" }],
    ["/landing", false, { redirect: "/" }],
    ["/landing", true, { redirect: "/" }],
    ["/history", false, { redirect: "/login" }],
    ["/diagnoses/123", false, { redirect: "/login" }],
    ["/signup/complete", false, { redirect: "/login" }],
    ["/login", false, null],
    ["/signup", false, null],
    ["/auth/callback", false, null],
    ["/", true, null],
    ["/signup/complete", true, null],
    ["/login", true, { redirect: "/" }],
    ["/signup", true, { redirect: "/" }],
    ["/auth/callback", true, null],
  ] as const;
  it.each(cases)(
    "%s with login=%s resolves to %o",
    (path, loggedIn, target) => {
      expect(decideRoute(path, loggedIn)).toEqual(target);
    },
  );
});

describe("proxy 응답", () => {
  it.each([
    [
      "/?source=home",
      false,
      "x-middleware-rewrite",
      "http://localhost:3000/landing?source=home",
    ],
    ["/history", false, "location", "http://localhost:3000/login"],
    ["/landing", true, "location", "http://localhost:3000/"],
  ])(
    "%s 요청에 쿠키와 캐시 방지 헤더를 유지한다",
    async (path, loggedIn, header, expected) => {
      const original = NextResponse.next();
      original.cookies.set("session-test", "refreshed", {
        httpOnly: true,
        path: "/",
      });
      mocks.updateSession.mockResolvedValue({
        response: original,
        isLoggedIn: loggedIn,
      });
      const result = await proxy(
        new NextRequest(`http://localhost:3000${path}`),
      );
      expect(result.headers.get(header)).toBe(expected);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(result.cookies.get("session-test")).toMatchObject({
        value: "refreshed",
        httpOnly: true,
      });
    },
  );
  it("재작성하지 않는 응답에도 캐시 방지 헤더를 설정한다", async () => {
    const response = NextResponse.next();
    mocks.updateSession.mockResolvedValue({ response, isLoggedIn: false });
    expect(
      (await proxy(new NextRequest("http://localhost:3000/login"))).headers.get(
        "cache-control",
      ),
    ).toBe("private, no-store");
  });
});
