import asyncio
import logging
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI

from app.ai.providers.base import StructuredResult
from app.ai.schemas import ConceptResult, ReportInput, ReportText, load_concept
from app.diagnoses.ai import FakeAI, RealAI, get_ai
from app.main import lifespan
from app.settings import Settings


def settings() -> Settings:
    return Settings(
        _env_file=None,
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SECRET_KEY="sb_secret_fake",
        FRONTEND_ORIGIN="http://localhost:3000",
    )


def test_ai_settings_and_startup_warning(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.delenv("AI_MODE", raising=False)
    assert settings().ai_mode == "real"
    monkeypatch.setenv("AI_MODE", "fake")
    fake = settings()
    assert isinstance(get_ai(fake), FakeAI)
    monkeypatch.setattr("app.main.get_settings", lambda: fake)

    async def start() -> None:
        async with lifespan(FastAPI()):
            pass

    with caplog.at_level(logging.WARNING):
        asyncio.run(start())
    assert "AI_MODE=fake" in caplog.text


def outcome(text: str) -> StructuredResult[ReportText]:
    return StructuredResult(
        parsed=ReportText(
            not_understood=text,
            misconception_explanations="다시 볼 수 있어요",
            next_steps="연습해요",
        ),
        model="gpt-6.1-terra",
        input_tokens=5,
        output_tokens=5,
        reasoning_tokens=0,
        latency_ms=10,
        raw_text=text,
    )


@pytest.mark.parametrize("second_valid", [True, False])
def test_report_validation_retries(
    monkeypatch: pytest.MonkeyPatch, second_valid: bool
) -> None:
    provider = MagicMock()
    provider.model = "gpt-6.1-terra"
    provider.generate_structured.side_effect = [
        outcome("1점"),
        outcome("다시 살펴봐요" if second_valid else "2점"),
    ]
    monkeypatch.setattr("app.diagnoses.ai.OpenAIProvider", lambda **kwargs: provider)
    data = ReportInput(
        unit_score=0.5,
        unit_stage="기본 이해",
        concepts=[
            ConceptResult(
                concept_id="9수02-03-C4",
                name="등식의 성질",
                score=0.5,
                stage="기본 이해",
            )
        ],
    )
    service = RealAI(settings())
    if second_valid:
        assert (
            service.report(data, load_concept("9수02-03")).text.not_understood
            == "다시 살펴봐요"
        )
    else:
        with pytest.raises(ValueError, match="Report validation failed"):
            service.report(data, load_concept("9수02-03"))
    assert provider.generate_structured.call_count == 2
