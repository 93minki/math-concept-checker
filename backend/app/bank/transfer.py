import json
from pathlib import Path

from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.bank.repository import BankRepository, Row


class BankFile(BaseModel):
    questions: list[Row]
    backlog: list[Row]


def snapshot(repo: BankRepository, standard: str | None = None) -> BankFile:
    questions = repo.select("questions")
    backlog = repo.select("generation_backlog")
    if standard is not None:
        concept_ids = {
            row["id"]
            for row in repo.select("concepts")
            if row["standard_code"] == standard
        }
        item_ids = {
            row["id"]
            for row in repo.select("assessment_items")
            if row["concept_id"] in concept_ids
        }
        questions = [row for row in questions if row["assessment_item_id"] in item_ids]
        backlog = [row for row in backlog if row["assessment_item_id"] in item_ids]
    choices = repo.select("question_choices")
    rubric = repo.select("rubric_elements")
    links = repo.select("rubric_element_misconceptions")
    exported = []
    for question in questions:
        question_choices = [
            {k: v for k, v in choice.items() if k not in ("id", "question_id")}
            for choice in choices
            if choice["question_id"] == question["id"]
        ]
        elements = []
        for element in rubric:
            if element["question_id"] != question["id"]:
                continue
            related = sorted(
                str(link["misconception_id"])
                for link in links
                if link["rubric_element_id"] == element["id"]
            )
            elements.append(
                {
                    **{
                        k: v
                        for k, v in element.items()
                        if k not in ("id", "question_id")
                    },
                    "related_misconception_ids": related,
                }
            )
        exported.append(
            {
                **question,
                "choices": sorted(
                    question_choices, key=lambda row: int(str(row["no"]))
                ),
                "rubric": sorted(elements, key=lambda row: int(str(row["no"]))),
            }
        )
    exported.sort(
        key=lambda row: (
            str(row["assessment_item_id"]),
            str(row["difficulty"]),
            int(str(row["variant"])),
            str(row["id"]),
        )
    )
    backlog = [{k: v for k, v in row.items() if k != "id"} for row in backlog]
    backlog.sort(
        key=lambda row: (
            str(row["assessment_item_id"]),
            str(row["difficulty"]),
            int(str(row["variant"])),
            str(row["created_at"]),
            json.dumps(row, sort_keys=True, ensure_ascii=False),
        )
    )
    return BankFile(questions=exported, backlog=backlog)


def export_bank(repo: BankRepository, path: Path, standard: str | None = None) -> None:
    data = snapshot(repo, standard)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data.model_dump(), ensure_ascii=False, sort_keys=True, indent=2)
        + "\n",
        encoding="utf-8",
    )


def backlog_key(row: Row) -> tuple[object, ...]:
    return tuple(
        row[key]
        for key in ("assessment_item_id", "difficulty", "variant", "created_at")
    )


def import_bank(repo: BankRepository, path: Path) -> tuple[int, int]:
    data = BankFile.model_validate_json(path.read_text(encoding="utf-8"))
    current = snapshot(repo)
    existing = {str(row["id"]): row for row in current.questions}
    seen: dict[str, Row] = {}
    pending = []
    to_disable = []
    skipped = 0
    for row in data.questions:
        identifier = str(row["id"])
        previous = seen.get(identifier, existing.get(identifier))
        if previous is not None:
            if previous != row:
                if (
                    identifier not in seen
                    and previous.get("status") == "approved"
                    and row.get("status") == "disabled"
                    and isinstance(row.get("disabled_at"), str)
                    and bool(row["disabled_at"])
                    and {
                        k: v
                        for k, v in previous.items()
                        if k not in ("status", "disabled_at")
                    }
                    == {
                        k: v
                        for k, v in row.items()
                        if k not in ("status", "disabled_at")
                    }
                ):
                    to_disable.append(row)
                else:
                    raise ValueError(f"문제 내용 충돌: {identifier}")
            else:
                skipped += 1
        else:
            pending.append(row)
        seen[identifier] = row
    backlog_keys = {backlog_key(row) for row in current.backlog}
    pending_backlog = []
    for row in data.backlog:
        key = backlog_key(row)
        if key in backlog_keys:
            skipped += 1
        else:
            backlog_keys.add(key)
            pending_backlog.append(row)
    # Disabled rows must precede live rows because insertion starts as validated.
    pending.sort(key=lambda row: row["status"] != "disabled")
    try:
        for row in to_disable:
            changed = repo.update(
                "questions",
                {"status": "disabled", "disabled_at": row["disabled_at"]},
                {"id": row["id"], "status": "approved"},
            )
            if not changed:
                raise ValueError(f"문제 상태 변경 충돌: {row['id']}")
        for row in pending:
            repo.import_question(row)
        for row in pending_backlog:
            repo.insert("generation_backlog", row)
    except APIError as exc:
        if exc.code == "23503":
            raise ValueError(
                "교육과정 데이터가 없습니다. 먼저 load-curriculum을 실행하세요"
            ) from exc
        raise
    inserted = len(pending) + len(pending_backlog)
    print(f"추가 {inserted}개, 건너뜀 {skipped}개, 사용 중지 반영 {len(to_disable)}개")
    return inserted, skipped
