from dataclasses import dataclass
from typing import Literal

Stage = Literal["아직 이해 못 함", "기본 이해", "깊이 이해"]


@dataclass(frozen=True)
class QuestionResult:
    score: float
    passed: bool
    misconception_ids: tuple[str, ...] = ()


HardState = Literal["not_attempted", "no_question"]


@dataclass(frozen=True)
class ItemInput:
    assessment_item_id: str
    concept_id: str
    normal: QuestionResult | None
    hard: QuestionResult | HardState | None


@dataclass(frozen=True)
class ItemScore:
    assessment_item_id: str
    concept_id: str
    score: float | None
    stage: Stage | None
    deep_not_attempted: bool
    deep_not_measured: bool


@dataclass(frozen=True)
class ConceptScore:
    concept_id: str
    score: float | None
    stage: Stage | None
    not_measured: bool
    deep_not_attempted: bool
    deep_not_measured: bool
    misconception_ids: tuple[str, ...]


@dataclass(frozen=True)
class UnitScore:
    score: float | None
    stage: Stage | None
    concepts: tuple[ConceptScore, ...]
    misconception_ids: tuple[str, ...]


def stage_for(score: float) -> Stage:
    if score < 0.5:
        return "아직 이해 못 함"
    if score < 0.8:
        return "기본 이해"
    return "깊이 이해"


def score_item(item: ItemInput) -> ItemScore:
    normal = item.normal
    if normal is None:
        return _item_score(item, None, None, False, False)
    if not normal.passed:
        if item.hard is not None:
            raise ValueError("Failed normal question cannot include a hard result")
        return _item_score(item, normal.score * 0.5, "아직 이해 못 함", False, False)
    hard = item.hard
    if hard is None:
        raise ValueError("Passed normal question requires a hard result")
    if hard == "not_attempted":
        return _item_score(item, 0.5, "기본 이해", True, False)
    if hard == "no_question":
        return _item_score(item, 0.5, "기본 이해", False, True)
    if hard.passed:
        return _item_score(item, 1.0, "깊이 이해", False, False)
    return _item_score(item, 0.5 + hard.score * 0.5, "기본 이해", False, False)


def score_unit(items: list[ItemInput], concept_ids: list[str]) -> UnitScore:
    # Same order as question selection: standard code, then concept number.
    ordered = sorted(concept_ids, key=_concept_order)
    grouped: dict[str, list[ItemInput]] = {concept_id: [] for concept_id in ordered}
    for item in items:
        bucket = grouped.get(item.concept_id)
        if bucket is None:
            raise ValueError("Item concept is not in the unit")
        bucket.append(item)
    concepts = tuple(
        _score_concept(concept_id, grouped[concept_id]) for concept_id in ordered
    )
    measured: list[float] = []
    misconceptions: set[str] = set()
    for concept in concepts:
        misconceptions.update(concept.misconception_ids)
        if concept.score is not None:
            measured.append(concept.score)
    if not measured:
        return UnitScore(None, None, concepts, tuple(sorted(misconceptions)))
    unit_score = _mean(measured)
    return UnitScore(
        unit_score, stage_for(unit_score), concepts, tuple(sorted(misconceptions))
    )


def _item_score(
    item: ItemInput,
    score: float | None,
    stage: Stage | None,
    deep_not_attempted: bool,
    deep_not_measured: bool,
) -> ItemScore:
    return ItemScore(
        item.assessment_item_id,
        item.concept_id,
        score,
        stage,
        deep_not_attempted,
        deep_not_measured,
    )


def _score_concept(concept_id: str, items: list[ItemInput]) -> ConceptScore:
    scored = [
        score_item(item)
        for item in sorted(items, key=lambda item: item.assessment_item_id)
    ]
    measured: list[float] = []
    for item in scored:
        if item.score is not None:
            measured.append(item.score)
    score: float | None
    stage: Stage | None
    if measured:
        measured_score = _mean(measured)
        score = measured_score
        stage = stage_for(measured_score)
        not_measured = False
    else:
        score = None
        stage = None
        not_measured = True
    return ConceptScore(
        concept_id,
        score,
        stage,
        not_measured,
        any(item.deep_not_attempted for item in scored),
        any(item.deep_not_measured for item in scored),
        _misconceptions(items),
    )


def _misconceptions(items: list[ItemInput]) -> tuple[str, ...]:
    found: set[str] = set()
    for item in items:
        if item.normal is not None:
            found.update(item.normal.misconception_ids)
        if isinstance(item.hard, QuestionResult):
            found.update(item.hard.misconception_ids)
    return tuple(sorted(found))


def _mean(values: list[float]) -> float:
    total = 0.0
    for value in values:
        total += value
    return total / len(values)


def _concept_order(concept_id: str) -> tuple[str, int]:
    standard, number = concept_id.rsplit("-C", 1)
    return standard, int(number)
