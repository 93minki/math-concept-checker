import { expect, test } from "@playwright/test";

test("로그아웃 사용자는 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "로그인" }),
  ).toBeVisible();
});

for (const route of ["/login", "/signup"]) {
  test(`${route} 화면은 가로로 넘치지 않는다`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const controls = page.locator("input, button");
    for (let i = 0; i < await controls.count(); i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("proxy 응답은 공유 캐시에 저장되지 않는다", async ({ request }) => {
  const page = await request.get("/login");
  expect(page.headers()["cache-control"]).toContain("no-store");
  const redirect = await request.get("/", { maxRedirects: 0 });
  expect(redirect.status()).toBeGreaterThanOrEqual(300);
  expect(redirect.status()).toBeLessThan(400);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
});
