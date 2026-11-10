import logging
from dataclasses import dataclass
from typing import Annotated, Protocol

from fastapi import Depends

from app.ai.prompts import PROMPT_VERSION
from app.ai.providers.openai import OpenAIProvider
from app.ai.schemas import (
    ConceptData,
    ElementResult,
    Grading,
    Misconception,
    Question,
    ReportInput,
    ReportText,
    RubricElement,
)
from app.ai.tasks import CallHooks, grade_written, write_report
from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIGrade:
    grading: Grading
    model: str
    prompt_version: str


@dataclass(frozen=True)
class AIReport:
    text: ReportText
    model: str
    prompt_version: str


class DiagnosisAI(Protocol):
    def grade(
        self,
        question: Question,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade: ...
    def report(self, data: ReportInput, context: ConceptData) -> AIReport: ...


class SafeLoggingHooks(CallHooks):
    def before_call(self) -> None:
        pass

    def record(self, entry: dict[str, object]) -> None:
        logger.info(
            "AI call model=%s input_tokens=%s output_tokens=%s "
            "latency_ms=%s cost_usd=%s success=%s",
            entry.get("model"),
            entry.get("input_tokens"),
            entry.get("output_tokens"),
            entry.get("latency_ms"),
            entry.get("cost_usd"),
            entry.get("parsed_success"),
        )


class RealAI:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.hooks = SafeLoggingHooks()

    def grade(
        self,
        question: Question,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade:
        provider = OpenAIProvider(settings=self.settings)
        result = grade_written(
            provider,
            question,
            rubric,
            answer,
            misconceptions=misconceptions,
            hooks=self.hooks,
        )
        return AIGrade(result.grading, provider.model, PROMPT_VERSION)

    def report(self, data: ReportInput, context: ConceptData) -> AIReport:
        provider = OpenAIProvider(settings=self.settings)
        for attempt in (1, 2):
            result = write_report(
                provider, data, hooks=self.hooks, concept_data=context, attempt=attempt
            )
            if not result.issues:
                return AIReport(result.text, provider.model, PROMPT_VERSION)
        raise ValueError("Report validation failed")


class FakeAI:
    def grade(
        self,
        question: Question,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade:
        return AIGrade(
            Grading(
                element_results=[
                    ElementResult(no=r.no, met=True, reason="요소를 확인했어요")
                    for r in rubric
                ],
                detected_misconception_ids=[],
            ),
            "fake",
            PROMPT_VERSION,
        )

    def report(self, data: ReportInput, context: ConceptData) -> AIReport:
        return AIReport(
            ReportText(
                not_understood="개념을 다시 살펴봐요.",
                misconception_explanations="헷갈린 부분이 있을 수 있어요.",
                next_steps="비슷한 문제를 풀어 봐요.",
            ),
            "fake",
            PROMPT_VERSION,
        )


def get_ai(settings: Annotated[Settings, Depends(get_settings)]) -> DiagnosisAI:
    return FakeAI() if settings.ai_mode == "fake" else RealAI(settings)
