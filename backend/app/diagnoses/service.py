import random
import re
from dataclasses import asdict
from datetime import datetime
from uuid import UUID

from app.ai.schemas import (
    Choice,
    ConceptResult,
    ElementResult,
    Misconception,
    ReportInput,
    RubricElement,
    load_concept,
)
from app.ai.schemas import (
    Question as AIQuestion,
)
from app.ai.scoring import score_choice, score_written
from app.ai.terms import earliest_standard
from app.diagnoses.ai import DiagnosisAI
from app.diagnoses.repository import DiagnosesRepository
from app.diagnoses.schemas import (
    AnswerRow,
    Diagnosis,
    GradingRow,
    Item,
    Question,
    ReportRow,
)
from app.diagnoses.scoring import HardState, ItemInput, QuestionResult, score_unit


def is_answered(answer: AnswerRow | None) -> bool:
    return bool(
        answer
        and (answer.selected_choice is not None or (answer.written_text or "").strip())
    )


def grade_items(
    repo: DiagnosesRepository,
    ai: DiagnosisAI,
    items: list[Item],
    answers: dict[int, AnswerRow],
) -> list[GradingRow]:
    question_ids = [item.question_id for item in items]
    questions = {q.id: q for q in repo.questions_by_ids(question_ids)}
    assessments = {a.id: a for a in repo.assessments()}
    misconceptions = repo.misconceptions()
    result: list[GradingRow] = []
    for item in items:
        question = questions[item.question_id]
        answer = answers[item.id]
        if question.question_type == "multiple_choice":
            choices = repo.question_choices(question.id)
            ai_choices = [Choice.model_validate(c.model_dump()) for c in choices]
            if answer.selected_choice is None:
                raise ValueError("Missing choice")
            score = score_choice(ai_choices, answer.selected_choice)
            selected = next(c for c in choices if c.no == answer.selected_choice)
            result.append(
                GradingRow(
                    diagnosis_item_id=item.id,
                    score=score.value,
                    passed=score.passed,
                    selected_misconception_id=selected.misconception_id
                    if not score.passed
                    else None,
                )
            )
            continue
        assessment = assessments[item.assessment_item_id]
        standard = assessment.concept_id.split("-C", 1)[0]
        related = [m for m in misconceptions if assessment.concept_id in m.concept_ids]
        by_global = {m.id: m.local_id for m in related}
        by_local = {m.local_id: m.id for m in related}
        rubric = [
            RubricElement(
                no=r.no,
                description=r.description,
                points=r.points,
                required=r.required,
                related_misconception_ids=[
                    by_global[mid] for mid in r.related_misconception_ids
                ],
            )
            for r in repo.rubric(question.id)
        ]
        ai_question = AIQuestion(
            assessment_item_id=item.assessment_item_id,
            concept_id=assessment.concept_id,
            level=assessment.level,
            type="written",
            difficulty=question.difficulty,
            body=question.body,
            explanation=question.explanation,
            choices=[],
            model_answer=question.model_answer,
            rubric=rubric,
            hard_condition=question.hard_condition,
            hard_condition_reason=question.hard_condition_reason,
        )
        local = [
            Misconception(id=m.local_id, concept_ids=m.concept_ids, text=m.content)
            for m in related
        ]
        graded = ai.grade(ai_question, rubric, answer.written_text or "", local)
        score = score_written(rubric, graded.grading)
        if any(
            mid not in by_local for mid in graded.grading.detected_misconception_ids
        ):
            raise ValueError("Unknown misconception")
        result.append(
            GradingRow(
                diagnosis_item_id=item.id,
                score=score.value,
                passed=score.passed,
                element_results=[
                    e.model_dump() for e in graded.grading.element_results
                ],
                detected_misconception_ids=[
                    by_local[mid] for mid in graded.grading.detected_misconception_ids
                ],
                ai_model=graded.model,
                prompt_version=graded.prompt_version,
            )
        )
        if not all(m.standard_code == standard for m in related):
            raise ValueError("Misconception standard mismatch")
    return result


def pick_hard(
    repo: DiagnosesRepository,
    user_id: UUID,
    items: list[Item],
    gradings: list[GradingRow],
) -> list[UUID]:
    passed = {g.diagnosis_item_id for g in gradings if g.passed}
    history = repo.history(user_id)
    questions = repo.question_slots()
    rng = random.Random()
    chosen: list[UUID] = []
    for item in sorted(items, key=lambda i: i.position):
        if item.id not in passed:
            continue
        candidates = [
            q
            for q in questions
            if q.assessment_item_id == item.assessment_item_id
            and q.difficulty == "hard"
            and q.status == "approved"
        ]
        if not candidates:
            continue
        unseen = [q for q in candidates if q.id not in history]
        q = (
            rng.choice(unseen)
            if unseen
            else min(candidates, key=lambda q: (history[q.id], q.variant))
        )
        chosen.append(q.id)
    return chosen


class AnswersChanged(Exception):
    pass


def payload(
    gradings: list[GradingRow], answer_versions: dict[int, datetime]
) -> list[dict[str, object]]:
    return [
        g.model_dump(mode="json")
        | {"answer_updated_at": answer_versions[g.diagnosis_item_id].isoformat()}
        for g in gradings
    ]


REQUIRED_PREFIX = re.compile(r"^\s*(?:\(필수\)|\[필수\]|필수\s*:)\s*")


def student_description(description: str) -> str:
    """Drop the "필수:" label some generated rubric texts start with.

    Approved questions are immutable, so the label is removed when shown.
    """
    return REQUIRED_PREFIX.sub("", description, count=1)


def result_data(
    repo: DiagnosesRepository, item: Item, question: Question, grade: GradingRow | None
) -> dict[str, object] | None:
    if grade is None:
        return None
    result: dict[str, object] = {
        "passed": grade.passed,
        "explanation": question.explanation,
    }
    if question.question_type == "multiple_choice":
        result["correct_choice"] = next(
            c.no for c in repo.question_choices(question.id) if c.is_correct
        )
    else:
        result["model_answer"] = question.model_answer
        results = {
            r.no: r
            for r in (
                ElementResult.model_validate(value)
                for value in grade.element_results or []
            )
        }
        result["elements"] = [
            {
                "description": student_description(r.description),
                "met": results[r.no].met,
                "reason": results[r.no].reason,
            }
            for r in repo.rubric(question.id)
        ]
    return result


def question_result(grade: GradingRow) -> QuestionResult:
    ids = list(grade.detected_misconception_ids)
    if grade.selected_misconception_id:
        ids.append(grade.selected_misconception_id)
    return QuestionResult(grade.score, grade.passed, tuple(ids))


def create_report(
    repo: DiagnosesRepository, ai: DiagnosisAI, diagnosis: Diagnosis, user_id: UUID
) -> ReportRow:
    items = repo.items(user_id, diagnosis.id)
    answers = {
        a.diagnosis_item_id: a for a in repo.answers(user_id, [i.id for i in items])
    }
    grades = {
        g.diagnosis_item_id: g for g in repo.gradings(user_id, [i.id for i in items])
    }
    missing = [
        i
        for i in items
        if i.stage == 2 and i.id not in grades and is_answered(answers.get(i.id))
    ]
    answer_versions = {item.id: answers[item.id].updated_at for item in missing}
    new_grades = (
        grade_items(repo, ai, missing, answers) if diagnosis.status == "aborted" else []
    )
    grades.update({g.diagnosis_item_id: g for g in new_grades})
    assessments = {a.id: a for a in repo.assessments()}
    normal = [i for i in items if i.stage == 1]
    hard = {i.assessment_item_id: i for i in items if i.stage == 2}
    inputs: list[ItemInput] = []
    for item in normal:
        grade = grades[item.id]
        hard_item = hard.get(item.assessment_item_id)
        hard_result: QuestionResult | HardState | None
        if not grade.passed:
            hard_result = None
        elif hard_item is None:
            hard_result = "no_question"
        elif hard_item.id not in grades:
            hard_result = "not_attempted"
        else:
            hard_result = question_result(grades[hard_item.id])
        inputs.append(
            ItemInput(
                item.assessment_item_id,
                assessments[item.assessment_item_id].concept_id,
                question_result(grade),
                hard_result,
            )
        )
    standards = [
        link.standard_code
        for link in repo.standards()
        if link.display_unit_id == diagnosis.display_unit_id
    ]
    concepts = [c for c in repo.concepts() if c.standard_code in standards]
    scores = score_unit(inputs, [c.id for c in concepts])
    names = {c.id: c.name for c in concepts}
    misconceptions = {m.id: m for m in repo.misconceptions()}
    stored_concepts = [
        {
            **asdict(c),
            "name": names[c.concept_id],
            "misconception_ids": list(c.misconception_ids),
        }
        for c in scores.concepts
    ]
    report_input = ReportInput(
        unit_score=scores.score,
        unit_stage=scores.stage,
        concepts=[
            ConceptResult(
                concept_id=c.concept_id,
                name=names[c.concept_id],
                score=c.score,
                stage=c.stage or "측정 안 됨",
                deep_not_attempted=c.deep_not_attempted,
                misconception_ids=list(c.misconception_ids),
            )
            for c in scores.concepts
        ],
        misconception_ids=list(scores.misconception_ids),
    )
    codes = sorted({c.standard_code for c in concepts})
    contexts = [load_concept(code) for code in codes]
    if not contexts:
        raise ValueError("No concept data")
    unit = next(u for u in repo.units() if u.id == diagnosis.display_unit_id)
    unit_data = contexts[0].display_unit.model_copy(
        update={
            "grade": unit.grade,
            "name": unit.name,
            "number": unit.number,
            "publisher": unit.publisher,
        }
    )
    # IDs in report inputs are global, matching these DB-derived entries.
    context = contexts[0].model_copy(
        update={
            "standard_code": earliest_standard(standards),
            "display_unit": unit_data,
            "misconceptions": [
                Misconception(id=m.id, concept_ids=m.concept_ids, text=m.content)
                for m in misconceptions.values()
            ],
        }
    )
    generated = ai.report(report_input, context)
    report: dict[str, object] = {
        "unit_score": scores.score,
        "unit_stage": scores.stage,
        "concepts": stored_concepts,
        "misconception_ids": list(scores.misconception_ids),
        "text": generated.text.model_dump(),
        "ai_model": generated.model,
        "prompt_version": generated.prompt_version,
    }
    result = repo.create_report(
        user_id, diagnosis.id, payload(new_grades, answer_versions), report
    )
    if result == "answers_changed":
        raise AnswersChanged
    if result not in ("created", "exists"):
        raise ValueError("Report could not be stored")
    saved = repo.report(user_id, diagnosis.id)
    if saved is None:
        raise ValueError("Report not found after creation")
    return saved


def public_report(repo: DiagnosesRepository, report: ReportRow) -> dict[str, object]:
    misconceptions = {m.id: m.content for m in repo.misconceptions()}
    concepts: list[dict[str, object]] = []
    for concept in report.concepts:
        ids = concept["misconception_ids"]
        if not isinstance(ids, list) or not all(isinstance(mid, str) for mid in ids):
            raise ValueError("Invalid report")
        concepts.append(
            {
                key: concept[key]
                for key in (
                    "name",
                    "stage",
                    "not_measured",
                    "deep_not_attempted",
                    "deep_not_measured",
                )
            }
            | {"misconceptions": [misconceptions[mid] for mid in ids]}
        )
    return {"unit_stage": report.unit_stage, "concepts": concepts, "text": report.text}
