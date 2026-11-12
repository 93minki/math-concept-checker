from collections.abc import Sequence
from dataclasses import dataclass

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
    total = sum(element.points for element in rubric)
    if total <= 0 or any(element.points <= 0 for element in rubric):
        raise ValueError("Rubric points must be positive")
    met = {result.no for result in grading.element_results if result.met}
    return Score(
        sum(element.points for element in rubric if element.no in met) / total,
        all(element.no in met for element in rubric if element.required),
    )
