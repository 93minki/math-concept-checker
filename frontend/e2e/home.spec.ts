import { expect, test } from "@playwright/test";

test("첫 화면이 열리고 가로로 넘치지 않는다", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "수학 개념 체커" }),
  ).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
