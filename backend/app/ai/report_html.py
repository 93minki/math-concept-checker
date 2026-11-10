import html
from collections.abc import Sequence
from typing import Protocol, cast

KATEX_VERSION = "0.16.47"
KATEX_CDN = f"https://cdn.jsdelivr.net/npm/katex@{KATEX_VERSION}/dist"

CRITERIA = (
    ("1", "a05_m2", "A05의 M2"),
    ("2", "false_positive", "잘못 탐지"),
    ("3", "preserved_a03_a08", "A03·A08 유지"),
    ("4", "additional_a11_plus", "A11 이후"),
)


class _Answer(Protocol):
    id: str
    kind: str
    expected: dict[str, bool]
    expected_misconceptions: list[str]


class _Fixture(Protocol):
    @property
    def answers(self) -> Sequence[_Answer]: ...


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def _mapping(value: object) -> dict[str, object] | None:
    if isinstance(value, dict):
        return cast(dict[str, object], value)
    return None


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _question_payload(call: dict[str, object]) -> dict[str, object] | None:
    assembled = _mapping(call.get("assembled_question"))
    if assembled is not None:
        return assembled
    return _mapping(call.get("parsed_output"))


def _matching_review(generate: dict[str, object], review: dict[str, object]) -> bool:
    return (
        review.get("call_type") == "review"
        and review.get("provider") == generate.get("provider")
        and review.get("target_id") == generate.get("target_id")
        and review.get("attempt") == generate.get("attempt")
    )


def _question_status(
    generate: dict[str, object], review: dict[str, object] | None
) -> str:
    if generate.get("parsed_success") is not True or generate.get("error"):
        return "오류"
    if _strings(generate.get("validation")):
        return "코드 검사 실패"
    if (
        review is None
        or review.get("parsed_success") is not True
        or review.get("error")
    ):
        return "오류"
    if _strings(review.get("validation")):
        return "AI 검사 거절"
    return "통과"


def _failure_reasons(
    generate: dict[str, object], review: dict[str, object] | None
) -> list[str]:
    reasons = _strings(generate.get("validation"))
    error = generate.get("error")
    if isinstance(error, str) and error:
        reasons.append(error)
    if review is not None:
        reasons.extend(_strings(review.get("validation")))
        review_error = review.get("error")
        if isinstance(review_error, str) and review_error:
            reasons.append(review_error)
    return reasons


def _pair_questions(
    calls: list[dict[str, object]],
) -> list[tuple[dict[str, object], dict[str, object] | None]]:
    pairs: list[tuple[dict[str, object], dict[str, object] | None]] = []
    for index, call in enumerate(calls):
        if call.get("call_type") != "generate":
            continue
        review = calls[index + 1] if index + 1 < len(calls) else None
        if review is not None and _matching_review(call, review):
            pairs.append((call, review))
        else:
            pairs.append((call, None))
    return pairs


def _choices_html(payload: dict[str, object]) -> str:
    raw = payload.get("choices")
    if not isinstance(raw, list) or not raw:
        return ""
    items: list[str] = []
    for choice in raw:
        data = _mapping(choice)
        if data is None:
            continue
        number = data.get("no")
        label = esc(number) if isinstance(number, int) else ""
        text = esc(_text(data.get("text")))
        body = (
            f"<strong>{label}. {text}</strong>"
            if data.get("is_correct") is True
            else f"{label}. {text}"
        )
        misconception = data.get("misconception_id")
        if isinstance(misconception, str) and misconception:
            body += f" (오개념 {esc(misconception)})"
        items.append(f"<li>{body}</li>")
    if not items:
        return ""
    return "<ol>" + "".join(items) + "</ol>"


def _written_html(payload: dict[str, object]) -> str:
    question_type = _text(payload.get("type"))
    model_answer = payload.get("model_answer")
    rubric = payload.get("rubric")
    has_rubric = isinstance(rubric, list) and bool(rubric)
    has_answer = isinstance(model_answer, str) and bool(model_answer)
    if question_type != "written" and not (
        question_type == "" and (has_answer or has_rubric)
    ):
        return ""
    parts = [
        "<h4>모범 답안</h4>",
        f'<p class="pre">{esc(model_answer or "없음")}</p>',
        "<h4>채점 요소</h4>",
    ]
    if not isinstance(rubric, list) or not rubric:
        parts.append("<p>없음</p>")
        return "".join(parts)
    rows = [
        '<div class="table-scroll"><table><thead><tr>'
        "<th>번호</th><th>내용</th><th>배점</th><th>필수</th><th>오개념</th>"
        "</tr></thead><tbody>"
    ]
    for element in rubric:
        data = _mapping(element)
        if data is None:
            continue
        related = ", ".join(_strings(data.get("related_misconception_ids"))) or "없음"
        required = "필수" if data.get("required") is True else "선택"
        rows.append(
            "<tr>"
            f"<td>{esc(data.get('no'))}</td>"
            f'<td class="pre">{esc(_text(data.get("description")))}</td>'
            f"<td>{esc(data.get('points'))}</td>"
            f"<td>{required}</td>"
            f"<td>{esc(related)}</td>"
            "</tr>"
        )
    rows.append("</tbody></table></div>")
    parts.append("".join(rows))
    return "".join(parts)


def _question_card(
    generate: dict[str, object], review: dict[str, object] | None
) -> str:
    payload = _question_payload(generate)
    item_id = _text(generate.get("target_id"))
    difficulty = "알 수 없음"
    if payload is not None:
        item_id = _text(payload.get("assessment_item_id")) or item_id
        found = payload.get("difficulty")
        if isinstance(found, str) and found:
            difficulty = found
    status = _question_status(generate, review)
    reasons = _failure_reasons(generate, review)
    reason_html = (
        "<ul>"
        + "".join(f'<li class="issue">{esc(reason)}</li>' for reason in reasons)
        + "</ul>"
        if reasons
        else "<p>없음</p>"
    )
    body = (
        esc(_text(payload.get("body"))) if payload else "문제 내용을 읽지 못했습니다."
    )
    explanation = esc(_text(payload.get("explanation"))) if payload else ""
    choices = _choices_html(payload) if payload else ""
    written = _written_html(payload) if payload else ""
    return (
        '<article class="question-card" data-question-card="1">'
        f"<p>평가 항목 {esc(item_id)} · 난이도 {esc(difficulty)} · "
        f"시도 {esc(generate.get('attempt'))} · 상태 {esc(status)}</p>"
        f'<div class="pre">{body}</div>'
        f"{choices}{written}"
        "<details><summary>해설</summary>"
        f'<div class="pre">{explanation}</div></details>'
        f"<h4>실패 이유</h4>{reason_html}"
        "</article>"
    )


def _element_rows(parsed: dict[str, object] | None) -> list[tuple[int, bool, str]]:
    if parsed is None:
        return []
    raw = parsed.get("element_results")
    if not isinstance(raw, list):
        return []
    rows: list[tuple[int, bool, str]] = []
    for item in raw:
        data = _mapping(item)
        if data is None:
            continue
        number = data.get("no")
        met = data.get("met")
        if (
            isinstance(number, bool)
            or not isinstance(number, int)
            or not isinstance(met, bool)
        ):
            continue
        rows.append((number, met, _text(data.get("reason"))))
    rows.sort(key=lambda row: row[0])
    return rows


def _marks(flags: list[tuple[int, bool]]) -> str:
    circled = {1: "①", 2: "②", 3: "③"}
    return " ".join(
        f"{circled.get(number, str(number))} {'충족' if met else '미충족'}"
        for number, met in flags
    )


def _grade_row(call: dict[str, object], answers: dict[str, _Answer]) -> str:
    answer_id = _text(call.get("target_id"))
    answer = answers.get(answer_id)
    parsed = (
        _mapping(call.get("parsed_output"))
        if call.get("parsed_success") is True
        else None
    )
    elements = _element_rows(parsed)
    actual = {str(number): met for number, met, _reason in elements}
    expected = answer.expected if answer is not None else {}
    detected = _strings(call.get("detected_misconception_ids"))
    expected_misconceptions = (
        list(answer.expected_misconceptions) if answer is not None else []
    )
    failed = call.get("parsed_success") is not True or bool(call.get("error"))
    differs = (
        failed
        or set(detected) != set(expected_misconceptions)
        or any(actual.get(key) is not value for key, value in expected.items())
    )
    evidence = [
        issue
        for issue in _strings(call.get("validation"))
        if issue.startswith("evidence_not_in_answer")
    ]
    reasons = [reason for _number, _met, reason in elements if reason]
    if isinstance(call.get("error"), str) and call.get("error"):
        reasons.append(_text(call.get("error")))
    mismatch = ' data-mismatch="1" class="mismatch"' if differs else ""
    expected_flags = sorted(
        ((int(key), value) for key, value in expected.items() if key.isdigit()),
        key=lambda item: item[0],
    )
    actual_marks = _marks([(number, met) for number, met, _reason in elements])
    expected_marks = _marks(expected_flags)
    kind = answer.kind if answer is not None and answer.kind else "없음"
    return (
        f'<tr data-grade-row="1"{mismatch}>'
        f"<td>{esc(answer_id)}</td>"
        f"<td>{esc(call.get('attempt'))}</td>"
        f"<td>{esc(kind)}</td>"
        f"<td>{esc(actual_marks or '없음')}</td>"
        f"<td>{esc(expected_marks or '없음')}</td>"
        f"<td>{esc(', '.join(detected) or '없음')}</td>"
        f"<td>{esc(', '.join(expected_misconceptions) or '없음')}</td>"
        f"<td>{esc(', '.join(evidence) or '없음')}</td>"
        f'<td class="pre">{esc(" / ".join(reasons) or "없음")}</td>'
        "</tr>"
    )


def _report_block(call: dict[str, object]) -> str:
    parsed = (
        _mapping(call.get("parsed_output"))
        if call.get("parsed_success") is True
        else None
    )
    fields = (
        ("이해하지 못한 부분", "not_understood"),
        ("추정되는 오개념", "misconception_explanations"),
        ("다음 학습 방향", "next_steps"),
    )
    parts = [
        '<article class="report-set">',
        f"<h3>세트 {esc(call.get('target_id'))}</h3>",
    ]
    for label, key in fields:
        value = _text(parsed.get(key)) if parsed else ""
        parts.append(f'<h4>{label}</h4><p class="pre">{esc(value or "없음")}</p>')
    issues = _strings(call.get("validation"))
    error = call.get("error")
    if isinstance(error, str) and error:
        issues.append(error)
    if issues:
        parts.append(
            '<ul class="issue">'
            + "".join(f"<li>{esc(issue)}</li>" for issue in issues)
            + "</ul>"
        )
    else:
        parts.append("<p>코드 검사 문제 없음</p>")
    parts.append("</article>")
    return "".join(parts)


def _criteria_table(grading: dict[str, object]) -> str:
    criteria = _mapping(grading.get("misconception_criteria")) or {}
    rows = [
        '<div class="table-scroll"><table><thead><tr>'
        "<th>기준</th><th>내용</th><th>결과</th><th>수치</th>"
        "</tr></thead><tbody>"
    ]
    for number, key, label in CRITERIA:
        item = _mapping(criteria.get(key)) or {}
        status = _text(item.get("status")) or "없음"
        detail = ", ".join(
            f"{name} {item.get(name)}"
            for name in ("detected", "count", "evaluated", "expected", "target")
            if name in item
        )
        status_class = ' class="issue"' if status == "미달" else ""
        rows.append(
            "<tr>"
            f"<td>{number}</td><td>{esc(label)}</td>"
            f"<td{status_class}>{esc(status)}</td><td>{esc(detail or '없음')}</td>"
            "</tr>"
        )
    rows.append("</tbody></table></div>")
    return "".join(rows)


def _provider_html(
    name: str,
    calls: list[dict[str, object]],
    summary: dict[str, object],
    answers: dict[str, _Answer],
) -> str:
    data = _mapping(summary.get(name)) or {}
    grading = _mapping(data.get("grading")) or {}
    model = _text(data.get("model")) or "없음"
    cost = data.get("total_cost_usd", "없음")
    call_count = len([call for call in calls if call.get("provider") == name])
    questions = [
        _question_card(generate, review)
        for generate, review in _pair_questions(calls)
        if generate.get("provider") == name
    ]
    grades = [
        _grade_row(call, answers)
        for call in calls
        if call.get("call_type") == "grade" and call.get("provider") == name
    ]
    reports = [
        _report_block(call)
        for call in calls
        if call.get("call_type") == "report" and call.get("provider") == name
    ]
    return (
        f"<section><h2>{esc(name)}</h2>"
        "<h3>요약</h3><ul>"
        f"<li>모델: {esc(model)}</li>"
        f"<li>호출 수: {call_count}</li>"
        f"<li>표준가 비용 USD: {esc(cost)}</li>"
        "</ul>"
        f"{_criteria_table(grading)}"
        "<h3>생성한 문제</h3>"
        + ("".join(questions) or "<p>없음</p>")
        + '<h3>서술형 채점</h3><div class="table-scroll"><table><thead><tr>'
        "<th>답안 ID</th><th>회차</th><th>답안 유형</th><th>AI 판정</th>"
        "<th>기대 판정</th><th>탐지 오개념</th><th>기대 오개념</th>"
        "<th>근거 탈락</th><th>판단 이유</th>"
        "</tr></thead><tbody>"
        + ("".join(grades) or '<tr><td colspan="9">없음</td></tr>')
        + "</tbody></table></div><h3>리포트 문장</h3>"
        + ("".join(reports) or "<p>없음</p>")
        + "</section>"
    )


def render_report_html(
    calls: list[dict[str, object]],
    fixture: _Fixture,
    summary: dict[str, object],
) -> str:
    providers = _mapping(summary.get("providers")) or {}
    names = list(providers)
    for call in calls:
        provider = call.get("provider")
        if isinstance(provider, str) and provider not in names:
            names.append(provider)
    answers = {answer.id: answer for answer in fixture.answers}
    sections = "".join(
        _provider_html(name, calls, providers, answers) for name in names
    )
    fake = (
        " 가짜 실행입니다. 비용 추정에 쓰지 않습니다."
        if summary.get("fake") is True
        else ""
    )
    heading = (
        f"{esc(summary.get('mode'))} / 표준가 총비용 USD "
        f"{esc(summary.get('total_cost_usd'))}.{esc(fake)}"
    )
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 비교 결과</title>
<link rel="stylesheet" href="{KATEX_CDN}/katex.min.css">
<style>
body {{
  margin: 0 auto;
  max-width: 52rem;
  padding: 1rem;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}}
.table-scroll {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{
  border: 1px solid #ccc;
  padding: 0.4rem;
  vertical-align: top;
  text-align: left;
}}
tr.mismatch {{ background: #fff3bf; }}
.issue {{ color: #9b1c1c; }}
.question-card, .report-set {{
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
}}
.pre {{ white-space: pre-wrap; overflow-wrap: anywhere; }}
.katex-display > .katex {{ white-space: normal; }}
</style>
</head>
<body>
<p>{heading}</p>
{sections}
<script defer src="{KATEX_CDN}/katex.min.js"></script>
<script defer src="{KATEX_CDN}/contrib/auto-render.min.js"></script>
<script defer>
document.addEventListener("DOMContentLoaded", function () {{
  renderMathInElement(document.body, {{
    delimiters: [
      {{left: "$$", right: "$$", display: true}},
      {{left: "$", right: "$", display: false}},
      {{left: "\\\\(", right: "\\\\)", display: false}},
      {{left: "\\\\[", right: "\\\\]", display: true}}
    ],
    throwOnError: false
  }});
}});
</script>
</body>
</html>
"""
