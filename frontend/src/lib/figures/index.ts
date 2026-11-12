import { drawShape, type Geometry, type Solid, type Net } from "./shapes.ts";

type Label = string | null;
type Point = { x: number; y: number };
type Graph =
  | { type: "linear"; m: number; b: number; label: Label }
  | { type: "vertical"; c: number; label: Label }
  | { type: "quadratic"; a: number; p: number; q: number; label: Label }
  | { type: "polyline"; points: Point[]; label: Label }
  | { type: "inverse"; k: number; label: Label };
export type Figure =
  | Geometry
  | Solid
  | Net
  | {
      kind: "number_line";
      min: number;
      max: number;
      tick_step: number;
      label_step: number;
      points: { x: number; label: Label; filled: boolean | null }[];
      rays: { from: number; direction: "left" | "right"; closed: boolean }[];
      segments: {
        from: number;
        to: number;
        from_closed: boolean;
        to_closed: boolean;
      }[];
    }
  | {
      kind: "coordinate_plane";
      x_min: number;
      x_max: number;
      y_min: number;
      y_max: number;
      tick_step: number;
      show_tick_labels: boolean;
      points: (Point & { label: Label })[];
      graphs: Graph[];
      x_label?: Label;
      y_label?: Label;
      y_tick_step?: number | null;
    }
  | {
      kind: "bar_chart";
      y_min?: number | null;
      categories: string[];
      values: number[];
      y_max: number;
      y_step: number;
      x_label: Label;
      y_label: Label;
    }
  | {
      kind: "frequency";
      class_start: number;
      class_width: number;
      frequencies: number[];
      relative?: boolean | null;
      compare_frequencies?: number[] | null;
      series_labels?: string[] | null;
      show_bars: boolean;
      show_polygon: boolean;
      y_step: number;
      x_label: Label;
      y_label: Label;
    }
  | {
      kind: "boxplot";
      axis_min: number;
      axis_max: number;
      axis_step: number;
      series: {
        label: string;
        min: number;
        q1: number;
        median: number;
        q3: number;
        max: number;
      }[];
    }
  | {
      kind: "scatter";
      x_min: number;
      x_max: number;
      x_step: number;
      y_min: number;
      y_max: number;
      y_step: number;
      x_label: Label;
      y_label: Label;
      points: Point[];
    };
export type Element = {
  tag: "line" | "rect" | "circle" | "polyline" | "text";
  attrs: Record<string, string | number>;
  text?: string;
};
export type Drawing = { viewBox: string; elements: Element[] };

export function drawFigure(figure: Figure): Drawing {
  if (
    figure.kind === "geometry" ||
    figure.kind === "solid" ||
    figure.kind === "net"
  )
    return drawShape(figure);
  const elements: Element[] = [];
  let height = 303;
  const add = (tag: Element["tag"], attrs: Element["attrs"], text?: string) =>
    elements.push({ tag, attrs, ...(text === undefined ? {} : { text }) });
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1.5) =>
    add("line", { x1, y1, x2, y2, stroke: "#222", strokeWidth: width });
  const axis = (x1: number, y1: number, x2: number, y2: number) =>
    add("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: "#222",
      strokeWidth: 1.5,
      "data-axis": "true",
    });
  const text = (
    x: number,
    y: number,
    value: string | number,
    anchor = "middle",
  ) =>
    add(
      "text",
      {
        x,
        y,
        textAnchor: anchor,
        fontSize: 20,
        fill: "#111",
        stroke: "white",
        strokeWidth: 4,
        paintOrder: "stroke",
      },
      String(value),
    );
  const circle = (x: number, y: number, filled: boolean, radius = 4) =>
    add("circle", {
      cx: x,
      cy: y,
      r: radius,
      fill: filled ? "#222" : "white",
      stroke: "#222",
      strokeWidth: 2,
    });
  const ticks = (min: number, max: number, step: number) => {
    if (!(step > 0) || !(max > min)) return [];
    const start = Math.ceil((min - step * 1e-8) / step);
    const end = Math.floor((max + step * 1e-8) / step);
    if (end - start > 100) return [];
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) =>
      Number(((start + i) * step).toPrecision(12)),
    );
  };
  // Choose a 1/2/5 × 10ⁿ multiple of the original label interval.
  // Keep zero and endpoints when they fit beside the regular labels.
  const numericLabels = (
    values: number[],
    position: (value: number) => number,
    horizontal: boolean,
  ): number[] => {
    if (values.length < 2) return values;
    const pixelStep = Math.abs(position(values[1]) - position(values[0]));
    if (!(pixelStep > 0)) return values.slice(0, 1);
    const widest = Math.max(...values.map((v) => String(v).length)) * 12;
    const spacing = horizontal ? widest + 6 : 24;
    const needed = Math.max(1, Math.ceil(spacing / pixelStep));
    const magnitude = 10 ** Math.floor(Math.log10(needed));
    const multiple =
      [1, 2, 5, 10].map((v) => v * magnitude).find((v) => v >= needed) ??
      needed;
    const zeroIndex = Math.max(
      0,
      values.findIndex((v) => Math.abs(v) < 1e-10),
    );
    const selected = values.filter(
      (_, index) => (index - zeroIndex) % multiple === 0,
    );
    const fits = (v: number) =>
      selected.every(
        (other) => Math.abs(position(v) - position(other)) >= spacing - 1e-7,
      );
    for (const v of [values[0], values[values.length - 1]]) {
      if (!selected.includes(v) && fits(v)) selected.push(v);
    }
    return selected;
  };
  const xmap = (v: number, min: number, max: number) =>
    50 + ((v - min) / (max - min)) * 320;
  const ymap = (v: number, min: number, max: number) =>
    235 - ((v - min) / (max - min)) * 170;
  const inside = (v: number, min: number, max: number) =>
    Number.isFinite(v) && v >= min && v <= max;
  const rect = (x: number, y: number, width: number, height: number) =>
    add("rect", {
      x,
      y,
      width,
      height,
      fill: "#dce9fa",
      stroke: "#222",
      strokeWidth: 1.5,
    });
  const dotLabel = (x: number, y: number, label: Label) => {
    if (label) {
      const labelWidth = Array.from(label).length * 20;
      if (x + 7 + labelWidth > 396) text(x - 7, y - 15, label, "end");
      else text(x + 7, y - 15, label, "start");
    }
  };
  const axes = (
    xmin: number,
    xmax: number,
    ymin: number,
    ymax: number,
    xstep: number,
    ystep: number,
    xl: Label,
    yl: Label,
  ) => {
    axis(50, 235, 370, 235);
    axis(50, 235, 50, 65);
    const xticks = ticks(xmin, xmax, xstep);
    const yticks = ticks(ymin, ymax, ystep);
    const xlabels = numericLabels(xticks, (v) => xmap(v, xmin, xmax), true);
    const ylabels = numericLabels(yticks, (v) => ymap(v, ymin, ymax), false);
    xticks.forEach((v) => {
      const x = xmap(v, xmin, xmax);
      axis(x, 235, x, 240);
      if (xlabels.includes(v)) text(x, 265, v);
    });
    yticks.forEach((v) => {
      const y = ymap(v, ymin, ymax);
      axis(45, y, 50, y);
      if (ylabels.includes(v)) text(40, y + 4, v, "end");
    });
    if (xl) text(210, 295, xl);
    if (yl) text(10, 28, yl, "start");
  };
  if (figure.kind === "number_line") {
    const { min, max } = figure;
    const x = (v: number) => xmap(v, min, max);
    const y = 45;
    height = 83;
    if (!(max > min)) return { viewBox: "0 0 400 83", elements };
    axis(50, y, 370, y);
    ticks(min, max, figure.tick_step).forEach((v) => {
      axis(x(v), y - 6, x(v), y + 6);
    });
    numericLabels(ticks(min, max, figure.label_step), x, true).forEach((v) =>
      text(x(v), y + 30, v),
    );
    figure.rays.forEach((r) => {
      if (!inside(r.from, min, max)) return;
      const end = r.direction === "left" ? 50 : 370;
      line(x(r.from), y, end, y, 4);
      const dir = r.direction === "left" ? 1 : -1;
      line(end, y, end + 9 * dir, y - 6, 3);
      line(end, y, end + 9 * dir, y + 6, 3);
      circle(x(r.from), y, r.closed, 5);
    });
    figure.segments.forEach((s) => {
      if (!inside(s.from, min, max) || !inside(s.to, min, max)) return;
      line(x(s.from), y, x(s.to), y, 4);
      circle(x(s.from), y, s.from_closed, 5);
      circle(x(s.to), y, s.to_closed, 5);
    });
    figure.points.forEach((p) => {
      if (!inside(p.x, min, max)) return;
      circle(x(p.x), y, p.filled !== false, p.filled === null ? 3 : 5);
      dotLabel(x(p.x), y, p.label);
    });
  } else if (figure.kind === "coordinate_plane") {
    const f = figure;
    if (!(f.x_max > f.x_min && f.y_max > f.y_min))
      return { viewBox: "0 0 400 260", elements };
    const xspan = f.x_max - f.x_min;
    const yspan = f.y_max - f.y_min;
    const scale = Math.min(320 / xspan, 270 / yspan);
    const plotWidth = f.y_tick_step != null ? 320 : xspan * scale;
    const plotHeight = f.y_tick_step != null ? 270 : yspan * scale;
    const left = 210 - plotWidth / 2;
    const right = left + plotWidth;
    const top = 45;
    const bottom = top + plotHeight;
    height = bottom + (f.x_label ? 74 : 40);
    const x = (v: number) => left + ((v - f.x_min) / xspan) * plotWidth;
    const y = (v: number) => bottom - ((v - f.y_min) / yspan) * plotHeight;
    const xticks = ticks(f.x_min, f.x_max, f.tick_step);
    const yticks = ticks(f.y_min, f.y_max, f.y_tick_step ?? f.tick_step);
    const xlabels = numericLabels(xticks, x, true);
    const ylabels = numericLabels(yticks, y, false);
    if (inside(0, f.y_min, f.y_max)) {
      axis(left, y(0), right, y(0));
      xticks.forEach((v) => {
        axis(x(v), y(0) - 4, x(v), y(0) + 4);
        if (
          f.show_tick_labels &&
          v !== 0 &&
          xlabels.includes(v) &&
          (v > 0 || x(0) - x(v) >= 27 + String(v).length * 6)
        )
          text(x(v), y(0) + 30, v);
      });
    }
    if (inside(0, f.x_min, f.x_max)) {
      axis(x(0), top, x(0), bottom);
      yticks.forEach((v) => {
        axis(x(0) - 4, y(v), x(0) + 4, y(v));
        if (
          f.show_tick_labels &&
          v !== 0 &&
          ylabels.includes(v) &&
          !(y(v) > y(0) && y(v) - y(0) < 45)
        )
          text(x(0) - 12, y(v) + 5, v, "end");
      });
    }
    if (inside(0, f.x_min, f.x_max) && inside(0, f.y_min, f.y_max))
      text(x(0) - 12, y(0) + 30, "O", "end");
    if (f.x_label) text(right, bottom + 65, f.x_label, "end");
    if (f.y_label) text(x(0) + 8, top - 10, f.y_label, "start");
    f.graphs.forEach((g) => {
      if (g.type === "vertical") {
        if (inside(g.c, f.x_min, f.x_max)) {
          line(x(g.c), top, x(g.c), bottom, 2.5);
          dotLabel(x(g.c), top + 20, g.label);
        }
        return;
      }
      if (g.type === "polyline") {
        for (let i = 1; i < g.points.length; i++) {
          const a = g.points[i - 1];
          const b = g.points[i];
          line(x(a.x), y(a.y), x(b.x), y(b.y), 2);
        }
        if (g.label && g.points[0])
          dotLabel(x(g.points[0].x), y(g.points[0].y), g.label);
        return;
      }
      let previous: Point | null = null;
      let labelPlaced = false;
      for (let i = 0; i <= 400; i++) {
        const vx = f.x_min + ((f.x_max - f.x_min) * i) / 400;
        const vy =
          g.type === "linear"
            ? g.m * vx + g.b
            : g.type === "inverse"
              ? g.k / vx
              : g.a * (vx - g.p) ** 2 + g.q;
        const current = { x: vx, y: vy };
        if (
          previous &&
          Number.isFinite(vy) &&
          Number.isFinite(previous.y) &&
          !(g.type === "inverse" && previous.x * vx <= 0)
        ) {
          const dy = current.y - previous.y;
          let t0 = 0;
          let t1 = 1;
          if (dy === 0) {
            if (!inside(vy, f.y_min, f.y_max)) {
              previous = current;
              continue;
            }
          } else {
            const a = (f.y_min - previous.y) / dy;
            const b = (f.y_max - previous.y) / dy;
            t0 = Math.max(0, Math.min(a, b));
            t1 = Math.min(1, Math.max(a, b));
          }
          if (t0 <= t1) {
            const ax = previous.x + (current.x - previous.x) * t0;
            const ay = previous.y + dy * t0;
            const bx = previous.x + (current.x - previous.x) * t1;
            const by = previous.y + dy * t1;
            add("polyline", {
              points: `${x(ax)},${y(ay)} ${x(bx)},${y(by)}`,
              fill: "none",
              stroke: "#222",
              strokeWidth: 2,
            });
            if (!labelPlaced && g.label) {
              dotLabel(x(ax), Math.max(top + 20, y(ay)), g.label);
              labelPlaced = true;
            }
          }
        }
        previous = current;
      }
    });
    f.points.forEach((p) => {
      if (inside(p.x, f.x_min, f.x_max) && inside(p.y, f.y_min, f.y_max)) {
        circle(x(p.x), y(p.y), true, 3);
        dotLabel(x(p.x), y(p.y), p.label);
      }
    });
  } else if (figure.kind === "boxplot") {
    const f = figure;
    if (!(f.axis_max > f.axis_min)) return { viewBox: "0 0 400 260", elements };
    const x = (v: number) => xmap(v, f.axis_min, f.axis_max);
    const axisY = 67 + Math.max(0, f.series.length - 1) * 48;
    height = axisY + 38;
    axis(50, axisY, 370, axisY);
    const boxTicks = ticks(f.axis_min, f.axis_max, f.axis_step);
    const boxLabels = numericLabels(boxTicks, x, true);
    boxTicks.forEach((v) => {
      axis(x(v), axisY, x(v), axisY + 5);
      if (boxLabels.includes(v)) text(x(v), axisY + 30, v);
    });
    f.series.forEach((s, i) => {
      if (
        ![s.min, s.q1, s.median, s.q3, s.max].every((v) =>
          inside(v, f.axis_min, f.axis_max),
        )
      )
        return;
      const y = 40 + i * 48;
      text(50, y - 17, s.label, "start");
      line(x(s.min), y, x(s.max), y);
      line(x(s.min), y - 10, x(s.min), y + 10);
      line(x(s.max), y - 10, x(s.max), y + 10);
      rect(x(s.q1), y - 12, Math.max(0, x(s.q3) - x(s.q1)), 24);
      line(x(s.median), y - 12, x(s.median), y + 12, 2);
    });
  } else if (figure.kind === "scatter") {
    const f = figure;
    if (!(f.x_max > f.x_min && f.y_max > f.y_min))
      return { viewBox: "0 0 400 260", elements };
    axes(
      f.x_min,
      f.x_max,
      f.y_min,
      f.y_max,
      f.x_step,
      f.y_step,
      f.x_label,
      f.y_label,
    );
    f.points.forEach((p) => {
      if (inside(p.x, f.x_min, f.x_max) && inside(p.y, f.y_min, f.y_max))
        circle(
          xmap(p.x, f.x_min, f.x_max),
          ymap(p.y, f.y_min, f.y_max),
          true,
          3,
        );
    });
  } else {
    const f = figure;
    const frequency = f.kind === "frequency";
    const values = frequency ? f.frequencies : f.values;
    const count = values.length;
    const ymin = frequency ? 0 : (f.y_min ?? 0);
    const ymax = frequency
      ? Math.max(
          f.y_step,
          Math.ceil(
            Math.max(0, ...values, ...(f.compare_frequencies ?? [])) / f.y_step,
          ) * f.y_step,
        )
      : f.y_max;
    if (!count || !(ymax > ymin)) return { viewBox: "0 0 400 260", elements };
    const left = frequency ? 50 + 160 / (count + 1) : 50;
    const width = frequency ? (320 * count) / (count + 1) : 320;
    const band = width / count;
    const y = (v: number) => ymap(v, ymin, ymax);
    axis(50, 235, 370, 235);
    axis(50, 235, 50, 65);
    const yTicks = ticks(ymin, ymax, f.y_step);
    const yLabels = numericLabels(yTicks, y, false);
    yTicks.forEach((v) => {
      axis(45, y(v), 50, y(v));
      if (yLabels.includes(v)) text(40, y(v) + 4, v, "end");
    });
    if (f.x_label) text(210, 295, f.x_label);
    if (f.y_label) text(10, 28, f.y_label, "start");
    values.forEach((v, i) => {
      if (!inside(v, ymin, ymax)) return;
      const cx = left + band * (i + 0.5);
      if (!frequency || f.show_bars)
        rect(
          left + band * i + (frequency ? 0 : band * 0.15),
          y(v),
          band * (frequency ? 1 : 0.7),
          235 - y(v),
        );
      if (!frequency) text(cx, 265, f.categories[i] ?? "");
    });
    if (frequency) {
      const boundaries = Array.from({ length: count + 1 }, (_, i) =>
        Number((f.class_start + f.class_width * i).toPrecision(12)),
      );
      const boundaryX = (value: number) =>
        left + ((value - f.class_start) / f.class_width) * band;
      const boundaryLabels = numericLabels(boundaries, boundaryX, true);
      boundaries.forEach((value) => {
        const x = boundaryX(value);
        axis(x, 235, x, 240);
        if (boundaryLabels.includes(value)) text(x, 265, value);
      });
      if (f.show_polygon) {
        const pts = [
          [left - band / 2, 235],
          ...values.map((v, i) => [left + band * (i + 0.5), y(v)]),
          [left + width + band / 2, 235],
        ];
        for (let i = 1; i < pts.length; i++)
          line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 2);
        if (f.compare_frequencies) {
          const second = [
            [left - band / 2, 235],
            ...f.compare_frequencies.map((v, i) => [
              left + band * (i + 0.5),
              y(v),
            ]),
            [left + width + band / 2, 235],
          ];
          add("polyline", {
            points: second.map((p) => p.join(",")).join(" "),
            fill: "none",
            stroke: "#222",
            strokeWidth: 2,
            strokeDasharray: "6 4",
          });
          if (f.series_labels) {
            line(235, 17, 265, 17, 2);
            text(275, 23, f.series_labels[0], "start");
            add("line", {
              x1: 235,
              y1: 43,
              x2: 265,
              y2: 43,
              stroke: "#222",
              strokeWidth: 2,
              strokeDasharray: "6 4",
            });
            text(275, 49, f.series_labels[1], "start");
          }
        }
      }
    }
  }
  // Reserve space for text at the edges. A full font-size per character is
  // conservative for Korean labels and avoids clipping without measuring DOM.
  let left = 0;
  let right = 400;
  for (const element of elements) {
    if (element.tag !== "text" || !element.text) continue;
    const x = Number(element.attrs.x);
    const width =
      Array.from(element.text).length * Number(element.attrs.fontSize);
    const anchor = element.attrs.textAnchor;
    const start =
      x - (anchor === "end" ? width : anchor === "middle" ? width / 2 : 0);
    const end = start + width;
    left = Math.min(left, Math.floor(start - 4));
    right = Math.max(right, Math.ceil(end + 4));
  }
  const fills = elements.filter(
    (e) =>
      e.tag === "rect" &&
      e.attrs.fill &&
      e.attrs.fill !== "none" &&
      e.attrs.fill !== "white",
  );
  const dots = elements.filter((e) => e.tag === "circle");
  const labels = elements.filter((e) => e.tag === "text");
  const lines = elements.filter(
    (e) => !fills.includes(e) && !dots.includes(e) && e.tag !== "text",
  );
  elements.splice(0, elements.length, ...fills, ...lines, ...dots, ...labels);
  elements.unshift({
    tag: "rect",
    attrs: { x: left, y: 0, width: right - left, height, fill: "white" },
  });
  return { viewBox: `${left} 0 ${right - left} ${height}`, elements };
}
