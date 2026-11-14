from dataclasses import asdict
from decimal import Decimal, InvalidOperation
from typing import Protocol, cast

from app.ai.compare import FakeProvider, load_fixture
from app.ai.providers.base import StructuredProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.schemas import Question, load_concept
from app.ai.tasks import revise_question, validate_revision
from app.bank.operations import question_payload, restore_question
from app.diagnoses.ai import SafeLoggingHooks
from app.settings import get_settings

Row = dict[str, object]


class RevisionEngine(Protocol):
    def generate(self, details: Row) -> Row: ...
    def check_manual(self, details: Row, payload: Row) -> Row: ...


class CostHooks(SafeLoggingHooks):
    def __init__(self) -> None:
        self.total = Decimal(0)

    def record(self, entry: dict[str, object]) -> None:
        super().record(entry)
        try:
            self.total += Decimal(str(entry.get("cost_usd", "0")))
        except InvalidOperation as exc:
            raise ValueError("Invalid AI cost") from exc


def _original(details: Row) -> tuple[Row, Question]:
    row = cast(Row, details["question"])
    standard = str(row["assessment_item_id"]).split("-C", 1)[0]
    concept = load_concept(standard)
    return row, restore_question(
        row,
        cast(list[Row], details["choices"]),
        cast(list[Row], details["rubric"]),
        cast(list[Row], details["rubric_links"]),
        concept,
    )


def _candidate(payload: Row, original: Question, variant: int) -> Question:
    if (
        payload.get("assessment_item_id") != original.assessment_item_id
        or payload.get("difficulty") != original.difficulty
        or payload.get("question_type") != original.type
        or payload.get("variant") != variant
    ):
        raise ValueError("수정안은 기존 문제 자리와 유형이 같아야 합니다")
    prefix = original.concept_id.split("-C", 1)[0] + "-"

    def local(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str) or not value.startswith(prefix):
            raise ValueError("오개념 성취기준 불일치")
        return value.removeprefix(prefix)

    choices = cast(list[Row], payload["choices"])
    rubric = cast(list[Row], payload["rubric"])
    return Question.model_validate(
        {
            **payload,
            "concept_id": original.concept_id,
            "level": original.level,
            "type": original.type,
            "choices": [
                {**choice, "misconception_id": local(choice.get("misconception_id"))}
                for choice in choices
            ],
            "rubric": [
                {
                    **element,
                    "related_misconception_ids": [
                        local(mid)
                        for mid in cast(
                            list[object], element.get("related_misconception_ids", [])
                        )
                    ],
                }
                for element in rubric
            ],
        }
    )


class DefaultRevisionEngine:
    def _provider(self) -> StructuredProvider:
        settings = get_settings()
        if settings.ai_mode == "fake":
            return FakeProvider("gpt-6.1-terra", load_fixture())
        return OpenAIProvider(settings=settings)

    def generate(self, details: Row) -> Row:
        row, original = _original(details)
        concept = load_concept(original.concept_id.split("-C", 1)[0])
        reports = [
            {"kind": str(r["kind"]), "description": str(r["description"])}
            for r in cast(list[Row], details["reports"])
            if r["status"] in ("received", "in_review")
        ]
        if not reports:
            raise ValueError("열린 신고가 없습니다")
        hooks = CostHooks()
        provider = self._provider()
        result = revise_question(provider, concept, original, reports, hooks=hooks)
        attempts = [cast(Row, asdict(item)) for item in result.attempts]
        payload = question_payload(
            result.question or original,
            int(str(row["variant"])),
            str(getattr(provider, "model", "unknown")),
            attempts,
        )
        payload["prompt_version"] = "v10"
        return {
            "payload": payload,
            "checks": attempts,
            "status": "passed" if result.question else "failed",
            "ai_cost": str(hooks.total),
        }

    def check_manual(self, details: Row, payload: Row) -> Row:
        row, original = _original(details)
        candidate = _candidate(payload, original, int(str(row["variant"])))
        concept = load_concept(original.concept_id.split("-C", 1)[0])
        hooks = CostHooks()
        provider = self._provider()
        errors = validate_revision(provider, concept, original, candidate, hooks=hooks)
        checks: list[Row] = [{"number": 1, "issues": errors}]
        normalized = question_payload(
            candidate,
            int(str(row["variant"])),
            str(getattr(provider, "model", "unknown")),
            checks,
        )
        return {
            "payload": normalized,
            "checks": checks,
            "status": "failed" if errors else "passed",
            "ai_cost": str(hooks.total),
        }


def get_revision_engine() -> RevisionEngine:
    return DefaultRevisionEngine()
