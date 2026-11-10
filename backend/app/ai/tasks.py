import json
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from pydantic import BaseModel

from app.ai.hard import render_hard_conditions
from app.ai.pricing import cost_usd
from app.ai.prompts import Prompt, load_prompt
from app.ai.providers.base import StructuredProvider, StructuredResult
from app.ai.schemas import (
    AssessmentItem,
    ConceptData,
    Grading,
    GradingDraft,
    Question,
    QuestionDraft,
    ReportInput,
    ReportText,
    Review,
    RubricElement,
    load_concept,
)
from app.ai.scoring import Score, score_written
from app.ai.validators import ValidationIssue, validate_question


class BudgetExceeded(Exception):
    pass


class CallHooks(Protocol):
    def before_call(self) -> None: ...
    def record(self, entry: dict[str, object]) -> None: ...


@dataclass(frozen=True)
class Attempt:
    number: int
    issues: list[str]
    at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass(frozen=True)
class GenerationOutcome:
    item_id: str
    concept_id: str
    level: str
    difficulty: str
    question: Question | None
    attempts: list[Attempt]

    @property
    def excluded(self) -> bool:
        return self.question is None


@dataclass(frozen=True)
class GradedAnswer:
    grading: Grading
    score: Score
    issues: list[ValidationIssue]


@dataclass(frozen=True)
class WrittenReport:
    text: ReportText
    issues: list[ValidationIssue]


def _invoke[T: BaseModel](
    provider: StructuredProvider,
    prompt: Prompt,
    schema: type[T],
    hooks: CallHooks | None,
    call_type: str,
    target_id: str,
    attempt: int,
) -> tuple[StructuredResult[T], dict[str, object]]:
    if hooks:
        hooks.before_call()
    entry: dict[str, object] = {
        "provider": "gemini"
        if getattr(provider, "model", "").startswith("gemini-")
        else "openai",
        "prompt_version": prompt.version,
        "call_type": call_type,
        "target_id": target_id,
        "attempt": attempt,
        "at": datetime.now(UTC).isoformat(),
    }
    try:
        result = provider.generate_structured(prompt.system, prompt.user, schema)
    except Exception as exc:
        entry.update(
            model=getattr(provider, "model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            reasoning_tokens=None,
            latency_ms=0,
            cost_usd="0",
            cost_usd_intro="0",
            parsed_success=False,
            error=type(exc).__name__,
            validation=[],
            parsed_output=None,
            raw_text="",
        )
        if hooks:
            hooks.record(entry)
        raise
    entry.update(
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        reasoning_tokens=result.reasoning_tokens,
        latency_ms=result.latency_ms,
        cost_usd=str(cost_usd(result.model, result.input_tokens, result.output_tokens)),
        cost_usd_intro=str(
            cost_usd(
                result.model, result.input_tokens, result.output_tokens, standard=False
            )
        ),
        parsed_success=True,
        error=None,
        validation=[],
        parsed_output=result.parsed.model_dump(),
        raw_text=result.raw_text,
    )
    return result, entry


def _record(
    hooks: CallHooks | None, entry: dict[str, object], issues: list[str]
) -> None:
    entry["validation"] = issues
    if hooks:
        hooks.record(entry)


def _declared_hard_condition(question: Question) -> str:
    if question.difficulty == "hard":
        code = question.hard_condition or ""
        reason = question.hard_condition_reason or ""
        return f"`{code}` — {reason}"
    return "없음 (일반 문제)"


def _context(
    concept: ConceptData,
    item: AssessmentItem,
    difficulty: str,
    avoid_bodies: Sequence[str] = (),
) -> dict[str, str]:
    concept_name = next(c.name for c in concept.concepts if c.id == item.concept_id)
    related = [m for m in concept.misconceptions if item.concept_id in m.concept_ids]
    if avoid_bodies:
        existing_variants = "\n".join(
            f"{index}. {body}" for index, body in enumerate(avoid_bodies, start=1)
        )
    else:
        existing_variants = "없음"
    return {
        "standard_code": concept.standard_code,
        "standard_text": concept.standard_text,
        "grade": concept.display_unit.grade,
        "display_unit": concept.display_unit.name,
        "assessment_item_id": item.id,
        "concept_id": item.concept_id,
        "concept_name": concept_name,
        "level": item.level,
        "item_basis": item.basis,
        "scope_note": concept.scope_note,
        "question_type": item.type,
        "difficulty": difficulty,
        "misconceptions": json.dumps(
            [m.model_dump() for m in related], ensure_ascii=False
        ),
        "formal_terms": ", ".join(concept.terms.formal),
        "teaching_only_terms": ", ".join(concept.terms.teaching_only),
        "not_yet_learned_terms": ", ".join(concept.terms.not_yet_learned),
        "hard_conditions": render_hard_conditions(item.level, difficulty),
        "existing_variants": existing_variants,
    }


def generate_question(
    provider: StructuredProvider,
    concept: ConceptData,
    item_id: str,
    difficulty: str,
    *,
    avoid_bodies: Sequence[str] = (),
    max_attempts: int = 3,
    hooks: CallHooks | None = None,
) -> GenerationOutcome:
    item = next((item for item in concept.assessment_items if item.id == item_id), None)
    if item is None or difficulty not in ("normal", "hard") or max_attempts < 1:
        raise ValueError("Invalid assessment item, difficulty, or attempt count")
    context = _context(concept, item, difficulty, avoid_bodies)
    attempts: list[Attempt] = []
    for number in range(1, max_attempts + 1):
        prompt = load_prompt("generate_question", context)
        try:
            generated, entry = _invoke(
                provider, prompt, QuestionDraft, hooks, "generate", item_id, number
            )
        except BudgetExceeded:
            raise
        except Exception as exc:
            attempts.append(Attempt(number, [f"generate: {type(exc).__name__}"]))
            continue
        draft = generated.parsed
        question = Question(
            assessment_item_id=item.id,
            concept_id=item.concept_id,
            level=item.level,
            type=item.type,
            difficulty=difficulty,
            body=draft.body,
            explanation=draft.explanation,
            choices=draft.choices,
            model_answer=draft.model_answer,
            rubric=draft.rubric,
            # A normal question has no hard condition by definition; drop stray
            # values instead of spending a retry on them.
            hard_condition=draft.hard_condition if difficulty == "hard" else None,
            hard_condition_reason=(
                draft.hard_condition_reason if difficulty == "hard" else None
            ),
        )
        entry["assembled_question"] = question.model_dump()
        checks = validate_question(question, concept)
        errors = [f"{issue.code}: {issue.message}" for issue in checks]
        _record(hooks, entry, errors)
        if errors:
            attempts.append(Attempt(number, errors))
            continue
        review_prompt = load_prompt(
            "review_question",
            {
                **context,
                "question_json": question.model_dump_json(),
                "declared_hard_condition": _declared_hard_condition(question),
            },
        )
        try:
            reviewed, review_entry = _invoke(
                provider, review_prompt, Review, hooks, "review", item_id, number
            )
        except BudgetExceeded:
            raise
        except Exception as exc:
            attempts.append(Attempt(number, [f"review: {type(exc).__name__}"]))
            continue
        review = reviewed.parsed
        review_errors = list(review.issues)
        if not review.single_correct_answer:
            review_errors.append("single_correct_answer: false")
        if not review.conditions_sufficient:
            review_errors.append("conditions_sufficient: false")
        if not review.measures_intended_level:
            review_errors.append("measures_intended_level: false")
        if not review.meets_hard_condition:
            review_errors.append("meets_hard_condition: false")
        _record(hooks, review_entry, review_errors)
        attempts.append(Attempt(number, review_errors))
        if not review_errors:
            return GenerationOutcome(
                item_id, item.concept_id, item.level, difficulty, question, attempts
            )
    return GenerationOutcome(
        item_id, item.concept_id, item.level, difficulty, None, attempts
    )


def grade_written(
    provider: StructuredProvider,
    question: Question,
    rubric: list[RubricElement],
    answer: str,
    *,
    target_id: str = "",
    attempt: int = 1,
    hooks: CallHooks | None = None,
) -> GradedAnswer:
    concept = load_concept(question.concept_id.split("-C")[0])
    related = [
        m for m in concept.misconceptions if question.concept_id in m.concept_ids
    ]
    prompt = load_prompt(
        "grade_written",
        {
            "question_body": question.body,
            "model_answer": question.model_answer or "",
            "rubric": json.dumps(
                [element.model_dump() for element in rubric], ensure_ascii=False
            ),
            "misconceptions": json.dumps(
                [m.model_dump() for m in related], ensure_ascii=False
            ),
            "student_answer": answer,
        },
    )
    result, entry = _invoke(
        provider, prompt, GradingDraft, hooks, "grade", target_id, attempt
    )
    allowed = {m.id for m in related}
    errors = [
        check.id
        for check in result.parsed.misconception_checks
        if check.id not in allowed
    ]
    if errors:
        _record(
            hooks,
            entry,
            [f"Unknown misconception: {identifier}" for identifier in errors],
        )
        raise ValueError("Grading contains unknown misconception")
    normalized_answer = " ".join(answer.split())
    issues = [
        ValidationIssue("evidence_not_in_answer", check.id)
        for check in result.parsed.misconception_checks
        if check.present
        and (
            not check.evidence.strip()
            or " ".join(check.evidence.split()) not in normalized_answer
        )
    ]
    rejected = {issue.message for issue in issues}
    grading = Grading(
        element_results=result.parsed.element_results,
        detected_misconception_ids=list(
            dict.fromkeys(
                check.id
                for check in result.parsed.misconception_checks
                if check.present and check.id not in rejected
            )
        ),
    )
    entry["detected_misconception_ids"] = grading.detected_misconception_ids
    try:
        score = score_written(rubric, grading)
    except ValueError as exc:
        _record(hooks, entry, [str(exc)])
        raise
    _record(hooks, entry, [f"{issue.code}: {issue.message}" for issue in issues])
    return GradedAnswer(grading, score, issues)


def validate_report(
    report: ReportText, report_input: ReportInput, concept: ConceptData
) -> list[ValidationIssue]:
    text = " ".join(
        (report.not_understood, report.misconception_explanations, report.next_steps)
    )
    allowed_m = set(report_input.misconception_ids)
    allowed_m.update(
        m for result in report_input.concepts for m in result.misconception_ids
    )
    allowed_c = {result.concept_id for result in report_input.concepts}
    issues = [
        ValidationIssue("not_yet_learned", term)
        for term in concept.terms.not_yet_learned
        if term in text
    ]
    issues.extend(
        ValidationIssue("unknown_misconception", identifier)
        for identifier in set(re.findall(r"M\d+", text)) - allowed_m
    )
    issues.extend(
        ValidationIssue("unknown_concept", identifier)
        for identifier in set(re.findall(r"9수\d{2}-\d{2}-C\d+", text)) - allowed_c
    )
    if re.search(r"(?<![A-Za-z0-9])M\d+(?![0-9])|9수\d{2}-\d{2}", text):
        issues.append(
            ValidationIssue("report_internal_id", "Internal id shown to students")
        )
    if re.search(r"\d+\.\d+|\d+\s*%|\d+\s*점", text):
        issues.append(ValidationIssue("report_number", "Student-facing number"))
    return issues


def write_report(
    provider: StructuredProvider,
    report_input: ReportInput,
    *,
    target_id: str = "",
    hooks: CallHooks | None = None,
) -> WrittenReport:
    if not report_input.concepts:
        raise ValueError("Report input needs concepts")
    concept = load_concept(report_input.concepts[0].concept_id.split("-C")[0])
    prompt = load_prompt(
        "write_report",
        {
            "grade": concept.display_unit.grade,
            "display_unit": concept.display_unit.name,
            "not_yet_learned_terms": ", ".join(concept.terms.not_yet_learned),
            "misconceptions": json.dumps(
                [
                    {"id": m.id, "text": m.text}
                    for m in concept.misconceptions
                    if m.id in report_input.misconception_ids
                ],
                ensure_ascii=False,
            ),
            # Scores stay in code; the model only sees stages, so it cannot
            # print numbers to students (docs/SCORING.md section 5).
            "report_input_json": report_input.model_dump_json(
                exclude={"unit_score": True, "concepts": {"__all__": {"score"}}}
            ),
        },
    )
    result, entry = _invoke(provider, prompt, ReportText, hooks, "report", target_id, 1)
    issues = validate_report(result.parsed, report_input, concept)
    _record(hooks, entry, [f"{issue.code}: {issue.message}" for issue in issues])
    return WrittenReport(result.parsed, issues)
