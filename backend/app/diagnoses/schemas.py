from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

UnitStatus = Literal["full", "partial", "unavailable"]
QuestionType = Literal["multiple_choice", "written"]


class Unit(BaseModel):
    id: int
    grade: str
    number: int
    name: str
    publisher: str
    aliases: list[str]


class StandardLink(BaseModel):
    display_unit_id: int
    standard_code: str


class Concept(BaseModel):
    id: str
    standard_code: str
    name: str = ""


class Assessment(BaseModel):
    id: str
    concept_id: str
    level: str
    question_type: QuestionType


class Question(BaseModel):
    id: UUID
    assessment_item_id: str
    variant: int
    question_type: QuestionType
    body: str
    explanation: str = ""
    model_answer: str | None = None
    hard_condition: str | None = None
    hard_condition_reason: str | None = None
    difficulty: str
    status: str


class Diagnosis(BaseModel):
    id: UUID
    user_id: UUID
    display_unit_id: int
    status: Literal["stage1", "stage2", "completed", "aborted"]
    abort_reason: Literal["expired", "restarted"] | None
    started_at: datetime
    stage1_submitted_at: datetime | None
    stage2_submitted_at: datetime | None = None


class HistoryCursor(BaseModel):
    started_at: AwareDatetime
    id: UUID


class HistoryUnit(BaseModel):
    grade: str
    name: str
    publisher: str


class HistoryItem(BaseModel):
    id: UUID
    status: Literal["stage1", "stage2", "completed", "aborted"]
    abort_reason: Literal["expired", "restarted"] | None
    started_at: AwareDatetime
    completed_at: datetime | None
    aborted_at: datetime | None
    unit: HistoryUnit


class Item(BaseModel):
    id: int
    diagnosis_id: UUID
    user_id: UUID
    stage: int
    position: int
    question_id: UUID
    assessment_item_id: str


class Choice(BaseModel):
    no: int
    text: str


class Answer(BaseModel):
    selected_choice: int | None
    written_text: str | None
    updated_at: datetime


class AnswerRow(Answer):
    diagnosis_item_id: int


class AnswerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    selected_choice: int | None = Field(default=None, ge=1, le=5, strict=True)
    written_text: str | None = Field(default=None, max_length=1000, strict=True)

    @model_validator(mode="after")
    def exactly_one(self) -> "AnswerInput":
        if len(self.model_fields_set) != 1 or (
            (self.selected_choice is None) == (self.written_text is None)
        ):
            raise ValueError("Exactly one answer is required")
        return self


class StartInput(BaseModel):
    display_unit_id: int
    restart: bool = False


class StartResult(BaseModel):
    result: Literal["created", "in_progress", "unit_not_found"]
    diagnosis_id: UUID | None = None


class QuestionChoice(Choice):
    is_correct: bool
    misconception_id: str | None


class RubricRow(BaseModel):
    id: int
    no: int
    description: str
    points: float
    required: bool
    related_misconception_ids: list[str] = []


class MisconceptionRow(BaseModel):
    id: str
    standard_code: str
    local_id: str
    content: str
    concept_ids: list[str] = []


class GradingRow(BaseModel):
    diagnosis_item_id: int
    score: float
    passed: bool
    selected_misconception_id: str | None = None
    element_results: list[dict[str, object]] | None = None
    detected_misconception_ids: list[str] = []
    ai_model: str | None = None
    prompt_version: str | None = None


class ReportRow(BaseModel):
    unit_score: float | None
    unit_stage: str | None
    concepts: list[dict[str, object]]
    misconception_ids: list[str]
    text: dict[str, str]
    ai_model: str
    prompt_version: str
