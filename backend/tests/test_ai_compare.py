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
    run,
)
from app.ai.prompts import PROMPT_VERSION, load_prompt
from app.ai.providers.base import StructuredResult
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
    assert prompt.version == PROMPT_VERSION == "v3"
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
    assert codes == {"not_yet_learned", "unknown_misconception", "unknown_concept"}
    good = ReportText(
        not_understood="등식을 살펴보세요.",
        misconception_explanations="M6일 수 있어요.",
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


def test_budget_stops_before_next_call(tmp_path: Path) -> None:
    out = tmp_path / "limited"
    summary = run(["gemini", "openai"], "probe", Decimal("0.000001"), out, True)
    assert summary["stopped_at_cost_limit"] is True
    assert len((out / "calls.jsonl").read_text().splitlines()) == 1
    assert (out / "summary.md").is_file()


class CapturingProvider(FakeProvider):
    def __init__(self, model: str, fixture: EvalFixture) -> None:
        super().__init__(model, fixture)
        self.users: list[str] = []

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        self.users.append(user)
        return super().generate_structured(system, user, schema)


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
