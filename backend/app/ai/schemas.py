import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt

FigureKind = Literal[
    "number_line", "coordinate_plane", "bar_chart", "frequency", "boxplot", "scatter"
]


class FigureBase(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class NumberPoint(FigureBase):
    x: float
    label: str | None
    filled: bool | None


class Ray(FigureBase):
    from_: float = Field(alias="from")
    direction: Literal["left", "right"]
    closed: bool


class Segment(FigureBase):
    from_: float = Field(alias="from")
    to: float
    from_closed: bool
    to_closed: bool


class NumberLine(FigureBase):
    kind: Literal["number_line"]
    min: float
    max: float
    tick_step: float
    label_step: float
    points: list[NumberPoint]
    rays: list[Ray]
    segments: list[Segment]


class CoordinatePoint(FigureBase):
    x: float
    y: float
    label: str | None


class LinearGraph(FigureBase):
    type: Literal["linear"]
    m: float
    b: float
    label: str | None


class VerticalGraph(FigureBase):
    type: Literal["vertical"]
    c: float
    label: str | None


class QuadraticGraph(FigureBase):
    type: Literal["quadratic"]
    a: float
    p: float
    q: float
    label: str | None


class CoordinatePlane(FigureBase):
    kind: Literal["coordinate_plane"]
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    tick_step: float
    show_tick_labels: bool
    points: list[CoordinatePoint]
    graphs: list[LinearGraph | VerticalGraph | QuadraticGraph]


class BarChart(FigureBase):
    kind: Literal["bar_chart"]
    categories: list[str]
    values: list[float]
    y_max: float
    y_step: float
    x_label: str | None
    y_label: str | None


class Frequency(FigureBase):
    kind: Literal["frequency"]
    class_start: float
    class_width: float
    frequencies: list[StrictInt]
    show_bars: bool
    show_polygon: bool
    y_step: float
    x_label: str | None
    y_label: str | None


class BoxSeries(FigureBase):
    label: str
    min: float
    q1: float
    median: float
    q3: float
    max: float


class Boxplot(FigureBase):
    kind: Literal["boxplot"]
    axis_min: float
    axis_max: float
    axis_step: float
    series: list[BoxSeries]


class ScatterPoint(FigureBase):
    x: float
    y: float


class Scatter(FigureBase):
    kind: Literal["scatter"]
    x_min: float
    x_max: float
    x_step: float
    y_min: float
    y_max: float
    y_step: float
    x_label: str | None
    y_label: str | None
    points: list[ScatterPoint]


Figure = NumberLine | CoordinatePlane | BarChart | Frequency | Boxplot | Scatter


class Concept(BaseModel):
    id: str
    name: str


class AssessmentItem(BaseModel):
    id: str
    concept_id: str
    level: str
    type: Literal["multiple_choice", "written"]
    basis: str
    figure: Literal["none", "body", "choices"] = "none"
    figure_kinds: list[FigureKind] = Field(default_factory=list)


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
    figure: Figure | None = None


class DraftChoice(Choice):
    figure: Figure | None = Field()


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
    figure: Figure | None = None
    choices: list[Choice]
    model_answer: str | None
    rubric: list[RubricElement]
    hard_condition: str | None = None
    hard_condition_reason: str | None = None


class QuestionDraft(BaseModel):
    body: str
    explanation: str
    figure: Figure | None
    choices: list[DraftChoice]
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
