from time import perf_counter
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from app.ai.providers.base import StructuredResult
from app.settings import Settings, get_settings


class OpenAIProvider:
    def __init__(
        self,
        client: OpenAI | None = None,
        settings: Settings | None = None,
        model: str = "gpt-6.1-terra",
        effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] = "medium",
    ) -> None:
        self.model = model
        self.effort = effort
        if client is None:
            key = (settings or get_settings()).openai_api_key
            if key is None:
                raise ValueError("OPENAI_API_KEY is required")
            client = OpenAI(api_key=key.get_secret_value())
        self.client = client

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        start = perf_counter()
        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            text_format=schema,
            reasoning={"effort": self.effort},
        )
        latency_ms = (perf_counter() - start) * 1000
        parsed = response.output_parsed
        if parsed is None:
            raise ValueError("OpenAI response has no parsed output")
        usage = response.usage
        if usage is None:
            raise ValueError("OpenAI response has no usage")
        return StructuredResult(
            parsed=parsed,
            model=self.model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            reasoning_tokens=usage.output_tokens_details.reasoning_tokens,
            latency_ms=latency_ms,
            raw_text=response.output_text,
        )
