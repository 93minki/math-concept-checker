from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class StructuredResult[T: BaseModel]:
    parsed: T
    model: str
    input_tokens: int
    output_tokens: int
    reasoning_tokens: int | None
    latency_ms: float
    raw_text: str


class StructuredProvider(Protocol):
    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]: ...
