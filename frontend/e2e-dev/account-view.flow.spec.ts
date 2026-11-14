import { expect, test } from "@playwright/test";
import { login, noHorizontalOverflow, requiredEnv } from "./helpers";

test("시험 계정의 내 정보 조회와 탈퇴 취소", async ({ page }) => {
  const email = requiredEnv("E2E_USER_A_EMAIL");
  await login(page, email, requiredEnv("E2E_USER_A_PASSWORD"));
  await page.goto("/account");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "비밀번호 변경" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "회원 탈퇴" }).click();
  const dialog = page.getByRole("dialog", { name: "정말 탈퇴하시겠어요?" });
  await expect(dialog).toBeVisible();
  await noHorizontalOverflow(page);
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).not.toBeVisible();
});

test("가입을 마친 계정은 가입 마무리 화면 대신 홈으로 간다", async ({
  page,
}) => {
  // Kakao sign-ins always pass /signup/complete; finished accounts must not
  // be asked for consent again. Read-only: account A is not changed.
  await login(
    page,
    requiredEnv("E2E_USER_A_EMAIL"),
    requiredEnv("E2E_USER_A_PASSWORD"),
  );
  await page.goto("/signup/complete");
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(
    page.getByRole("heading", { name: "진단할 단원을 골라요" }),
  ).toBeVisible();
});
