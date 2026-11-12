import json
import subprocess
from collections.abc import Sequence
from pathlib import Path

from app.ai.report_html import KATEX_CDN, esc
from app.bank.repository import Row


def render_review(
    questions: Sequence[Row],
    choices: Sequence[Row],
    rubric: Sequence[Row],
    rubric_links: Sequence[Row],
    misconceptions: Sequence[Row],
    backlog: Sequence[Row],
) -> str:
    mis = {str(m["id"]): str(m["content"]) for m in misconceptions}
    questions = sorted(
        questions,
        key=lambda q: (
            str(q["assessment_item_id"]),
            str(q["difficulty"]) != "normal",
            int(str(q["variant"])),
        ),
    )
    choices = sorted(choices, key=lambda c: int(str(c["no"])))
    rubric = sorted(rubric, key=lambda r: int(str(r["no"])))
    figure_rows = [
        row for row in [*questions, *choices] if row.get("figure") is not None
    ]
    figures: dict[int, str] = {}
    if figure_rows:
        script = (
            Path(__file__).resolve().parents[3]
            / "frontend"
            / "scripts"
            / "render-figures.ts"
        )
        result = subprocess.run(
            ["node", str(script)],
            input=json.dumps(
                [row["figure"] for row in figure_rows], ensure_ascii=False
            ),
            text=True,
            capture_output=True,
            check=True,
        )
        figures = dict(
            zip(
                (id(row) for row in figure_rows), json.loads(result.stdout), strict=True
            )
        )
    cards = []
    for q in questions:
        identifier = q["id"]
        details = [
            ("문제 ID", identifier),
            ("평가 항목", q["assessment_item_id"]),
            ("난이도", q["difficulty"]),
            ("변형", q["variant"]),
            ("상태", q["status"]),
            ("고난이도 조건", q.get("hard_condition")),
            ("조건 이유", q.get("hard_condition_reason")),
            ("본문", q["body"]),
            ("모범 답안", q.get("model_answer")),
            ("해설", q["explanation"]),
            ("검증 시도 기록", json.dumps(q.get("validation"), ensure_ascii=False)),
        ]
        content = "".join(
            f'<dt>{esc(k)}</dt><dd class="pre">'
            f"{esc(v if v is not None else '없음')}</dd>"
            for k, v in details
        )
        content += figures.get(id(q), "")
        choice_lines = []
        for c in choices:
            if c["question_id"] != identifier:
                continue
            mid = str(c.get("misconception_id") or "")
            choice_lines.append(
                f"<li>{esc(c['no'])}. {esc(c['text'])} "
                f"{'(정답)' if c['is_correct'] else ''} "
                f"{esc(mid)} {esc(mis.get(mid, ''))}{figures.get(id(c), '')}</li>"
            )
        rubric_lines = []
        for r in rubric:
            if r["question_id"] != identifier:
                continue
            related = [
                str(link["misconception_id"])
                for link in rubric_links
                if link["rubric_element_id"] == r["id"]
            ]
            related_text = ", ".join(f"{m}: {mis.get(m, '')}" for m in related)
            rubric_lines.append(
                f"<li>{esc(r['no'])}. {esc(r['description'])} "
                f"({esc(r['points'])}점, {'필수' if r['required'] else '선택'}) "
                f"{esc(related_text)}</li>"
            )
        cards.append(
            f"<article><dl>{content}</dl><h3>보기</h3>"
            f"<ul>{''.join(choice_lines)}</ul><h3>채점 요소</h3>"
            f"<ul>{''.join(rubric_lines)}</ul></article>"
        )
    rows = "".join(
        "<tr>"
        + "".join(
            f'<td class="pre">{esc(value)}</td>'
            for k in ("assessment_item_id", "difficulty", "variant", "attempts")
            for value in [
                json.dumps(b.get(k), ensure_ascii=False)
                if k == "attempts"
                else b.get(k)
            ]
        )
        + "</tr>"
        for b in backlog
    )
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>문제 은행 검토</title>
<link rel="stylesheet" href="{KATEX_CDN}/katex.min.css">
<style>
body {{ max-width:52rem; margin:auto; padding:1rem;
  font-family:system-ui; line-height:1.5 }}
article {{ border:1px solid #ddd; padding:1rem; margin:1rem 0 }}
.pre {{ white-space:pre-wrap; overflow-wrap:anywhere }}
table {{ border-collapse:collapse }} td,th {{ border:1px solid #ccc; padding:.4rem }}
.scroll {{ overflow-x:auto }} .katex-display > .katex {{ white-space:normal }}
</style></head><body><h1>문제 은행 검토</h1>{"".join(cards)}
<h2>미해결 백로그</h2><div class="scroll"><table>
<tr><th>평가 항목</th><th>난이도</th><th>변형</th><th>시도 기록</th></tr>
{rows}</table></div>
<script defer src="{KATEX_CDN}/katex.min.js"></script>
<script defer src="{KATEX_CDN}/contrib/auto-render.min.js"></script>
<script defer>document.addEventListener("DOMContentLoaded",function(){{
  renderMathInElement(document.body,{{delimiters:[
    {{left:"$$",right:"$$",display:true}}, {{left:"$",right:"$",display:false}},
    {{left:"\\\\(",right:"\\\\)",display:false}},
    {{left:"\\\\[",right:"\\\\]",display:true}}
  ],throwOnError:false}});
}});</script></body></html>'''
