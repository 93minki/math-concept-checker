import { expect, test } from "@playwright/test";
import { login, noHorizontalOverflow, requiredEnv } from "./helpers";

test("신고 화면을 읽고 대화 상자를 취소하며 관리자 접근은 거부된다", async ({
  page,
}) => {
  await login(
    page,
    requiredEnv("E2E_USER_A_EMAIL"),
    requiredEnv("E2E_USER_A_PASSWORD"),
  );
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "내 신고", exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/history");
  const active = page.getByRole("link", { name: /이어서 풀기/ }).first();
  await expect(active).toBeVisible();
  await active.click();
  await page.getByRole("button", { name: "오류 신고" }).first().click();
  const dialog = page.getByRole("dialog", { name: "문항 오류 신고" });
  await expect(dialog).toBeVisible();
  await noHorizontalOverflow(page);
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).not.toBeVisible();
});
