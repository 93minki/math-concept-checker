"""Numerical checks for geometry and fixed-shape figures."""

import math
import re
from collections import defaultdict

from app.ai.schemas import Geometry, Net, Solid


def geometry_errors(figure: Geometry) -> list[str]:
    errors: list[str] = []

    def check(ok: bool, code: str) -> None:
        if not ok:
            errors.append(code)

    points = {p.id: (p.x, p.y) for p in figure.points}
    check(
        len(points) == len(figure.points)
        and all(
            1 <= len(p.id) <= 3 and -100 <= p.x <= 100 and -100 <= p.y <= 100
            for p in figure.points
        ),
        "geometry_points",
    )
    check(
        len(points) <= 14
        and len(figure.segments) <= 20
        and len(figure.lines) <= 6
        and len(figure.polygons) <= 4
        and len(figure.circles) <= 3
        and len(figure.arcs) <= 6
        and len(figure.angles) <= 8,
        "geometry_count",
    )
    refs = (
        [r for s in figure.segments for r in (s.from_, s.to)]
        + [r for line in figure.lines for r in (line.from_, line.through)]
        + [r for poly in figure.polygons for r in poly.vertices]
        + [r for circle in figure.circles for r in (circle.center, *circle.points_on)]
        + [r for arc in figure.arcs for r in (arc.center, arc.from_, arc.to)]
        + [r for angle in figure.angles for r in (angle.vertex, angle.from_, angle.to)]
    )
    check(all(r in points for r in refs), "geometry_reference")
    if any(r not in points for r in refs):
        return errors

    def vector(a: str, b: str) -> tuple[float, float]:
        return points[b][0] - points[a][0], points[b][1] - points[a][1]

    def length(a: str, b: str) -> float:
        return math.hypot(*vector(a, b))

    def direction(a: str, b: str) -> float:
        v = vector(a, b)
        return math.degrees(math.atan2(v[1], v[0])) % 180

    def same(values: list[float], tolerance: float) -> bool:
        return not values or max(values) - min(values) <= max(values) * tolerance

    ticks: dict[int, list[float]] = defaultdict(list)
    parallels: dict[int, list[float]] = defaultdict(list)
    angle_groups: dict[int, list[float]] = defaultdict(list)
    ratios: list[float] = []
    for segment in figure.segments:
        d = length(segment.from_, segment.to)
        check(
            d > 0 and 0 <= segment.ticks <= 3 and 0 <= segment.parallel_marks <= 3,
            "geometry_segment",
        )
        if segment.ticks:
            ticks[segment.ticks].append(d)
        if segment.parallel_marks:
            parallels[segment.parallel_marks].append(
                direction(segment.from_, segment.to)
            )
        match = re.fullmatch(
            r"\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|km)?\s*", segment.label or ""
        )
        if match and d:
            ratios.append(float(match.group(1)) / d)
    for line in figure.lines:
        check(
            length(line.from_, line.through) > 0 and 0 <= line.parallel_marks <= 3,
            "geometry_line",
        )
        if line.parallel_marks:
            parallels[line.parallel_marks].append(direction(line.from_, line.through))
    check(all(same(v, 0.01) for v in ticks.values()), "geometry_ticks")
    check(
        all(
            all(
                min(abs(a - b), 180 - abs(a - b)) <= 0.5 for a in values for b in values
            )
            for values in parallels.values()
        ),
        "geometry_parallel",
    )
    check(same(ratios, 0.05), "geometry_lengths")
    for poly in figure.polygons:
        check(
            len(poly.vertices) >= 3 and len(set(poly.vertices)) == len(poly.vertices),
            "geometry_polygon",
        )
    for circle in figure.circles:
        check(
            circle.radius > 0
            and all(
                abs(length(circle.center, p) - circle.radius) <= circle.radius * 0.01
                for p in circle.points_on
            ),
            "geometry_circle",
        )
    for arc in figure.arcs:
        a = length(arc.center, arc.from_)
        b = length(arc.center, arc.to)
        check(a > 0 and abs(a - b) <= a * 0.01, "geometry_arc")
    for angle in figure.angles:
        va, vb = vector(angle.vertex, angle.from_), vector(angle.vertex, angle.to)
        la, lb = math.hypot(*va), math.hypot(*vb)
        check(la > 0 and lb > 0 and 0 <= angle.marks <= 3, "geometry_angle")
        if not la or not lb:
            continue
        value = math.degrees(
            math.acos(max(-1, min(1, (va[0] * vb[0] + va[1] * vb[1]) / (la * lb))))
        )
        check(not angle.right or abs(value - 90) <= 0.5, "geometry_right")
        match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)°\s*", angle.label or "")
        check(
            not match or abs(value - float(match.group(1))) <= 3, "geometry_angle_label"
        )
        if angle.marks:
            angle_groups[angle.marks].append(value)
    check(
        all(max(v) - min(v) <= 1 for v in angle_groups.values()), "geometry_angle_marks"
    )
    return errors


def solid_errors(figure: Solid) -> list[str]:
    required = {
        "cuboid": ("width", "depth", "height"),
        "prism": ("radius", "height"),
        "pyramid": ("radius", "height"),
        "frustum": ("radius", "top_radius", "height"),
        "cylinder": ("radius", "height"),
        "cone": ("radius", "height"),
        "cone_frustum": ("radius", "top_radius", "height"),
        "sphere": ("radius",),
        "hemisphere": ("radius",),
    }[figure.shape]
    dimensions = ("width", "depth", "height", "radius", "top_radius")
    values = [getattr(figure, field) for field in required]
    errors = []
    if any(
        getattr(figure, field) is None or getattr(figure, field) <= 0
        for field in required
    ) or any(
        getattr(figure, field) is not None
        for field in dimensions
        if field not in required
    ):
        errors.append("solid_dimensions")
    if all(v is not None and v > 0 for v in values) and max(values) > 5 * min(values):
        errors.append("solid_ratio")
    polygonal = figure.shape in ("prism", "pyramid", "frustum")
    if (
        polygonal and (figure.base_sides is None or not 3 <= figure.base_sides <= 8)
    ) or (not polygonal and figure.base_sides is not None):
        errors.append("solid_sides")
    count = {
        "cuboid": 8,
        "prism": 2 * (figure.base_sides or 0),
        "pyramid": (figure.base_sides or 0) + 1,
        "frustum": 2 * (figure.base_sides or 0),
    }.get(figure.shape, 0)
    if figure.vertex_names is not None and (
        len(figure.vertex_names) != count or count == 0
    ):
        errors.append("solid_vertices")
    return errors


def net_errors(figure: Net) -> list[str]:
    if (
        figure.radius <= 0
        or (
            figure.shape == "cylinder"
            and (
                figure.height is None or figure.height <= 0 or figure.slant is not None
            )
        )
        or (
            figure.shape == "cone"
            and (
                figure.slant is None
                or figure.slant <= figure.radius
                or figure.height is not None
            )
        )
    ):
        return ["net_dimensions"]
    return []
