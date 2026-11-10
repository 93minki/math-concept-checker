import { expect, test, type Page } from "@playwright/test";
import { login, noHorizontalOverflow, requiredEnv, unitName } from "./helpers";

function unitCard(page: Page) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: new RegExp(unitName) }) });
}

async function start(page: Page, expectConflict = false) {
  const startResponse = page.waitForResponse(response => response.url().endsWith("/diagnoses") && response.request().method() === "POST");
  await unitCard(page).getByRole("button", { name: "진단 시작하기" }).click();
  const response = await startResponse;
  if (expectConflict) expect(response.status()).toBe(409);
  if (response.status() === 409) {
    const dialog = page.getByRole("dialog", { name: "진행 중인 진단" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();
    await dialog.getByRole("button", { name: "새로 시작하기" }).click();
  } else {
    expect(response.status()).toBe(201);
  }
  await expect(page).toHaveURL(/\/diagnoses\/[0-9a-f-]+$/);
  await expect(page.locator(".question")).toBeVisible();
}

test("진단을 풀고 이어서 확인해 제출하면 다음 진단은 다른 변형을 출제한다", async ({ page }) => {
  await login(page, requiredEnv("E2E_USER_A_EMAIL"), requiredEnv("E2E_USER_A_PASSWORD"));
  await noHorizontalOverflow(page);
  await expect(unitCard(page)).toBeVisible();
  await start(page);
  const progress = page.locator("section p").filter({ hasText: /^\d+\s*\/\s*\d+$/ });
  await expect(progress).toHaveText(/^1\s*\/\s*\d+$/);
  const match = (await progress.innerText()).match(/^1\s*\/\s*(\d+)$/);
  if (!match) throw new Error("문제 수를 읽지 못했어요");
  const count = Number(match[1]);
  expect(count).toBeGreaterThan(0);
  const bodies: string[] = [];
  const answerTypes: ("choice" | "written")[] = [];
  for (let i = 0; i < count; i++) {
    await expect(progress).toHaveText(`${i + 1} / ${count}`);
    await noHorizontalOverflow(page);
    bodies.push(await page.locator(".question").innerText());
    const radio = page.getByRole("radio").first();
    if (await radio.count()) {
      answerTypes.push("choice");
      await radio.check();
    } else {
      answerTypes.push("written");
      await page.getByLabel("풀이와 답").fill("풀이와 답이에요");
    }
    await expect(page.getByText("저장했어요", { exact: true })).toBeVisible();
    if (i < count - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await unitCard(page).getByRole("link", { name: "이어서 풀기" }).click();
  await expect(progress).toHaveText(new RegExp(`^\\d+\\s*\\/\\s*${count}$`));
  // Resume opens at the first unanswered question, or the first one when all are answered.
  while (!/^1\s*\/\s*\d+$/.test(await progress.innerText())) await page.getByRole("button", { name: "이전", exact: true }).click();
  for (let i = 0; i < count; i++) {
    await expect(progress).toHaveText(`${i + 1} / ${count}`);
    await noHorizontalOverflow(page);
    if (answerTypes[i] === "choice") await expect(page.getByRole("radio").first()).toBeChecked();
    else await expect(page.getByLabel("풀이와 답")).toHaveValue("풀이와 답이에요");
    if (i < count - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByRole("dialog", { name: "제출 확인" }).getByRole("button", { name: "제출할게요" }).click();
  await expect(page.getByText("제출했어요. 채점 기능은 준비 중이에요")).toBeVisible();
  for (let i = count - 1; i >= 0; i--) {
    if (answerTypes[i] === "choice") await expect(page.getByRole("radio").first()).toBeDisabled();
    else await expect(page.getByLabel("풀이와 답")).toBeDisabled();
    if (i > 0) await page.getByRole("button", { name: "이전", exact: true }).click();
  }
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await start(page, true);
  for (let i = 0; i < count; i++) {
    await expect(progress).toHaveText(`${i + 1} / ${count}`);
    await noHorizontalOverflow(page);
    expect(await page.locator(".question").innerText()).not.toBe(bodies[i]);
    if (i < count - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
});
