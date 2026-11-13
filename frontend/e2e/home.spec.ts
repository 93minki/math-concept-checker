import { expect, test } from "@playwright/test";

test("로그아웃 사용자는 /에서 랜딩을 본다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "점수 말고, 개념을 확인해요" }),
  ).toBeVisible();
  await page.locator("header").getByRole("link", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "로그인" }),
  ).toBeVisible();
});

for (const route of ["/", "/login", "/signup"]) {
  test(`${route} 화면은 가로로 넘치지 않는다`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const controls = page.locator(
      "input:visible, button:visible, header .btn:visible",
    );
    for (let i = 0; i < (await controls.count()); i++) {
      const control = controls.nth(i);
      // A checkbox or radio is pressed through the label that wraps it, so
      // the touch target is that label row (user decision 2026-11-12).
      const toggle = await control.evaluate(
        (node) =>
          node instanceof HTMLInputElement &&
          (node.type === "checkbox" || node.type === "radio"),
      );
      const target = toggle
        ? control.locator("xpath=ancestor::label[1]")
        : control;
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("/signup 동의 체크는 문구를 눌러도 켜진다", async ({ page }) => {
  await page.goto("/signup");
  const consent = page.getByRole("checkbox", {
    name: "개인정보 수집·이용에 동의합니다 (필수)",
  });
  await expect(consent).not.toBeChecked();
  await page.getByText("개인정보 수집·이용에 동의합니다 (필수)").click();
  await expect(consent).toBeChecked();
  await expect(page.getByRole("button", { name: "가입하기" })).toBeEnabled();
});

test("proxy 응답은 공유 캐시에 저장되지 않는다", async ({ request }) => {
  const page = await request.get("/login");
  expect(page.headers()["cache-control"]).toContain("no-store");
  const landing = await request.get("/", { maxRedirects: 0 });
  expect(landing.status()).toBe(200);
  expect(landing.headers()["cache-control"]).toContain("no-store");
  const redirect = await request.get("/history", { maxRedirects: 0 });
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

test("로그아웃 사용자는 지난 기록에서 로그인으로 이동한다", async ({
  page,
}) => {
  await page.goto("/history");
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

test("테마 선택은 새로고침 뒤에도 유지된다", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", {
    name: /(?:다크|라이트) 모드로 바꾸기/,
  });
  await expect(button).toBeVisible();
  await button.click();
  const selected = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(selected);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selected!);
  // Astryx's root <Theme> mirrors the mode onto <html>; check both the
  // document and the theme wrapper inside <body>.
  await expect(page.locator("html")).toHaveCSS("color-scheme", selected!);
  await expect(
    page.locator('body [data-astryx-theme="concept"]').first(),
  ).toHaveCSS("color-scheme", selected!);
});

for (const route of ["/", "/login", "/signup"]) {
  test(`${route}에서 외부 Google 글꼴을 요청하지 않는다`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.hostname === "fonts.googleapis.com" ||
        url.hostname === "fonts.gstatic.com"
      )
        requests.push(url.hostname);
    });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    expect(requests).toEqual([]);
  });
}
