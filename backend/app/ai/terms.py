from functools import cache, lru_cache
from pathlib import Path

from pydantic import BaseModel

DATA = Path(__file__).resolve().parents[2] / "data" / "curriculum"


class Term(BaseModel):
    term: str
    standard: str | None = None
    check: bool = True


class TermData(BaseModel):
    elementary: list[Term]
    middle: list[Term]
    high: list[Term]


class Unit(BaseModel):
    grade: str
    number: int
    standards: list[str]


class UnitData(BaseModel):
    display_units: list[Unit]


@lru_cache(maxsize=1)
def curriculum() -> tuple[TermData, dict[str, tuple[int, int]]]:
    terms = TermData.model_validate_json(
        (DATA / "terms.json").read_text(encoding="utf-8")
    )
    units = UnitData.model_validate_json(
        (DATA / "display_units.json").read_text(encoding="utf-8")
    )
    positions = {
        code: (int(unit.grade.removeprefix("중")), unit.number)
        for unit in units.display_units
        for code in unit.standards
    }
    return terms, positions


def earliest_standard(codes: list[str]) -> str:
    if not codes:
        raise ValueError("성취기준이 없습니다")
    positions = curriculum()[1]
    return min(codes, key=lambda code: (positions[code], code))


@cache
def term_rules(
    standard_code: str,
) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    data, positions = curriculum()
    current = positions[standard_code]
    elementary = {row.term for row in data.elementary}
    earliest: dict[str, tuple[int, int]] = {}
    for row in data.middle:
        if row.standard is None:
            raise ValueError("중학교 용어에 성취기준이 없습니다")
        position = positions[row.standard]
        earliest[row.term] = min(earliest.get(row.term, position), position)
    allowed = elementary | {
        term for term, position in earliest.items() if position <= current
    }
    banned = (
        {row.term for row in data.high}
        | {term for term, position in earliest.items() if position > current}
    ) - allowed
    unchecked = {
        row.term
        for row in [*data.elementary, *data.middle, *data.high]
        if not row.check
    }
    return (
        tuple(sorted(banned - unchecked)),
        tuple(sorted(banned & unchecked)),
        tuple(sorted(allowed)),
    )


def find_banned_terms(text: str, standard_code: str) -> list[str]:
    banned, _, allowed = term_rules(standard_code)
    # Short allowed terms inside a banned term must not erase that banned term.
    for term in sorted(allowed, key=lambda value: (-len(value), value)):
        if any(value in term for value in banned):
            text = text.replace(term, " ")
    return [term for term in banned if term in text]
