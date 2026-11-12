import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, noHorizontalOverflow, requiredEnv, unitName } from "./helpers";

function unitCard(page: Page) {
  return page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: new RegExp(unitName) }) });
}
async function start(page: Page) {
  const waiting = page.waitForResponse(
    (response) =>
      response.url().endsWith("/diagnoses") &&
      response.request().method() === "POST",
  );
  const card = unitCard(page);
  if (await card.getByRole("link", { name: "이어서 풀기" }).isVisible()) {
    await card.getByLabel(`${unitName} 더보기`).click();
    await card.getByRole("button", { name: "새로 시작하기" }).click();
  } else {
    await card
      .getByRole("button", { name: /^(진단 시작하기|다시 진단하기)$/ })
      .click();
  }
  const response = await waiting;
  if (response.status() === 409) {
    const dialog = page.getByRole("dialog", { name: "진행 중인 진단" });
    await expect(dialog).toBeInViewport();
    await dialog.getByRole("button", { name: "새로 시작하기" }).click();
  } else expect(response.status()).toBe(201);
  await expect(page).toHaveURL(/\/diagnoses\/[0-9a-f-]+$/);
  await expect(page.locator(".question")).toBeVisible();
}
function progress(page: Page) {
  return page.locator("section p").filter({ hasText: /^\d+\s*\/\s*\d+$/ });
}
async function countQuestions(page: Page) {
  await expect(progress(page)).toHaveText(/^1\s*\/\s*\d+$/);
  const match = (await progress(page).innerText()).match(/^1\s*\/\s*(\d+)$/);
  if (!match) throw new Error("문제 수를 읽지 못했어요");
  const count = Number(match[1]);
  expect(count).toBeGreaterThan(0);
  return count;
}
async function documentY(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("요소의 위치를 읽지 못했어요");
  const scrollY = await locator.page().evaluate(() => window.scrollY);
  return box.y + scrollY;
}
async function solve(page: Page) {
  const count = await countQuestions(page);
  const bodies: string[] = [];
  const answerTypes: ("choice" | "written")[] = [];
  for (let i = 0; i < count; i++) {
    await expect(progress(page)).toHaveText(`${i + 1} / ${count}`);
    await noHorizontalOverflow(page);
    // Fractions (\dfrac) in the body or choices must not get a vertical
    // scrollbar or be clipped (2026-11-11 manual check).
    expect(
      await page
        .locator(".question, .choice > .math-text")
        .evaluateAll(
          (nodes) =>
            nodes.filter((node) => node.scrollHeight > node.clientHeight)
              .length,
        ),
    ).toBe(0);
    // Submit sits in place of "다음" on the last question only (user decision A).
    const last = i === count - 1;
    await expect(
      page.getByRole("button", { name: "다음", exact: true }),
    ).toHaveCount(last ? 0 : 1);
    await expect(
      page.getByRole("button", { name: "제출하기", exact: true }),
    ).toHaveCount(last ? 1 : 0);
    // Cannot move on (or submit) before answering (user decision 2026-11-11).
    const forward = page.getByRole("button", {
      name: last ? "제출하기" : "다음",
      exact: true,
    });
    await expect(forward).toBeDisabled();
    // The nav row must not move when answering/saving (2026-11-11 manual check).
    // Document Y (viewport y + scrollY) stays the same when the page scrolls.
    const navBefore = await documentY(forward);
    bodies.push(await page.locator(".question").innerText());
    const radio = page.getByRole("radio").first();
    if (await radio.count()) {
      answerTypes.push("choice");
      await radio.check();
    } else {
      answerTypes.push("written");
      await page.getByLabel("풀이와 답").fill("풀이와 답이에요");
    }
    await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
    await expect(forward).toBeEnabled();
    expect(await documentY(forward)).toBe(navBefore);
    if (i < count - 1)
      await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  return { bodies, answerTypes };
}
async function submit(page: Page, stage: 1 | 2) {
  const waiting = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/stages/${stage}/submit`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "제출 확인" });
  await expect(dialog).toBeInViewport();
  await dialog.getByRole("button", { name: "제출할게요" }).click();
  const response = await waiting;
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ status: "stage2" | "completed" }>;
}

async function openHistory(page: Page, diagnosisId: string) {
  const link = page.getByRole("link", { name: "지난 기록으로" });
  await expect(link).toBeInViewport();
  await link.click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "지난 기록" })).toBeVisible();
  const entry = page.locator(`a[href="/diagnoses/${diagnosisId}"]`);
  // Newest first: the diagnosis we just touched is the first card.
  await expect(page.locator('a[href^="/diagnoses/"]').first()).toHaveAttribute(
    "href",
    `/diagnoses/${diagnosisId}`,
  );
  await expect(entry).toBeInViewport();
  await noHorizontalOverflow(page);
  return entry;
}
const diagnosisId = (page: Page) =>
  new URL(page.url()).pathname.split("/").pop() ?? "";

test("진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다", async ({
  page,
}) => {
  await login(
    page,
    requiredEnv("E2E_USER_A_EMAIL"),
    requiredEnv("E2E_USER_A_PASSWORD"),
  );
  await noHorizontalOverflow(page);
  await start(page);
  const first = await solve(page);
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await unitCard(page).getByRole("link", { name: "이어서 풀기" }).click();
  await expect(progress(page)).toHaveText(/^1\s*\/\s*\d+$/);
  for (let i = 0; i < first.answerTypes.length; i++) {
    await noHorizontalOverflow(page);
    if (first.answerTypes[i] === "choice")
      await expect(page.getByRole("radio").first()).toBeChecked();
    else
      await expect(page.getByLabel("풀이와 답")).toHaveValue("풀이와 답이에요");
    if (i < first.answerTypes.length - 1)
      await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  const submitted = await submit(page, 1);
  if (submitted.status === "stage2") {
    const notice = page.getByText(
      /기본 문제를 잘 풀었어요\. 심화 문제 \d+개를 풀어 볼까요\?/,
    );
    await expect(notice).toBeInViewport();
    await expect(
      page.getByRole("heading", { name: "심화 문제", exact: true }),
    ).toBeVisible();
    await solve(page);
    expect((await submit(page, 2)).status).toBe("completed");
  } else expect(submitted.status).toBe("completed");
  await expect(
    page.getByRole("heading", { name: "이해도 리포트" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "다음 학습 방향" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "문제별 결과" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  const nextSteps = page
    .getByRole("heading", { name: "다음 학습 방향" })
    .locator("xpath=following-sibling::p[1]");
  const text = await nextSteps.innerText();
  await page.reload();
  await expect(nextSteps).toHaveText(text);
  // F-10: the finished diagnosis is in the history list and reopens with its
  // report and stored math rendered by KaTeX.
  const finishedId = diagnosisId(page);
  const finished = await openHistory(page, finishedId);
  await expect(finished).toContainText("완료");
  await finished.click();
  await expect(page).toHaveURL(new RegExp(`/diagnoses/${finishedId}$`));
  await expect(
    page.getByRole("heading", { name: "이해도 리포트" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "문제별 결과" }),
  ).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.getByText("수식을 표시하지 못했어요")).toHaveCount(0);
  await noHorizontalOverflow(page);
  await page.getByRole("link", { name: "← 단원 선택으로" }).click();
  await start(page);
  for (let i = 0; i < first.bodies.length; i++) {
    await expect(progress(page)).toHaveText(
      `${i + 1} / ${first.bodies.length}`,
    );
    await noHorizontalOverflow(page);
    expect(await page.locator(".question").innerText()).not.toBe(
      first.bodies[i],
    );
    // "다음" stays disabled until the question is answered.
    const radio = page.getByRole("radio").first();
    if (await radio.count()) await radio.check();
    else await page.getByLabel("풀이와 답").fill("풀이와 답이에요");
    if (i < first.bodies.length - 1)
      await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  // F-10: an in-progress diagnosis opens from the list and continues.
  const runningId = diagnosisId(page);
  const running = await openHistory(page, runningId);
  await expect(running).toContainText("진행 중");
  await expect(running).toContainText("이어서 풀기");
  await running.click();
  await expect(page).toHaveURL(new RegExp(`/diagnoses/${runningId}$`));
  await expect(progress(page)).toHaveText(/^1\s*\/\s*\d+$/);
});
