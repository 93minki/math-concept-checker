import json
from pathlib import Path
from typing import cast

import pytest
from test_bank import MemoryBank

from app.bank.repository import Row
from app.bank.transfer import export_bank, import_bank


class TransferBank(MemoryBank):
    def import_question(self, payload: Row) -> None:
        question = {k: v for k, v in payload.items() if k not in ("choices", "rubric")}
        self.tables.setdefault("questions", []).append(question)
        for row in cast(list[Row], payload["choices"]):
            self.tables.setdefault("question_choices", []).append(
                {**row, "question_id": question["id"]}
            )
        for row in cast(list[Row], payload["rubric"]):
            element_id = len(self.tables.setdefault("rubric_elements", [])) + 1
            self.tables["rubric_elements"].append(
                {
                    **{
                        k: v for k, v in row.items() if k != "related_misconception_ids"
                    },
                    "id": element_id,
                    "question_id": question["id"],
                }
            )
            for mid in cast(list[str], row["related_misconception_ids"]):
                self.tables.setdefault("rubric_element_misconceptions", []).append(
                    {"rubric_element_id": element_id, "misconception_id": mid}
                )
        self.writes += 1


def source() -> TransferBank:
    repo = TransferBank()
    repo.tables = {
        "concepts": [{"id": "c", "standard_code": "9수02-03"}],
        "assessment_items": [{"id": "a", "concept_id": "c"}],
        "questions": [
            {
                "id": "q2",
                "assessment_item_id": "a",
                "difficulty": "normal",
                "variant": 2,
                "status": "approved",
                "body": "둘",
            },
            {
                "id": "q1",
                "assessment_item_id": "a",
                "difficulty": "normal",
                "variant": 1,
                "status": "validated",
                "body": "하나",
            },
        ],
        "question_choices": [
            {"question_id": "q1", "no": 2, "text": "둘"},
            {"question_id": "q1", "no": 1, "text": "하나"},
        ],
        "rubric_elements": [
            {
                "id": 72,
                "question_id": "q2",
                "no": 1,
                "description": "풀이",
                "points": 1,
                "required": True,
            }
        ],
        "rubric_element_misconceptions": [
            {"rubric_element_id": 72, "misconception_id": "9수02-03-M1"}
        ],
        "generation_backlog": [
            {
                "id": 10,
                "assessment_item_id": "a",
                "difficulty": "hard",
                "variant": 1,
                "created_at": "2026-01-01T00:00:00+00:00",
                "attempts": [],
            }
        ],
    }
    return repo


def test_export_and_import_are_deterministic_and_idempotent(tmp_path: Path) -> None:
    path = tmp_path / "bank.json"
    other = tmp_path / "again.json"
    repo = source()
    export_bank(repo, path, "9수02-03")
    export_bank(repo, other, "9수02-03")
    assert path.read_bytes() == other.read_bytes()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert [q["id"] for q in data["questions"]] == ["q1", "q2"]
    assert [c["no"] for c in data["questions"][0]["choices"]] == [1, 2]
    assert "id" not in data["questions"][1]["rubric"][0]
    assert data["questions"][1]["rubric"][0]["related_misconception_ids"] == [
        "9수02-03-M1"
    ]
    assert "id" not in data["backlog"][0]
    target = TransferBank()
    assert import_bank(target, path) == (3, 0)
    assert import_bank(target, path) == (0, 3)
    export_bank(target, other)
    assert path.read_bytes() == other.read_bytes()


def test_conflict_prevents_all_writes(tmp_path: Path) -> None:
    path = tmp_path / "bank.json"
    export_bank(source(), path)
    target = TransferBank()
    target.tables["questions"] = [
        {
            "id": "q2",
            "assessment_item_id": "a",
            "difficulty": "normal",
            "variant": 2,
            "status": "approved",
            "body": "다름",
        }
    ]
    with pytest.raises(ValueError, match="충돌"):
        import_bank(target, path)
    assert target.writes == 0


def test_import_disables_existing_before_inserting(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    target = source()
    incoming = source()
    old = incoming.tables["questions"][0]
    old.update(status="disabled", disabled_at="2026-11-11T00:00:00+00:00")
    incoming.tables["questions"].append(
        {**old, "id": "q3", "status": "approved", "disabled_at": None}
    )
    target.tables["questions"][0]["disabled_at"] = None
    path = tmp_path / "bank.json"
    export_bank(incoming, path)
    events: list[str] = []
    update = target.update
    insert = target.import_question

    def track_update(table: str, row: Row, filters: Row) -> list[Row]:
        assert row == {"status": "disabled", "disabled_at": old["disabled_at"]}
        events.append("disable")
        return update(table, row, filters)

    def track_insert(payload: Row) -> None:
        events.append("insert")
        insert(payload)

    monkeypatch.setattr(target, "update", track_update)
    monkeypatch.setattr(target, "import_question", track_insert)
    assert import_bank(target, path) == (1, 2)
    assert events == ["disable", "insert"]
    assert target.tables["questions"][0]["status"] == "disabled"
    assert "사용 중지 반영 1개" in capsys.readouterr().out
    assert import_bank(target, path) == (0, 4)
    assert "사용 중지 반영 0개" in capsys.readouterr().out


@pytest.mark.parametrize("difference", ["reverse", "content"])
def test_import_rejects_other_changes_before_writes(
    tmp_path: Path, difference: str
) -> None:
    target = source()
    incoming = source()
    incoming.tables["questions"][0].update(
        status="disabled", disabled_at="2026-11-11T00:00:00+00:00"
    )
    target.tables["questions"][0]["disabled_at"] = None
    if difference == "reverse":
        target, incoming = incoming, target
    else:
        incoming.tables["questions"][0]["body"] = "변경된 내용"
    path = tmp_path / "bank.json"
    export_bank(incoming, path)
    with pytest.raises(ValueError, match="충돌"):
        import_bank(target, path)
    assert target.writes == 0


def test_later_conflict_prevents_pending_disable(tmp_path: Path) -> None:
    target = source()
    incoming = source()
    # q1 sorts before q2, so a later q2 conflict must cancel the planned update.
    target.tables["questions"][1].update(status="approved", disabled_at=None)
    incoming.tables["questions"][1].update(
        status="disabled", disabled_at="2026-11-11T00:00:00+00:00"
    )
    incoming.tables["questions"][0]["body"] = "변경된 내용"
    path = tmp_path / "bank.json"
    export_bank(incoming, path)
    with pytest.raises(ValueError, match="충돌"):
        import_bank(target, path)
    assert target.writes == 0


def test_figures_roundtrip_and_legacy_import(tmp_path: Path) -> None:
    repo = source()
    figure = {"kind": "boxplot", "series": []}
    repo.tables["questions"][1]["figure"] = figure
    repo.tables["question_choices"][0]["figure"] = figure
    path = tmp_path / "figures.json"
    export_bank(repo, path)
    target = TransferBank()
    import_bank(target, path)
    restored = tmp_path / "restored.json"
    export_bank(target, restored)
    assert path.read_bytes() == restored.read_bytes()
    data = json.loads(path.read_text(encoding="utf-8"))
    for row in data["questions"]:
        row.pop("figure", None)
        for choice in row["choices"]:
            choice.pop("figure", None)
    path.write_text(json.dumps(data), encoding="utf-8")
    legacy = TransferBank()
    import_bank(legacy, path)
    assert all(row["figure"] is None for row in legacy.tables["questions"])


def test_existing_bank_files_import() -> None:
    directory = Path(__file__).resolve().parents[1] / "data" / "bank"
    paths = list(directory.glob("*.json"))
    assert paths
    for path in paths:
        repo = TransferBank()
        import_bank(repo, path)
        assert import_bank(repo, path)[0] == 0
