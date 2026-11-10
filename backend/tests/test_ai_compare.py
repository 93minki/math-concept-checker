import json
from decimal import Decimal
from pathlib import Path
from typing import Literal, cast

import pytest
from pydantic import BaseModel

from app.ai.compare import FakeProvider, Recorder, load_fixture, make_summary, run
from app.ai.prompts import load_prompt
from app.ai.providers.base import StructuredResult
from app.ai.schemas import Grading, Question, ReportText, Review, load_concept
from app.ai.scoring import score_choice, score_written
from app.ai.tasks import generate_question, validate_report
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


def test_prompt_loading() -> None:
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
    assert prompt.version == "v1"
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
            Question,
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


def test_three_failures_excluded(tmp_path: Path) -> None:
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


@pytest.mark.parametrize("mode,expected_calls", [("probe", 8), ("full", 114)])
def test_fake_runs(mode: str, expected_calls: int, tmp_path: Path) -> None:
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
    assert len(calls) == expected_calls
    assert all(call["fake"] and call["parsed_success"] for call in calls)
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
