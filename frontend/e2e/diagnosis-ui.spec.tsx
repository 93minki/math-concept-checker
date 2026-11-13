import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import ReportSummary from "../src/app/(protected)/diagnoses/[id]/report-summary";
import SolveHeader from "../src/app/(protected)/diagnoses/[id]/solve-header";
import type { Report } from "../src/lib/diagnosis-api";

const report: Report = {
  unit_stage: "기본 이해",
  concepts: [
    {
      name: "등식의 뜻",
      stage: "깊이 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [],
    },
    {
      name: "방정식과 항등식의 구별",
      stage: "아직 이해 못 함",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [
        "문자가 들어 있는 등식은 모두 방정식이라고 생각했을 수 있어요.",
      ],
    },
  ],
  text: {
    not_understood: "방정식과 항등식을 다시 구별해 봐요.",
    misconception_explanations: "문자가 있다는 것만으로 정해지지 않아요.",
    next_steps: "여러 값을 대입해 등식이 항상 참인지 확인해 보세요.",
  },
};

const styles = [
  "node_modules/@astryxdesign/core/src/reset.css",
  "node_modules/@astryxdesign/core/dist/astryx.css",
  "src/themes/concept/concept.css",
  "src/app/globals.css",
]
  .map((path) => readFileSync(resolve(path), "utf8"))
  .join("\n");

for (const theme of ["light", "dark"] as const) {
  test(`${theme} 풀이 머리와 리포트는 화면 너비 안에 표시된다`, async ({
    page,
  }, info) => {
    const markup = renderToStaticMarkup(
      <main className="study-page" data-astryx-theme="concept">
        <VStack gap={6}>
          <SolveHeader
            unit="문자의 사용과 식"
            stage={1}
            index={0}
            total={9}
            status={
              <Text as="span" role="status" aria-label="답안 저장 상태">
                저장됨 ✓
              </Text>
            }
          />
          <HStack className="diagnosis-actions" gap={3}>
            <Button label="이전" variant="secondary" size="lg" width="100%" />
            <Button label="다음" variant="primary" size="lg" width="100%" />
          </HStack>
          <ReportSummary report={report} />
        </VStack>
      </main>,
    );
    await page.setContent(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style><div data-astryx-theme="concept">${markup}</div>`,
    );
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
    }, theme);

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    await expect(
      page.getByRole("progressbar", {
        name: "전체 9문제 중 1번째 문제",
      }),
    ).toHaveAttribute("aria-valuenow", "1");
    await expect(
      page.getByRole("progressbar", {
        name: "단원 이해 단계: 기본 이해",
      }),
    ).toBeVisible();

    const buttons = page.getByRole("button");
    for (let index = 0; index < (await buttons.count()); index++) {
      expect(
        (await buttons.nth(index).boundingBox())?.height,
      ).toBeGreaterThanOrEqual(44);
    }
    // The save status must not move anything when it appears or changes
    // (user 2026-11-13: "저장됨" pushed the page down).
    const statusNode = page.getByRole("status", { name: "답안 저장 상태" });
    const measure = () =>
      page.evaluate(() => {
        const header = document.querySelector(".diagnosis-header");
        const bar = document.querySelector(
          ".diagnosis-progress [role='progressbar']",
        );
        return {
          header: header?.getBoundingClientRect().height,
          bar: bar?.getBoundingClientRect().width,
        };
      });
    for (const text of ["", "저장 중…", "저장됨 ✓"]) {
      const before = await measure();
      await statusNode.evaluate((node, value) => {
        node.textContent = value;
      }, text);
      expect(await measure()).toEqual(before);
    }
    await expect(page.locator(".diagnosis-header")).toHaveCSS(
      "position",
      info.project.name === "mobile" ? "sticky" : "static",
    );
  });
}
