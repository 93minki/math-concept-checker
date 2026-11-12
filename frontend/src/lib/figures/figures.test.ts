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

test("확장 그래프 필드를 그린다", () => {
  const plane: Figure = {
    kind: "coordinate_plane",
    x_min: -2,
    x_max: 2,
    y_min: -2,
    y_max: 2,
    tick_step: 1,
    y_tick_step: 0.5,
    x_label: "시간",
    y_label: "거리",
    show_tick_labels: true,
    points: [],
    graphs: [
      {
        type: "polyline",
        points: [
          { x: -1, y: 0 },
          { x: 1, y: 1 },
        ],
        label: null,
      },
      { type: "inverse", k: 1, label: null },
    ],
  };
  const drawing = drawFigure(plane);
  expect(drawing.elements.some((e) => e.text === "시간")).toBe(true);
  expect(drawing.elements.some((e) => e.tag === "polyline")).toBe(true);
  const bar: Figure = {
    kind: "bar_chart",
    y_min: 3,
    y_max: 6,
    y_step: 1,
    values: [4],
    categories: ["A"],
    x_label: null,
    y_label: null,
  };
  expect(drawFigure(bar).elements.some((e) => e.text === "3")).toBe(true);
  const frequency: Figure = {
    kind: "frequency",
    class_start: 0,
    class_width: 1,
    frequencies: [0.5, 0.5],
    relative: true,
    compare_frequencies: [0.25, 0.75],
    series_labels: ["가", "나"],
    show_bars: false,
    show_polygon: true,
    y_step: 0.25,
    x_label: null,
    y_label: null,
  };
  expect(
    drawFigure(frequency).elements.some(
      (e) => e.attrs.strokeDasharray === "6 4",
    ),
  ).toBe(true);
});

test("함수 그래프의 x축 이름은 x축 가까이에 있다", () => {
  const figure: Figure = {
    kind: "coordinate_plane",
    x_min: -6,
    x_max: 8,
    y_min: -6,
    y_max: 8,
    tick_step: 1,
    show_tick_labels: true,
    x_label: "x",
    y_label: "y",
    y_tick_step: null,
    points: [{ x: 2, y: 6, label: "A" }],
    graphs: [{ type: "inverse", k: 12, label: null }],
  };
  const elements = drawFigure(figure).elements;
  const axis = elements.find(
    (e) =>
      e.attrs["data-axis"] === "true" &&
      e.attrs.x1 !== e.attrs.x2 &&
      e.attrs.y1 === e.attrs.y2,
  );
  const label = elements.find((e) => e.text === "x");
  expect(axis).toBeDefined();
  expect(label).toBeDefined();
  expect(
    Math.abs(Number(label!.attrs.y) - Number(axis!.attrs.y1)),
  ).toBeLessThanOrEqual(30);
});

test("원 안의 각 이름은 꼭짓점 가까이에 있다", () => {
  const figure: Figure = {
    kind: "geometry",
    points: [
      { id: "O", x: 0, y: 0, show_name: true, dot: true },
      { id: "A", x: -4.330127, y: 2.5, show_name: true, dot: true },
      { id: "C", x: 4.330127, y: 2.5, show_name: true, dot: true },
      { id: "B", x: 0, y: 5, show_name: true, dot: true },
    ],
    segments: [
      ["O", "A"],
      ["O", "C"],
      ["A", "B"],
      ["B", "C"],
    ].map(([from, to]) => ({
      from,
      to,
      dashed: false,
      ticks: 0,
      parallel_marks: 0,
      label: null,
    })),
    lines: [],
    polygons: [],
    circles: [
      { center: "O", radius: 5, dashed: false, points_on: ["A", "B", "C"] },
    ],
    arcs: [],
    angles: [
      {
        vertex: "O",
        from: "A",
        to: "C",
        label: "120°",
        right: false,
        marks: 0,
      },
    ],
  };
  const elements = drawFigure(figure).elements;
  const vertex = elements.find((e) => e.text === "O")!;
  const label = elements.find((e) => e.text === "120°")!;
  expect(
    Math.hypot(
      Number(label.attrs.x) - Number(vertex.attrs["data-point-x"]),
      Number(label.attrs.y) - Number(vertex.attrs["data-point-y"]),
    ),
  ).toBeLessThanOrEqual(18 + 30);
});

test("새 그림과 전개도의 배경과 요소", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  for (const f of shapeFixtures) {
    const drawing = drawFigure(f);
    expect(drawing.elements[0].tag).toBe("rect");
    expect(drawing.elements[0].attrs.fill).toBe("white");
    expect(drawing.elements.length).toBeGreaterThan(2);
  }
  const cone = drawFigure(shapeFixtures[6]);
  const sector = cone.elements.find((e) => e.tag === "polyline");
  expect(sector?.attrs.points?.toString().split(" ")).toHaveLength(65);
});

test("직각 표시는 꼭짓점에 붙고 원뿔 전개도 각도는 반지름과 모선으로 정해진다", () => {
  const right: Figure = {
    kind: "geometry",
    points: [
      { id: "A", x: 0, y: 0, show_name: true, dot: true },
      { id: "B", x: 4, y: 0, show_name: true, dot: true },
      { id: "C", x: 0, y: 3, show_name: true, dot: true },
    ],
    segments: [],
    lines: [],
    polygons: [],
    circles: [],
    arcs: [],
    angles: [
      { vertex: "A", from: "B", to: "C", label: null, right: true, marks: 1 },
    ],
  };
  const corner = drawFigure(right).elements.find((e) => e.tag === "polyline");
  const points = String(corner?.attrs.points)
    .split(" ")
    .map((p) => p.split(",").map(Number));
  expect(points).toHaveLength(3);
  expect(
    Math.abs(points[1][0] - points[0][0]) +
      Math.abs(points[1][1] - points[0][1]),
  ).toBeCloseTo(17);
  const cone: Figure = {
    kind: "net",
    shape: "cone",
    radius: 3,
    slant: 6,
    height: null,
    labels: [],
  };
  const sector = drawFigure(cone).elements.find((e) => e.tag === "polyline");
  const arc = String(sector?.attrs.points).split(" ");
  const a = arc[0].split(",").map(Number),
    b = arc[64].split(",").map(Number);
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(230);
});

test.each([0, 1, 2, 3] as const)(
  "각 표시 %i에 해당하는 호를 그린다",
  (marks) => {
    const figure: Figure = {
      kind: "geometry",
      points: [
        { id: "O", x: 0, y: 0, show_name: false, dot: false },
        { id: "A", x: 1, y: 0, show_name: false, dot: false },
        { id: "B", x: 0, y: 1, show_name: false, dot: false },
      ],
      segments: [],
      lines: [],
      polygons: [],
      circles: [],
      arcs: [],
      angles: [
        { vertex: "O", from: "A", to: "B", label: null, right: false, marks },
      ],
    };
    expect(
      drawFigure(figure).elements.filter(
        (element) => element.tag === "polyline",
      ),
    ).toHaveLength(Math.max(1, marks));
  },
);

test("모든 그림 글자는 흰 테두리를 갖는다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  let count = 0;
  for (const figure of shapeFixtures) {
    for (const element of drawFigure(figure).elements) {
      if (element.tag !== "text") continue;
      count++;
      expect(element.attrs).toMatchObject({
        stroke: "white",
        strokeWidth: 4,
        paintOrder: "stroke",
      });
    }
  }
  expect(count).toBeGreaterThan(0);
});

test("원기둥 전개도는 넓게 그리며 치수는 해당 부분에 표시한다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  const drawing = drawFigure(shapeFixtures[23]);
  const rectangle = drawing.elements.find(
    (element) => element.tag === "polyline",
  );
  const points = String(rectangle?.attrs.points)
    .split(" ")
    .map((value) => value.split(",").map(Number));
  expect(points[1][0] - points[0][0]).toBeGreaterThan(200);
  expect(
    drawing.elements.some(
      (element) => element.tag === "text" && element.text === "3 cm",
    ),
  ).toBe(true);
  expect(
    drawing.elements.some(
      (element) => element.tag === "text" && element.text === "5 cm",
    ),
  ).toBe(true);
});

test("두 집단 범례는 실선과 점선을 각각 표시한다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  const elements = drawFigure(shapeFixtures[10]).elements;
  expect(
    elements.some(
      (element) =>
        element.tag === "line" &&
        element.attrs.x1 === 235 &&
        element.attrs.y1 === 17 &&
        !element.attrs.strokeDasharray,
    ),
  ).toBe(true);
  expect(
    elements.some(
      (element) =>
        element.tag === "line" &&
        element.attrs.x1 === 235 &&
        element.attrs.y1 === 43 &&
        element.attrs.strokeDasharray === "6 4",
    ),
  ).toBe(true);
});

test("예시 그림의 글자는 겹치지 않고 연결된 선을 피한다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  for (const [index, figure] of shapeFixtures.entries()) {
    const elements = drawFigure(figure).elements;
    const boxes: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = [];
    const lines = elements
      .filter((e) => e.tag === "polyline")
      .flatMap((e) => {
        const points = String(e.attrs.points)
          .split(" ")
          .map((p) => p.split(",").map(Number));
        return points.slice(1).map((p, i) => [points[i], p]);
      });
    const allTexts = elements.filter((e) => e.tag === "text");
    const texts = allTexts.filter((e) => e.text);
    expect(
      allTexts.length === 0 ||
        elements.slice(-allTexts.length).every((e) => e.tag === "text"),
      `그림 ${index} 출력 순서`,
    ).toBe(true);
    for (const element of texts) {
      const x = Number(element.attrs.x),
        y = Number(element.attrs.y),
        width = Array.from(element.text!).length * 12;
      const anchor = element.attrs.textAnchor;
      const rect = {
        left:
          x - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0),
        right:
          x + (anchor === "middle" ? width / 2 : anchor === "end" ? 0 : width),
        top: y - 16,
        bottom: y + 4,
      };
      for (const other of boxes)
        expect(
          rect.left < other.right &&
            rect.right > other.left &&
            rect.top < other.bottom &&
            rect.bottom > other.top,
          `그림 ${index}: ${element.text} 글자 겹침`,
        ).toBe(false);
      boxes.push(rect);
      if (element.attrs["data-point-x"] === undefined) continue;
      const point = [
        Number(element.attrs["data-point-x"]),
        Number(element.attrs["data-point-y"]),
      ];
      for (const [a, b] of lines) {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = dx * dx + dy * dy;
        if (!length) continue;
        const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length;
        if (
          t < 0 ||
          t > 1 ||
          Math.hypot(a[0] + t * dx - point[0], a[1] + t * dy - point[1]) > 1
        )
          continue;
        let low = 0,
          high = 1;
        for (const [origin, delta, min, max] of [
          [a[0], dx, rect.left, rect.right],
          [a[1], dy, rect.top, rect.bottom],
        ]) {
          if (Math.abs(delta) < 1e-9) {
            if (origin < min || origin > max) low = 2;
            continue;
          }
          const first = (min - origin) / delta,
            last = (max - origin) / delta;
          low = Math.max(low, Math.min(first, last));
          high = Math.min(high, Math.max(first, last));
        }
        expect(low > high, `그림 ${index}: 점 ${element.text}과 선 교차`).toBe(
          true,
        );
      }
    }
  }
});

test("다각형과 입체도형 꼭짓점 이름은 도형 중심에서 더 바깥에 있다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  for (const [index, names] of [
    [14, ["A", "B"]],
    [16, ["A", "B"]],
    [17, ["A"]],
    [22, ["B", "C"]],
    [25, ["A", "B"]],
    [4, ["B", "C"]],
  ] as const) {
    const elements = drawFigure(shapeFixtures[index]).elements;
    for (const name of names) {
      const label = elements.find(
        (element) =>
          element.tag === "text" &&
          element.text === name &&
          element.attrs["data-point-x"] !== undefined,
      );
      expect(label, `그림 ${index} 꼭짓점 ${name}`).toBeDefined();
      expect(
        label?.attrs["data-center-x"],
        `그림 ${index} 꼭짓점 ${name} 중심`,
      ).toBeDefined();
      const centerX = Number(label?.attrs["data-center-x"]),
        centerY = Number(label?.attrs["data-center-y"]);
      const vertexDistance = Math.hypot(
        Number(label?.attrs["data-point-x"]) - centerX,
        Number(label?.attrs["data-point-y"]) - centerY,
      );
      const labelDistance = Math.hypot(
        Number(label?.attrs.x) - centerX,
        Number(label?.attrs.y) - centerY,
      );
      expect(labelDistance, `그림 ${index} 꼭짓점 ${name}`).toBeGreaterThan(
        vertexDistance,
      );
    }
  }
});

test("모든 종류의 글자는 마지막에 흰 테두리로 그려진다", async () => {
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  const allFigures = [...figures, ...shapeFixtures];
  const kinds = new Set(allFigures.map((figure) => figure.kind));
  expect(kinds).toEqual(
    new Set([
      "number_line",
      "coordinate_plane",
      "bar_chart",
      "frequency",
      "boxplot",
      "scatter",
      "geometry",
      "solid",
      "net",
    ]),
  );
  for (const figure of allFigures) {
    const elements = drawFigure(figure).elements;
    const firstText = elements.findIndex((element) => element.tag === "text");
    if (firstText < 0) continue;
    expect(
      elements.slice(firstText).every((element) => element.tag === "text"),
      figure.kind,
    ).toBe(true);
    for (const element of elements.slice(firstText)) {
      expect(element.attrs, `${figure.kind} ${element.text}`).toMatchObject({
        stroke: "white",
        strokeWidth: 4,
        paintOrder: "stroke",
      });
    }
  }
});

test("반비례 SVG는 곡선 뒤에 눈금 글자와 흰 테두리를 출력한다", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Figure: FigureComponent } = await import("../../components/figure");
  const { shapeFixtures } = await import("../../../e2e/shape-fixtures");
  const svg = new DOMParser().parseFromString(
    renderToStaticMarkup(
      createElement(FigureComponent, { figure: shapeFixtures[8] }),
    ),
    "image/svg+xml",
  );
  const children = Array.from(svg.documentElement.children);
  const firstText = children.findIndex((node) => node.tagName === "text");
  expect(firstText).toBeGreaterThan(0);
  expect(
    children.slice(firstText).every((node) => node.tagName === "text"),
  ).toBe(true);
  for (const value of ["-4", "-5"]) {
    const labels = children.filter(
      (node) => node.tagName === "text" && node.textContent === value,
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.getAttribute("stroke")).toBe("white");
      expect(label.getAttribute("stroke-width")).toBe("4");
      expect(label.getAttribute("paint-order")).toBe("stroke");
    }
  }
});
