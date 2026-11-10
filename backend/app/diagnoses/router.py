import logging
import random
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, get_current_user
from app.diagnoses.ai import DiagnosisAI, get_ai
from app.diagnoses.repository import AnswerConflict, DiagnosesRepository, get_diagnoses
from app.diagnoses.schemas import AnswerInput, Diagnosis, StartInput, Unit, UnitStatus
from app.diagnoses.selection import select_questions
from app.diagnoses.service import (
    AnswersChanged,
    create_report,
    grade_items,
    is_answered,
    payload,
    pick_hard,
    public_report,
    result_data,
)
from app.profiles import ProfilesRepository, get_profiles

router = APIRouter()
# Failures are logged with the diagnosis ID only; answer text never goes to logs.
logger = logging.getLogger(__name__)


def completed_user(
    user: Annotated[AuthUser, Depends(get_current_user)],
    profiles: Annotated[ProfilesRepository, Depends(get_profiles)],
) -> AuthUser:
    profile = profiles.get(user.id)
    if profile is None or profile.signup_status != "completed":
        raise HTTPException(status_code=403, detail="Signup incomplete")
    return user


def request_repository(
    user: Annotated[AuthUser, Depends(completed_user)],
    repo: Annotated[DiagnosesRepository, Depends(get_diagnoses)],
) -> DiagnosesRepository:
    repo.expire(user.id)
    return repo


User = Annotated[AuthUser, Depends(completed_user)]
Repo = Annotated[DiagnosesRepository, Depends(request_repository)]
AI = Annotated[DiagnosisAI, Depends(get_ai)]


def selection(
    repo: DiagnosesRepository, unit_id: int, user_id: UUID
) -> tuple[UnitStatus, list[UUID]]:
    standards = [
        s.standard_code for s in repo.standards() if s.display_unit_id == unit_id
    ]
    return select_questions(
        standards,
        repo.concepts(),
        repo.assessments(),
        repo.questions(),
        repo.history(user_id),
        random.Random(),
    )


def find_diagnosis(
    repo: DiagnosesRepository, user_id: UUID, diagnosis_id: UUID
) -> Diagnosis:
    diagnosis = repo.diagnosis(user_id, diagnosis_id)
    if diagnosis is None:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return diagnosis


def find_unit(repo: DiagnosesRepository, unit_id: int) -> Unit:
    unit = next((u for u in repo.units() if u.id == unit_id), None)
    if unit is None:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.get("/units")
def list_units(user: User, repo: Repo) -> list[dict[str, object]]:
    progress = {d.display_unit_id: d.id for d in repo.in_progress(user.id)}
    links = repo.standards()
    concepts = repo.concepts()
    assessments = repo.assessments()
    questions = repo.questions()
    return [
        {
            **unit.model_dump(),
            "status": select_questions(
                [
                    link.standard_code
                    for link in links
                    if link.display_unit_id == unit.id
                ],
                concepts,
                assessments,
                questions,
                {},
                random.Random(),
            )[0],
            "in_progress_diagnosis_id": progress.get(unit.id),
        }
        for unit in sorted(repo.units(), key=lambda u: (u.grade, u.number))
    ]


@router.post("/diagnoses", status_code=201)
def start_diagnosis(body: StartInput, user: User, repo: Repo) -> dict[str, UUID]:
    find_unit(repo, body.display_unit_id)
    status, ids = selection(repo, body.display_unit_id, user.id)
    if status == "unavailable":
        raise HTTPException(status_code=422, detail="Unit unavailable")
    result = repo.start(user.id, body.display_unit_id, body.restart, ids)
    if result.result == "unit_not_found":
        raise HTTPException(status_code=404, detail="Unit not found")
    if result.result == "in_progress":
        raise HTTPException(
            status_code=409,
            detail={"code": "in_progress", "diagnosis_id": str(result.diagnosis_id)},
        )
    if result.diagnosis_id is None:
        raise RuntimeError("Diagnosis start returned no ID")
    return {"diagnosis_id": result.diagnosis_id}


@router.get("/diagnoses/{diagnosis_id}")
def get_diagnosis(diagnosis_id: UUID, user: User, repo: Repo) -> dict[str, object]:
    diagnosis = find_diagnosis(repo, user.id, diagnosis_id)
    unit = find_unit(repo, diagnosis.display_unit_id)
    status, _ = selection(repo, unit.id, user.id)
    items = sorted(
        repo.items(user.id, diagnosis_id), key=lambda i: (i.stage, i.position)
    )
    questions = {q.id: q for q in repo.questions()}
    answers = {
        a.diagnosis_item_id: a for a in repo.answers(user.id, [i.id for i in items])
    }
    finished = diagnosis.status == "completed" or (
        diagnosis.status == "aborted" and diagnosis.stage1_submitted_at is not None
    )
    grades = (
        {g.diagnosis_item_id: g for g in repo.gradings(user.id, [i.id for i in items])}
        if finished
        else {}
    )
    result_items: list[dict[str, object]] = []
    for item in items:
        question = questions[item.question_id]
        answer = answers.get(item.id)
        item_data: dict[str, object] = {
            "id": item.id,
            "stage": item.stage,
            "position": item.position,
            "question_type": question.question_type,
            "body": question.body,
            "choices": [
                c.model_dump()
                for c in sorted(repo.choices(question.id), key=lambda c: c.no)
            ]
            if question.question_type == "multiple_choice"
            else [],
            "answer": answer.model_dump(exclude={"diagnosis_item_id"})
            if answer
            else None,
        }
        if finished:
            item_data["result"] = result_data(repo, item, question, grades.get(item.id))
        result_items.append(item_data)
    return {
        "id": diagnosis.id,
        "status": diagnosis.status,
        "abort_reason": diagnosis.abort_reason,
        "started_at": diagnosis.started_at,
        "stage1_submitted_at": diagnosis.stage1_submitted_at,
        "unit": {
            "id": unit.id,
            "grade": unit.grade,
            "name": unit.name,
            "publisher": unit.publisher,
            "status": status,
        },
        "items": result_items,
    }


@router.put("/diagnoses/{diagnosis_id}/items/{item_id}/answer")
def save_answer(
    diagnosis_id: UUID, item_id: int, body: AnswerInput, user: User, repo: Repo
) -> dict[str, object]:
    diagnosis = find_diagnosis(repo, user.id, diagnosis_id)
    item = next((i for i in repo.items(user.id, diagnosis_id) if i.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    if diagnosis.status != f"stage{item.stage}" or (
        item.stage == 1 and diagnosis.stage1_submitted_at is not None
    ):
        raise HTTPException(status_code=409, detail="Stage is not accepting answers")
    question = next(q for q in repo.questions() if q.id == item.question_id)
    if (question.question_type == "multiple_choice") != (
        body.selected_choice is not None
    ):
        raise HTTPException(
            status_code=422, detail="Answer type does not match question"
        )
    try:
        return repo.save_answer(user.id, item.id, body).model_dump()
    except AnswerConflict as exc:
        raise HTTPException(
            status_code=409, detail="Stage is not accepting answers"
        ) from exc


def _report_ready(
    repo: DiagnosesRepository, ai: DiagnosisAI, diagnosis: Diagnosis, user_id: UUID
) -> bool:
    try:
        if repo.report(user_id, diagnosis.id) is None:
            create_report(repo, ai, diagnosis, user_id)
        return True
    except Exception:
        logger.exception("Report creation failed for diagnosis %s", diagnosis.id)
        return False


def _submit(
    diagnosis_id: UUID,
    user: AuthUser,
    repo: DiagnosesRepository,
    ai: DiagnosisAI,
    stage: int,
) -> dict[str, object]:
    diagnosis = find_diagnosis(repo, user.id, diagnosis_id)
    if diagnosis.status != f"stage{stage}":
        raise HTTPException(status_code=409, detail={"code": "not_in_progress"})
    if stage == 1 and diagnosis.stage1_submitted_at is not None:
        raise HTTPException(status_code=409, detail={"code": "already_submitted"})
    items = [i for i in repo.items(user.id, diagnosis_id) if i.stage == stage]
    answers = {
        a.diagnosis_item_id: a for a in repo.answers(user.id, [i.id for i in items])
    }
    if any(not is_answered(answers.get(i.id)) for i in items):
        raise HTTPException(status_code=409, detail={"code": "unanswered"})
    answer_versions = {item.id: answers[item.id].updated_at for item in items}
    try:
        gradings = grade_items(repo, ai, items, answers)
    except Exception as exc:
        logger.exception("Grading failed for diagnosis %s", diagnosis_id)
        raise HTTPException(status_code=503, detail={"code": "grading_failed"}) from exc
    selected = pick_hard(repo, user.id, items, gradings) if stage == 1 else []
    code = repo.submit_stage(
        user.id, diagnosis_id, stage, payload(gradings, answer_versions), selected
    )
    if code == "not_found":
        raise HTTPException(status_code=404, detail={"code": code})
    if code != "submitted":
        raise HTTPException(status_code=409, detail={"code": code})
    status = "stage2" if selected else "completed"
    report_ready = False
    if status == "completed":
        updated = find_diagnosis(repo, user.id, diagnosis_id)
        report_ready = _report_ready(repo, ai, updated, user.id)
    return {"status": status, "report_ready": report_ready}


@router.post("/diagnoses/{diagnosis_id}/stages/1/submit")
def submit_stage1(
    diagnosis_id: UUID, user: User, repo: Repo, ai: AI
) -> dict[str, object]:
    return _submit(diagnosis_id, user, repo, ai, 1)


@router.post("/diagnoses/{diagnosis_id}/stages/2/submit")
def submit_stage2(
    diagnosis_id: UUID, user: User, repo: Repo, ai: AI
) -> dict[str, object]:
    return _submit(diagnosis_id, user, repo, ai, 2)


@router.get("/diagnoses/{diagnosis_id}/report")
def get_report(diagnosis_id: UUID, user: User, repo: Repo, ai: AI) -> dict[str, object]:
    diagnosis = find_diagnosis(repo, user.id, diagnosis_id)
    if diagnosis.status != "completed" and not (
        diagnosis.status == "aborted" and diagnosis.stage1_submitted_at is not None
    ):
        raise HTTPException(status_code=409, detail={"code": "no_report"})
    try:
        report = repo.report(user.id, diagnosis.id) or create_report(
            repo, ai, diagnosis, user.id
        )
        return public_report(repo, report)
    except AnswersChanged as exc:
        raise HTTPException(
            status_code=409, detail={"code": "answers_changed"}
        ) from exc
    except Exception as exc:
        logger.exception("Report failed for diagnosis %s", diagnosis.id)
        raise HTTPException(status_code=503, detail={"code": "report_failed"}) from exc
