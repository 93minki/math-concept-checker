import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, requiredEnv } from "./helpers";

type Geometry = {
  sidebarX: number;
  sidebarWidth: number;
  contentX: number;
  contentWidth: number;
  pageX: number;
  pageWidth: number;
  titleX: number;
};
async function measure(page: Page, title: Locator): Promise<Geometry> {
  await expect(title).toBeVisible();
  await expect(page.locator(".status-screen[role=status]")).toHaveCount(0);
  const sidebar = await page.locator(".study-sidebar").boundingBox();
  const content = await page.locator(".protected-content").boundingBox();
  const child = await page.locator(".protected-content > main").boundingBox();
  const heading = await title.boundingBox();
  if (!sidebar || !content || !child || !heading)
    throw new Error("레이아웃 위치를 측정할 수 없어요");
  return {
    sidebarX: sidebar.x,
    sidebarWidth: sidebar.width,
    contentX: content.x,
    contentWidth: content.width,
    pageX: child.x,
    pageWidth: child.width,
    titleX: heading.x,
  };
}
test("사이드바 이동 시 본문과 제목의 가로 위치가 유지된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(
    page,
    requiredEnv("E2E_USER_A_EMAIL"),
    requiredEnv("E2E_USER_A_PASSWORD"),
  );
  await expect(page.locator(".path-node").first()).toBeVisible();
  const initial = await measure(
    page,
    page.getByRole("heading", { name: "진단할 단원을 골라요" }),
  );
  const sidebar = page.locator(".study-sidebar");
  await sidebar.getByRole("link", { name: "지난 기록" }).click();
  await expect(page).toHaveURL(/\/history$/);
  const history = await measure(
    page,
    page.getByRole("heading", { name: "지난 기록", exact: true }),
  );
  await sidebar.getByRole("link", { name: "내 정보" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByText(requiredEnv("E2E_USER_A_EMAIL"), { exact: true }),
  ).toBeVisible();
  const account = await measure(
    page,
    page.getByRole("heading", { name: "내 정보", exact: true }),
  );
  await sidebar.getByRole("link", { name: "학습하기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".path-node").first()).toBeVisible();
  const returned = await measure(
    page,
    page.getByRole("heading", { name: "진단할 단원을 골라요" }),
  );
  for (const current of [history, account, returned]) {
    for (const key of Object.keys(initial) as (keyof Geometry)[])
      expect(Math.abs(current[key] - initial[key]), key).toBeLessThanOrEqual(1);
  }
});
