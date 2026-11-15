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

test("작은 도형의 글자는 서로 겹치거나 다른 선분을 가리지 않는다", async () => {
  const { default: examples } = await import("./crowded-examples.json");
  for (const [index, input] of examples.entries()) {
    const figure = input as Figure;
    if (figure.kind !== "geometry") throw new Error("geometry 필요");
    const elements = drawFigure(figure).elements;
    const texts = elements.filter((element) => element.tag === "text");
    const boxes = texts.map((element) => {
      const x = Number(element.attrs.x),
        y = Number(element.attrs.y);
      const half = Array.from(element.text!).length * 6;
      return { left: x - half, right: x + half, top: y - 16, bottom: y + 4 };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = boxes[i],
          b = boxes[j];
        expect(
          a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top,
          `그림 ${index}: ${texts[i].text}, ${texts[j].text}`,
        ).toBe(false);
      }
    }
    const points = new Map(
      figure.points.map((point) => {
        const label = texts.find(
          (element) =>
            element.text === point.id &&
            element.attrs["data-point-x"] !== undefined,
        )!;
        return [
          point.id,
          [
            Number(label.attrs["data-point-x"]),
            Number(label.attrs["data-point-y"]),
          ],
        ];
      }),
    );
    for (const segment of figure.segments) {
      const a = points.get(segment.from)!,
        b = points.get(segment.to)!;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(
        29.999,
      );
    }
    let labelIndex = 0;
    for (const segment of figure.segments) {
      if (!segment.label) continue;
      const rect = boxes[labelIndex++];
      for (const other of figure.segments) {
        if (other === segment) continue;
        const a = points.get(other.from)!,
          b = points.get(other.to)!;
        let low = 0,
          high = 1;
        for (const [origin, delta, min, max] of [
          [a[0], b[0] - a[0], rect.left, rect.right],
          [a[1], b[1] - a[1], rect.top, rect.bottom],
        ]) {
          if (Math.abs(delta) < 1e-9) {
            if (origin < min || origin > max) low = 2;
          } else {
            const first = (min - origin) / delta,
              last = (max - origin) / delta;
            low = Math.max(low, Math.min(first, last));
            high = Math.min(high, Math.max(first, last));
          }
        }
        expect(
          low <= high,
          `그림 ${index}: ${segment.label} / ${other.from}${other.to}`,
        ).toBe(false);
      }
    }
  }
});

test("다각 입체의 가려진 모서리만 점선이다", () => {
  for (const [shape, n, hiddenBase, visibleBase, hiddenSide, visibleSide] of [
    ["prism", 3, [1, 2], [2, 0], null, 1],
    ["pyramid", 4, [2, 3], [0, 1], 3, 0],
    ["frustum", 5, [2, 3], [4, 0], null, 1],
  ] as const) {
    const names = Array.from({ length: n * 2 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const figure: Figure = {
      kind: "solid",
      shape,
      base_sides: n,
      width: null,
      depth: null,
      height: 3,
      radius: 2,
      top_radius: shape === "frustum" ? 1 : null,
      vertex_names: names.slice(0, shape === "pyramid" ? n + 1 : n * 2),
      labels: [],
      show_axis: false,
    };
    const elements = drawFigure(figure).elements;
    const point = (i: number) => {
      const e = elements.find(
        (item) => item.tag === "text" && item.text === names[i],
      )!;
      return `${e.attrs["data-point-x"]},${e.attrs["data-point-y"]}`;
    };
    const edge = (a: number, b: number) =>
      elements.find(
        (e) =>
          e.tag === "polyline" &&
          [`${point(a)} ${point(b)}`, `${point(b)} ${point(a)}`].includes(
            String(e.attrs.points),
          ),
      )!;
    expect(
      edge(hiddenBase[0], hiddenBase[1]).attrs.strokeDasharray,
      shape,
    ).toBe("6 4");
    expect(
      edge(visibleBase[0], visibleBase[1]).attrs.strokeDasharray,
      shape,
    ).toBeUndefined();
    if (hiddenSide !== null)
      expect(edge(hiddenSide, n).attrs.strokeDasharray).toBe("6 4");
    expect(
      edge(visibleSide, shape === "pyramid" ? n : n + visibleSide).attrs
        .strokeDasharray,
      shape,
    ).toBeUndefined();
  }
});

test("낮은 각뿔의 꼭짓점과 이름이 읽을 수 있는 위치에 있다", () => {
  const figure: Figure = {
    kind: "solid",
    shape: "pyramid",
    base_sides: 4,
    width: null,
    depth: null,
    height: 0.4,
    radius: 2,
    top_radius: null,
    vertex_names: ["A", "B", "C", "D", "S"],
    labels: [],
    show_axis: false,
  };
  const apex = drawFigure(figure).elements.find((e) => e.text === "S")!;
  expect(220 - Number(apex.attrs["data-point-y"])).toBeGreaterThanOrEqual(70);
  expect(
    Math.hypot(
      Number(apex.attrs.x) - Number(apex.attrs["data-point-x"]),
      Number(apex.attrs.y) - Number(apex.attrs["data-point-y"]),
    ),
  ).toBeLessThan(50);
});

test("선분 길이 표시가 다른 선분을 피한다", () => {
  const figure: Figure = {
    kind: "geometry",
    points: [
      ["O", 0, 0],
      ["Q", 7.5, 0],
      ["D", 4.5, 0],
      ["E", -4.5, 0],
      ["T", 2.7, 3.6],
    ].map(([id, x, y]) => ({
      id: String(id),
      x: Number(x),
      y: Number(y),
      show_name: true,
      dot: true,
    })),
    segments: [
      ["E", "Q", "12"],
      ["Q", "T", "6"],
      ["O", "T", null],
    ].map(([from, to, label]) => ({
      from: from!,
      to: to!,
      label,
      dashed: false,
      ticks: 0,
      parallel_marks: 0,
    })),
    circles: [
      { center: "O", radius: 4.5, dashed: false, points_on: ["D", "E", "T"] },
    ],
    angles: [
      { vertex: "T", from: "O", to: "Q", label: null, right: true, marks: 0 },
    ],
    lines: [],
    polygons: [],
    arcs: [],
  };
  const elements = drawFigure(figure).elements;
  const label = elements.find((e) => e.text === "12")!;
  const x = Number(label.attrs.x),
    y = Number(label.attrs.y);
  const o = elements.find((e) => e.text === "O")!,
    t = elements.find((e) => e.text === "T")!;
  const ax = Number(o.attrs["data-point-x"]),
    ay = Number(o.attrs["data-point-y"]),
    bx = Number(t.attrs["data-point-x"]),
    by = Number(t.attrs["data-point-y"]);
  let low = 0,
    high = 1;
  for (const [origin, delta, min, max] of [
    [ax, bx - ax, x - 12, x + 12],
    [ay, by - ay, y - 16, y + 4],
  ]) {
    const first = (min - origin) / delta,
      last = (max - origin) / delta;
    low = Math.max(low, Math.min(first, last));
    high = Math.min(high, Math.max(first, last));
  }
  expect(low > high).toBe(true);
  low = 0;
  high = 1;
  for (const [origin, delta, min, max] of [
    [ax, bx - ax, x - 22, x + 22],
    [ay, by - ay, y - 26, y + 14],
  ]) {
    const first = (min - origin) / delta,
      last = (max - origin) / delta;
    low = Math.max(low, Math.min(first, last));
    high = Math.min(high, Math.max(first, last));
  }
  expect(low > high).toBe(true);
});

test("사각뿔의 높이선과 모서리가 분리되고 꼭짓점 이름이 가까이 있다", () => {
  for (const [height, radius, name, label] of [
    [6, 2.8284271247461903, "P", "?"],
    [3, 5.656854249492381, "S", "3 cm"],
    [3, 2, "S", "3 cm"],
  ] as const) {
    const figure: Figure = {
      kind: "solid",
      shape: "pyramid",
      base_sides: 4,
      width: null,
      depth: null,
      height,
      radius,
      top_radius: null,
      vertex_names: ["A", "B", "C", "D", name],
      labels: [{ part: "height", text: label }],
      show_axis: true,
    };
    const drawing = drawFigure(figure);
    const elements = drawing.elements;
    const cuboid: Figure = {
      kind: "solid",
      shape: "cuboid",
      base_sides: null,
      width: 2,
      depth: 2,
      height: 3,
      radius: null,
      top_radius: null,
      vertex_names: ["A", "B", "C", "D", "E", "F", "G", "H"],
      labels: [],
      show_axis: false,
    };
    const size = drawing.viewBox.split(" ").map(Number);
    const reference = drawFigure(cuboid).viewBox.split(" ").map(Number);
    expect(size[2]).toBeLessThanOrEqual(reference[2]);
    expect(size[3]).toBeLessThanOrEqual(reference[3]);
    const vertex = (id: string) => elements.find((e) => e.text === id)!;
    const apex = vertex(name),
      ax = Number(apex.attrs["data-point-x"]),
      ay = Number(apex.attrs["data-point-y"]);
    const xs = ["A", "B", "C", "D"].map((id) =>
      Number(vertex(id).attrs["data-point-x"]),
    );
    expect(220 - ay).toBeGreaterThanOrEqual(
      (Math.max(...xs) - Math.min(...xs)) * 0.6,
    );
    expect(xs.every((x) => Math.abs(x - ax) > 1)).toBe(true);
    expect(new Set(xs.map((x) => x.toFixed(6))).size).toBe(4);
    const vertices = ["A", "B", "C", "D", name].map((id) => {
      const point = vertex(id);
      return {
        x: Number(point.attrs["data-point-x"]),
        y: Number(point.attrs["data-point-y"]),
      };
    });
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ];
    for (const [a, b] of edges) {
      const from = `${vertices[a].x},${vertices[a].y}`;
      const to = `${vertices[b].x},${vertices[b].y}`;
      const edge = elements.find(
        (e) =>
          e.tag === "polyline" &&
          [`${from} ${to}`, `${to} ${from}`].includes(String(e.attrs.points)),
      )!;
      expect(Boolean(edge.attrs.strokeDasharray)).toBe(a === 3 || b === 3);
    }
    for (let i = 0; i < vertices.length; i++) {
      const rays = edges
        .filter((edge) => edge.includes(i))
        .map((edge) => {
          const other = vertices[edge[0] === i ? edge[1] : edge[0]];
          return Math.atan2(other.y - vertices[i].y, other.x - vertices[i].x);
        });
      for (let j = 0; j < rays.length; j++)
        for (let k = j + 1; k < rays.length; k++) {
          const difference = Math.abs(rays[j] - rays[k]);
          expect(
            Math.min(difference, 2 * Math.PI - difference),
          ).toBeGreaterThanOrEqual((8 * Math.PI) / 180);
        }
    }
    expect(
      Math.hypot(Number(apex.attrs.x) - ax, Number(apex.attrs.y) - ay),
    ).toBeLessThan(40);
    expect(
      elements.some(
        (e) =>
          e.tag === "polyline" &&
          e.attrs.points === `${ax},${ay} 200,220` &&
          e.attrs.strokeDasharray === "6 4",
      ),
    ).toBe(true);
    const heightLabel = vertex(label);
    expect(heightLabel.attrs.fontSize).toBe(apex.attrs.fontSize);
    const center = {
      x: Number(heightLabel.attrs.x),
      y: Number(heightLabel.attrs.y) - 6,
    };
    const lineDistance = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((center.x - a.x) * dx + (center.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
      return Math.hypot(center.x - a.x - t * dx, center.y - a.y - t * dy);
    };
    const apexPoint = { x: ax, y: ay };
    const axisDistance = lineDistance(apexPoint, { x: 200, y: 220 });
    for (const id of ["A", "B", "C", "D"]) {
      const point = vertex(id);
      expect(axisDistance).toBeLessThan(
        lineDistance(apexPoint, {
          x: Number(point.attrs["data-point-x"]),
          y: Number(point.attrs["data-point-y"]),
        }),
      );
    }
    expect(center.y).toBeGreaterThanOrEqual((ay + 220) / 2 - 20);
    expect(center.y).toBeLessThanOrEqual((ay + 220) / 2 + 70);
  }
});

test("접선 그림에서 OP 길이와 선분 사이를 다른 선이나 원이 가로막지 않는다", () => {
  const figure: Figure = {
    angles: [
      {
        from: "O",
        label: null,
        marks: 0,
        right: true,
        to: "P",
        vertex: "A",
      },
      {
        from: "O",
        label: null,
        marks: 0,
        right: true,
        to: "P",
        vertex: "B",
      },
    ],
    arcs: [],
    circles: [
      {
        center: "O",
        dashed: false,
        points_on: ["A", "B"],
        radius: 5.0,
      },
    ],
    kind: "geometry",
    lines: [],
    points: [
      {
        dot: true,
        id: "O",
        show_name: true,
        x: 0.0,
        y: 0.0,
      },
      {
        dot: true,
        id: "P",
        show_name: true,
        x: 13.0,
        y: 0.0,
      },
      {
        dot: true,
        id: "A",
        show_name: true,
        x: 1.9230769231,
        y: 4.6153846154,
      },
      {
        dot: true,
        id: "B",
        show_name: true,
        x: 1.9230769231,
        y: -4.6153846154,
      },
    ],
    polygons: [],
    segments: [
      {
        dashed: false,
        from: "O",
        label: "5",
        parallel_marks: 0,
        ticks: 1,
        to: "A",
      },
      {
        dashed: false,
        from: "O",
        label: null,
        parallel_marks: 0,
        ticks: 1,
        to: "B",
      },
      {
        dashed: false,
        from: "O",
        label: "13",
        parallel_marks: 0,
        ticks: 0,
        to: "P",
      },
      {
        dashed: false,
        from: "P",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "A",
      },
      {
        dashed: false,
        from: "P",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "B",
      },
    ],
  };
  const elements = drawFigure(figure).elements;
  const point = (name: string) => {
    const label = elements.find(
      (element) =>
        element.text === name && element.attrs["data-point-x"] !== undefined,
    )!;
    return {
      x: Number(label.attrs["data-point-x"]),
      y: Number(label.attrs["data-point-y"]),
    };
  };
  const label = elements.find((element) => element.text === "13")!;
  const center = { x: Number(label.attrs.x), y: Number(label.attrs.y) - 6 };
  const o = point("O"),
    p = point("P");
  const dx = p.x - o.x,
    dy = p.y - o.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((center.x - o.x) * dx + (center.y - o.y) * dy) / (dx * dx + dy * dy),
    ),
  );
  const path = { x: o.x + t * dx - center.x, y: o.y + t * dy - center.y };
  const cross = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    a.x * b.y - a.y * b.x;
  for (const [from, to] of [
    ["O", "A"],
    ["O", "B"],
    ["P", "A"],
    ["P", "B"],
  ]) {
    const a = point(from),
      b = point(to);
    const edge = { x: b.x - a.x, y: b.y - a.y },
      delta = { x: a.x - center.x, y: a.y - center.y };
    const d = cross(path, edge);
    if (Math.abs(d) < 1e-9) continue;
    const along = cross(delta, edge) / d,
      across = cross(delta, path) / d;
    expect(
      along > 1e-6 && along < 1 - 1e-6 && across >= 0 && across <= 1,
      `${from}${to}`,
    ).toBe(false);
  }
  const circle = elements.find(
    (element) => element.tag === "circle" && element.attrs.fill === "none",
  )!;
  const cx = Number(circle.attrs.cx),
    cy = Number(circle.attrs.cy),
    r = Number(circle.attrs.r);
  const dist = (q: { x: number; y: number }) => Math.hypot(q.x - cx, q.y - cy);
  const end = { x: center.x + path.x, y: center.y + path.y };
  const nearest = Math.max(
    0,
    Math.min(
      1,
      -((center.x - cx) * path.x + (center.y - cy) * path.y) /
        (path.x ** 2 + path.y ** 2),
    ),
  );
  const closest = {
    x: center.x + nearest * path.x,
    y: center.y + nearest * path.y,
  };
  expect(dist(closest) < r && Math.max(dist(center), dist(end)) > r).toBe(
    false,
  );
});

const regressionPlane: Figure = {
  graphs: [],
  kind: "coordinate_plane",
  points: [
    { label: "A", x: -1.0, y: -3.0 },
    { label: "B", x: -3.0, y: -1.0 },
    { label: "C", x: -1.0, y: 2.0 },
    { label: "D", x: 2.0, y: -1.0 },
    { label: "E", x: 0.0, y: -2.0 },
  ],
  show_tick_labels: true,
  tick_step: 1.0,
  x_label: "x",
  x_max: 4.0,
  x_min: -4.0,
  y_label: "y",
  y_max: 4.0,
  y_min: -4.0,
  y_tick_step: null,
};
const regressionTriangles: Figure = {
  angles: [
    { from: "B", label: null, marks: 1, right: false, to: "C", vertex: "A" },
    { from: "C", label: null, marks: 1, right: false, to: "A", vertex: "B" },
    { from: "A", label: null, marks: 1, right: false, to: "B", vertex: "C" },
    { from: "E", label: null, marks: 1, right: false, to: "F", vertex: "D" },
    { from: "F", label: null, marks: 1, right: false, to: "D", vertex: "E" },
    { from: "D", label: null, marks: 1, right: false, to: "E", vertex: "F" },
  ],
  arcs: [],
  circles: [],
  kind: "geometry",
  lines: [],
  points: [
    { dot: false, id: "A", show_name: true, x: 0.0, y: 0.0 },
    { dot: false, id: "B", show_name: true, x: 3.0, y: 0.0 },
    { dot: false, id: "C", show_name: true, x: 1.5, y: 2.598076 },
    { dot: false, id: "D", show_name: true, x: 4.5, y: 0.0 },
    { dot: false, id: "E", show_name: true, x: 8.5, y: 0.0 },
    { dot: false, id: "F", show_name: true, x: 6.5, y: 3.464102 },
  ],
  polygons: [],
  segments: [
    {
      dashed: false,
      from: "A",
      label: "3",
      parallel_marks: 0,
      ticks: 1,
      to: "B",
    },
    {
      dashed: false,
      from: "B",
      label: null,
      parallel_marks: 0,
      ticks: 1,
      to: "C",
    },
    {
      dashed: false,
      from: "C",
      label: null,
      parallel_marks: 0,
      ticks: 1,
      to: "A",
    },
    {
      dashed: false,
      from: "D",
      label: "4",
      parallel_marks: 0,
      ticks: 2,
      to: "E",
    },
    {
      dashed: false,
      from: "E",
      label: null,
      parallel_marks: 0,
      ticks: 2,
      to: "F",
    },
    {
      dashed: false,
      from: "F",
      label: null,
      parallel_marks: 0,
      ticks: 2,
      to: "D",
    },
  ],
};

test("축 눈금 숫자가 점과 점 이름을 가리지 않는다", () => {
  const { elements } = drawFigure(regressionPlane);
  const texts = elements.filter((e) => e.tag === "text");
  const box = (e: (typeof elements)[number]) => {
    const x = Number(e.attrs.x),
      y = Number(e.attrs.y),
      w = Array.from(e.text ?? "").reduce(
        (sum, char) =>
          sum +
          Number(e.attrs.fontSize) *
            (char === "-" ? 0.33 : /\d/.test(char) ? 0.56 : 0.75),
        0,
      ),
      anchor = e.attrs.textAnchor;
    return {
      l: x - (anchor === "end" ? w : anchor === "middle" ? w / 2 : 0),
      r: x + (anchor === "start" ? w : anchor === "middle" ? w / 2 : 0),
      t: y - Number(e.attrs.fontSize) * 0.9,
      b: y + Number(e.attrs.fontSize) * 0.25,
    };
  };
  const ticks = texts.filter((e) => /^-?\d+$/.test(e.text ?? ""));
  const names = texts.filter((e) =>
    ["A", "B", "C", "D", "E"].includes(e.text ?? ""),
  );
  expect(names).toHaveLength(5);
  for (const tick of ticks) {
    const a = box(tick);
    for (const name of names) {
      const b = box(name);
      expect(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t).toBe(false);
    }
    for (const point of elements.filter(
      (e) => e.tag === "circle" && e.attrs.r === 3,
    )) {
      const x = Number(point.attrs.cx),
        y = Number(point.attrs.cy);
      expect(a.l < x + 3 && a.r > x - 3 && a.t < y + 3 && a.b > y - 3).toBe(
        false,
      );
    }
  }
});

test("분리된 두 삼각형의 꼭짓점 이름은 각각의 바깥쪽에 있다", () => {
  const elements = drawFigure(regressionTriangles).elements;
  const labels = elements.filter(
    (e) => e.tag === "text" && /^[A-F]$/.test(e.text ?? ""),
  );
  expect(labels).toHaveLength(6);
  const lines = elements
    .filter((e) => e.tag === "polyline")
    .flatMap((e) => {
      const points = String(e.attrs.points)
        .split(" ")
        .map((v) => v.split(",").map(Number));
      return points.slice(1).map((p, i) => [points[i], p]);
    });
  for (const label of labels) {
    const x = Number(label.attrs.x),
      y = Number(label.attrs.y);
    const r = { left: x - 6, right: x + 6, top: y - 16, bottom: y + 4 };
    for (const other of elements.filter(
      (e) => e.tag === "text" && e !== label && !!e.text,
    )) {
      const ox = Number(other.attrs.x),
        oy = Number(other.attrs.y),
        w = Array.from(other.text!).length * 6;
      expect(
        r.left < ox + w &&
          r.right > ox - w &&
          r.top < oy + 4 &&
          r.bottom > oy - 16,
        label.text,
      ).toBe(false);
    }
    for (const [a, b] of lines) {
      let low = 0,
        high = 1;
      for (const [origin, delta, min, max] of [
        [a[0], b[0] - a[0], r.left, r.right],
        [a[1], b[1] - a[1], r.top, r.bottom],
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
      expect(low > high, `${label.text} 선 교차`).toBe(true);
    }
  }

  const anchor = (label: (typeof labels)[number]) => ({
    x: Number(label.attrs["data-point-x"]),
    y: Number(label.attrs["data-point-y"]),
  });
  for (const group of [
    ["A", "B", "C"],
    ["D", "E", "F"],
  ]) {
    const vertices = group.map((name) =>
      anchor(labels.find((e) => e.text === name)!),
    );
    const cross = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      p: { x: number; y: number },
    ) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    for (const name of group) {
      const label = labels.find((e) => e.text === name)!;
      const p = { x: Number(label.attrs.x), y: Number(label.attrs.y) - 6 };
      const sides = vertices.map((a, i) => cross(a, vertices[(i + 1) % 3], p));
      expect(sides.every((v) => v > 0) || sides.every((v) => v < 0), name).toBe(
        false,
      );
    }
  }
});

const nearbyTriangleCases: Figure[] = [
  {
    angles: [
      { from: "B", label: null, marks: 0, right: true, to: "C", vertex: "A" },
      { from: "C", label: null, marks: 1, right: false, to: "A", vertex: "B" },
      { from: "A", label: null, marks: 2, right: false, to: "B", vertex: "C" },
      { from: "E", label: null, marks: 0, right: true, to: "F", vertex: "D" },
      { from: "F", label: null, marks: 1, right: false, to: "D", vertex: "E" },
      { from: "D", label: null, marks: 2, right: false, to: "E", vertex: "F" },
    ],
    arcs: [],
    circles: [],
    kind: "geometry",
    lines: [],
    points: [
      { dot: false, id: "A", show_name: true, x: 0.0, y: 0.0 },
      { dot: false, id: "B", show_name: true, x: 4.0, y: 0.0 },
      { dot: false, id: "C", show_name: true, x: 0.0, y: 3.0 },
      { dot: false, id: "D", show_name: true, x: 6.0, y: 0.0 },
      { dot: false, id: "E", show_name: true, x: 12.0, y: 0.0 },
      { dot: false, id: "F", show_name: true, x: 6.0, y: 4.5 },
    ],
    polygons: [],
    segments: [
      {
        dashed: false,
        from: "A",
        label: "4",
        parallel_marks: 0,
        ticks: 0,
        to: "B",
      },
      {
        dashed: false,
        from: "B",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "C",
      },
      {
        dashed: false,
        from: "C",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "A",
      },
      {
        dashed: false,
        from: "D",
        label: "6",
        parallel_marks: 0,
        ticks: 0,
        to: "E",
      },
      {
        dashed: false,
        from: "E",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "F",
      },
      {
        dashed: false,
        from: "F",
        label: null,
        parallel_marks: 0,
        ticks: 0,
        to: "D",
      },
    ],
  },
  {
    angles: [
      { from: "B", label: null, marks: 0, right: true, to: "C", vertex: "A" },
      { from: "A", label: null, marks: 1, right: false, to: "C", vertex: "B" },
      { from: "A", label: null, marks: 2, right: false, to: "B", vertex: "C" },
      { from: "E", label: null, marks: 0, right: true, to: "F", vertex: "D" },
      { from: "D", label: null, marks: 1, right: false, to: "F", vertex: "E" },
      { from: "D", label: null, marks: 2, right: false, to: "E", vertex: "F" },
    ],
    arcs: [],
    circles: [],
    kind: "geometry",
    lines: [],
    points: [
      { dot: false, id: "A", show_name: true, x: 0.0, y: 0.0 },
      { dot: false, id: "B", show_name: true, x: 4.0, y: 0.0 },
      { dot: false, id: "C", show_name: true, x: 0.0, y: 3.0 },
      { dot: false, id: "D", show_name: true, x: 7.0, y: 0.0 },
      { dot: false, id: "E", show_name: true, x: 15.0, y: 0.0 },
      { dot: false, id: "F", show_name: true, x: 7.0, y: 6.0 },
    ],
    polygons: [],
    segments: [
      {
        dashed: false,
        from: "A",
        label: "4",
        parallel_marks: 0,
        ticks: 0,
        to: "B",
      },
      {
        dashed: false,
        from: "B",
        label: "5",
        parallel_marks: 0,
        ticks: 0,
        to: "C",
      },
      {
        dashed: false,
        from: "C",
        label: "3",
        parallel_marks: 0,
        ticks: 0,
        to: "A",
      },
      {
        dashed: false,
        from: "D",
        label: "8",
        parallel_marks: 0,
        ticks: 0,
        to: "E",
      },
      {
        dashed: false,
        from: "E",
        label: "10",
        parallel_marks: 0,
        ticks: 0,
        to: "F",
      },
      {
        dashed: false,
        from: "F",
        label: "6",
        parallel_marks: 0,
        ticks: 0,
        to: "D",
      },
    ],
  },
  {
    angles: [],
    arcs: [],
    circles: [],
    kind: "geometry",
    lines: [],
    points: [
      { dot: false, id: "A", show_name: true, x: 0.0, y: 0.0 },
      { dot: false, id: "B", show_name: true, x: 4.0, y: 0.0 },
      { dot: false, id: "C", show_name: true, x: 0.0, y: 3.0 },
      { dot: false, id: "D", show_name: true, x: 7.0, y: 0.0 },
      { dot: false, id: "E", show_name: true, x: 15.0, y: 0.0 },
      { dot: false, id: "F", show_name: true, x: 7.0, y: 6.0 },
    ],
    polygons: [],
    segments: [
      {
        dashed: false,
        from: "A",
        label: "4",
        parallel_marks: 0,
        ticks: 0,
        to: "B",
      },
      {
        dashed: false,
        from: "A",
        label: "3",
        parallel_marks: 0,
        ticks: 0,
        to: "C",
      },
      {
        dashed: false,
        from: "B",
        label: "5",
        parallel_marks: 0,
        ticks: 0,
        to: "C",
      },
      {
        dashed: false,
        from: "D",
        label: "8",
        parallel_marks: 0,
        ticks: 0,
        to: "E",
      },
      {
        dashed: false,
        from: "D",
        label: "6",
        parallel_marks: 0,
        ticks: 0,
        to: "F",
      },
      {
        dashed: false,
        from: "E",
        label: "10",
        parallel_marks: 0,
        ticks: 0,
        to: "F",
      },
    ],
  },
];
const preservedTickCases: Figure[] = [
  {
    graphs: [{ a: 1.0, label: null, p: -2.0, q: -3.0, type: "quadratic" }],
    kind: "coordinate_plane",
    points: [{ label: "A", x: -2.0, y: -3.0 }],
    show_tick_labels: true,
    tick_step: 1.0,
    x_label: "x",
    x_max: 2.0,
    x_min: -5.0,
    y_label: "y",
    y_max: 6.0,
    y_min: -4.0,
    y_tick_step: 1.0,
  },
  {
    graphs: [{ a: -2.0, label: null, p: -1.0, q: 2.0, type: "quadratic" }],
    kind: "coordinate_plane",
    points: [
      { label: null, x: -1.0, y: 2.0 },
      { label: null, x: 0.0, y: 0.0 },
    ],
    show_tick_labels: true,
    tick_step: 1.0,
    x_label: "x",
    x_max: 5.0,
    x_min: -5.0,
    y_label: "y",
    y_max: 5.0,
    y_min: -5.0,
    y_tick_step: null,
  },
  {
    graphs: [{ a: -1.0, label: null, p: -1.0, q: 2.0, type: "quadratic" }],
    kind: "coordinate_plane",
    points: [
      { label: null, x: -1.0, y: 2.0 },
      { label: null, x: 0.0, y: 1.0 },
    ],
    show_tick_labels: true,
    tick_step: 1.0,
    x_label: "x",
    x_max: 5.0,
    x_min: -5.0,
    y_label: "y",
    y_max: 5.0,
    y_min: -5.0,
    y_tick_step: null,
  },
  {
    graphs: [{ a: 1.0, label: null, p: -1.0, q: 2.0, type: "quadratic" }],
    kind: "coordinate_plane",
    points: [
      { label: null, x: -1.0, y: 2.0 },
      { label: null, x: 0.0, y: 3.0 },
    ],
    show_tick_labels: true,
    tick_step: 1.0,
    x_label: "x",
    x_max: 5.0,
    x_min: -5.0,
    y_label: "y",
    y_max: 5.0,
    y_min: -5.0,
    y_tick_step: null,
  },
  {
    graphs: [{ a: -0.5, label: null, p: -1.0, q: 2.0, type: "quadratic" }],
    kind: "coordinate_plane",
    points: [
      { label: null, x: -1.0, y: 2.0 },
      { label: null, x: 1.0, y: 0.0 },
    ],
    show_tick_labels: true,
    tick_step: 1.0,
    x_label: "x",
    x_max: 5.0,
    x_min: -5.0,
    y_label: "y",
    y_max: 5.0,
    y_min: -5.0,
    y_tick_step: null,
  },
];

const measuredTextBox = (
  e: ReturnType<typeof drawFigure>["elements"][number],
) => {
  const x = Number(e.attrs.x),
    y = Number(e.attrs.y),
    fontSize = Number(e.attrs.fontSize);
  const width = Array.from(e.text ?? "").reduce(
    (sum, char) =>
      sum + fontSize * (char === "-" ? 0.33 : /\d/.test(char) ? 0.56 : 0.75),
    0,
  );
  const anchor = e.attrs.textAnchor;
  return {
    left: x - (anchor === "end" ? width : anchor === "middle" ? width / 2 : 0),
    right:
      x + (anchor === "start" ? width : anchor === "middle" ? width / 2 : 0),
    top: y - fontSize * 0.9,
    bottom: y + fontSize * 0.25,
  };
};
const boxesOverlap = (
  a: ReturnType<typeof measuredTextBox>,
  b: ReturnType<typeof measuredTextBox>,
) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test("가까운 두 삼각형에서 B와 D의 이름 상자가 겹치지 않는다", () => {
  for (const figure of nearbyTriangleCases) {
    const texts = drawFigure(figure).elements.filter((e) => e.tag === "text");
    const b = texts.find((e) => e.text === "B"),
      d = texts.find((e) => e.text === "D");
    expect(b).toBeDefined();
    expect(d).toBeDefined();
    expect(boxesOverlap(measuredTextBox(b!), measuredTextBox(d!))).toBe(false);
  }
});

test("좌표평면에서 C와 y축 눈금 2가 겹치지 않는다", () => {
  const texts = drawFigure(regressionPlane).elements.filter(
    (e) => e.tag === "text",
  );
  const c = texts.find((e) => e.text === "C");
  const tick = texts.find(
    (e) => e.text === "2" && e.attrs.textAnchor === "end",
  );
  expect(c).toBeDefined();
  if (tick)
    expect(boxesOverlap(measuredTextBox(c!), measuredTextBox(tick))).toBe(
      false,
    );
});

test("점과 겹치지 않는 y축 눈금은 남긴다", () => {
  for (const [i, figure] of preservedTickCases.entries()) {
    const texts = drawFigure(figure).elements.filter((e) => e.tag === "text");
    expect(
      texts.some(
        (e) =>
          e.text === (i === 0 ? "-2" : "2") && e.attrs.textAnchor === "end",
      ),
    ).toBe(true);
  }
});
