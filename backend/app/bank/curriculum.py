import json
import re
from collections import Counter
from pathlib import Path
from typing import cast

from app.ai.schemas import ConceptData
from app.bank.repository import BankRepository, Row

DATA = Path(__file__).resolve().parents[2] / "data"


def read_data() -> tuple[list[Row], list[Row], list[ConceptData]]:
    standards = cast(
        list[Row],
        json.loads((DATA / "curriculum/standards.json").read_text(encoding="utf-8"))[
            "standards"
        ],
    )
    units = cast(
        list[Row],
        json.loads(
            (DATA / "curriculum/display_units.json").read_text(encoding="utf-8")
        )["display_units"],
    )
    concepts = [
        ConceptData.model_validate_json(p.read_text(encoding="utf-8"))
        for p in sorted((DATA / "concepts").glob("*.json"))
    ]
    validate_data(standards, units, concepts)
    return standards, units, concepts


def validate_data(
    standards: list[Row], units: list[Row], concepts: list[ConceptData]
) -> None:
    codes = [str(s["code"]) for s in standards]
    if (
        len(codes) != 60
        or len(set(codes)) != 60
        or any(not re.fullmatch(r"9수\d{2}-\d{2}", c) for c in codes)
    ):
        raise ValueError("성취기준 코드와 개수가 잘못되었습니다")
    if Counter(c[2:4] for c in codes) != {"01": 10, "02": 22, "03": 19, "04": 9}:
        raise ValueError("영역별 성취기준 개수가 잘못되었습니다")
    if len(units) != 23 or len({(u["grade"], u["number"]) for u in units}) != 23:
        raise ValueError("표시 단원은 중복 없이 23개여야 합니다")
    links = [str(c) for u in units for c in cast(list[object], u["standards"])]
    if Counter(links) != Counter(codes):
        raise ValueError("모든 성취기준은 정확히 한 단원에 연결되어야 합니다")
    if any(c.standard_code not in codes for c in concepts):
        raise ValueError("개념 데이터에 없는 성취기준이 있습니다")


def curriculum_rows(
    standards: list[Row], units: list[Row], concepts: list[ConceptData]
) -> dict[str, list[Row]]:
    rows: dict[str, list[Row]] = {
        "standards": standards,
        "display_units": [
            {k: v for k, v in u.items() if k != "standards"} for u in units
        ],
        "concepts": [],
        "assessment_items": [],
        "misconceptions": [],
        "misconception_concepts": [],
    }
    for data in concepts:
        rows["concepts"].extend(
            {"id": c.id, "standard_code": data.standard_code, "name": c.name}
            for c in data.concepts
        )
        rows["assessment_items"].extend(
            {
                "id": i.id,
                "concept_id": i.concept_id,
                "level": i.level,
                "question_type": i.type,
                "basis": i.basis,
            }
            for i in data.assessment_items
        )
        for m in data.misconceptions:
            identifier = f"{data.standard_code}-{m.id}"
            rows["misconceptions"].append(
                {
                    "id": identifier,
                    "standard_code": data.standard_code,
                    "local_id": m.id,
                    "content": m.text,
                    "source": f"docs/concepts/{data.standard_code}.md",
                }
            )
            rows["misconception_concepts"].extend(
                {"misconception_id": identifier, "concept_id": c} for c in m.concept_ids
            )
    return rows


def load_curriculum(
    repo: BankRepository | None, dry_run: bool = False
) -> dict[str, int]:
    standards, units, concepts = read_data()
    rows = curriculum_rows(standards, units, concepts)
    counts = {name: len(values) for name, values in rows.items()}
    counts["display_unit_standards"] = sum(
        len(cast(list[object], u["standards"])) for u in units
    )
    if dry_run:
        return counts
    if repo is None:
        raise ValueError("저장소가 필요합니다")
    for table in ("concepts", "assessment_items", "misconceptions"):
        existing = {str(r["id"]) for r in repo.select(table)}
        wanted = {str(r["id"]) for r in rows[table]}
        for identifier in sorted(existing - wanted):
            print(f"경고: {table}의 {identifier}는 JSON에 없지만 삭제하지 않습니다")
    repo.upsert("standards", rows["standards"], "code")
    repo.upsert("display_units", rows["display_units"], "grade,number")
    db_units = repo.select("display_units")
    ids = {(u["grade"], u["number"]): u["id"] for u in db_units}
    links = [
        {"display_unit_id": ids[(u["grade"], u["number"])], "standard_code": code}
        for u in units
        for code in cast(list[object], u["standards"])
    ]
    repo.upsert("display_unit_standards", links, "standard_code")
    for table, conflict in [
        ("concepts", "id"),
        ("assessment_items", "id"),
        ("misconceptions", "id"),
        ("misconception_concepts", "misconception_id,concept_id"),
    ]:
        repo.upsert(table, rows[table], conflict)
    return counts
