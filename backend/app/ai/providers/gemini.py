from time import perf_counter

from google import genai
from pydantic import BaseModel

from app.ai.providers.base import StructuredResult
from app.settings import Settings, get_settings


class GeminiProvider:
    def __init__(
        self,
        client: genai.Client | None = None,
        settings: Settings | None = None,
        model: str = "gemini-3.8-flash",
        thinking_level: str = "medium",
    ) -> None:
        self.model = model
        self.thinking_level = thinking_level
        if client is None:
            key = (settings or get_settings()).gemini_api_key
            if key is None:
                raise ValueError("GEMINI_API_KEY is required")
            client = genai.Client(api_key=key.get_secret_value())
        self.client = client

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        start = perf_counter()
        response = self.client.interactions.create(
            model=self.model,
            input=user,
            system_instruction=system,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema_": schema.model_json_schema(),
            },
            generation_config={"thinking_level": self.thinking_level},
            stream=False,
        )
        latency_ms = (perf_counter() - start) * 1000
        if not hasattr(response, "output_text") or not hasattr(response, "usage"):
            raise ValueError("Gemini returned a stream")
        raw_text = response.output_text
        if raw_text is None:
            raise ValueError("Gemini response has no text")
        usage = response.usage
        if usage is None:
            raise ValueError("Gemini response has no usage")
        thoughts = usage.total_thought_tokens or 0
        return StructuredResult(
            parsed=schema.model_validate_json(raw_text),
            model=self.model,
            input_tokens=usage.total_input_tokens or 0,
            # Gemini reports thoughts separately; both are billable output.
            output_tokens=(usage.total_output_tokens or 0) + thoughts,
            reasoning_tokens=thoughts,
            latency_ms=latency_ms,
            raw_text=raw_text,
        )
