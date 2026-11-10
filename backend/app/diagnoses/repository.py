from datetime import datetime
from functools import lru_cache
from typing import Annotated, Protocol, TypeVar
from uuid import UUID

from fastapi import Depends
from postgrest.exceptions import APIError
from pydantic import TypeAdapter
from supabase import Client

from app.diagnoses.schemas import (
    Answer,
    AnswerInput,
    AnswerRow,
    Assessment,
    Choice,
    Concept,
    Diagnosis,
    Item,
    Question,
    StandardLink,
    StartResult,
    Unit,
)
from app.profiles import _supabase_client
from app.settings import Settings, get_settings

T = TypeVar("T")


class AnswerConflict(Exception):
    pass


class DiagnosesRepository(Protocol):
    def expire(self, user_id: UUID) -> None: ...
    def units(self) -> list[Unit]: ...
    def standards(self) -> list[StandardLink]: ...
    def concepts(self) -> list[Concept]: ...
    def assessments(self) -> list[Assessment]: ...
    def questions(self) -> list[Question]: ...
    def history(self, user_id: UUID) -> dict[UUID, datetime]: ...
    def in_progress(self, user_id: UUID) -> list[Diagnosis]: ...
    def start(
        self, user_id: UUID, unit_id: int, restart: bool, ids: list[UUID]
    ) -> StartResult: ...
    def diagnosis(self, user_id: UUID, diagnosis_id: UUID) -> Diagnosis | None: ...
    def items(self, user_id: UUID, diagnosis_id: UUID) -> list[Item]: ...
    def choices(self, question_id: UUID) -> list[Choice]: ...
    def answers(self, user_id: UUID, item_ids: list[int]) -> list[AnswerRow]: ...
    def save_answer(
        self, user_id: UUID, item_id: int, answer: AnswerInput
    ) -> Answer: ...
    def submit(self, user_id: UUID, diagnosis_id: UUID) -> str: ...


class SupabaseDiagnoses:
    def __init__(self, client: Client) -> None:
        self.client = client

    def _pages(
        self,
        table: str,
        columns: str,
        adapter: TypeAdapter[list[T]],
        user_id: UUID | None = None,
    ) -> list[T]:
        result: list[T] = []
        offset = 0
        while True:
            query = self.client.table(table).select(columns)
            if user_id is not None:
                query = query.eq("user_id", str(user_id))
            rows = adapter.validate_python(
                query.order("id").range(offset, offset + 499).execute().data
            )
            result.extend(rows)
            if len(rows) < 500:
                return result
            offset += len(rows)

    def expire(self, user_id: UUID) -> None:
        self.client.rpc("diagnosis_expire", {"p_user_id": str(user_id)}).execute()

    def units(self) -> list[Unit]:
        return TypeAdapter(list[Unit]).validate_python(
            self.client.table("display_units")
            .select("id,grade,number,name,publisher,aliases")
            .execute()
            .data
        )

    def standards(self) -> list[StandardLink]:
        return TypeAdapter(list[StandardLink]).validate_python(
            self.client.table("display_unit_standards")
            .select("display_unit_id,standard_code")
            .execute()
            .data
        )

    def concepts(self) -> list[Concept]:
        return self._pages("concepts", "id,standard_code", TypeAdapter(list[Concept]))

    def assessments(self) -> list[Assessment]:
        return self._pages(
            "assessment_items",
            "id,concept_id,level,question_type",
            TypeAdapter(list[Assessment]),
        )

    def questions(self) -> list[Question]:
        return self._pages(
            "questions",
            "id,assessment_item_id,variant,question_type,body,difficulty,status",
            TypeAdapter(list[Question]),
        )

    def history(self, user_id: UUID) -> dict[UUID, datetime]:
        items = self._pages(
            "diagnosis_items",
            "id,diagnosis_id,user_id,stage,position,question_id,assessment_item_id",
            TypeAdapter(list[Item]),
            user_id,
        )
        diagnoses = self._pages(
            "diagnoses",
            "id,user_id,display_unit_id,status,abort_reason,started_at,stage1_submitted_at",
            TypeAdapter(list[Diagnosis]),
            user_id,
        )
        times = {d.id: d.started_at for d in diagnoses}
        result: dict[UUID, datetime] = {}
        for item in items:
            time = times[item.diagnosis_id]
            if item.question_id not in result or time > result[item.question_id]:
                result[item.question_id] = time
        return result

    def in_progress(self, user_id: UUID) -> list[Diagnosis]:
        return TypeAdapter(list[Diagnosis]).validate_python(
            self.client.table("diagnoses")
            .select(
                "id,user_id,display_unit_id,status,abort_reason,started_at,stage1_submitted_at"
            )
            .eq("user_id", str(user_id))
            .in_("status", ["stage1", "stage2"])
            .execute()
            .data
        )

    def start(
        self, user_id: UUID, unit_id: int, restart: bool, ids: list[UUID]
    ) -> StartResult:
        response = self.client.rpc(
            "diagnosis_start",
            {
                "p_user_id": str(user_id),
                "p_display_unit_id": unit_id,
                "p_restart": restart,
                "p_question_ids": [str(i) for i in ids],
            },
        ).execute()
        return StartResult.model_validate(response.data)

    def diagnosis(self, user_id: UUID, diagnosis_id: UUID) -> Diagnosis | None:
        rows = TypeAdapter(list[Diagnosis]).validate_python(
            self.client.table("diagnoses")
            .select(
                "id,user_id,display_unit_id,status,abort_reason,started_at,stage1_submitted_at"
            )
            .eq("id", str(diagnosis_id))
            .eq("user_id", str(user_id))
            .execute()
            .data
        )
        return rows[0] if rows else None

    def items(self, user_id: UUID, diagnosis_id: UUID) -> list[Item]:
        return TypeAdapter(list[Item]).validate_python(
            self.client.table("diagnosis_items")
            .select(
                "id,diagnosis_id,user_id,stage,position,question_id,assessment_item_id"
            )
            .eq("diagnosis_id", str(diagnosis_id))
            .eq("user_id", str(user_id))
            .execute()
            .data
        )

    def choices(self, question_id: UUID) -> list[Choice]:
        return TypeAdapter(list[Choice]).validate_python(
            self.client.table("question_choices")
            .select("no,text")
            .eq("question_id", str(question_id))
            .order("no")
            .execute()
            .data
        )

    def answers(self, user_id: UUID, item_ids: list[int]) -> list[AnswerRow]:
        if not item_ids:
            return []
        return TypeAdapter(list[AnswerRow]).validate_python(
            self.client.table("answers")
            .select("diagnosis_item_id,selected_choice,written_text,updated_at")
            .eq("user_id", str(user_id))
            .in_("diagnosis_item_id", item_ids)
            .execute()
            .data
        )

    def save_answer(self, user_id: UUID, item_id: int, answer: AnswerInput) -> Answer:
        try:
            response = (
                self.client.table("answers")
                .upsert(
                    {
                        "diagnosis_item_id": item_id,
                        "user_id": str(user_id),
                        **answer.model_dump(),
                    },
                    on_conflict="diagnosis_item_id",
                )
                .execute()
            )
        except APIError as exc:
            # Trigger exceptions are raised for concurrent state changes.
            if exc.code == "P0001":
                raise AnswerConflict from exc
            raise
        return Answer.model_validate(response.data[0])

    def submit(self, user_id: UUID, diagnosis_id: UUID) -> str:
        response = self.client.rpc(
            "diagnosis_submit_stage1",
            {"p_user_id": str(user_id), "p_diagnosis_id": str(diagnosis_id)},
        ).execute()
        return TypeAdapter(str).validate_python(response.data)


@lru_cache
def _repository(url: str, secret: str) -> SupabaseDiagnoses:
    return SupabaseDiagnoses(_supabase_client(url, secret))


def get_diagnoses(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DiagnosesRepository:
    return _repository(
        str(settings.supabase_url).rstrip("/"),
        settings.supabase_secret_key.get_secret_value(),
    )
