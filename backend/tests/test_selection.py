import ast
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from app.diagnoses.schemas import Assessment, Concept, Question
from app.diagnoses.selection import select_questions


def test_selection() -> None:
    q1, q2, q3 = uuid4(), uuid4(), uuid4()
    concepts = [
        Concept(id="S-C10", standard_code="S"),
        Concept(id="S-C2", standard_code="S"),
    ]
    items = [
        Assessment(
            id="a",
            concept_id="S-C10",
            level="정의 이해",
            question_type="multiple_choice",
        ),
        Assessment(
            id="b",
            concept_id="S-C2",
            level="정의 이해",
            question_type="multiple_choice",
        ),
        Assessment(
            id="c", concept_id="S-C2", level="성질 적용", question_type="written"
        ),
    ]
    questions = [
        Question(
            id=q,
            assessment_item_id=a,
            variant=v,
            question_type="multiple_choice",
            body="문제",
            difficulty="normal",
            status="approved",
        )
        for q, a, v in [(q1, "a", 1), (q2, "b", 1), (q3, "b", 2)]
    ]
    now = datetime.now(UTC)
    assert select_questions(
        ["S"], concepts, items, questions, {q2: now}, random.Random(1)
    ) == ("partial", [q3, q1])
    assert select_questions(
        ["S"],
        concepts,
        items[:2],
        questions,
        {q1: now, q2: now, q3: now - timedelta(days=1)},
        random.Random(1),
    ) == ("full", [q3, q1])
    assert (
        select_questions(
            ["S", "T"], concepts, items[:2], questions, {}, random.Random(1)
        )[0]
        == "partial"
    )
    assert select_questions(["S"], concepts, items, [], {}, random.Random(1)) == (
        "unavailable",
        [],
    )


def test_no_ai_import() -> None:
    for path in [Path("app/diagnoses/selection.py")]:
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith("app.ai")
            if isinstance(node, ast.Import):
                assert all(not alias.name.startswith("app.ai") for alias in node.names)
