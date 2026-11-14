import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportKindOptions } from "../src/components/report-kind-options";

test("신고 유형은 키보드로 선택하고 방향키로 이동한다", async ({ page }) => {
  const markup = renderToStaticMarkup(
    <ReportKindOptions itemId={1} kind="" onChange={() => {}} />,
  );
  await page.setContent(markup);
  await page.keyboard.press("Tab");
  const first = page.getByRole("radio", { name: "문제 글 오류" });
  await expect(first).toBeFocused();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "보기·정답 오류" }),
  ).toBeChecked();
});
