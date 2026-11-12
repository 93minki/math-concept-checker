import type { Drawing, Element } from "./index.ts";

type Point = { x: number; y: number };
type Label = string | null;
type Part = "width" | "depth" | "height" | "radius" | "top_radius" | "slant";
export type Geometry = {
  kind: "geometry";
  points: (Point & { id: string; show_name: boolean; dot: boolean })[];
  segments: {
    from: string;
    to: string;
    dashed: boolean;
    ticks: number;
    parallel_marks: number;
    label: Label;
  }[];
  lines: {
    from: string;
    through: string;
    type: "line" | "ray";
    dashed: boolean;
    parallel_marks: number;
    label: Label;
  }[];
  polygons: { vertices: string[]; shaded: boolean }[];
  circles: {
    center: string;
    radius: number;
    dashed: boolean;
    points_on: string[];
  }[];
  arcs: {
    center: string;
    from: string;
    to: string;
    trace: boolean;
    label: Label;
  }[];
  angles: {
    vertex: string;
    from: string;
    to: string;
    label: Label;
    right: boolean;
    marks: 0 | 1 | 2 | 3;
  }[];
};
type Dimension = { part: Part; text: string };
export type Solid = {
  kind: "solid";
  shape:
    | "cuboid"
    | "prism"
    | "pyramid"
    | "frustum"
    | "cylinder"
    | "cone"
    | "cone_frustum"
    | "sphere"
    | "hemisphere";
  base_sides: number | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  radius: number | null;
  top_radius: number | null;
  vertex_names: string[] | null;
  labels: Dimension[];
  show_axis: boolean;
};
export type Net = {
  kind: "net";
  shape: "cylinder" | "cone";
  radius: number;
  height: number | null;
  slant: number | null;
  labels: Dimension[];
};

export function drawShape(figure: Geometry | Solid | Net): Drawing {
  const elements: Element[] = [];
  const pointAnchors = new Map<Element, Point>();
  const vertexCenters = new Map<Element, Point>();
  const angleLimits = new Map<Element, { center: Point; radius: number }>();
  const segmentLabels = new Map<Element, [Point, Point]>();
  const pyramidHeights = new Set<Element>();
  const add = (tag: Element["tag"], attrs: Element["attrs"], text?: string) =>
    elements.push({ tag, attrs, ...(text === undefined ? {} : { text }) });
  const path = (points: Point[], dashed = false, fill = "none", width = 1.5) =>
    add("polyline", {
      points: points.map((p) => `${p.x},${p.y}`).join(" "),
      fill,
      stroke: "#222",
      strokeWidth: width,
      ...(dashed ? { strokeDasharray: "6 4" } : {}),
    });
  const line = (a: Point, b: Point, dashed = false) => path([a, b], dashed);
  const text = (p: Point, value: string, anchor = "middle") =>
    add(
      "text",
      {
        x: p.x,
        y: p.y,
        textAnchor: anchor,
        fontSize: 20,
        fill: "#111",
        stroke: "white",
        strokeWidth: 4,
        paintOrder: "stroke",
      },
      value,
    );
  const circle = (p: Point, r: number, dashed = false) =>
    add("circle", {
      cx: p.x,
      cy: p.y,
      r,
      fill: "none",
      stroke: "#222",
      ...(dashed ? { strokeDasharray: "6 4" } : {}),
    });
  const arc = (
    c: Point,
    rx: number,
    ry: number,
    start: number,
    sweep: number,
    dashed = false,
    width = 1.5,
  ) => {
    const points = Array.from({ length: 65 }, (_, i) => ({
      x: c.x + rx * Math.cos(start + (sweep * i) / 64),
      y: c.y + ry * Math.sin(start + (sweep * i) / 64),
    }));
    path(points, dashed, "none", width);
    return points;
  };
  let height = 320;
  if (figure.kind === "geometry") {
    const f = figure,
      original = new Map(f.points.map((p) => [p.id, p]));
    const xs = f.points.map((p) => p.x),
      ys = f.points.map((p) => p.y);
    for (const c of f.circles) {
      const p = original.get(c.center)!;
      xs.push(p.x - c.radius, p.x + c.radius);
      ys.push(p.y - c.radius, p.y + c.radius);
    }
    for (const a of f.arcs) {
      const c = original.get(a.center)!,
        p = original.get(a.from)!,
        r = Math.hypot(c.x - p.x, c.y - p.y);
      const q = original.get(a.to)!;
      const start = Math.atan2(p.y - c.y, p.x - c.x);
      const end = Math.atan2(q.y - c.y, q.x - c.x);
      const sweep = (end - start + 2 * Math.PI) % (2 * Math.PI);
      for (let i = 0; i <= 64; i++) {
        const angle = start + (sweep * i) / 64;
        xs.push(c.x + r * Math.cos(angle));
        ys.push(c.y + r * Math.sin(angle));
      }
    }
    const xmin = Math.min(...xs),
      xmax = Math.max(...xs),
      ymin = Math.min(...ys),
      ymax = Math.max(...ys);
    const shortest = Math.min(
      ...f.segments
        .map((segment) => {
          const a = original.get(segment.from)!,
            b = original.get(segment.to)!;
          return Math.hypot(a.x - b.x, a.y - b.y);
        })
        .filter((length) => length > 0),
    );
    const scale = Math.max(
      Math.min(290 / Math.max(xmax - xmin, 1), 230 / Math.max(ymax - ymin, 1)),
      30 / shortest,
    );
    const convert = (p: Point) => ({
      x: 200 + (p.x - (xmin + xmax) / 2) * scale,
      y: 155 - (p.y - (ymin + ymax) / 2) * scale,
    });
    const get = (id: string) => convert(original.get(id)!);
    const sorted = f.points
      .map((p) => ({ id: p.id, ...convert(p) }))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a: Point, b: Point, c: Point) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const hullHalf = (points: typeof sorted) => {
      const half: typeof sorted = [];
      for (const point of points) {
        while (
          half.length >= 2 &&
          cross(half[half.length - 2], half[half.length - 1], point) <= 0
        )
          half.pop();
        half.push(point);
      }
      return half.slice(0, -1);
    };
    const hull =
      sorted.length >= 3
        ? [...hullHalf(sorted), ...hullHalf([...sorted].reverse())]
        : [];
    const hullIds = new Set(hull.map((point) => point.id));
    const hullCenter = hull.length
      ? {
          x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
          y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length,
        }
      : null;
    const marks = (a: Point, b: Point, count: number, parallel: boolean) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy);
      if (!len) return;
      const ux = dx / len,
        uy = dy / len;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 7,
          x = (a.x + b.x) / 2 + ux * offset,
          y = (a.y + b.y) / 2 + uy * offset;
        if (parallel)
          path([
            { x: x - ux * 4 - uy * 4, y: y - uy * 4 + ux * 4 },
            { x: x + ux * 3, y: y + uy * 3 },
            { x: x - ux * 4 + uy * 4, y: y - uy * 4 - ux * 4 },
          ]);
        else
          line(
            { x: x - uy * 5, y: y + ux * 5 },
            { x: x + uy * 5, y: y - ux * 5 },
          );
      }
    };
    for (const p of f.polygons) {
      const pts = p.vertices.map(get);
      if (pts.length) path([...pts, pts[0]], false, p.shaded ? "#eee" : "none");
    }
    for (const c of f.circles)
      circle(get(c.center), c.radius * scale, c.dashed);
    for (const a of f.arcs) {
      const c = get(a.center),
        p = get(a.from),
        q = get(a.to),
        start = Math.atan2(p.y - c.y, p.x - c.x),
        end = Math.atan2(q.y - c.y, q.x - c.x),
        sweep = -((start - end + 2 * Math.PI) % (2 * Math.PI));
      const pts = arc(
        c,
        Math.hypot(p.x - c.x, p.y - c.y),
        Math.hypot(p.x - c.x, p.y - c.y),
        start,
        sweep,
        false,
        a.trace ? 0.8 : 1.5,
      );
      if (a.label) text({ x: pts[32].x, y: pts[32].y - 7 }, a.label);
    }
    for (const s of f.segments) {
      const a = get(s.from),
        b = get(s.to);
      line(a, b, s.dashed);
      marks(a, b, s.ticks, false);
      marks(a, b, s.parallel_marks, true);
      if (s.label) {
        text({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 10 }, s.label);
        segmentLabels.set(elements[elements.length - 1], [a, b]);
      }
    }
    for (const l of f.lines) {
      const a = get(l.from),
        b = get(l.through),
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = (dir: number) =>
        Math.min(
          ...[
            dx ? ((dir * dx > 0 ? 370 : 30) - a.x) / (dir * dx) : Infinity,
            dy ? ((dir * dy > 0 ? 280 : 30) - a.y) / (dir * dy) : Infinity,
          ].filter((n) => n >= 0),
        );
      const lo = l.type === "line" ? t(-1) : 0,
        hi = t(1),
        p = { x: a.x - dx * lo, y: a.y - dy * lo },
        q = { x: a.x + dx * hi, y: a.y + dy * hi };
      line(p, q, l.dashed);
      marks(p, q, l.parallel_marks, true);
      if (l.label)
        text({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 10 }, l.label);
    }
    for (const a of f.angles) {
      const c = get(a.vertex),
        p = get(a.from),
        q = get(a.to);
      const start = Math.atan2(p.y - c.y, p.x - c.x),
        end = Math.atan2(q.y - c.y, q.x - c.x);
      const sweep = ((end - start + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      if (a.right) {
        const u = { x: Math.cos(start) * 17, y: Math.sin(start) * 17 },
          v = { x: Math.cos(end) * 17, y: Math.sin(end) * 17 };
        path([
          { x: c.x + u.x, y: c.y + u.y },
          { x: c.x + u.x + v.x, y: c.y + u.y + v.y },
          { x: c.x + v.x, y: c.y + v.y },
        ]);
      } else
        for (let i = 0; i < Math.max(1, a.marks); i++)
          arc(c, 18 + i * 5, 18 + i * 5, start, sweep);
      if (a.label) {
        const radius = 18 + (Math.max(1, a.marks) - 1) * 5;
        const narrow = Math.abs(sweep) < (50 * Math.PI) / 180;
        text(
          {
            x:
              c.x + (radius + (narrow ? 30 : 20)) * Math.cos(start + sweep / 2),
            y:
              c.y + (radius + (narrow ? 30 : 20)) * Math.sin(start + sweep / 2),
          },
          a.label,
        );
        angleLimits.set(elements[elements.length - 1], {
          center: c,
          radius: radius + (narrow ? 40 : 30),
        });
      }
    }
    for (const p of f.points) {
      const at = get(p.id);
      if (p.dot) add("circle", { cx: at.x, cy: at.y, r: 3, fill: "#222" });
      if (p.show_name) {
        text({ x: at.x, y: at.y }, p.id);
        pointAnchors.set(elements[elements.length - 1], at);
        const polygon = f.polygons.find((shape) =>
          shape.vertices.includes(p.id),
        );
        const center = polygon
          ? {
              x:
                polygon.vertices.reduce((sum, id) => sum + get(id).x, 0) /
                polygon.vertices.length,
              y:
                polygon.vertices.reduce((sum, id) => sum + get(id).y, 0) /
                polygon.vertices.length,
            }
          : hullIds.has(p.id)
            ? hullCenter
            : null;
        if (center) vertexCenters.set(elements[elements.length - 1], center);
        elements[elements.length - 1].attrs["data-point-x"] = at.x;
        elements[elements.length - 1].attrs["data-point-y"] = at.y;
      }
    }
  } else if (figure.kind === "net") {
    if (figure.shape === "cylinder") {
      const r = Math.min(
          290 / (Math.PI * 2),
          240 / (4 + (figure.height ?? 1) / figure.radius),
        ),
        rectWidth = 2 * Math.PI * r,
        h = (r * (figure.height ?? 1)) / figure.radius,
        left = 200 - rectWidth / 2,
        top = 160 - h / 2;
      path([
        { x: left, y: top },
        { x: left + rectWidth, y: top },
        { x: left + rectWidth, y: top + h },
        { x: left, y: top + h },
        { x: left, y: top },
      ]);
      circle({ x: 200, y: top - r }, r);
      circle({ x: 200, y: top + h + r }, r);
      for (const label of figure.labels) {
        if (label.part === "radius") {
          line({ x: 200, y: top - r }, { x: 200 + r, y: top - r });
          text({ x: 200 + r / 2, y: top - r - 8 }, label.text);
        } else if (label.part === "height")
          text(
            { x: left + rectWidth + 12, y: top + h / 2 },
            label.text,
            "start",
          );
        else if (label.part === "width")
          text({ x: 200, y: top + h / 2 }, label.text);
      }
    } else {
      const radius = figure.radius,
        slant = figure.slant ?? radius,
        angle = (2 * Math.PI * radius) / slant,
        R = 115,
        c = { x: 200, y: 70 };
      const points = arc(c, R, R, Math.PI / 2 - angle / 2, angle);
      line(c, points[0]);
      line(c, points[points.length - 1]);
      const mid = points[32];
      const norm = Math.hypot(mid.x - c.x, mid.y - c.y),
        r = (R * radius) / slant;
      const center = {
        x: mid.x + ((mid.x - c.x) / norm) * r,
        y: mid.y + ((mid.y - c.y) / norm) * r,
      };
      circle(center, r);
      for (const label of figure.labels) {
        if (label.part === "slant")
          text(
            { x: (c.x + points[0].x) / 2 - 12, y: (c.y + points[0].y) / 2 },
            label.text,
            "end",
          );
        else if (label.part === "radius") {
          line(center, { x: center.x + r, y: center.y });
          text({ x: center.x + r / 2, y: center.y - 8 }, label.text);
        }
      }
    }
  } else {
    const f = figure;
    const positions: Partial<Record<Part, Point>> = {};
    if (f.shape === "sphere" || f.shape === "hemisphere") {
      const c = { x: 200, y: 150 },
        r = 90;
      if (f.shape === "sphere") circle(c, r);
      else arc(c, r, r, Math.PI, Math.PI);
      arc(c, r, 25, Math.PI, Math.PI, true);
      arc(c, r, 25, 0, Math.PI);
      if (f.show_axis) line({ x: 200, y: 55 }, { x: 200, y: 245 }, true);
      if (f.labels.some((label) => label.part === "radius"))
        line(c, { x: c.x + r, y: c.y });
      positions.radius = { x: c.x + r / 2, y: c.y - 25 };
    } else if (["cylinder", "cone", "cone_frustum"].includes(f.shape)) {
      const scale = Math.min(120 / (f.radius ?? 1), 185 / (f.height ?? 1));
      const r = (f.radius ?? 1) * scale;
      const h = (f.height ?? 1) * scale;
      const bottom = { x: 200, y: 240 },
        top = { x: 200, y: 240 - h },
        tr =
          f.shape === "cylinder"
            ? r
            : f.shape === "cone"
              ? 0
              : (r * (f.top_radius ?? 0)) / (f.radius ?? 1);
      arc(bottom, r, r * 0.26, Math.PI, Math.PI, true);
      arc(bottom, r, r * 0.26, 0, Math.PI);
      if (tr) {
        arc(top, tr, tr * 0.26, 0, 2 * Math.PI);
        line({ x: 200 - r, y: bottom.y }, { x: 200 - tr, y: top.y });
        line({ x: 200 + r, y: bottom.y }, { x: 200 + tr, y: top.y });
      } else {
        line({ x: 200 - r, y: bottom.y }, top);
        line({ x: 200 + r, y: bottom.y }, top);
      }
      if (f.show_axis || f.labels.some((label) => label.part === "height"))
        line(top, bottom, true);
      if (f.labels.some((label) => label.part === "radius"))
        line(bottom, { x: bottom.x + r, y: bottom.y });
      if (f.labels.some((label) => label.part === "top_radius") && tr)
        line(top, { x: top.x + tr, y: top.y });
      // Cones narrow toward the apex, so keep the height label low on the
      // axis where it cannot be read as the slant edge.
      positions.height = {
        x: top.x + 8,
        y: tr ? (top.y + bottom.y) / 2 : top.y + (bottom.y - top.y) * 0.72,
      };
      // Below the radius line, inside the front half of the base ellipse.
      positions.radius = { x: bottom.x + r / 2, y: bottom.y + 20 };
      positions.top_radius = { x: top.x + tr / 2, y: top.y - 9 };
      positions.slant = {
        x: (bottom.x + r + top.x + tr) / 2 + 30,
        y: (top.y + bottom.y) / 2,
      };
    } else {
      const n = f.shape === "cuboid" ? 4 : (f.base_sides ?? 3);
      const radialUnit = Math.min(100 / (f.radius ?? 1), 150 / (f.height ?? 1));
      const radial = (f.radius ?? 1) * radialUnit;
      let base: Point[];
      if (f.shape === "cuboid") {
        const unit = Math.min(
          180 / ((f.width ?? 1) + (f.depth ?? 1) * 0.35),
          155 / (f.height ?? 1),
        );
        const w = (f.width ?? 1) * unit,
          d = (f.depth ?? 1) * unit * 0.5;
        base = [
          { x: 200 - w / 2, y: 245 },
          { x: 200 + w / 2, y: 245 },
          { x: 200 + w / 2 + d * 0.7, y: 245 - d * 0.7 },
          { x: 200 - w / 2 + d * 0.7, y: 245 - d * 0.7 },
        ];
      } else if (f.shape === "pyramid" && n === 4) {
        const w = radial * 2.1,
          d = radial * 0.9;
        base = [
          { x: 200 - (w + d) / 2, y: 220 + d / 2 },
          { x: 200 + (w - d) / 2, y: 220 + d / 2 },
          { x: 200 + (w + d) / 2, y: 220 - d / 2 },
          { x: 200 - (w - d) / 2, y: 220 - d / 2 },
        ];
      } else
        base = Array.from({ length: n }, (_, i) => {
          const angle = Math.PI / 2 + (2 * Math.PI * i) / n;
          return {
            x: 200 + radial * Math.cos(angle),
            y: 220 + radial * 0.35 * Math.sin(angle),
          };
        });
      const vertical =
        f.shape === "cuboid"
          ? Math.min(
              180 / ((f.width ?? 1) + (f.depth ?? 1) * 0.35),
              155 / (f.height ?? 1),
            ) * (f.height ?? 1)
          : f.shape === "pyramid" && n === 4
            ? Math.min(
                radial * 2.4,
                Math.max(radialUnit * (f.height ?? 1), radial * 1.801),
              )
            : Math.max(
                radialUnit * (f.height ?? 1),
                f.shape === "pyramid" ? radial * 0.7 : 0,
              );
      const top =
        f.shape === "pyramid"
          ? [{ x: 200, y: 220 - vertical }]
          : base.map((p) => ({
              x:
                200 +
                (p.x - 200) *
                  (f.shape === "frustum"
                    ? (f.top_radius ?? 0) / (f.radius ?? 1)
                    : 1),
              y:
                p.y -
                vertical +
                (p.y - 220) *
                  (f.shape === "frustum"
                    ? (f.top_radius ?? 0) / (f.radius ?? 1) - 1
                    : 0),
            }));
      const visibleFaces = base.map((p, i) => {
        const next = base[(i + 1) % n],
          upper = top[f.shape === "pyramid" ? 0 : i];
        return (
          (next.x - p.x) * (upper.y - p.y) - (next.y - p.y) * (upper.x - p.x) >
          1e-8
        );
      });
      for (let i = 0; i < n; i++) {
        line(
          base[i],
          base[(i + 1) % n],
          f.shape === "cuboid" || (f.shape === "pyramid" && n === 4)
            ? i >= Math.ceil(n / 2)
            : !visibleFaces[i],
        );
        line(
          base[i],
          top[f.shape === "pyramid" ? 0 : i],
          f.shape === "cuboid" || (f.shape === "pyramid" && n === 4)
            ? i === 3
            : !visibleFaces[i] && !visibleFaces[(i + n - 1) % n],
        );
        if (f.shape !== "pyramid") line(top[i], top[(i + 1) % n]);
      }
      if (
        f.shape === "pyramid" &&
        n === 4 &&
        (f.show_axis || f.labels.some((label) => label.part === "height"))
      )
        line(top[0], { x: 200, y: 220 }, true);
      const vertices = [...base, ...top];
      const center = {
        x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length,
        y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length,
      };
      const vertexOrder =
        f.shape === "pyramid" && n === 4
          ? [n, ...Array.from({ length: n }, (_, i) => i)]
          : vertices.map((_, i) => i);
      vertexOrder.forEach((i) => {
        const p = vertices[i];
        if (f.vertex_names?.[i]) {
          text(p, f.vertex_names[i]);
          pointAnchors.set(elements[elements.length - 1], p);
          vertexCenters.set(elements[elements.length - 1], center);
          elements[elements.length - 1].attrs["data-point-x"] = p.x;
          elements[elements.length - 1].attrs["data-point-y"] = p.y;
        }
      });
      positions.width = {
        x: (base[0].x + base[1].x) / 2,
        y: (base[0].y + base[1].y) / 2 + 25,
      };
      positions.depth = {
        x: (base[1].x + base[2].x) / 2 + 22,
        y: (base[1].y + base[2].y) / 2,
      };
      positions.height = {
        x: (base[1].x + top[Math.min(1, top.length - 1)].x) / 2 + 20,
        y: (base[1].y + top[Math.min(1, top.length - 1)].y) / 2,
      };
      if (f.shape === "pyramid" && n === 4)
        positions.height = { x: 208, y: (top[0].y + 220) / 2 };
      positions.slant = positions.height;
    }
    f.labels.forEach((label) => {
      const position = positions[label.part];
      if (position) {
        text(
          position,
          label.text,
          label.part === "height" && f.shape === "pyramid" && f.base_sides === 4
            ? "middle"
            : label.part === "height" || label.part === "slant"
              ? "start"
              : "middle",
        );
        if (
          label.part === "height" &&
          f.shape === "pyramid" &&
          f.base_sides === 4
        ) {
          const element = elements[elements.length - 1];
          pyramidHeights.add(element);
        }
      }
    });
  }
  const strokes: [Point, Point][] = [];
  for (const element of elements) {
    if (element.tag !== "polyline") continue;
    const points = String(element.attrs.points)
      .split(" ")
      .map((value) => {
        const [x, y] = value.split(",").map(Number);
        return { x, y };
      });
    for (let i = 1; i < points.length; i++)
      strokes.push([points[i - 1], points[i]]);
  }
  const textElements = elements.filter((e) => e.tag === "text" && e.text);
  const boxes: { left: number; right: number; top: number; bottom: number }[] =
    [];
  for (const element of textElements) {
    const width = Array.from(element.text!).length * 12;
    const anchor = element.attrs.textAnchor;
    const original = { x: Number(element.attrs.x), y: Number(element.attrs.y) };
    const point = pointAnchors.get(element);
    const center = vertexCenters.get(element);
    if (center) {
      element.attrs["data-center-x"] = center.x;
      element.attrs["data-center-y"] = center.y;
    }
    const box = (position: Point) => ({
      left:
        position.x -
        (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0),
      right:
        position.x +
        (anchor === "middle" ? width / 2 : anchor === "end" ? 0 : width),
      top: position.y - 16,
      bottom: position.y + 4,
    });
    const intersects = (a: Point, b: Point, rect: ReturnType<typeof box>) => {
      let low = 0,
        high = 1;
      for (const [origin, delta, min, max] of [
        [a.x, b.x - a.x, rect.left, rect.right],
        [a.y, b.y - a.y, rect.top, rect.bottom],
      ]) {
        if (Math.abs(delta) < 1e-9) {
          if (origin < min || origin > max) return false;
          continue;
        }
        const first = (min - origin) / delta,
          last = (max - origin) / delta;
        low = Math.max(low, Math.min(first, last));
        high = Math.min(high, Math.max(first, last));
        if (low > high) return false;
      }
      return true;
    };
    let candidates: Point[];
    if (point) {
      const directions: number[] = [];
      for (const [a, b] of strokes) {
        const dx = b.x - a.x,
          dy = b.y - a.y,
          length2 = dx * dx + dy * dy;
        if (!length2) continue;
        const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2;
        if (
          t < -0.001 ||
          t > 1.001 ||
          Math.hypot(a.x + t * dx - point.x, a.y + t * dy - point.y) > 1
        )
          continue;
        if (t > 0.001)
          directions.push(Math.atan2(a.y - point.y, a.x - point.x));
        if (t < 0.999)
          directions.push(Math.atan2(b.y - point.y, b.x - point.x));
      }
      directions.sort((a, b) => a - b);
      const gaps = directions
        .map((angle, i) => {
          const next =
            i + 1 < directions.length
              ? directions[i + 1]
              : directions[0] + 2 * Math.PI;
          return { angle: (angle + next) / 2, size: next - angle };
        })
        .sort((a, b) => b.size - a.size);
      const angles = gaps.length
        ? gaps.map((gap) => gap.angle)
        : [-Math.PI / 2];
      if (center && Math.hypot(point.x - center.x, point.y - center.y) > 1e-8)
        angles.push(Math.atan2(point.y - center.y, point.x - center.x));
      candidates = angles.flatMap((angle) =>
        [24, 36, 52, 70, 90].map((distance) => ({
          x: point.x + Math.cos(angle) * (distance + width / 2),
          y: point.y + Math.sin(angle) * distance + 6,
        })),
      );
      if (center) {
        const radius = Math.hypot(point.x - center.x, point.y - center.y);
        const outward = candidates.filter(
          (candidate) =>
            Math.hypot(candidate.x - center.x, candidate.y - center.y) >
              radius &&
            ((candidate.x - point.x) * (point.x - center.x) +
              (candidate.y - point.y) * (point.y - center.y) >
              0 ||
              radius < 1e-8),
        );
        if (outward.length) candidates = outward;
      }
    } else if (pyramidHeights.has(element)) {
      candidates = [0, 10, -10, 20, -20, 30, 40, 50, 60, 70].flatMap((offset) =>
        [-1, 1].map((sign) => ({
          x: 200 + sign * (width / 2 + 2),
          y: original.y + 6 + offset,
        })),
      );
    } else if (segmentLabels.has(element)) {
      const [a, b] = segmentLabels.get(element)!;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
      candidates = [15, 25, 35, 50, 70, 90].flatMap((distance) =>
        [1, -1].map((sign) => ({
          x: (a.x + b.x) / 2 + sign * normal.x * distance,
          y: (a.y + b.y) / 2 + sign * normal.y * distance + 6,
        })),
      );
    } else if (angleLimits.has(element)) {
      const limit = angleLimits.get(element)!;
      const dx = original.x - limit.center.x,
        dy = original.y - limit.center.y;
      const length = Math.hypot(dx, dy);
      candidates = [0, -5, 5, -10, 10, 20, 30, 40, 55, 70, 90].map(
        (offset) => ({
          x: original.x + (dx / length) * offset,
          y: original.y + (dy / length) * offset,
        }),
      );
    } else {
      candidates = [{ x: original.x, y: original.y }];
      for (const distance of [12, 24, 36, 52, 70, 90])
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [-1, 0],
          [0, 1],
          [1, -1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ])
          candidates.push({
            x: original.x + dx * distance,
            y: original.y + dy * distance,
          });
      const limit = angleLimits.get(element);
      if (limit)
        candidates = candidates.filter(
          (candidate) =>
            Math.hypot(
              candidate.x - limit.center.x,
              candidate.y - limit.center.y,
            ) <= limit.radius,
        );
    }
    const score = (candidate: Point) => {
      const rect = box(candidate);
      const overlaps = boxes.filter(
        (other) =>
          rect.left < other.right + 2 &&
          rect.right + 2 > other.left &&
          rect.top < other.bottom + 2 &&
          rect.bottom + 2 > other.top,
      ).length;
      let crosses = strokes.filter(([a, b]) => intersects(a, b, rect)).length;
      if (pyramidHeights.has(element)) {
        const center = { x: candidate.x, y: candidate.y - 6 };
        const axisDistance = Math.abs(center.x - 200);
        crosses += strokes.filter(([a, b]) => {
          if (a.x === 200 && b.x === 200) return false;
          const dx = b.x - a.x,
            dy = b.y - a.y,
            length = dx * dx + dy * dy;
          if (!length) return false;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((center.x - a.x) * dx + (center.y - a.y) * dy) / length,
            ),
          );
          return (
            Math.hypot(center.x - a.x - t * dx, center.y - a.y - t * dy) <=
            axisDistance
          );
        }).length;
      }
      if (figure.kind === "geometry" && segmentLabels.has(element)) {
        const [ownA, ownB] = segmentLabels.get(element)!;
        const padded = {
          left: rect.left - 10,
          right: rect.right + 10,
          top: rect.top - 10,
          bottom: rect.bottom + 10,
        };
        crosses += strokes.filter(
          ([a, b]) =>
            !(
              a.x === ownA.x &&
              a.y === ownA.y &&
              b.x === ownB.x &&
              b.y === ownB.y
            ) && intersects(a, b, padded),
        ).length;
        for (const circle of elements.filter(
          (e) => e.tag === "circle" && e.attrs.fill === "none",
        )) {
          const x = Number(circle.attrs.cx),
            y = Number(circle.attrs.cy),
            r = Number(circle.attrs.r);
          const nearest = Math.hypot(
            Math.max(rect.left - x, 0, x - rect.right),
            Math.max(rect.top - y, 0, y - rect.bottom),
          );
          const farthest = Math.max(
            ...[rect.left, rect.right].flatMap((px) =>
              [rect.top, rect.bottom].map((py) => Math.hypot(px - x, py - y)),
            ),
          );
          if (nearest <= r && farthest >= r) crosses++;
        }
      }
      const distance = Math.hypot(
        candidate.x - original.x,
        candidate.y - original.y,
      );
      return overlaps * 100000 + crosses * 1000 + distance;
    };
    const chosen = candidates.reduce((best, candidate) =>
      score(candidate) < score(best) ? candidate : best,
    );
    element.attrs.x = chosen.x;
    element.attrs.y = chosen.y;
    boxes.push(box(chosen));
  }

  let left = 0,
    right = 400,
    top = 0;
  for (const e of textElements) {
    const x = Number(e.attrs.x),
      w = Array.from(e.text!).length * 20;
    left = Math.min(left, Math.floor(x - w / 2 - 4));
    right = Math.max(right, Math.ceil(x + w / 2 + 4));
    top = Math.min(top, Math.floor(Number(e.attrs.y) - 20));
    height = Math.max(height, Number(e.attrs.y) + 8);
  }
  for (const element of elements) {
    if (element.tag === "polyline") {
      for (const point of String(element.attrs.points).split(" ")) {
        const [x, y] = point.split(",").map(Number);
        left = Math.min(left, Math.floor(x - 2));
        right = Math.max(right, Math.ceil(x + 2));
        top = Math.min(top, Math.floor(y - 2));
        height = Math.max(height, Math.ceil(y + 2));
      }
    } else if (element.tag === "circle") {
      const cx = Number(element.attrs.cx),
        cy = Number(element.attrs.cy),
        r = Number(element.attrs.r);
      left = Math.min(left, Math.floor(cx - r - 2));
      right = Math.max(right, Math.ceil(cx + r + 2));
      top = Math.min(top, Math.floor(cy - r - 2));
      height = Math.max(height, Math.ceil(cy + r + 2));
    }
  }
  const fills = elements.filter(
    (e) => e.tag === "polyline" && e.attrs.fill !== "none",
  );
  const dots = elements.filter(
    (e) => e.tag === "circle" && e.attrs.fill === "#222",
  );
  const lines = elements.filter(
    (e) => !fills.includes(e) && !dots.includes(e) && e.tag !== "text",
  );
  elements.splice(
    0,
    elements.length,
    ...fills,
    ...lines,
    ...dots,
    ...textElements,
  );
  elements.unshift({
    tag: "rect",
    attrs: {
      x: left,
      y: top,
      width: right - left,
      height: height - top,
      fill: "white",
    },
  });
  return {
    viewBox: `${left} ${top} ${right - left} ${height - top}`,
    elements,
  };
}
