import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Summary } from "../src/app/(protected)/learning-map";

test("남은 개념 체크 요약은 360px에서 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const css = [
    "node_modules/@astryxdesign/core/src/reset.css",
    "node_modules/@astryxdesign/core/dist/astryx.css",
    "src/themes/concept/concept.css",
    "src/app/globals.css",
    "src/app/(protected)/learning-map.css",
  ]
    .map((path) => readFileSync(resolve(path), "utf8"))
    .join("\n");
  const markup = renderToStaticMarkup(
    <div className="study-page">
      <Summary
        units={[
          {
            id: 1,
            grade: "중1",
            number: 1,
            name: "단원",
            publisher: "출판사",
            aliases: [],
            concepts: [],
            status: "full",
            in_progress_diagnosis_id: null,
            latest_result: null,
          },
        ]}
        grade="중1"
        quota={{
          limit: 3,
          used: 1,
          remaining: 2,
          unlimited: false,
          resets_at: null,
        }}
      />
    </div>,
  );
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>${markup}`,
  );
  await expect(page.getByText("오늘 남은 개념 체크 2/3")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
