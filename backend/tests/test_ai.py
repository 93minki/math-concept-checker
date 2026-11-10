from decimal import Decimal
from types import SimpleNamespace
from typing import cast

import pytest
from google import genai
from openai import OpenAI
from pydantic import BaseModel

from app.ai.hard import render_hard_conditions
from app.ai.pricing import cost_usd
from app.ai.providers.anthropic import AnthropicProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.schemas import Choice, Question, RubricElement, load_concept
from app.ai.validators import KatexChecker, ValidationIssue, validate_question
from app.settings import Settings


class Answer(BaseModel):
    value: int


class FakeChecker:
    def check(self, formulas: list[str]) -> list[ValidationIssue]:
        return []


def test_concept_data_references() -> None:
    data = load_concept("9수02-03")
    ids = {concept.id for concept in data.concepts}
    assert len(ids) == len(data.concepts)
    assert all(item.concept_id in ids for item in data.assessment_items)
    assert all(set(m.concept_ids) <= ids for m in data.misconceptions)
    with pytest.raises(ValueError):
        load_concept("../settings")


def test_optional_ai_keys_and_presence(
    capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(
        _env_file=None,
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SECRET_KEY="sb_secret_fake",
        FRONTEND_ORIGIN="http://localhost:3000",
    )
    assert settings.gemini_api_key is None
    monkeypatch.setattr("app.check_settings.get_settings", lambda: settings)
    from app.check_settings import main

    assert main() == 0
    output = capsys.readouterr().out
    assert "GEMINI_API_KEY: 없음" in output
    assert "sb_secret_fake" not in output


def test_provider_requests_and_usage() -> None:
    class GeminiInteractions:
        def create(self, **kwargs: object) -> SimpleNamespace:
            assert kwargs["model"] == "gemini-3.8-flash"
            assert kwargs["system_instruction"] == "system"
            assert kwargs["input"] == "user"
            assert kwargs["generation_config"] == {"thinking_level": "medium"}
            assert kwargs["response_format"] == {
                "type": "text",
                "mime_type": "application/json",
                "schema_": Answer.model_json_schema(),
            }
            return SimpleNamespace(
                output_text='{"value": 2}',
                usage=SimpleNamespace(
                    total_input_tokens=10, total_output_tokens=5, total_thought_tokens=3
                ),
            )

    gemini_client = cast(
        genai.Client, SimpleNamespace(interactions=GeminiInteractions())
    )
    gemini = GeminiProvider(client=gemini_client).generate_structured(
        "system", "user", Answer
    )
    assert (
        gemini.parsed.value,
        gemini.input_tokens,
        gemini.output_tokens,
        gemini.reasoning_tokens,
    ) == (2, 10, 8, 3)
    assert gemini.latency_ms >= 0

    class Responses:
        def parse(self, **kwargs: object) -> SimpleNamespace:
            assert kwargs["model"] == "gpt-6.1-terra"
            assert kwargs["text_format"] is Answer
            assert kwargs["reasoning"] == {"effort": "medium"}
            assert kwargs["input"] == [
                {"role": "system", "content": "system"},
                {"role": "user", "content": "user"},
            ]
            return SimpleNamespace(
                output_parsed=Answer(value=2),
                output_text='{"value": 2}',
                usage=SimpleNamespace(
                    input_tokens=10,
                    output_tokens=8,
                    output_tokens_details=SimpleNamespace(reasoning_tokens=3),
                ),
            )

    openai_client = cast(OpenAI, SimpleNamespace(responses=Responses()))
    openai = OpenAIProvider(client=openai_client).generate_structured(
        "system", "user", Answer
    )
    assert (
        openai.parsed.value,
        openai.input_tokens,
        openai.output_tokens,
        openai.reasoning_tokens,
    ) == (2, 10, 8, 3)
    with pytest.raises(NotImplementedError, match="not part of this comparison"):
        AnthropicProvider().generate_structured("", "", Answer)


def test_missing_keys() -> None:
    settings = Settings(
        _env_file=None,
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SECRET_KEY="sb_secret_fake",
        FRONTEND_ORIGIN="http://localhost:3000",
    )
    with pytest.raises(ValueError, match="GEMINI_API_KEY is required"):
        GeminiProvider(settings=settings)
    with pytest.raises(ValueError, match="OPENAI_API_KEY is required"):
        OpenAIProvider(settings=settings)


def test_pricing() -> None:
    assert cost_usd("gemini-3.8-flash", 1_000_000, 1_000_000) == Decimal("9.00")
    assert cost_usd(
        "gemini-3.8-flash", 1_000_000, 1_000_000, standard=False
    ) == Decimal("4.50")
    assert cost_usd("gpt-6.1-terra", 1_000_000, 1_000_000) == Decimal("6")
    with pytest.raises(ValueError):
        cost_usd("gpt-6.1-terra", -1, 0)


def good_question() -> Question:
    return Question(
        assessment_item_id="9수02-03-C1-정의이해",
        concept_id="9수02-03-C1",
        level="정의 이해",
        type="multiple_choice",
        difficulty="normal",
        body="다음 중 등식은? $1+1=2$",
        explanation="양변이 같다.",
        choices=[
            Choice(no=1, text="맞다", is_correct=True, misconception_id=None),
            Choice(
                no=2, text="결과만 써야 한다", is_correct=False, misconception_id="M1"
            ),
            Choice(no=3, text="오답", is_correct=False, misconception_id=None),
            Choice(no=4, text="오답", is_correct=False, misconception_id=None),
            Choice(no=5, text="오답", is_correct=False, misconception_id=None),
        ],
        model_answer=None,
        rubric=[],
    )


def codes(question: Question) -> set[str]:
    return {
        issue.code
        for issue in validate_question(
            question, load_concept("9수02-03"), FakeChecker()
        )
    }


def test_choice_rules() -> None:
    q = good_question()
    assert codes(q) == set()
    assert "choice_count" in codes(q.model_copy(update={"choices": q.choices[:4]}))
    assert "choice_numbers" in codes(
        q.model_copy(update={"choices": [*q.choices[:4], q.choices[3]]})
    )
    assert "correct_count" in codes(
        q.model_copy(
            update={
                "choices": [
                    q.choices[0].model_copy(update={"is_correct": False}),
                    *q.choices[1:],
                ]
            }
        )
    )
    choices = [
        q.choices[0],
        q.choices[1].model_copy(update={"misconception_id": None}),
        *q.choices[2:],
    ]
    assert "linked_distractor" in codes(q.model_copy(update={"choices": choices}))
    choices[1] = choices[1].model_copy(update={"misconception_id": "M2"})
    assert "misconception" in codes(q.model_copy(update={"choices": choices}))


def test_written_rules() -> None:
    q = good_question().model_copy(
        update={
            "assessment_item_id": "9수02-03-C4-이유설명",
            "concept_id": "9수02-03-C4",
            "level": "이유 설명",
            "type": "written",
            "choices": [],
            "model_answer": "양변에 같은 수를 더한다.",
            "rubric": [
                RubricElement(
                    no=1,
                    description="설명",
                    points=2,
                    required=True,
                    related_misconception_ids=["M2"],
                )
            ],
        }
    )
    assert codes(q) == set()
    assert "rubric" in codes(q.model_copy(update={"rubric": []}))
    bad = [
        q.rubric[0].model_copy(
            update={"required": False, "points": 0, "related_misconception_ids": ["M1"]}
        )
    ]
    assert {"required_rubric", "rubric_points", "misconception"} <= codes(
        q.model_copy(update={"rubric": bad})
    )
    assert "model_answer" in codes(q.model_copy(update={"model_answer": " "}))


def test_common_rules() -> None:
    q = good_question()
    assert "assessment_item" in codes(
        q.model_copy(update={"assessment_item_id": "missing"})
    )
    assert "assessment_item" in codes(q.model_copy(update={"level": "wrong"}))
    assert "concept" in codes(q.model_copy(update={"concept_id": "missing"}))
    assert "forbidden_notation" in codes(
        q.model_copy(update={"body": r"$\overparen{AB}$"})
    )
    assert "not_yet_learned" in codes(
        q.model_copy(update={"explanation": "좌표를 사용한다"})
    )


def test_real_katex() -> None:
    assert KatexChecker().check([r"x+1=2"]) == []
    assert [issue.code for issue in KatexChecker().check([r"\overparen{AB}"])] == [
        "invalid_tex"
    ]


def test_render_hard_conditions() -> None:
    hard = render_hard_conditions("정의 이해", "hard")
    assert hard.startswith("   - `definition-a`:")
    normal = render_hard_conditions("성질 적용", "normal")
    assert normal == "   - (일반 문제: 해당 없음)"
    with pytest.raises(ValueError):
        render_hard_conditions("없는 수준", "hard")


def test_hard_condition_validation() -> None:
    q = good_question().model_copy(
        update={
            "difficulty": "hard",
            "hard_condition": "definition-a",
            "hard_condition_reason": "경계 등식을 묻는다.",
        }
    )
    assert "hard_condition" not in codes(q)
    assert "hard_condition" in codes(q.model_copy(update={"hard_condition": None}))
    assert "hard_condition" in codes(
        q.model_copy(update={"hard_condition": "application-a"})
    )
    assert "hard_condition" in codes(q.model_copy(update={"hard_condition_reason": ""}))
    normal = good_question()
    assert "hard_condition" not in codes(normal)
    assert "hard_condition" in codes(
        normal.model_copy(update={"hard_condition": "definition-a"})
    )
