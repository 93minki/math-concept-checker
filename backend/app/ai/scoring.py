from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from app.ai.schemas import Choice, Grading, RubricElement


@dataclass(frozen=True)
class Score:
    value: float
    passed: bool


def score_choice(choices: Sequence[Choice], selected_no: int) -> Score:
    selected = next((choice for choice in choices if choice.no == selected_no), None)
    if selected is None:
        raise ValueError("Unknown choice number")
    correct = selected.is_correct
    return Score(float(correct), correct)


def score_written(rubric: list[RubricElement], grading: Grading) -> Score:
    expected = {element.no for element in rubric}
    actual = [result.no for result in grading.element_results]
    if (
        not rubric
        or len(expected) != len(rubric)
        or set(actual) != expected
        or len(actual) != len(expected)
    ):
        raise ValueError("Grading elements do not match rubric")
    points = {element.no: Decimal(str(element.points)) for element in rubric}
    total = sum(points.values())
    if total <= 0 or any(point <= 0 for point in points.values()):
        raise ValueError("Rubric points must be positive")
    met = {result.no for result in grading.element_results if result.met}
    met_points = sum(points[no] for no in met)
    return Score(float(met_points / total), met_points * 3 >= total * 2)
