import random
from datetime import datetime
from uuid import UUID

from app.diagnoses.schemas import Assessment, Concept, QuestionSlot, UnitStatus

LEVELS = ["정의 이해", "성질 적용", "오개념 판별", "이유 설명"]


def select_questions(
    standards: list[str],
    concepts: list[Concept],
    assessments: list[Assessment],
    questions: list[QuestionSlot],
    history: dict[UUID, datetime],
    rng: random.Random,
) -> tuple[UnitStatus, list[UUID]]:
    relevant_concepts = {c.id: c for c in concepts if c.standard_code in standards}
    relevant = [a for a in assessments if a.concept_id in relevant_concepts]
    relevant.sort(
        key=lambda a: (
            relevant_concepts[a.concept_id].standard_code,
            int(a.concept_id.rsplit("-C", 1)[1]),
            LEVELS.index(a.level),
        )
    )
    partial = any(
        not any(relevant_concepts[a.concept_id].standard_code == s for a in relevant)
        for s in standards
    )
    selected: list[UUID] = []
    for assessment in relevant:
        candidates = [
            q
            for q in questions
            if q.assessment_item_id == assessment.id
            and q.status == "approved"
            and q.difficulty == "normal"
        ]
        if not candidates:
            partial = True
            continue
        unseen = [q for q in candidates if q.id not in history]
        chosen = (
            rng.choice(unseen)
            if unseen
            else min(candidates, key=lambda q: (history[q.id], q.variant))
        )
        selected.append(chosen.id)
    return (
        "unavailable" if not selected else "partial" if partial else "full"
    ), selected
