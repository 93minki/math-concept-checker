import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class Concept(BaseModel):
    id: str
    name: str


class AssessmentItem(BaseModel):
    id: str
    concept_id: str
    level: str
    type: Literal["multiple_choice", "written"]
    basis: str


class Misconception(BaseModel):
    id: str
    concept_ids: list[str]
    text: str


class Terms(BaseModel):
    formal: list[str]
    teaching_only: list[str]
    forbidden_notation: list[str]


class DisplayUnit(BaseModel):
    grade: str
    number: int
    name: str
    publisher: str


class ConceptData(BaseModel):
    standard_code: str
    variants: int = Field(default=2, ge=1, le=3)
    standard_text: str
    area: str
    topic: str
    display_unit: DisplayUnit
    scope_note: str
    concepts: list[Concept]
    assessment_items: list[AssessmentItem]
    misconceptions: list[Misconception]
    terms: Terms


def load_concept(code: str) -> ConceptData:
    if not re.fullmatch(r"9수\d{2}-\d{2}", code):
        raise ValueError("Invalid standard code")
    path = Path(__file__).resolve().parents[2] / "data" / "concepts" / f"{code}.json"
    return ConceptData.model_validate_json(path.read_text(encoding="utf-8"))


class Choice(BaseModel):
    no: int
    text: str
    is_correct: bool
    misconception_id: str | None


class RubricElement(BaseModel):
    no: int
    description: str
    points: float
    required: bool
    related_misconception_ids: list[str]


class Question(BaseModel):
    assessment_item_id: str
    concept_id: str
    level: str
    type: Literal["multiple_choice", "written"]
    difficulty: Literal["normal", "hard"]
    body: str
    explanation: str
    choices: list[Choice]
    model_answer: str | None
    rubric: list[RubricElement]
    hard_condition: str | None = None
    hard_condition_reason: str | None = None


class QuestionDraft(BaseModel):
    body: str
    explanation: str
    choices: list[Choice]
    model_answer: str | None
    rubric: list[RubricElement]
    hard_condition: str | None
    hard_condition_reason: str | None


class Review(BaseModel):
    single_correct_answer: bool
    conditions_sufficient: bool
    measures_intended_level: bool
    meets_hard_condition: bool
    issues: list[str]


class ElementResult(BaseModel):
    no: int
    met: bool
    reason: str


class MisconceptionCheck(BaseModel):
    id: str
    present: bool
    evidence: str


class GradingDraft(BaseModel):
    element_results: list[ElementResult]
    misconception_checks: list[MisconceptionCheck]


class Grading(BaseModel):
    element_results: list[ElementResult]
    detected_misconception_ids: list[str]


class ConceptResult(BaseModel):
    concept_id: str
    name: str | None = None
    score: float | None
    stage: str
    deep_not_attempted: bool = False
    misconception_ids: list[str] = Field(default_factory=list)


class ReportInput(BaseModel):
    unit_score: float | None
    unit_stage: str | None = None
    concepts: list[ConceptResult]
    misconception_ids: list[str] = Field(default_factory=list)


class ReportText(BaseModel):
    not_understood: str
    misconception_explanations: str
    next_steps: str
