import { ChoiceNumber } from "../src/components/choice-number";
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
  points: [
    { x: 1, label: "A", filled: false },
    { x: -1, label: "B", filled: true },
  ],
  rays: [],
  segments: [],
};

const denseChoice: FigureData = {
  kind: "coordinate_plane",
  x_min: -6,
  x_max: 6,
  y_min: -8,
  y_max: 10,
  tick_step: 1,
  show_tick_labels: true,
  points: [],
  graphs: [{ type: "quadratic", a: 1, p: 0, q: 0, label: null }],
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

for (const theme of ["light", "dark"] as const) {
  test(`${theme} 본문 표와 그림 보기의 화면 너비`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    const markup = renderToStaticMarkup(
      <main className="study-page">
        <div className="problem-sheet stack">
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
            <legend className="visually-hidden">답을 골라요</legend>
            {[1, 2, 3, 4, 5].map((i) => (
              <label className="choice" key={i}>
                <input type="radio" name="answer" />
                <ChoiceNumber number={i} />
                <div className="choice-content">
                  <ProblemText
                    text={
                      i === 1
                        ? "| 긴 제목 하나 | 긴 제목 둘 | 긴 제목 셋 | 긴 제목 넷 |\n|---|---|---|---|\n| $1$ | $2$ | $3$ | $4$ |"
                        : "보기"
                    }
                  />
                  <Figure figure={i === 1 ? denseChoice : choice} />
                </div>
              </label>
            ))}
          </fieldset>
        </div>
      </main>,
    );
    await page.setContent(
      // Without a viewport meta tag, mobile emulation lays the page out at 980px
      // and the 360px checks below would pass without testing anything.
      `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync(resolve("node_modules/katex/dist/katex.min.css"), "utf8") + readFileSync(resolve("src/app/globals.css"), "utf8")}</style>${markup}`,
    );
    await expect(page.getByRole("img", { name: "문제 그림" })).toHaveCount(11);
    await expect(page.locator(".problem-sheet")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(page.locator(".problem-sheet")).toHaveCSS(
      "color",
      "rgb(17, 17, 17)",
    );
    await page.locator(".choice").first().click();
    await expect(page.locator(".choice").first()).toHaveCSS(
      "background-color",
      "rgb(232, 242, 255)",
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    const choices = page.locator(".choice");
    const choiceTable = choices.first().locator(".table-scroll");
    await expect(choiceTable.locator("table.problem-table")).toBeVisible();
    if (info.project.name === "mobile") {
      expect(
        await choiceTable.evaluate(
          (node) => node.scrollWidth > node.clientWidth,
        ),
      ).toBe(true);
    }
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
        expect(item.height, `그림 글자 ${item.text}`).toBeGreaterThanOrEqual(
          11,
        );
      }
      await page.screenshot({
        path: `test-results/step1/${theme}-360.png`,
        fullPage: true,
      });
    } else {
      expect(second!.x).toBeGreaterThan(first!.x);
      await page.screenshot({
        path: `test-results/step1/${theme}-1280.png`,
        fullPage: true,
      });
    }
  });
}

test("새 그림의 본문과 보기 크기", async ({ page }, info) => {
  const { shapeFixtures } = await import("./shape-fixtures");
  const markup = renderToStaticMarkup(
    <main className="study-page">
      {shapeFixtures.map((figure, i) => (
        <div className="problem-sheet" key={i}>
          <div style={{ width: "min(100%, 330px)" }} className="body-example">
            <Figure figure={figure} />
          </div>
          <div style={{ width: "min(100%, 250px)" }} className="choice-example">
            <Figure figure={figure} />
          </div>
        </div>
      ))}
    </main>,
  );
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync(resolve("src/app/globals.css"), "utf8")}</style>${markup}`,
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const heights = await page
    .locator("svg.figure text")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.textContent?.trim())
        .map((node) => node.getBoundingClientRect().height),
    );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(11);
  const size = info.project.name === "mobile" ? "360" : "1280";
  for (let i = 0; i < shapeFixtures.length; i++) {
    await page
      .locator(".body-example")
      .nth(i)
      .screenshot({ path: `test-results/step4/${size}-${i}-body.png` });
    await page
      .locator(".choice-example")
      .nth(i)
      .screenshot({ path: `test-results/step4/${size}-${i}-choice.png` });
  }
});

test("보기 번호와 첫 줄 정렬 및 키보드 선택", async ({ page }) => {
  const samples = [
    "일반 보기",
    "$x+1$ 수식 보기",
    "두 줄로 나뉘는 보기를 확인합니다.\n다음 줄입니다.",
  ];
  const markup = renderToStaticMarkup(
    <main className="study-page">
      <div className="problem-sheet">
        <fieldset className="stack">
          <legend className="visually-hidden">답을 골라요</legend>
          {samples.map((text, i) => (
            <label className="choice" key={text}>
              <input type="radio" name="aligned" />
              <ChoiceNumber number={i + 1} />
              <div className="choice-content">
                <ProblemText text={text} />
              </div>
            </label>
          ))}
        </fieldset>
      </div>
    </main>,
  );
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync(resolve("node_modules/katex/dist/katex.min.css"), "utf8") + readFileSync(resolve("src/app/globals.css"), "utf8")}</style>${markup}`,
  );
  await expect(page.getByRole("group", { name: "답을 골라요" })).toHaveCount(1);
  await expect(page.locator("legend")).toHaveCSS("width", "1px");
  const choices = page.locator(".choice");
  for (let i = 0; i < samples.length; i++) {
    const diff = await choices.nth(i).evaluate((choice) => {
      const circle = choice.querySelector<HTMLElement>(".choice-number");
      const text = choice.querySelector<HTMLElement>(
        ".choice-content .problem-text",
      );
      if (!circle || !text) throw new Error("보기 요소 없음");
      const circleRect = circle.getBoundingClientRect();
      // Measure the first rendered glyph, not the CSS line-height: a KaTeX
      // line can be taller than the text line (2026-11-13 misalignment).
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.textContent?.trim() &&
          !node.parentElement?.closest(".katex-mathml")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
      });
      const first = walker.nextNode();
      if (!first) throw new Error("보기 글자 없음");
      const range = document.createRange();
      const start = first.textContent!.search(/\S/);
      range.setStart(first, start);
      range.setEnd(first, start + 1);
      const glyph = range.getBoundingClientRect();
      const firstLineCenter = glyph.top + glyph.height / 2;
      return Math.abs(circleRect.top + circleRect.height / 2 - firstLineCenter);
    });
    expect(diff).toBeLessThanOrEqual(2);
  }
  const radios = page.getByRole("radio");
  const box = await radios.first().boundingBox();
  expect(box?.width).toBeLessThanOrEqual(1);
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  await expect(choices.nth(1).locator(".choice-number")).toHaveCSS(
    "background-color",
    "rgb(21, 89, 168)",
  );
});
