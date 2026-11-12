import { describe, expect, test } from "vitest";
import { drawFigure, type Figure } from "./index";

const figures: Figure[] = [
  {
    kind: "number_line",
    min: -2,
    max: 2,
    tick_step: 1,
    label_step: 1,
    points: [
      { x: -1, label: "A", filled: true },
      { x: 1, label: "B", filled: false },
    ],
    rays: [],
    segments: [],
  },
  {
    kind: "coordinate_plane",
    x_min: -2,
    x_max: 2,
    y_min: -2,
    y_max: 2,
    tick_step: 1,
    show_tick_labels: true,
    points: [],
    graphs: [{ type: "quadratic", a: 1, p: 0, q: 0, label: null }],
  },
  {
    kind: "bar_chart",
    categories: ["가", "나"],
    values: [2, 4],
    y_max: 5,
    y_step: 1,
    x_label: null,
    y_label: null,
  },
  {
    kind: "frequency",
    class_start: 0,
    class_width: 1,
    frequencies: [2, 4],
    show_bars: true,
    show_polygon: true,
    y_step: 1,
    x_label: null,
    y_label: null,
  },
  {
    kind: "boxplot",
    axis_min: 0,
    axis_max: 10,
    axis_step: 1,
    series: [{ label: "A", min: 1, q1: 2, median: 4, q3: 7, max: 9 }],
  },
  {
    kind: "scatter",
    x_min: 0,
    x_max: 10,
    x_step: 1,
    y_min: 0,
    y_max: 10,
    y_step: 1,
    x_label: null,
    y_label: null,
    points: [
      { x: 2, y: 3 },
      { x: 100, y: 3 },
    ],
  },
];
describe("그림 요소", () => {
  test.each(figures)("$kind 생성", (figure) => {
    const { elements, viewBox } = drawFigure(figure);
    expect(elements.length).toBeGreaterThan(3);
    const [x, y, width, height] = viewBox.split(" ").map(Number);
    expect(elements[0]).toEqual({
      tag: "rect",
      attrs: { x, y, width, height, fill: "white" },
    });
  });
  test("수직선과 상자그림 높이는 내용에 맞는다", () => {
    const numberLine = drawFigure(figures[0]).viewBox.split(" ").map(Number);
    const one = figures[4];
    if (one.kind !== "boxplot") throw new Error("boxplot fixture required");
    const three = {
      ...one,
      series: [one.series[0], one.series[0], one.series[0]],
    };
    const oneHeight = Number(drawFigure(one).viewBox.split(" ")[3]);
    const threeHeight = Number(drawFigure(three).viewBox.split(" ")[3]);
    expect(numberLine[3]).toBeLessThanOrEqual(85);
    expect(oneHeight).toBeLessThanOrEqual(110);
    expect(threeHeight - oneHeight).toBe(96);
  });
  test("긴 이름을 포함한 모든 글자의 추정 영역이 viewBox 안에 있다", () => {
    const long = "다람쥐 모둠 이름열글자";
    const samples: Figure[] = [
      {
        kind: "number_line",
        min: -2,
        max: 2,
        tick_step: 1,
        label_step: 1,
        points: [{ x: 2, label: long, filled: true }],
        rays: [],
        segments: [],
      },
      {
        kind: "coordinate_plane",
        x_min: -2,
        x_max: 2,
        y_min: -2,
        y_max: 2,
        tick_step: 1,
        show_tick_labels: true,
        points: [{ x: 2, y: 2, label: long }],
        graphs: [{ type: "vertical", c: 2, label: long }],
      },
      {
        kind: "bar_chart",
        categories: [long],
        values: [2],
        y_max: 5,
        y_step: 1,
        x_label: long,
        y_label: long,
      },
      {
        kind: "frequency",
        class_start: 0,
        class_width: 1,
        frequencies: [2],
        show_bars: true,
        show_polygon: true,
        y_step: 1,
        x_label: long,
        y_label: long,
      },
      {
        kind: "boxplot",
        axis_min: 0,
        axis_max: 10,
        axis_step: 1,
        series: [{ label: long, min: 1, q1: 2, median: 4, q3: 7, max: 9 }],
      },
      {
        kind: "scatter",
        x_min: 0,
        x_max: 10,
        x_step: 1,
        y_min: 0,
        y_max: 10,
        y_step: 1,
        x_label: long,
        y_label: long,
        points: [],
      },
    ];
    for (const sample of samples) {
      const { viewBox, elements } = drawFigure(sample);
      const [left, top, width, height] = viewBox.split(" ").map(Number);
      for (const element of elements.filter(
        (e) => e.tag === "text" && e.text,
      )) {
        const x = Number(element.attrs.x),
          y = Number(element.attrs.y);
        const textWidth =
          Array.from(element.text ?? "").length *
          Number(element.attrs.fontSize);
        const anchor = element.attrs.textAnchor;
        const start =
          x -
          (anchor === "end"
            ? textWidth
            : anchor === "middle"
              ? textWidth / 2
              : 0);
        expect(start).toBeGreaterThanOrEqual(left);
        expect(start + textWidth).toBeLessThanOrEqual(left + width);
        const fontSize = Number(element.attrs.fontSize);
        expect(y - fontSize).toBeGreaterThanOrEqual(top);
        expect(y + fontSize * 0.25).toBeLessThanOrEqual(top + height);
      }
    }
  });
  test("수직선의 열린 점과 닫힌 점", () => {
    const circles = drawFigure(figures[0]).elements.filter(
      (e) => e.tag === "circle",
    );
    expect(circles.map((e) => e.attrs.fill)).toEqual(["#222", "white"]);
  });
  test("상자그림 다섯 수치의 위치", () => {
    const es = drawFigure(figures[4]).elements;
    const horizontal = es.find(
      (e) => e.tag === "line" && e.attrs.y1 === 40 && e.attrs.y2 === 40,
    );
    expect(horizontal?.attrs.x1).toBe(82);
    expect(horizontal?.attrs.x2).toBe(338);
    const box = es.find((e) => e.tag === "rect" && e.attrs.stroke === "#222");
    expect(box?.attrs.x).toBe(114);
    expect(box?.attrs.width).toBe(160);
    expect(
      es.some(
        (e) => e.tag === "line" && e.attrs.x1 === 178 && e.attrs.y1 === 28,
      ),
    ).toBe(true);
  });
  test("포물선은 보이는 범위에서 잘린다", () => {
    const curves = drawFigure(figures[1]).elements.filter(
      (e) => e.tag === "polyline",
    );
    expect(curves.length).toBeGreaterThan(1);
    const axes = drawFigure(figures[1]).elements.filter(
      (e) => e.attrs["data-axis"] === "true",
    );
    const horizontal = axes.find(
      (e) =>
        e.attrs.y1 === e.attrs.y2 &&
        Math.abs(Number(e.attrs.x2) - Number(e.attrs.x1)) > 10,
    );
    const vertical = axes.find(
      (e) =>
        e.attrs.x1 === e.attrs.x2 &&
        Math.abs(Number(e.attrs.y2) - Number(e.attrs.y1)) > 10,
    );
    if (!horizontal || !vertical) throw new Error("coordinate axes required");
    for (const curve of curves)
      for (const point of String(curve.attrs.points).split(" ")) {
        const [x, y] = point.split(",").map(Number);
        expect(x).toBeGreaterThanOrEqual(Number(horizontal.attrs.x1) - 0.001);
        expect(x).toBeLessThanOrEqual(Number(horizontal.attrs.x2) + 0.001);
        expect(y).toBeGreaterThanOrEqual(Number(vertical.attrs.y1) - 0.001);
        expect(y).toBeLessThanOrEqual(Number(vertical.attrs.y2) + 0.001);
      }
  });
  test("범위 밖 점은 그리지 않는다", () => {
    expect(
      drawFigure(figures[5]).elements.filter((e) => e.tag === "circle"),
    ).toHaveLength(1);
  });
});

test("여섯 그림 견본에서 글자와 축·눈금이 겹치지 않는다", () => {
  const examples: Figure[] = [
    {
      kind: "number_line",
      min: -2,
      max: 2,
      tick_step: 1,
      label_step: 1,
      points: [{ x: 1, label: "A", filled: false }],
      rays: [],
      segments: [],
    },
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
      kind: "coordinate_plane",
      x_min: -6,
      x_max: 6,
      y_min: -8,
      y_max: 10,
      tick_step: 1,
      show_tick_labels: true,
      points: [],
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
    {
      kind: "boxplot",
      axis_min: 0,
      axis_max: 10,
      axis_step: 1,
      series: [
        { label: "다람쥐 모둠 이름", min: 1, q1: 2, median: 4, q3: 7, max: 9 },
      ],
    },
    {
      kind: "boxplot",
      axis_min: 0,
      axis_max: 10,
      axis_step: 1,
      series: [
        {
          label: "가나다라마바사아자차",
          min: 1,
          q1: 2,
          median: 4,
          q3: 7,
          max: 9,
        },
      ],
    },
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
  for (const figure of examples) {
    const elements = drawFigure(figure).elements;
    const boxes = elements
      .filter((e) => e.tag === "text" && e.text)
      .map((e) => {
        const size = Number(e.attrs.fontSize);
        // Korean glyphs occupy roughly a full em; Latin and digits roughly 0.6 em.
        const width = Array.from(e.text ?? "").reduce(
          (sum, char) =>
            sum +
            size *
              (/\s/.test(char)
                ? 0.35
                : /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(char)
                  ? 1
                  : 0.6),
          0,
        );
        const x = Number(e.attrs.x),
          y = Number(e.attrs.y);
        const left =
          x -
          (e.attrs.textAnchor === "end"
            ? width
            : e.attrs.textAnchor === "middle"
              ? width / 2
              : 0);
        return {
          label: e.text,
          left,
          right: left + width,
          top: y - size * 0.8,
          bottom: y + size * 0.2,
        };
      });
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (const b of boxes.slice(i + 1)) {
        const overlap =
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom;
        expect(overlap, `${figure.kind}: ${a.label} / ${b.label}`).toBe(false);
      }
      const axes = elements.filter(
        (e) => e.tag === "line" && e.attrs["data-axis"] === "true",
      );
      expect(axes.length).toBeGreaterThan(0);
      for (const axis of axes) {
        const { x1, x2, y1, y2 } = axis.attrs;
        const intersects =
          Math.max(Number(x1), Number(x2)) >= a.left &&
          Math.min(Number(x1), Number(x2)) <= a.right &&
          Math.max(Number(y1), Number(y2)) >= a.top &&
          Math.min(Number(y1), Number(y2)) <= a.bottom;
        expect(intersects, `${figure.kind}: ${a.label} intersects axis`).toBe(
          false,
        );
      }
    }
  }
});

test("촘촘한 좌표평면의 x와 y는 같은 단위 길이를 쓰고 눈금선은 유지한다", () => {
  const figure: Figure = {
    kind: "coordinate_plane",
    x_min: -6,
    x_max: 6,
    y_min: -8,
    y_max: 10,
    tick_step: 1,
    show_tick_labels: true,
    points: [],
    graphs: [],
  };
  const elements = drawFigure(figure).elements;
  const axes = elements.filter((e) => e.attrs["data-axis"] === "true");
  const horizontal = axes.find(
    (e) =>
      e.attrs.y1 === e.attrs.y2 &&
      Math.abs(Number(e.attrs.x2) - Number(e.attrs.x1)) > 10,
  );
  const vertical = axes.find(
    (e) =>
      e.attrs.x1 === e.attrs.x2 &&
      Math.abs(Number(e.attrs.y2) - Number(e.attrs.y1)) > 10,
  );
  if (!horizontal || !vertical) throw new Error("coordinate axes required");
  expect(
    (Number(horizontal.attrs.x2) - Number(horizontal.attrs.x1)) / 12,
  ).toBeCloseTo((Number(vertical.attrs.y2) - Number(vertical.attrs.y1)) / 18);
  expect(axes).toHaveLength(2 + 13 + 19);
  const origin = elements.find((e) => e.tag === "text" && e.text === "O");
  expect(origin).toBeDefined();
  expect(Number(origin?.attrs.x)).toBeLessThan(Number(vertical.attrs.x1));
  expect(Number(origin?.attrs.y)).toBeGreaterThan(Number(horizontal.attrs.y1));
  expect(elements.filter((e) => e.tag === "text").length).toBeLessThan(13 + 19);
});

test("각 그림의 촘촘한 축은 눈금선을 유지하고 숫자만 솎는다", () => {
  const examples: Figure[] = [
    {
      kind: "number_line",
      min: 0,
      max: 20,
      tick_step: 1,
      label_step: 2,
      points: [],
      rays: [],
      segments: [],
    },
    {
      kind: "bar_chart",
      categories: ["A"],
      values: [5],
      y_max: 20,
      y_step: 1,
      x_label: null,
      y_label: null,
    },
    {
      kind: "frequency",
      class_start: 2,
      class_width: 10,
      frequencies: Array(12).fill(20),
      show_bars: true,
      show_polygon: true,
      y_step: 1,
      x_label: null,
      y_label: null,
    },
    {
      kind: "boxplot",
      axis_min: 0,
      axis_max: 20,
      axis_step: 1,
      series: [{ label: "A", min: 1, q1: 2, median: 4, q3: 7, max: 9 }],
    },
    {
      kind: "scatter",
      x_min: 0,
      x_max: 20,
      x_step: 1,
      y_min: 0,
      y_max: 20,
      y_step: 1,
      x_label: null,
      y_label: null,
      points: [],
    },
  ];
  for (const figure of examples) {
    const elements = drawFigure(figure).elements;
    const axis = elements.filter((e) => e.attrs["data-axis"] === "true");
    const labels = elements.filter((e) => e.tag === "text" && e.text !== "A");
    expect(axis.length, figure.kind).toBeGreaterThanOrEqual(22);
    expect(labels.length, figure.kind).toBeLessThan(axis.length - 2);
    expect(
      labels.some((e) => e.text === "0"),
      figure.kind,
    ).toBe(true);
    if (figure.kind === "number_line") {
      expect(labels.every((e) => Number(e.text) % 2 === 0)).toBe(true);
    }
    if (figure.kind === "frequency") {
      const classLabels = labels.filter((e) => e.attrs.y === 265);
      expect(classLabels.length).toBeGreaterThanOrEqual(3);
      expect(classLabels.every((e) => (Number(e.text) - 2) % 10 === 0)).toBe(
        true,
      );
    }
  }
});
