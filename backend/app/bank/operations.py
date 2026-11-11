from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import cast

from app.ai import prompts
from app.ai.compare import FakeProvider, Recorder, load_fixture
from app.ai.providers.base import StructuredProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.schemas import ConceptData, Question, load_concept
from app.ai.tasks import BudgetExceeded, generate_question
from app.bank.repository import BankRepository, Row

Slot = tuple[str, str, int]
# docs/DESIGN.md "AI 제공사·모델": 생성 실측 $0.0068. 검사도 동일 단가로 가정.
ESTIMATED_CALL_USD = Decimal("0.0068")


def slot(row: Row) -> Slot:
    return (
        str(row["assessment_item_id"]),
        str(row["difficulty"]),
        int(str(row["variant"])),
    )


def available_slots(
    concept: ConceptData,
    questions: list[Row],
    backlog: list[Row],
    difficulty: str | None,
    item_id: str | None,
    retry: bool,
) -> list[Slot]:
    items = [
        i.id for i in concept.assessment_items if item_id is None or i.id == item_id
    ]
    if not items:
        raise ValueError("평가 항목이 없습니다")
    occupied = {slot(q) for q in questions if q["status"] != "disabled"}
    blocked = {slot(b) for b in backlog if b.get("resolved_at") is None}
    return [
        (i, d, v)
        for i in items
        for d in ([difficulty] if difficulty else ["normal", "hard"])
        for v in range(1, concept.variants + 1)
        if (i, d, v) not in occupied and (retry or (i, d, v) not in blocked)
    ]


def question_payload(
    question: Question, variant: int, model: str, attempts: list[Row]
) -> Row:
    data = question.model_dump()
    standard = question.assessment_item_id.split("-C", 1)[0]
    for choice in data["choices"]:
        if choice["misconception_id"]:
            choice["misconception_id"] = f"{standard}-{choice['misconception_id']}"
    for element in data["rubric"]:
        element["related_misconception_ids"] = [
            f"{standard}-{m}" for m in element["related_misconception_ids"]
        ]
    data["question_type"] = data.pop("type")
    data.update(
        variant=variant,
        model=model,
        prompt_version=prompts.PROMPT_VERSION,
        generated_at=datetime.now(UTC).isoformat(),
        validation=attempts,
        retry_count=max(0, len(attempts) - 1),
    )
    return cast(Row, data)


def restore_question(
    row: Row,
    choices: list[Row],
    rubric: list[Row],
    links: list[Row],
    concept: ConceptData,
) -> Question:
    standard = concept.standard_code + "-"
    item = next(
        i for i in concept.assessment_items if i.id == row["assessment_item_id"]
    )

    def local(value: object) -> str:
        identifier = str(value)
        if not identifier.startswith(standard):
            raise ValueError("오개념 성취기준 불일치")
        return identifier.removeprefix(standard)

    restored_choices = [
        {
            **c,
            "misconception_id": local(c["misconception_id"])
            if c.get("misconception_id")
            else None,
        }
        for c in choices
        if c["question_id"] == row["id"]
    ]
    restored_rubric = [
        {
            **r,
            "related_misconception_ids": [
                local(link["misconception_id"])
                for link in links
                if link["rubric_element_id"] == r["id"]
            ],
        }
        for r in rubric
        if r["question_id"] == row["id"]
    ]
    return Question.model_validate(
        {
            **row,
            "concept_id": item.concept_id,
            "level": item.level,
            "type": row["question_type"],
            "choices": restored_choices,
            "rubric": restored_rubric,
        }
    )


def generate(
    repo: BankRepository,
    standard: str,
    difficulty: str | None,
    item_id: str | None,
    retry: bool,
    fake: bool,
    max_cost: Decimal,
    dry_run: bool,
    out: Path | None = None,
    provider: StructuredProvider | None = None,
) -> tuple[int, int, Decimal]:
    concept = load_concept(standard)
    questions = repo.select("questions")
    backlog = repo.select("generation_backlog")
    slots = available_slots(concept, questions, backlog, difficulty, item_id, retry)
    if dry_run:
        for i, d, v in slots:
            print(f"{i} {d} {v}")
        estimate = len(slots) * 3 * 2 * ESTIMATED_CALL_USD
        print(f"빈 자리 {len(slots)}개, 최대 추정 비용 ${estimate}")
        return 0, 0, Decimal(0)
    if max_cost <= 0:
        raise ValueError("비용 한도는 양수여야 합니다")
    if out is None:
        out = (
            Path(__file__).resolve().parents[3]
            / "experiments"
            / "question-bank"
            / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        )
    out.mkdir(parents=True, exist_ok=True)
    recorder = Recorder(out / "calls.jsonl", max_cost, fake)
    actual_provider = provider or (
        FakeProvider("gpt-6.1-terra", load_fixture()) if fake else OpenAIProvider()
    )
    model = str(getattr(actual_provider, "model", "unknown"))
    filled = failed = 0
    try:
        for i, d, v in slots:
            avoid = [
                str(q["body"])
                for q in questions
                if q["assessment_item_id"] == i
                and q["difficulty"] == d
                and q["status"] != "disabled"
            ]
            outcome = generate_question(
                actual_provider, concept, i, d, hooks=recorder, avoid_bodies=avoid
            )
            attempts = [cast(Row, asdict(a)) for a in outcome.attempts]
            if outcome.question is None:
                repo.insert(
                    "generation_backlog",
                    {
                        "assessment_item_id": i,
                        "difficulty": d,
                        "variant": v,
                        "attempts": attempts,
                        "model": model,
                        "prompt_version": prompts.PROMPT_VERSION,
                    },
                )
                failed += 1
                continue
            payload = question_payload(outcome.question, v, model, attempts)
            repo.insert_question(payload)
            questions.append({**payload, "status": "validated"})
            filled += 1
            for b in backlog:
                if slot(b) == (i, d, v) and b.get("resolved_at") is None:
                    repo.update(
                        "generation_backlog",
                        {"resolved_at": datetime.now(UTC).isoformat()},
                        {"id": b["id"]},
                    )
    except BudgetExceeded:
        print("비용 한도 도달: 생성 중단")
    print(
        f"생성 {filled}개, 백로그 {failed}개, 비용 ${recorder.total}, "
        f"호출 기록 {out / 'calls.jsonl'}"
    )
    return filled, failed, recorder.total


def change_status(
    repo: BankRepository, ids: list[str], target: str, approver: str = ""
) -> list[str]:
    if target == "approved" and not approver.strip():
        raise ValueError("승인자 이름이 필요합니다")
    questions = {str(q["id"]): q for q in repo.select("questions")}
    results = []
    for identifier in ids:
        current = questions.get(identifier)
        allowed = ("validated",) if target == "approved" else ("validated", "approved")
        if current is None or current["status"] not in allowed:
            results.append(f"{identifier}: 상태 변경 거부")
            continue
        now = datetime.now(UTC).isoformat()
        updates: Row = {"status": target}
        if target == "approved":
            updates.update(approved_by=approver.strip(), approved_at=now)
        else:
            updates["disabled_at"] = now
        changed = repo.update(
            "questions", updates, {"id": identifier, "status": current["status"]}
        )
        results.append(
            f"{identifier}: {target}" if changed else f"{identifier}: 상태 변경 충돌"
        )
    return results
