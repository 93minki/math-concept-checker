import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.ai.hard import HARD_CONDITIONS
from app.ai.schemas import ConceptData, Question

KATEX_SCRIPT = (
    Path(__file__).resolve().parents[3] / "frontend" / "scripts" / "katex-check.mjs"
)
FORMULA = re.compile(r"\$([^$]+)\$")


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
    for term in concepts.terms.not_yet_learned:
        if any(term in value for value in texts):
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
