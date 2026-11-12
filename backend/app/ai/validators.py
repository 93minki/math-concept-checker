import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.ai.figure_validation import geometry_errors, net_errors, solid_errors
from app.ai.hard import HARD_CONDITIONS
from app.ai.schemas import (
    BarChart,
    Boxplot,
    ConceptData,
    CoordinatePlane,
    Figure,
    Frequency,
    Geometry,
    InverseGraph,
    Net,
    NumberLine,
    PolylineGraph,
    QuadraticGraph,
    Question,
    Scatter,
    Solid,
)
from app.ai.terms import find_banned_terms

KATEX_SCRIPT = (
    Path(__file__).resolve().parents[3] / "frontend" / "scripts" / "katex-check.mjs"
)
FORMULA = re.compile(r"\$([^$]+)\$")
RUBRIC_LABEL = re.compile(r"^\s*(?:필수\s*[:：]|\(필수\)|\[필수\]|【필수】)")


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    message: str


class FormulaChecker(Protocol):
    def check(self, formulas: list[str]) -> list[ValidationIssue]: ...


class KatexChecker:
    def check(self, formulas: list[str]) -> list[ValidationIssue]:
        if not formulas:
            return []
        try:
            result = subprocess.run(
                ["node", str(KATEX_SCRIPT)],
                input=json.dumps(formulas),
                text=True,
                capture_output=True,
                check=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Node.js is required for KaTeX validation") from exc
        except subprocess.CalledProcessError as exc:
            raise RuntimeError("KaTeX validation failed") from exc
        errors = json.loads(result.stdout)
        return [
            ValidationIssue(
                "invalid_tex", f"Formula {error['index']}: {error['message']}"
            )
            for error in errors
        ]


def validate_figure(figure: Figure, standard_code: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def check(condition: bool, code: str) -> None:
        if not condition:
            issues.append(ValidationIssue("figure_" + code, "Invalid figure: " + code))

    def axis(low: float, high: float, step: float, limit: int | None = None) -> bool:
        return (
            low < high
            and step > 0
            and (limit is None or (high - low) / step <= limit - 1)
        )

    labels: list[str | None] = []
    if isinstance(figure, NumberLine):
        check(
            axis(figure.min, figure.max, figure.tick_step, 25)
            and figure.label_step > 0,
            "number_line_axis",
        )
        check(
            len(figure.points) <= 8 and len(figure.rays) + len(figure.segments) <= 3,
            "number_line_count",
        )
        check(
            all(figure.min <= p.x <= figure.max for p in figure.points)
            and all(figure.min <= r.from_ <= figure.max for r in figure.rays)
            and all(
                figure.min <= seg.from_ < seg.to <= figure.max
                for seg in figure.segments
            ),
            "number_line_bounds",
        )
        labels.extend(p.label for p in figure.points)
    elif isinstance(figure, CoordinatePlane):
        check(
            axis(figure.x_min, figure.x_max, figure.tick_step, 25)
            and axis(
                figure.y_min,
                figure.y_max,
                figure.y_tick_step
                if figure.y_tick_step is not None
                else figure.tick_step,
                25,
            )
            and figure.x_min <= 0 <= figure.x_max
            and figure.y_min <= 0 <= figure.y_max,
            "coordinate_axis",
        )
        check(len(figure.points) <= 8 and len(figure.graphs) <= 3, "coordinate_count")
        check(
            all(
                figure.x_min <= p.x <= figure.x_max
                and figure.y_min <= p.y <= figure.y_max
                for p in figure.points
            ),
            "coordinate_bounds",
        )
        check(
            all(not isinstance(g, QuadraticGraph) or g.a != 0 for g in figure.graphs),
            "quadratic_coefficient",
        )
        check(
            all(
                (not isinstance(g, InverseGraph) or g.k != 0)
                and (
                    not isinstance(g, PolylineGraph)
                    or (
                        2 <= len(g.points) <= 12
                        and all(
                            figure.x_min <= p.x <= figure.x_max
                            and figure.y_min <= p.y <= figure.y_max
                            for p in g.points
                        )
                    )
                )
                for g in figure.graphs
            ),
            "coordinate_graph",
        )
        labels.extend([figure.x_label, figure.y_label])
        labels.extend(p.label for p in figure.points)
        labels.extend(g.label for g in figure.graphs)
    elif isinstance(figure, BarChart):
        check(
            1 <= len(figure.categories) <= 12
            and len(figure.categories) == len(figure.values),
            "bar_count",
        )
        check(
            figure.y_max > (figure.y_min if figure.y_min is not None else 0)
            and figure.y_step > 0
            and all(
                (figure.y_min if figure.y_min is not None else 0) <= v <= figure.y_max
                for v in figure.values
            ),
            "bar_values",
        )
        labels.extend([*figure.categories, figure.x_label, figure.y_label])
    elif isinstance(figure, Frequency):
        check(
            1 <= len(figure.frequencies) <= 12
            and all(v >= 0 for v in figure.frequencies),
            "frequency_values",
        )
        check(
            figure.class_width > 0
            and figure.y_step > 0
            and (figure.show_bars or figure.show_polygon),
            "frequency_axes",
        )
        groups = [figure.frequencies] + (
            [figure.compare_frequencies]
            if figure.compare_frequencies is not None
            else []
        )
        check(
            all(
                all(
                    v >= 0 and (v <= 1 if figure.relative else v.is_integer())
                    for v in group
                )
                and (not figure.relative or abs(sum(group) - 1) <= 0.01)
                for group in groups
            ),
            "frequency_distribution",
        )
        check(
            figure.compare_frequencies is None
            or (
                len(figure.compare_frequencies) == len(figure.frequencies)
                and figure.show_polygon
                and figure.series_labels is not None
                and len(figure.series_labels) == 2
            ),
            "frequency_compare",
        )
        check(
            figure.series_labels is None
            or (
                figure.compare_frequencies is not None
                and len(figure.series_labels) == 2
            ),
            "frequency_labels",
        )
        labels.extend([figure.x_label, figure.y_label, *(figure.series_labels or [])])
    elif isinstance(figure, Boxplot):
        check(axis(figure.axis_min, figure.axis_max, figure.axis_step), "boxplot_axis")
        check(1 <= len(figure.series) <= 3, "boxplot_count")
        check(
            all(
                figure.axis_min
                <= s.min
                <= s.q1
                <= s.median
                <= s.q3
                <= s.max
                <= figure.axis_max
                for s in figure.series
            ),
            "boxplot_values",
        )
        labels.extend(s.label for s in figure.series)
    elif isinstance(figure, Scatter):
        check(
            axis(figure.x_min, figure.x_max, figure.x_step)
            and axis(figure.y_min, figure.y_max, figure.y_step),
            "scatter_axis",
        )
        check(len(figure.points) <= 40, "scatter_count")
        check(
            all(
                figure.x_min <= p.x <= figure.x_max
                and figure.y_min <= p.y <= figure.y_max
                for p in figure.points
            ),
            "scatter_bounds",
        )
        labels.extend([figure.x_label, figure.y_label])
    elif isinstance(figure, Geometry):
        for code in geometry_errors(figure):
            check(False, code)
        labels.extend(
            [
                *(s.label for s in figure.segments),
                *(line.label for line in figure.lines),
                *(arc.label for arc in figure.arcs),
                *(angle.label for angle in figure.angles),
            ]
        )
    elif isinstance(figure, Solid):
        for code in solid_errors(figure):
            check(False, code)
        labels.extend(
            [*(figure.vertex_names or []), *(label.text for label in figure.labels)]
        )
    elif isinstance(figure, Net):
        for code in net_errors(figure):
            check(False, code)
        labels.extend(label.text for label in figure.labels)
    for label in labels:
        if label is None:
            continue
        check(
            bool(label.strip())
            and len(label) <= 10
            and not any(c in label for c in "$<>"),
            "label",
        )
        for term in find_banned_terms(label, standard_code):
            issues.append(
                ValidationIssue("figure_banned_term", f"Term not yet learned: {term}")
            )
    return issues


def validate_question(
    question: Question, concepts: ConceptData, checker: FormulaChecker | None = None
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def add(code: str, message: str) -> None:
        issues.append(ValidationIssue(code, message))

    items = {item.id: item for item in concepts.assessment_items}
    item = items.get(question.assessment_item_id)
    if item is None:
        add("assessment_item", "Unknown assessment item")
    elif (item.concept_id, item.level, item.type) != (
        question.concept_id,
        question.level,
        question.type,
    ):
        add("assessment_item", "Assessment item, concept, level, or type mismatch")
    if question.concept_id not in {concept.id for concept in concepts.concepts}:
        add("concept", "Unknown concept")

    figures = [
        f
        for f in [question.figure, *(c.figure for c in question.choices)]
        if f is not None
    ]
    for figure in figures:
        issues.extend(validate_figure(figure, concepts.standard_code))
    if item is not None:
        choice_figures = [c.figure for c in question.choices]
        if item.figure == "none" and figures:
            add("figure_unexpected", "This assessment item does not allow figures")
        elif item.figure == "body" and (
            question.figure is None
            or question.figure.kind not in item.figure_kinds
            or any(choice_figures)
        ):
            add("figure_body", "Expected an allowed body figure only")
        elif item.figure == "choices" and (
            question.figure is not None
            or len(choice_figures) != 5
            or any(f is None for f in choice_figures)
            or len({f.kind for f in choice_figures if f is not None}) != 1
            or any(
                f is not None and f.kind not in item.figure_kinds
                for f in choice_figures
            )
        ):
            add("figure_choices", "Expected five choice figures of one allowed kind")
    for choice in question.choices:
        if not choice.text.strip() and choice.figure is None:
            add("figure_choice_text", "A choice needs text or a figure")

    misconceptions = {m.id: m for m in concepts.misconceptions}

    def valid_misconception(identifier: str) -> bool:
        m = misconceptions.get(identifier)
        return m is not None and question.concept_id in m.concept_ids

    if question.type == "multiple_choice":
        if len(question.choices) != 5:
            add("choice_count", "Multiple choice requires exactly five choices")
        if sorted(choice.no for choice in question.choices) != [1, 2, 3, 4, 5]:
            add("choice_numbers", "Choice numbers must be 1 through 5 once each")
        if sum(choice.is_correct for choice in question.choices) != 1:
            add("correct_count", "Exactly one choice must be correct")
        if not any(
            not choice.is_correct
            and choice.misconception_id is not None
            and valid_misconception(choice.misconception_id)
            for choice in question.choices
        ):
            add(
                "linked_distractor",
                "At least one wrong choice needs an approved misconception",
            )
        for choice in question.choices:
            if choice.misconception_id and not valid_misconception(
                choice.misconception_id
            ):
                add(
                    "misconception", f"Invalid misconception: {choice.misconception_id}"
                )
    else:
        if not question.rubric:
            add("rubric", "Written question requires rubric elements")
        if not any(element.required for element in question.rubric):
            add("required_rubric", "At least one rubric element must be required")
        if any(element.points <= 0 for element in question.rubric):
            add("rubric_points", "Rubric points must be positive")
        if not question.model_answer or not question.model_answer.strip():
            add("model_answer", "Written question requires model answer")
        for element in question.rubric:
            if RUBRIC_LABEL.match(element.description):
                add("rubric_label", "Rubric description starts with a required label")
            for identifier in element.related_misconception_ids:
                if not valid_misconception(identifier):
                    add("misconception", f"Invalid misconception: {identifier}")

    texts = [
        question.body,
        question.explanation,
        *(choice.text for choice in question.choices),
    ]
    for notation in concepts.terms.forbidden_notation:
        if any(notation in value for value in texts):
            add("forbidden_notation", f"Forbidden notation: {notation}")
    banned = {
        term
        for value in texts
        for term in find_banned_terms(value, concepts.standard_code)
    }
    for term in sorted(banned):
        add("not_yet_learned", f"Term not yet learned: {term}")
    formulas = [match for value in texts for match in FORMULA.findall(value)]
    issues.extend((checker or KatexChecker()).check(formulas))

    if question.difficulty == "hard":
        allowed = {
            condition.code for condition in HARD_CONDITIONS.get(question.level, ())
        }
        if (
            question.hard_condition not in allowed
            or not question.hard_condition_reason
            or not question.hard_condition_reason.strip()
        ):
            add("hard_condition", "Invalid or missing hard condition declaration")
    elif question.difficulty == "normal":
        if (
            question.hard_condition is not None
            or question.hard_condition_reason is not None
        ):
            add("hard_condition", "Normal question must not declare hard condition")

    return issues
