import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Figure } from "../src/components/figure";
import { ProblemText } from "../src/components/problem-text";
import type { Figure as FigureData } from "../src/lib/figures";

const figure: FigureData = {
  kind: "boxplot",
  axis_min: 0,
  axis_max: 10,
  axis_step: 1,
  series: [
    { label: "다람쥐 모둠 이름", min: 1, q1: 2, median: 4, q3: 7, max: 9 },
  ],
};
const choice: FigureData = {
  kind: "number_line",
  min: -2,
  max: 2,
  tick_step: 1,
  label_step: 1,
  points: [{ x: 1, label: "A", filled: false }],
  rays: [],
  segments: [],
};

const examples: FigureData[] = [
  choice,
  {
    kind: "coordinate_plane",
    x_min: -2,
    x_max: 2,
    y_min: -2,
    y_max: 2,
    tick_step: 1,
    show_tick_labels: true,
    points: [{ x: 1, y: 1, label: "점 A" }],
    graphs: [{ type: "quadratic", a: 1, p: 0, q: 0, label: null }],
  },
  {
    kind: "bar_chart",
    categories: ["A", "B", "C"],
    values: [2, 4, 3],
    y_max: 5,
    y_step: 1,
    x_label: "모둠",
    y_label: "도수",
  },
  {
    kind: "frequency",
    class_start: 0,
    class_width: 10,
    frequencies: [2, 4, 3],
    show_bars: true,
    show_polygon: true,
    y_step: 1,
    x_label: "점수",
    y_label: "도수",
  },
  figure,
  {
    kind: "scatter",
    x_min: 0,
    x_max: 10,
    x_step: 2,
    y_min: 0,
    y_max: 10,
    y_step: 2,
    x_label: "가로",
    y_label: "세로",
    points: [
      { x: 2, y: 3 },
      { x: 6, y: 7 },
    ],
  },
];

test("본문 표와 그림 보기의 화면 너비", async ({ page }, info) => {
  const markup = renderToStaticMarkup(
    <main className="study-page">
      <div className="question">
        <ProblemText
          text={
            "표를 보고 답하세요.\n| 값 | 설명 |\n|---|---|\n| $|x|$ | 아주 긴 값을 가진 표의 칸입니다 |"
          }
        />
        {examples.map((example) => (
          <Figure key={example.kind} figure={example} />
        ))}
      </div>
      <fieldset className="choice-grid">
        <legend>답을 골라요</legend>
        {[1, 2, 3, 4, 5].map((i) => (
          <label className="choice" key={i}>
            <input type="radio" name="answer" />
            <div className="choice-content">
              {i}. <Figure figure={choice} />
            </div>
          </label>
        ))}
      </fieldset>
    </main>,
  );
  await page.setContent(
    // Without a viewport meta tag, mobile emulation lays the page out at 980px
    // and the 360px checks below would pass without testing anything.
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync(resolve("node_modules/katex/dist/katex.min.css"), "utf8") + readFileSync(resolve("src/app/globals.css"), "utf8")}</style>${markup}`,
  );
  await expect(page.getByRole("img", { name: "문제 그림" })).toHaveCount(11);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const choices = page.locator(".choice");
  const first = await choices.nth(0).boundingBox();
  const second = await choices.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (info.project.name === "mobile") {
    expect(second!.y).toBeGreaterThan(first!.y);
    const textSizes = await page
      .locator("svg.figure text")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.textContent?.trim())
          .map((node) => ({
            text: node.textContent,
            height: node.getBoundingClientRect().height,
          })),
      );
    expect(textSizes.length).toBeGreaterThan(0);
    for (const item of textSizes) {
      expect(item.height, `그림 글자 ${item.text}`).toBeGreaterThanOrEqual(11);
    }
    await page.screenshot({
      path: "test-results/figures-360.png",
      fullPage: true,
    });
  } else {
    expect(second!.x).toBeGreaterThan(first!.x);
    await page.screenshot({
      path: "test-results/figures-1280.png",
      fullPage: true,
    });
  }
});
