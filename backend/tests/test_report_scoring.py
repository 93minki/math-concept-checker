import pytest

from app.diagnoses.scoring import (
    ConceptScore,
    HardState,
    ItemInput,
    ItemScore,
    QuestionResult,
    score_item,
    score_unit,
    stage_for,
)


def test_score_item_cases() -> None:
    concept = "9수02-03-C1"
    assert score_item(ItemInput("a", concept, None, None)) == ItemScore(
        "a", concept, None, None, False, False
    )
    assert score_item(
        ItemInput("a", concept, QuestionResult(0.0, False), None)
    ) == ItemScore("a", concept, 0.0, "아직 이해 못 함", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(1.0, False), None)
    ) == ItemScore("a", concept, 0.5, "아직 이해 못 함", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(0.5, False), None)
    ) == ItemScore("a", concept, 0.25, "아직 이해 못 함", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(1.0, True), QuestionResult(0.0, False))
    ) == ItemScore("a", concept, 0.5, "기본 이해", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(0.5, True), QuestionResult(0.75, False))
    ) == ItemScore("a", concept, 0.875, "기본 이해", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(0.5, True), QuestionResult(0.25, True))
    ) == ItemScore("a", concept, 1.0, "깊이 이해", False, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(1.0, True), "not_attempted")
    ) == ItemScore("a", concept, 0.5, "기본 이해", True, False)
    assert score_item(
        ItemInput("a", concept, QuestionResult(1.0, True), "no_question")
    ) == ItemScore("a", concept, 0.5, "기본 이해", False, True)


def test_score_item_rejects_inconsistent_hard() -> None:
    concept = "9수02-03-C1"
    with pytest.raises(ValueError):
        score_item(ItemInput("a", concept, QuestionResult(1.0, True), None))
    hard_results: tuple[QuestionResult | HardState, ...] = (
        QuestionResult(1.0, True),
        "not_attempted",
        "no_question",
    )
    for hard in hard_results:
        with pytest.raises(ValueError):
            score_item(ItemInput("a", concept, QuestionResult(0.0, False), hard))


def test_stage_for_boundaries() -> None:
    assert stage_for(0.0) == "아직 이해 못 함"
    assert stage_for(0.4999) == "아직 이해 못 함"
    assert stage_for(0.5) == "기본 이해"
    assert stage_for(0.7999) == "기본 이해"
    assert stage_for(0.8) == "깊이 이해"
    assert stage_for(1.0) == "깊이 이해"


def test_concept_and_unit_averages() -> None:
    c2, c3, c4, c10 = (
        "9수02-03-C2",
        "9수02-03-C3",
        "9수02-03-C4",
        "9수02-03-C10",
    )
    result = score_unit(
        [
            ItemInput("b", c2, QuestionResult(0.0, False), None),
            ItemInput("c", c2, None, None),
            ItemInput("a", c2, QuestionResult(1.0, True), QuestionResult(1.0, True)),
            ItemInput("d", c4, None, None),
            ItemInput("e", c10, QuestionResult(1.0, True), QuestionResult(0.0, True)),
        ],
        [c10, c3, c2, c4],
    )
    assert [concept.concept_id for concept in result.concepts] == [c2, c3, c4, c10]
    assert result.concepts[0] == ConceptScore(
        c2, 0.5, "기본 이해", False, False, False, ()
    )
    assert result.concepts[1] == ConceptScore(c3, None, None, True, False, False, ())
    assert result.concepts[2] == ConceptScore(c4, None, None, True, False, False, ())
    assert result.concepts[3] == ConceptScore(
        c10, 1.0, "깊이 이해", False, False, False, ()
    )
    assert result.score == 0.75
    assert result.stage == "기본 이해"


def test_unit_score_is_none_when_nothing_is_measured() -> None:
    c1, c2 = "9수02-03-C1", "9수02-03-C2"
    result = score_unit([ItemInput("a", c1, None, None)], [c2, c1])
    assert result.score is None
    assert result.stage is None
    assert result.misconception_ids == ()
    assert [concept.concept_id for concept in result.concepts] == [c1, c2]
    assert all(
        concept.not_measured and concept.score is None and concept.stage is None
        for concept in result.concepts
    )


def test_deep_flags_roll_up() -> None:
    concept = "9수02-03-C1"
    result = score_unit(
        [
            ItemInput("b", concept, QuestionResult(1.0, True), "no_question"),
            ItemInput("a", concept, QuestionResult(1.0, True), "not_attempted"),
            ItemInput(
                "c", concept, QuestionResult(1.0, True), QuestionResult(1.0, True)
            ),
        ],
        [concept],
    )
    scored = result.concepts[0]
    assert scored.deep_not_attempted is True
    assert scored.deep_not_measured is True
    assert scored.not_measured is False
    assert scored.score == (0.5 + 0.5 + 1.0) / 3


def test_misconceptions_are_unique_and_sorted() -> None:
    c2, c10 = "9수02-03-C2", "9수02-03-C10"
    result = score_unit(
        [
            ItemInput("b", c2, QuestionResult(0.0, False, ("M2", "M1")), None),
            ItemInput(
                "a",
                c2,
                QuestionResult(1.0, True, ("M2",)),
                QuestionResult(0.0, False, ("M1", "M10")),
            ),
            ItemInput("c", c10, QuestionResult(1.0, True, ("M3", "M1")), "no_question"),
            ItemInput("d", c10, None, None),
        ],
        [c10, c2],
    )
    by_id = {concept.concept_id: concept for concept in result.concepts}
    assert by_id[c2].misconception_ids == ("M1", "M10", "M2")
    assert by_id[c10].misconception_ids == ("M1", "M3")
    assert result.misconception_ids == ("M1", "M10", "M2", "M3")


def test_concepts_sort_c2_before_c10() -> None:
    c2, c10 = "9수02-03-C2", "9수02-03-C10"
    result = score_unit([], [c10, c2])
    assert [concept.concept_id for concept in result.concepts] == [c2, c10]


def test_concepts_sort_by_standard_then_number() -> None:
    ids = ["9수02-03-C1", "9수02-01-C2", "9수02-03-C10", "9수02-01-C1"]
    result = score_unit([], ids)
    assert [concept.concept_id for concept in result.concepts] == [
        "9수02-01-C1",
        "9수02-01-C2",
        "9수02-03-C1",
        "9수02-03-C10",
    ]


def test_score_unit_is_deterministic() -> None:
    c2, c10 = "9수02-03-C2", "9수02-03-C10"
    items = [
        ItemInput("b", c2, QuestionResult(0.5, False, ("M2",)), None),
        ItemInput(
            "a",
            c2,
            QuestionResult(1.0, True, ("M1",)),
            QuestionResult(0.5, False, ("M2",)),
        ),
        ItemInput("c", c10, QuestionResult(1.0, True), "not_attempted"),
    ]
    concepts = [c10, c2]
    first = score_unit(items, concepts)
    assert score_unit(list(items), concepts) == first
    assert score_unit([items[2], items[0], items[1]], concepts) == first
    assert score_unit(list(reversed(items)), concepts) == first


def test_score_unit_rejects_concept_outside_unit() -> None:
    with pytest.raises(ValueError):
        score_unit(
            [ItemInput("a", "9수02-03-C9", None, None)],
            ["9수02-03-C1"],
        )
