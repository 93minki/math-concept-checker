import { expect, test } from "@playwright/test";

test("로그아웃 사용자는 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

for (const route of ["/login", "/signup"]) {
  test(`${route} 화면은 가로로 넘치지 않는다`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const controls = page.locator("input, button");
    for (let i = 0; i < (await controls.count()); i++) {
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

test("로그아웃 사용자는 진단 화면에서 로그인으로 이동한다", async ({
  page,
}) => {
  await page.goto("/diagnoses/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

// Before React runs, a native form submit would send the fields as a GET
// query (?email=…&password=…). With JavaScript off, the page must not let
// that happen: the submit button stays disabled and the form is POST.
for (const route of ["/login", "/signup"]) {
  test(`${route} 화면은 스크립트 실행 전에도 비밀번호를 주소로 보내지 않는다`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(route);
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.getByLabel("이메일").fill("leak-check@example.com");
    await page.getByLabel("비밀번호").fill("not-a-real-password");
    await page.getByLabel("비밀번호").press("Enter");
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain("not-a-real-password");
    expect(page.url()).not.toContain("password=");
    await context.close();
  });
}
