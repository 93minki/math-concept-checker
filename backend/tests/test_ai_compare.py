import html
import json
from decimal import Decimal
from pathlib import Path
from typing import Literal, cast

import pytest
from pydantic import BaseModel

from app.ai.compare import (
    FAKE_PROMPTS,
    AnswerCase,
    EvalFixture,
    FakeProvider,
    Recorder,
    load_fixture,
    make_summary,
    misconception_criteria,
    parse_difficulties,
    run,
)
from app.ai.hard import HARD_CONDITIONS
from app.ai.prompts import PROMPT_VERSION, load_prompt
from app.ai.providers.base import StructuredResult
from app.ai.report_html import render_report_html
from app.ai.schemas import (
    Grading,
    GradingDraft,
    QuestionDraft,
    ReportText,
    Review,
    load_concept,
)
from app.ai.scoring import Score, score_choice, score_written
from app.ai.tasks import (
    GradedAnswer,
    generate_question,
    grade_written,
    validate_report,
    write_report,
)
from app.ai.validators import validate_question
from app.settings import Settings


@pytest.fixture(autouse=True)
def fake_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        _env_file=None,
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SECRET_KEY="sb_secret_REPLACE_ME",
        FRONTEND_ORIGIN="http://localhost:3000",
    )
    monkeypatch.setattr("app.ai.compare.get_settings", lambda: settings)


def test_prompt_loading(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    with pytest.raises(ValueError, match="Missing prompt values"):
        load_prompt("grade_written", {})
    values = {
        "question_body": "body",
        "model_answer": "answer",
        "rubric": "[]",
        "misconceptions": "[]",
        "student_answer": "student",
    }
    prompt = load_prompt("grade_written", values)
    assert prompt.version == PROMPT_VERSION == "v7"
    assert "<!--" not in prompt.system + prompt.user
    assert "{{" not in prompt.system + prompt.user
    assert "student" in prompt.user


def test_scoring() -> None:
    fixture = load_fixture()
    grading = Grading.model_validate(
        {
            "element_results": [
                {"no": 1, "met": True, "reason": ""},
                {"no": 2, "met": False, "reason": ""},
                {"no": 3, "met": True, "reason": ""},
            ],
            "detected_misconception_ids": [],
        }
    )
    score = score_written(fixture.question.rubric, grading)
    assert score.value == pytest.approx(3 / 5)
    assert not score.passed
    grading.element_results[1].met = True
    assert score_written(fixture.question.rubric, grading).passed
    with pytest.raises(ValueError, match="do not match"):
        score_written(
            fixture.question.rubric,
            grading.model_copy(update={"element_results": grading.element_results[:2]}),
        )
    choices = (
        FakeProvider("gpt-6.1-terra", fixture)
        .generate_structured(
            "",
            "평가 항목 ID: 9수02-03-C2-성질적용\n난이도: normal\n",
            QuestionDraft,
        )
        .parsed.choices
    )
    assert score_choice(choices, 1).value == 1
    assert score_choice(choices, 2).value == 0


class RejectingProvider(FakeProvider):
    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        result = super().generate_structured(system, user, schema)
        if schema is Review:
            bad = schema.model_validate(
                {
                    "single_correct_answer": False,
                    "conditions_sufficient": True,
                    "measures_intended_level": True,
                    "meets_hard_condition": True,
                    "issues": ["복수 정답"],
                }
            )
            return StructuredResult(
                parsed=bad,
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                reasoning_tokens=result.reasoning_tokens,
                latency_ms=result.latency_ms,
                raw_text=bad.model_dump_json(),
            )
        return result


def test_three_failures_excluded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    concept = load_concept("9수02-03")
    fixture = load_fixture()
    recorder = Recorder(tmp_path / "calls.jsonl", Decimal("10"), True)
    outcome = generate_question(
        RejectingProvider("gpt-6.1-terra", fixture),
        concept,
        "9수02-03-C2-성질적용",
        "normal",
        hooks=recorder,
    )
    assert outcome.excluded
    assert len(outcome.attempts) == 3
    assert all("복수 정답" in attempt.issues for attempt in outcome.attempts)
    assert len(recorder.entries) == 6
    summary = make_summary(
        ["openai"],
        "full",
        recorder,
        {"openai": [outcome]},
        {"openai": []},
        {"openai": []},
        fixture,
        False,
        True,
    )
    providers = cast(dict[str, dict[str, object]], summary["providers"])
    generation = cast(dict[str, object], providers["openai"]["generation"])
    assert generation["excluded"] == 1
    backlog = cast(list[dict[str, object]], generation["backlog"])
    assert backlog[0]["item_id"] == outcome.item_id
    assert len(cast(list[object], backlog[0]["attempts"])) == 3


def test_question_draft_metadata_from_code(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    assert set(QuestionDraft.model_fields) == {
        "body",
        "explanation",
        "choices",
        "model_answer",
        "rubric",
        "hard_condition",
        "hard_condition_reason",
    }
    concept = load_concept("9수02-03")
    outcome = generate_question(
        FakeProvider("gpt-6.1-terra", load_fixture()),
        concept,
        "9수02-03-C2-성질적용",
        "hard",
        max_attempts=1,
    )
    question = outcome.question
    assert question is not None
    assert (
        question.assessment_item_id,
        question.concept_id,
        question.level,
        question.type,
        question.difficulty,
    ) == ("9수02-03-C2-성질적용", "9수02-03-C2", "성질 적용", "multiple_choice", "hard")
    assert not validate_question(question, concept)


class InventedEvidenceProvider(FakeProvider):
    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        result = super().generate_structured(system, user, schema)
        if schema is GradingDraft:
            data = result.parsed.model_dump()
            for check in data["misconception_checks"]:
                if check["present"]:
                    check["evidence"] = "답안에 없는 근거"
            parsed = schema.model_validate(data)
            return StructuredResult(
                parsed=parsed,
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                reasoning_tokens=result.reasoning_tokens,
                latency_ms=result.latency_ms,
                raw_text=parsed.model_dump_json(),
            )
        return result


def test_grading_evidence_controls_detection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    fixture = load_fixture()
    answer = next(case for case in fixture.answers if case.id == "A05")
    valid = grade_written(
        FakeProvider("gpt-6.1-terra", fixture),
        fixture.question,
        fixture.question.rubric,
        answer.text,
    )
    assert valid.grading.detected_misconception_ids == ["M2"]
    assert valid.issues == []
    bad = grade_written(
        InventedEvidenceProvider("gpt-6.1-terra", fixture),
        fixture.question,
        fixture.question.rubric,
        answer.text,
    )
    assert bad.grading.detected_misconception_ids == []
    assert [issue.code for issue in bad.issues] == ["evidence_not_in_answer"]
    assert (
        misconception_criteria([("A05", bad)], fixture)["evidence_rejected_count"] == 1
    )


def test_misconception_criteria() -> None:
    fixture = load_fixture()
    extra = AnswerCase(
        id="A11",
        text="추가 답안",
        expected={"1": False},
        expected_misconceptions=["M2"],
    )
    fixture = fixture.model_copy(update={"answers": [*fixture.answers, extra]})
    grades = [
        (
            case.id,
            GradedAnswer(
                Grading(
                    element_results=[],
                    detected_misconception_ids=case.expected_misconceptions,
                ),
                Score(0, False),
                [],
            ),
        )
        for case in fixture.answers
        for _ in range(3)
    ]
    metrics = misconception_criteria(grades, fixture)
    for key in ("a05_m2", "false_positive", "preserved_a03_a08"):
        assert cast(dict[str, object], metrics[key])["status"] == "통과"
    assert cast(dict[str, object], metrics["additional_a11_plus"])["rate"] == 1
    damaged = [
        (
            answer_id,
            GradedAnswer(
                Grading(
                    element_results=[],
                    detected_misconception_ids=["M6"] if answer_id == "A01" else [],
                ),
                Score(0, False),
                [],
            ),
        )
        for answer_id, _ in grades
    ]
    damaged_metrics = misconception_criteria(damaged, fixture)
    assert (
        cast(dict[str, object], damaged_metrics["false_positive"])["status"] == "미달"
    )
    assert cast(dict[str, object], damaged_metrics["a05_m2"])["status"] == "미달"


def test_report_validation() -> None:
    fixture = load_fixture()
    report_input = fixture.report_inputs[1]
    report = ReportText(
        not_understood="좌표는 모르겠고 M99일 수 있어요",
        misconception_explanations="9수02-03-C99",
        next_steps="등식부터 보세요.",
    )
    codes = {
        issue.code
        for issue in validate_report(report, report_input, load_concept("9수02-03"))
    }
    assert codes == {
        "not_yet_learned",
        "unknown_misconception",
        "unknown_concept",
        "report_internal_id",
    }
    good = ReportText(
        not_understood="등식을 살펴보세요.",
        misconception_explanations="0으로 나누어도 된다고 생각할 수 있어요.",
        next_steps="양변을 확인하세요.",
    )
    assert validate_report(good, report_input, load_concept("9수02-03")) == []


@pytest.mark.parametrize("bad_text", ["0.25", "25%", "25 %", "5점", "5 점"])
def test_report_number(bad_text: str) -> None:
    fixture = load_fixture()
    report = ReportText(
        not_understood=bad_text, misconception_explanations="", next_steps=""
    )
    assert "report_number" in {
        issue.code
        for issue in validate_report(
            report, fixture.report_inputs[1], load_concept("9수02-03")
        )
    }
    if bad_text == "0.25":
        good = ReportText(
            not_understood="x = 2", misconception_explanations="", next_steps=""
        )
        assert "report_number" not in {
            issue.code
            for issue in validate_report(
                good, fixture.report_inputs[1], load_concept("9수02-03")
            )
        }


@pytest.mark.parametrize("mode", ["probe", "full"])
def test_fake_runs(mode: str, tmp_path: Path) -> None:
    summary = run(
        ["gemini", "openai"],
        cast(Literal["probe", "full"], mode),
        Decimal("10"),
        tmp_path / mode,
        True,
    )
    out = tmp_path / mode
    assert (out / "summary.md").is_file()
    assert (out / "summary.json").is_file()
    calls = [
        json.loads(line) for line in (out / "calls.jsonl").read_text().splitlines()
    ]
    expected_calls = (
        8 if mode == "probe" else 2 * (27 + len(load_fixture().answers) * 3)
    )
    assert len(calls) == expected_calls
    assert all(call["fake"] and call["parsed_success"] for call in calls)
    generated = next(call for call in calls if call["call_type"] == "generate")
    assert set(generated["parsed_output"]) == set(QuestionDraft.model_fields)
    assert (
        generated["assembled_question"]["assessment_item_id"] == generated["target_id"]
    )
    graded = next(call for call in calls if call["call_type"] == "grade")
    assert "misconception_checks" in graded["parsed_output"]
    assert "detected_misconception_ids" not in graded["parsed_output"]
    assert "detected_misconception_ids" in graded
    providers = cast(dict[str, dict[str, object]], summary["providers"])
    for data in providers.values():
        generation = cast(dict[str, object], data["generation"])
        assert generation["excluded"] == 0
        assert generation["within_three_pass_rate"] == 1
        grading = cast(dict[str, object], data["grading"])
        assert grading["whole_agreement"] == 1
    report_html = (out / "report.html").read_text(encoding="utf-8")
    assert report_html.count('data-question-card="1"') == sum(
        call["call_type"] == "generate" for call in calls
    )
    assert report_html.count('data-grade-row="1"') == sum(
        call["call_type"] == "grade" for call in calls
    )
    assert "katex@0.16.47/dist/katex.min.js" in report_html
    assert "katex@0.16.47/dist/contrib/auto-render.min.js" in report_html


def test_budget_stops_before_next_call(tmp_path: Path) -> None:
    out = tmp_path / "limited"
    summary = run(["gemini", "openai"], "probe", Decimal("0.000001"), out, True)
    assert summary["stopped_at_cost_limit"] is True
    assert len((out / "calls.jsonl").read_text().splitlines()) == 1
    assert (out / "summary.md").is_file()
    assert (out / "report.html").is_file()


class CapturingProvider(FakeProvider):
    def __init__(self, model: str, fixture: EvalFixture) -> None:
        super().__init__(model, fixture)
        self.users: list[str] = []

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        self.users.append(user)
        return super().generate_structured(system, user, schema)


def test_report_html_escapes_untrusted_text() -> None:
    payload = "<script>alert(1)</script>"
    fixture = load_fixture()
    calls: list[dict[str, object]] = [
        {
            "provider": "openai",
            "call_type": "generate",
            "target_id": "9수02-03-C4-이유설명",
            "attempt": 1,
            "parsed_success": True,
            "error": None,
            "validation": [],
            "parsed_output": {
                "body": payload,
                "explanation": payload,
                "choices": [
                    {
                        "no": 1,
                        "text": payload,
                        "is_correct": True,
                        "misconception_id": payload,
                    }
                ],
                "model_answer": payload,
                "rubric": [
                    {
                        "no": 1,
                        "description": payload,
                        "points": 2,
                        "required": True,
                        "related_misconception_ids": [],
                    }
                ],
            },
        },
        {
            "provider": "openai",
            "call_type": "review",
            "target_id": "9수02-03-C4-이유설명",
            "attempt": 1,
            "parsed_success": True,
            "error": None,
            "validation": [payload],
            "parsed_output": {"issues": [payload]},
        },
        {
            "provider": "openai",
            "call_type": "grade",
            "target_id": "A01",
            "attempt": 1,
            "parsed_success": True,
            "error": None,
            "validation": [f"evidence_not_in_answer: {payload}"],
            "detected_misconception_ids": [payload],
            "parsed_output": {
                "element_results": [{"no": 1, "met": False, "reason": payload}],
            },
        },
        {
            "provider": "openai",
            "call_type": "report",
            "target_id": "R1",
            "attempt": 1,
            "parsed_success": True,
            "error": None,
            "validation": [payload],
            "parsed_output": {
                "not_understood": payload,
                "misconception_explanations": payload,
                "next_steps": payload,
            },
        },
    ]
    page = render_report_html(
        calls,
        fixture,
        {
            "mode": "full",
            "fake": True,
            "total_cost_usd": "0",
            "providers": {"openai": {"model": "gpt-6.1-terra", "total_cost_usd": "0"}},
        },
    )
    assert payload not in page
    assert page.count(html.escape(payload)) >= 8
    assert page.count('data-question-card="1"') == 1
    assert page.count('data-grade-row="1"') == 1
    assert 'data-mismatch="1"' in page


def test_report_prompt_hides_scores() -> None:
    fixture = load_fixture()
    provider = CapturingProvider("gpt-6.1-terra", fixture)
    report_input = fixture.report_inputs[0]
    write_report(provider, report_input)
    sent = provider.users[-1]
    assert report_input.unit_score is not None
    assert str(report_input.unit_score) not in sent
    for concept in report_input.concepts:
        assert concept.stage in sent
        if concept.score not in (None, 0.0, 1.0):
            assert str(concept.score) not in sent


def test_report_flags_internal_ids() -> None:
    fixture = load_fixture()
    concept = load_concept("9수02-03")
    report_input = fixture.report_inputs[0]
    flagged = ReportText(
        not_understood="등식의 뜻은 기본 이해 단계예요.",
        misconception_explanations="M3: 이항을 규칙으로만 알 수 있어요.",
        next_steps="x+3=7을 풀어 보세요.",
    )
    clean = flagged.model_copy(
        update={"misconception_explanations": "이항을 규칙으로만 알 수 있어요."}
    )
    assert "report_internal_id" in {
        issue.code for issue in validate_report(flagged, report_input, concept)
    }
    assert "report_internal_id" not in {
        issue.code for issue in validate_report(clean, report_input, concept)
    }


class HardRejectingProvider(FakeProvider):
    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        result = super().generate_structured(system, user, schema)
        if schema is Review:
            bad = schema.model_validate(
                {
                    "single_correct_answer": True,
                    "conditions_sufficient": True,
                    "measures_intended_level": True,
                    "meets_hard_condition": False,
                    "issues": [],
                }
            )
            return StructuredResult(
                parsed=bad,
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                reasoning_tokens=result.reasoning_tokens,
                latency_ms=result.latency_ms,
                raw_text=bad.model_dump_json(),
            )
        return result


def test_meets_hard_condition_rejects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    concept = load_concept("9수02-03")
    outcome = generate_question(
        HardRejectingProvider("gpt-6.1-terra", load_fixture()),
        concept,
        "9수02-03-C2-성질적용",
        "hard",
        max_attempts=1,
    )
    assert outcome.excluded
    assert outcome.attempts[0].issues == ["meets_hard_condition: false"]


def test_avoid_bodies_in_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    concept = load_concept("9수02-03")
    provider = CapturingProvider("gpt-6.1-terra", load_fixture())
    generate_question(
        provider,
        concept,
        "9수02-03-C2-성질적용",
        "normal",
        avoid_bodies=["첫 변형", "둘째 변형"],
        max_attempts=1,
    )
    assert "1. 첫 변형" in provider.users[0]
    assert "2. 둘째 변형" in provider.users[0]
    generate_question(
        provider,
        concept,
        "9수02-03-C2-성질적용",
        "normal",
        max_attempts=1,
    )
    assert "없음" in provider.users[1]


def test_v5_real_prompts_fill_context() -> None:
    from app.ai.tasks import _context, _declared_hard_condition

    concept = load_concept("9수02-03")
    fixture = load_fixture()
    item = next(i for i in concept.assessment_items if i.id == "9수02-03-C2-성질적용")
    fake = FakeProvider("gpt-6.1-terra", fixture)
    for difficulty in ("normal", "hard"):
        context = _context(concept, item, difficulty, ["기존 본문"])
        prompt = load_prompt("generate_question", context)
        assert "{{" not in prompt.system + prompt.user
        draft = fake.generate_structured(
            "",
            f"평가 항목 ID: {item.id}\n난이도: {difficulty}\n",
            QuestionDraft,
        ).parsed
        assembled = fixture.question.model_copy(
            update={
                "assessment_item_id": item.id,
                "concept_id": item.concept_id,
                "level": item.level,
                "type": item.type,
                "difficulty": difficulty,
                "hard_condition": draft.hard_condition,
                "hard_condition_reason": draft.hard_condition_reason,
            }
        )
        review_values = {
            **context,
            "question_json": assembled.model_dump_json(),
            "declared_hard_condition": _declared_hard_condition(assembled),
        }
        review = load_prompt("review_question", review_values)
        assert "{{" not in review.system + review.user


def test_hard_conditions_cover_concept_levels() -> None:
    levels = {item.level for item in load_concept("9수02-03").assessment_items}
    assert levels <= set(HARD_CONDITIONS)


def test_compare_difficulties_hard_only(tmp_path: Path) -> None:
    run(
        ["openai"],
        "probe",
        Decimal("10"),
        tmp_path / "hard-only",
        True,
        skip_grading=True,
        difficulties="hard",
    )
    calls = [
        json.loads(line)
        for line in (tmp_path / "hard-only" / "calls.jsonl").read_text().splitlines()
    ]
    generates = [call for call in calls if call["call_type"] == "generate"]
    assert len(generates) == 1
    assert all(call["assembled_question"]["difficulty"] == "hard" for call in generates)


def test_skip_grading_runs_only_generation_and_reports(tmp_path: Path) -> None:
    run(["openai"], "full", Decimal("10"), tmp_path / "out", True, skip_grading=True)
    calls = [
        json.loads(line)
        for line in (tmp_path / "out" / "calls.jsonl").read_text().splitlines()
    ]
    kinds = {call["call_type"] for call in calls}
    assert "grade" not in kinds
    assert {"generate", "review", "report"} <= kinds
    assert (tmp_path / "out" / "report.html").exists()


def test_parse_difficulties() -> None:
    assert parse_difficulties("hard, normal,hard") == ("hard", "normal")
    with pytest.raises(ValueError):
        parse_difficulties("easy")
    with pytest.raises(ValueError):
        parse_difficulties(" , ")


class StrayHardConditionProvider(FakeProvider):
    """Returns a hard condition even for normal questions."""

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        result = super().generate_structured(system, user, schema)
        if schema is QuestionDraft:
            stray = schema.model_validate(
                {
                    **result.parsed.model_dump(),
                    "hard_condition": "application-a",
                    "hard_condition_reason": "잘못 채운 값",
                }
            )
            return StructuredResult(
                parsed=stray,
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                reasoning_tokens=result.reasoning_tokens,
                latency_ms=result.latency_ms,
                raw_text=stray.model_dump_json(),
            )
        return result


def test_normal_question_drops_stray_hard_condition(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.ai.prompts.PROMPTS", FAKE_PROMPTS)
    outcome = generate_question(
        StrayHardConditionProvider("gpt-6.1-terra", load_fixture()),
        load_concept("9수02-03"),
        "9수02-03-C2-성질적용",
        "normal",
        max_attempts=1,
    )
    assert outcome.question is not None
    assert outcome.question.hard_condition is None
    assert outcome.question.hard_condition_reason is None
