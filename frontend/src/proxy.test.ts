import { describe, expect, it } from "vitest";
import { decideRedirect } from "./proxy";

describe("decideRedirect", () => {
  const cases: [string, boolean, string | null][] = [
    ["/", false, "/login"],
    ["/signup/complete", false, "/login"],
    ["/login", false, null],
    ["/signup", false, null],
    ["/auth/callback", false, null],
    ["/", true, null],
    ["/signup/complete", true, null],
    ["/login", true, "/"],
    ["/signup", true, "/"],
    ["/auth/callback", true, null],
  ];
  it.each(cases)("%s with login=%s redirects to %s", (path, loggedIn, target) => {
    expect(decideRedirect(path, loggedIn)).toBe(target);
  });
});
