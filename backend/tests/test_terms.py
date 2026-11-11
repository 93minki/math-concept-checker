from app.ai.schemas import ConceptResult, ReportInput, ReportText, load_concept
from app.ai.tasks import _context, validate_report
from app.ai.terms import curriculum, earliest_standard, find_banned_terms, term_rules


def test_curriculum_standards_and_term_rules() -> None:
    data, positions = curriculum()
    assert all(row.standard in positions for row in data.middle)
    code, prompt_only, allowed = map(set, term_rules("9수02-03"))
    assert {"좌표", "확률", "인수분해", "교점", "집합"} <= code
    assert {
        "등식",
        "일차식",
        "소인수분해",
        "대각선",
        "전개도",
        "그래프",
        "항",
    } <= allowed
    assert {"조건", "정의"} <= prompt_only
    assert "항" in term_rules("9수01-01")[1]
    assert not find_banned_terms("조건과 정의와 항", "9수01-01")
    assert "인수분해" in term_rules("9수02-20")[2]
    assert "삼각비" in term_rules("9수02-20")[0]


def test_allowed_phrases_do_not_hide_banned_terms() -> None:
    for text in ("소인수분해하면", "대각선을 긋고", "전개도를 그리면"):
        assert find_banned_terms(text, "9수02-03") == []
    assert {"인수", "인수분해"} <= set(find_banned_terms("인수분해하면", "9수02-03"))


def test_prompt_and_report_use_earliest_standard() -> None:
    concept = load_concept("9수02-03")
    prompt = _context(concept, concept.assessment_items[0], "normal")
    terms = prompt["not_yet_learned_terms"].split(", ")
    assert {"좌표", "조건", "정의"} <= set(terms)
    assert "항" not in terms
    assert earliest_standard(["9수02-20", "9수02-03"]) == "9수02-03"
    report = ReportText(
        not_understood="인수분해", misconception_explanations="", next_steps=""
    )
    inputs = ReportInput(
        unit_score=None,
        unit_stage=None,
        misconception_ids=[],
        concepts=[
            ConceptResult(
                concept_id="9수02-20-C1",
                name="개념",
                score=None,
                stage="측정 안 됨",
                deep_not_attempted=False,
                misconception_ids=[],
            )
        ],
    )
    assert "not_yet_learned" in {
        issue.code for issue in validate_report(report, inputs, concept)
    }
