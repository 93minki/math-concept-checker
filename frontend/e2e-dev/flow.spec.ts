import { expect, test, type Page } from "@playwright/test";
import { login, noHorizontalOverflow, requiredEnv, unitName } from "./helpers";

function unitCard(page: Page) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: new RegExp(unitName) }) });
}
async function start(page: Page) {
  const waiting = page.waitForResponse(response => response.url().endsWith("/diagnoses") && response.request().method() === "POST");
  await unitCard(page).getByRole("button", { name: "진단 시작하기" }).click();
  const response = await waiting;
  if (response.status() === 409) {
    const dialog = page.getByRole("dialog", { name: "진행 중인 진단" });
    await expect(dialog).toBeInViewport();
    await dialog.getByRole("button", { name: "새로 시작하기" }).click();
  } else expect(response.status()).toBe(201);
  await expect(page).toHaveURL(/\/diagnoses\/[0-9a-f-]+$/);
  await expect(page.locator(".question")).toBeVisible();
}
function progress(page: Page) { return page.locator("section p").filter({ hasText: /^\d+\s*\/\s*\d+$/ }); }
async function countQuestions(page: Page) {
  await expect(progress(page)).toHaveText(/^1\s*\/\s*\d+$/);
  const match = (await progress(page).innerText()).match(/^1\s*\/\s*(\d+)$/);
  if (!match) throw new Error("문제 수를 읽지 못했어요");
  const count = Number(match[1]); expect(count).toBeGreaterThan(0); return count;
}
async function solve(page: Page) {
  const count = await countQuestions(page);
  const bodies: string[] = [];
  const answerTypes: ("choice" | "written")[] = [];
  for (let i = 0; i < count; i++) {
    await expect(progress(page)).toHaveText(`${i + 1} / ${count}`);
    await noHorizontalOverflow(page);
    bodies.push(await page.locator(".question").innerText());
    const radio = page.getByRole("radio").first();
    if (await radio.count()) { answerTypes.push("choice"); await radio.check(); }
    else { answerTypes.push("written"); await page.getByLabel("풀이와 답").fill("풀이와 답이에요"); }
    await expect(page.getByText("저장했어요", { exact: true })).toBeVisible();
    if (i < count - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  return { bodies, answerTypes };
}
async function submit(page: Page, stage: 1 | 2) {
  const waiting = page.waitForResponse(response => response.url().endsWith(`/stages/${stage}/submit`) && response.request().method() === "POST");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "제출 확인" });
  await expect(dialog).toBeInViewport();
  await dialog.getByRole("button", { name: "제출할게요" }).click();
  const response = await waiting; expect(response.status()).toBe(200);
  return response.json() as Promise<{ status: "stage2" | "completed" }>;
}

test("진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다", async ({ page }) => {
  await login(page, requiredEnv("E2E_USER_A_EMAIL"), requiredEnv("E2E_USER_A_PASSWORD"));
  await noHorizontalOverflow(page); await start(page);
  const first = await solve(page);
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await unitCard(page).getByRole("link", { name: "이어서 풀기" }).click();
  await expect(progress(page)).toHaveText(/^1\s*\/\s*\d+$/);
  for (let i = 0; i < first.answerTypes.length; i++) {
    await noHorizontalOverflow(page);
    if (first.answerTypes[i] === "choice") await expect(page.getByRole("radio").first()).toBeChecked();
    else await expect(page.getByLabel("풀이와 답")).toHaveValue("풀이와 답이에요");
    if (i < first.answerTypes.length - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  const submitted = await submit(page, 1);
  if (submitted.status === "stage2") {
    const notice = page.getByText(/기본 문제를 잘 풀었어요\. 심화 문제 \d+개를 풀어 볼까요\?/);
    await expect(notice).toBeInViewport();
    await expect(page.getByRole("heading", { name: "심화 문제", exact: true })).toBeVisible();
    await solve(page);
    expect((await submit(page, 2)).status).toBe("completed");
  } else expect(submitted.status).toBe("completed");
  await expect(page.getByRole("heading", { name: "이해도 리포트" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "다음 학습 방향" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "문제별 결과" })).toBeVisible();
  await noHorizontalOverflow(page);
  const nextSteps = page.getByRole("heading", { name: "다음 학습 방향" }).locator("xpath=following-sibling::p[1]");
  const text = await nextSteps.innerText();
  await page.reload();
  await expect(nextSteps).toHaveText(text);
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await start(page);
  for (let i = 0; i < first.bodies.length; i++) {
    await expect(progress(page)).toHaveText(`${i + 1} / ${first.bodies.length}`);
    await noHorizontalOverflow(page);
    expect(await page.locator(".question").innerText()).not.toBe(first.bodies[i]);
    if (i < first.bodies.length - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
});
