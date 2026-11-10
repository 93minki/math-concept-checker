from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
