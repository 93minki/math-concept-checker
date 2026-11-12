"""Convert approved concept documents into the bank's concept JSON format."""

import difflib
import json
import re
from pathlib import Path

from app.ai.schemas import ConceptData
from app.ai.terms import find_banned_terms

ROOT = Path(__file__).resolve().parents[3]
DOCUMENTS = ROOT / "docs" / "concepts"
DATA = ROOT / "backend" / "data"
CODE = re.compile(r"9수\d{2}-\d{2}")
FIGURE = re.compile(r"\s*\[그림:\s*(본문|보기)\s*,\s*([a-z_,\s]+)\]\s*$")


def clean(value: str) -> str:
    return value.replace("`", "").replace(r"\|", "|").strip()


def cells_of(line: str) -> list[str]:
    # A pipe preceded by an odd number of backslashes is escaped.
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith(r"\|"):
        line = line[:-1]
    cells: list[str] = []
    part: list[str] = []
    for char in line:
        if char == "|":
            slashes = len(part) - len("".join(part).rstrip("\\"))
            if slashes % 2 == 0:
                cells.append(clean("".join(part)))
                part = []
                continue
        part.append(char)
    cells.append(clean("".join(part)))
    return cells


def parse_terms(document: str) -> dict[str, list[str]]:
    section = document.split("## 용어", 1)
    if len(section) != 2:
        raise ValueError("용어 절이 없습니다")
    formal_match = re.search(r"^- 정식 학습 용어[^:]*:\s*(.+)$", section[1], re.M)
    teaching_match = re.search(r"^- 수업용 용어:\s*(.+)$", section[1], re.M)
    if not formal_match or not teaching_match:
        raise ValueError("용어 목록이 없습니다")
    raw = clean(formal_match.group(1))
    main = re.split(r"\s+\(", raw, maxsplit=1)[0]
    formal = [part.strip() for part in re.split(r"[,·]", main) if part.strip()]
    for parentheses in re.findall(r"\(([^()]*)\)", raw):
        groups = re.findall(
            r"(?:^|,)\s*([^\[\]]+?)(?:은|는)\s+"
            r"\[9수\d{2}-\d{2}\](?:·\[9수\d{2}-\d{2}\])*",
            parentheses,
        )
        for group in groups:
            formal.extend(x.strip() for x in re.split(r"[,·]", group) if x.strip())
    teaching = clean(teaching_match.group(1))
    return {
        "formal": formal,
        "teaching_only": []
        if teaching == "없음"
        else [v.strip() for v in teaching.split(",") if v.strip()],
        "forbidden_notation": [r"\overparen"],
    }


def convert(code: str, *, root: Path = ROOT) -> dict[str, object]:
    if not CODE.fullmatch(code):
        raise ValueError(f"잘못된 성취기준 코드: {code}")
    document = (root / "docs" / "concepts" / f"{code}.md").read_text(encoding="utf-8")
    meta = dict(re.findall(r"^- ([^:]+): (.*)$", document, re.M))
    approval = re.fullmatch(
        r"사용자 승인 \((\d{4}-\d{2}-\d{2})\)", meta.get("상태", "")
    )
    if not approval:
        raise ValueError(f"{code}: 사용자 승인 날짜가 없습니다")
    # Later approved edits are recorded as "- 변경: <date> ... 사용자 승인 ..." lines;
    # the copy carries the latest approval date.
    approved_on = max(
        [
            approval.group(1),
            *(
                found.group(1)
                for found in re.finditer(
                    r"^- 변경[^:]*: .*?(\d{4}-\d{2}-\d{2}).*사용자 승인", document, re.M
                )
            ),
        ]
    )
    data_dir = root / "backend" / "data"
    standards = json.loads(
        (data_dir / "curriculum" / "standards.json").read_text(encoding="utf-8")
    )["standards"]
    units = json.loads(
        (data_dir / "curriculum" / "display_units.json").read_text(encoding="utf-8")
    )["display_units"]
    standard = next((row for row in standards if row["code"] == code), None)
    unit = next((row for row in units if code in row["standards"]), None)
    if standard is None or unit is None:
        raise ValueError(f"{code}: 성취기준 또는 단원을 찾을 수 없습니다")
    if meta.get("성취기준") != standard["text"]:
        raise ValueError(f"{code}: 성취기준 문장이 원문과 다릅니다")
    scope = meta.get("범위 (에이전트 추론, 전문가 검토 필요)")
    if scope is None:
        scope = meta.get("범위")
    if scope is None:
        raise ValueError(f"{code}: 범위가 없습니다")
    concepts: list[dict[str, object]] = []
    items: list[dict[str, object]] = []
    misconceptions: list[dict[str, object]] = []
    names: dict[str, str] = {}
    for line in document.splitlines():
        if not line.startswith("|"):
            continue
        cells = cells_of(line)
        if cells and re.fullmatch(re.escape(code) + r"-C\d+", cells[0]):
            if len(cells) != 5:
                raise ValueError(f"{code}: 평가 항목 칸 수 오류")
            cid, name, level, kind, basis = cells
            if cid in names and names[cid] != name:
                raise ValueError(f"{code}: 개념 이름 불일치: {cid}")
            if cid not in names:
                names[cid] = name
                concepts.append({"id": cid, "name": name})
            types = {"객관식": "multiple_choice", "서술형": "written"}
            if kind not in types:
                raise ValueError(f"{code}: 알 수 없는 문제 유형: {kind}")
            item: dict[str, object] = {
                "id": f"{cid}-{level.replace(' ', '')}",
                "concept_id": cid,
                "level": level,
                "type": types[kind],
            }
            figure = FIGURE.search(basis)
            if figure:
                basis = basis[: figure.start()].rstrip()
                item["figure"] = "body" if figure.group(1) == "본문" else "choices"
                item["figure_kinds"] = [v.strip() for v in figure.group(2).split(",")]
            elif "[그림:" in basis:
                raise ValueError(f"{code}: 그림 표시 형식 오류")
            item["basis"] = basis
            items.append(item)
        elif cells and re.fullmatch(r"M\d+", cells[0]):
            if len(cells) < 4:
                raise ValueError(f"{code}: 오개념 칸 수 오류")
            refs = [v.strip() for v in cells[1].split(",")]
            if not all(re.fullmatch(r"C\d+", ref) for ref in refs):
                raise ValueError(f"{code}: 오개념 개념 ID 오류")
            misconceptions.append(
                {
                    "id": cells[0],
                    "concept_ids": [f"{code}-{ref}" for ref in refs],
                    "text": cells[2],
                }
            )
    if not concepts or not items or not misconceptions:
        raise ValueError(f"{code}: 개념, 평가 항목 또는 오개념이 없습니다")
    old_path = data_dir / "concepts" / f"{code}.json"
    old = json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {}
    result: dict[str, object] = {
        "_source": (
            f"docs/concepts/{code}.md (사용자 승인 {approved_on}). "
            "이 파일은 그 문서를 프로그램이 읽을 수 있게 옮긴 것이다. "
            "내용이 다르면 문서가 기준이다."
        ),
        "standard_code": code,
        "variants": old.get("variants", 2),
        "standard_text": standard["text"],
        "area": standard["area"],
        "topic": standard["topic"],
        "display_unit": {
            key: unit[key] for key in ("grade", "number", "name", "publisher")
        },
        "scope_note": clean(scope),
        # Approved term lists were curated by hand; the free-form "용어" section
        # is only parsed for a new standard and must be reviewed before loading.
        "terms": old.get("terms") or parse_terms(document),
        "concepts": concepts,
        "assessment_items": items,
        "misconceptions": misconceptions,
    }
    ConceptData.model_validate(result)
    return result


def banned_terms(result: dict[str, object], code: str) -> list[str]:
    """Later-unit terms in the converted data, for the reviewer to judge.

    Scope sentences legitimately name later terms to exclude them, so this
    warns instead of failing.
    """
    content = {key: value for key, value in result.items() if key != "_source"}
    return find_banned_terms(json.dumps(content, ensure_ascii=False), code)


def convert_concepts(codes: list[str], check: bool) -> bool:
    success = True
    for code in codes:
        try:
            result = convert(code)
            banned = banned_terms(result, code)
            if banned:
                print(f"{code}: 경고: 뒤 단원 용어 {', '.join(banned)} (문맥 확인)")
            output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
            path = DATA / "concepts" / f"{code}.json"
            current = path.read_text(encoding="utf-8") if path.exists() else ""
            # Compare content, not bytes: older files use a different key order.
            same = bool(current) and json.loads(current) == result
            if check and not same:
                print(
                    "".join(
                        difflib.unified_diff(
                            current.splitlines(keepends=True),
                            output.splitlines(keepends=True),
                            fromfile=str(path),
                            tofile=f"{code} 변환 결과",
                        )
                    ),
                    end="",
                )
                success = False
            elif not check:
                path.write_text(output, encoding="utf-8")
                print(f"{code}: 변환 완료")
            else:
                print(f"{code}: 일치")
        except (ValueError, OSError) as exc:
            print(f"{code}: {exc}")
            success = False
    return success
