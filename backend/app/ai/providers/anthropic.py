from pydantic import BaseModel

from app.ai.providers.base import StructuredResult


class AnthropicProvider:
    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        raise NotImplementedError("Claude provider is not part of this comparison")
