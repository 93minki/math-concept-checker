import json
import re
import shutil
from pathlib import Path

import pytest

from app.bank import converter
from app.bank.converter import cells_of, convert, parse_terms


def fixture_root(tmp_path: Path, code: str = "9수03-19") -> Path:
    root = tmp_path / "workspace"
    (root / "docs" / "concepts").mkdir(parents=True)
    (root / "backend" / "data" / "concepts").mkdir(parents=True)
    shutil.copytree(
        converter.DATA / "curriculum", root / "backend" / "data" / "curriculum"
    )
    shutil.copy(converter.DOCUMENTS / f"{code}.md", root / "docs" / "concepts")
    shutil.copy(
        converter.DATA / "concepts" / f"{code}.json",
        root / "backend" / "data" / "concepts",
    )
    return root


def test_escaped_table_pipes() -> None:
    assert cells_of(r"| M3 | C1, C2 | `\|a\|`와 \|b\| | 출처 |") == [
        "M3",
        "C1, C2",
        "|a|와 |b|",
        "출처",
    ]


def test_terms() -> None:
    doc = (
        "## 용어\n- 정식 학습 용어 (이 성취기준 관련): "
        "원주각 (호, 현, 중심각은 [9수03-06], 증명은 [9수03-09])\n"
        "- 수업용 용어: 좌변, 우변\n"
    )
    assert parse_terms(doc) == {
        "formal": ["원주각", "호", "현", "중심각", "증명"],
        "teaching_only": ["좌변", "우변"],
        "forbidden_notation": [r"\overparen"],
    }


def test_figure_references_and_variants(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = fixture_root(tmp_path)
    data_path = root / "backend" / "data" / "concepts" / "9수03-19.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    data["variants"] = 1
    data_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    path = root / "docs" / "concepts" / "9수03-19.md"
    text = path.read_text(encoding="utf-8")
    first_line = next(
        line for line in text.splitlines() if line.startswith("| 9수03-19-C1 |")
    )
    cleaned_line = re.sub(r"\s*\[그림:[^]]+\]", "", first_line)
    text = text.replace(
        first_line,
        cleaned_line[:-2] + " [그림: 보기, number_line, coordinate_plane] |",
        1,
    )
    text = text.replace("| M1 | C1 |", "| M1 | C1, C2 |")
    path.write_text(text, encoding="utf-8")
    monkeypatch.setattr(converter, "find_banned_terms", lambda _text, _code: [])
    result = convert("9수03-19", root=root)
    assert result["variants"] == 1
    items = result["assessment_items"]
    assert isinstance(items, list)
    assert items[0]["figure"] == "choices"
    assert items[0]["figure_kinds"] == ["number_line", "coordinate_plane"]
    assert "[그림:" not in items[0]["basis"]
    misconceptions = result["misconceptions"]
    assert isinstance(misconceptions, list)
    assert misconceptions[0]["concept_ids"] == ["9수03-19-C1", "9수03-19-C2"]


def test_warn_banned_terms_and_reject_standard_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = fixture_root(tmp_path)
    monkeypatch.setattr(converter, "find_banned_terms", lambda _text, _code: ["금지말"])
    assert converter.banned_terms(convert("9수03-19", root=root), "9수03-19") == [
        "금지말"
    ]
    monkeypatch.setattr(converter, "find_banned_terms", lambda _text, _code: [])
    path = root / "docs" / "concepts" / "9수03-19.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            "- 성취기준: ", "- 성취기준: 변경 ", 1
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="원문과 다릅니다"):
        convert("9수03-19", root=root)


def test_regression_all_documents() -> None:
    differences: list[str] = []
    for path in sorted(converter.DOCUMENTS.glob("*.md")):
        try:
            output = convert(path.stem)
            current = json.loads(
                (converter.DATA / "concepts" / f"{path.stem}.json").read_text(
                    encoding="utf-8"
                )
            )
            keys = [key for key in output if output[key] != current.get(key)]
            if keys:
                differences.append(f"{path.stem}: {', '.join(keys)}")
        except (ValueError, OSError) as exc:
            differences.append(f"{path.stem}: {exc}")
    assert not differences, "\n" + "\n".join(differences)
