from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import cast

import pytest

from app.ai.schemas import load_concept
from app.bank.curriculum import load_curriculum, read_data, validate_data
from app.bank.operations import available_slots, change_status, generate
from app.bank.repository import Row
from app.bank.review import render_review


class MemoryBank:
    def __init__(self) -> None:
        self.tables: dict[str, list[Row]] = {}
        self.writes = 0

    def select(self, table: str) -> list[Row]:
        return [dict(row) for row in self.tables.get(table, [])]

    def upsert(self, table: str, rows: list[Row], conflict: str) -> None:
        for row in rows:
            keys = conflict.split(",")
            found = next(
                (
                    r
                    for r in self.tables.setdefault(table, [])
                    if all(r[k] == row[k] for k in keys)
                ),
                None,
            )
            if found is None:
                found = dict(row)
                if table == "display_units":
                    found["id"] = len(self.tables[table]) + 1
                self.tables[table].append(found)
            else:
                found.update(row)
            self.writes += 1

    def insert(self, table: str, row: Row) -> None:
        self.tables.setdefault(table, []).append(
            {**row, "id": len(self.tables.get(table, [])) + 1}
        )
        self.writes += 1

    def update(self, table: str, row: Row, filters: Row) -> list[Row]:
        changed = []
        for existing in self.tables.get(table, []):
            if all(existing.get(k) == v for k, v in filters.items()):
                existing.update(row)
                changed.append(existing)
                self.writes += 1
        return changed

    def insert_question(self, payload: Row) -> None:
        self.insert("questions", {**payload, "status": "validated"})


def test_curriculum_data_and_idempotent_load() -> None:
    standards, units, concepts = read_data()
    assert len(standards) == 60 and len(units) == 23
    assert Counter(str(s["code"])[2:4] for s in standards) == {
        "01": 10,
        "02": 22,
        "03": 19,
        "04": 9,
    }
    assert (
        next(s["text"] for s in standards if s["code"] == "9수02-03")
        == concepts[0].standard_text
    )
    repo = MemoryBank()
    load_curriculum(repo)
    counts = {k: len(v) for k, v in repo.tables.items()}
    load_curriculum(repo)
    assert counts == {k: len(v) for k, v in repo.tables.items()}
    assert repo.tables["misconceptions"][0]["id"] == "9수02-03-M1"
    assert repo.tables["misconception_concepts"][0]["misconception_id"] == "9수02-03-M1"


def test_invalid_data_prevents_writes(monkeypatch: pytest.MonkeyPatch) -> None:
    standards, units, concepts = read_data()
    with pytest.raises(ValueError):
        validate_data(standards[:-1], units, concepts)

    def invalid() -> None:
        raise ValueError("invalid")

    monkeypatch.setattr("app.bank.curriculum.read_data", invalid)
    repo = MemoryBank()
    with pytest.raises(ValueError):
        load_curriculum(repo)
    assert repo.writes == 0


def test_slots_and_dry_run(tmp_path: Path) -> None:
    concept = load_concept("9수02-03")
    item = concept.assessment_items[0].id
    question = {
        "assessment_item_id": item,
        "difficulty": "normal",
        "variant": 1,
        "status": "approved",
        "body": "old",
    }
    pending = {
        "assessment_item_id": item,
        "difficulty": "normal",
        "variant": 2,
        "resolved_at": None,
    }
    assert available_slots(concept, [question], [pending], "normal", item, False) == [
        (item, "normal", 3)
    ]
    assert (
        len(available_slots(concept, [question], [pending], "normal", item, True)) == 2
    )
    repo = MemoryBank()
    repo.tables = {"questions": [question], "generation_backlog": [pending]}
    generate(repo, "9수02-03", "normal", item, False, True, Decimal(1), True, tmp_path)
    assert repo.writes == 0


def test_fake_generation_retries_backlog(tmp_path: Path) -> None:
    repo = MemoryBank()
    item = load_concept("9수02-03").assessment_items[0].id
    repo.insert(
        "generation_backlog",
        {
            "assessment_item_id": item,
            "difficulty": "normal",
            "variant": 1,
            "resolved_at": None,
        },
    )
    filled, failed, _ = generate(
        repo, "9수02-03", "normal", item, True, True, Decimal(10), False, tmp_path
    )
    assert (filled, failed) == (3, 0)
    assert repo.tables["generation_backlog"][0]["resolved_at"] is not None
    choices = cast(list[Row], repo.tables["questions"][0]["choices"])
    assert any(
        c["misconception_id"] == "9수02-03-M1" for c in choices if c["misconception_id"]
    )


def test_approval_and_html() -> None:
    repo = MemoryBank()
    repo.tables["questions"] = [
        {"id": "a", "status": "validated"},
        {"id": "b", "status": "disabled"},
    ]
    with pytest.raises(ValueError):
        change_status(repo, ["a"], "approved", "  ")
    assert "approved" in change_status(repo, ["a", "b"], "approved", "교사")[0]
    assert repo.tables["questions"][1]["status"] == "disabled"
    change_status(repo, ["a"], "disabled")
    assert repo.tables["questions"][0]["status"] == "disabled"
    q = {
        "id": "a",
        "assessment_item_id": "x",
        "difficulty": "normal",
        "variant": 1,
        "status": "validated",
        "body": "$x$ <script>alert(1)</script>",
        "explanation": "해설",
        "validation": [],
    }
    html = render_review([q], [], [], [], [], [])
    assert (
        "$x$" in html
        and "&lt;script&gt;" in html
        and "<script>alert(1)</script>" not in html
    )


def test_avoid_existing_bodies_and_restore(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from app.ai.providers.base import StructuredProvider
    from app.ai.schemas import ConceptData
    from app.ai.tasks import CallHooks, GenerationOutcome, generate_question
    from app.bank.operations import restore_question

    repo = MemoryBank()
    concept = load_concept("9수02-03")
    item = concept.assessment_items[0].id
    repo.tables["questions"] = [
        {
            "assessment_item_id": item,
            "difficulty": "normal",
            "variant": 1,
            "status": "validated",
            "body": "existing",
        }
    ]
    seen: list[list[str]] = []

    def wrapped(
        provider: StructuredProvider,
        data: ConceptData,
        item_id: str,
        difficulty: str,
        *,
        hooks: CallHooks,
        avoid_bodies: list[str],
    ) -> GenerationOutcome:
        seen.append(list(avoid_bodies))
        return generate_question(
            provider, data, item_id, difficulty, hooks=hooks, avoid_bodies=avoid_bodies
        )

    monkeypatch.setattr("app.bank.operations.generate_question", wrapped)
    generate(
        repo, "9수02-03", "normal", item, False, True, Decimal(10), False, tmp_path
    )
    assert seen[0] == ["existing"]
    assert len(seen[1]) == 2
    saved = repo.tables["questions"][1]
    choices = [
        {**choice, "question_id": saved["id"]}
        for choice in cast(list[Row], saved["choices"])
    ]
    restored = restore_question(saved, choices, [], [], concept)
    assert any(c.misconception_id == "M1" for c in restored.choices)


def test_failure_to_backlog_and_budget_stop(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from app.ai.tasks import Attempt, BudgetExceeded, GenerationOutcome

    repo = MemoryBank()
    item = load_concept("9수02-03").assessment_items[0].id

    def failed(*args: object, **kwargs: object) -> GenerationOutcome:
        return GenerationOutcome(
            item,
            "concept",
            "정의 이해",
            "normal",
            None,
            [Attempt(i, ["오류"]) for i in range(1, 4)],
        )

    monkeypatch.setattr("app.bank.operations.generate_question", failed)
    filled, failures, _ = generate(
        repo, "9수02-03", "normal", item, False, True, Decimal(10), False, tmp_path
    )
    assert filled == 0 and failures == 3
    assert (
        len(cast(list[object], repo.tables["generation_backlog"][0]["attempts"])) == 3
    )

    def exhausted(*args: object, **kwargs: object) -> GenerationOutcome:
        raise BudgetExceeded()

    monkeypatch.setattr("app.bank.operations.generate_question", exhausted)
    repo = MemoryBank()
    assert generate(
        repo, "9수02-03", "normal", item, False, True, Decimal(1), False, tmp_path
    )[:2] == (0, 0)
    assert repo.writes == 0


def test_review_html_orders_questions_and_choices() -> None:
    def question(identifier: str, difficulty: str, variant: int) -> Row:
        return {
            "id": identifier,
            "assessment_item_id": "9수02-03-C1-정의이해",
            "difficulty": difficulty,
            "variant": variant,
            "status": "validated",
            "body": f"본문-{identifier}",
            "explanation": "",
        }

    html = render_review(
        [
            question("q3", "hard", 1),
            question("q2", "normal", 2),
            question("q1", "normal", 1),
        ],
        [
            {"question_id": "q1", "no": 2, "text": "둘째", "is_correct": False},
            {"question_id": "q1", "no": 1, "text": "첫째", "is_correct": True},
        ],
        [],
        [],
        [],
        [],
    )
    assert html.index("본문-q1") < html.index("본문-q2") < html.index("본문-q3")
    assert html.index("첫째") < html.index("둘째")
