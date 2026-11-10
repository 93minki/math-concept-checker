import random
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, get_current_user
from app.diagnoses.repository import AnswerConflict, DiagnosesRepository, get_diagnoses
from app.diagnoses.schemas import AnswerInput, Diagnosis, StartInput, Unit, UnitStatus
from app.diagnoses.selection import select_questions
from app.profiles import ProfilesRepository, get_profiles

router = APIRouter()


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
    result_items: list[dict[str, object]] = []
    for item in items:
        question = questions[item.question_id]
        answer = answers.get(item.id)
        result_items.append(
            {
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
        )
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


@router.post("/diagnoses/{diagnosis_id}/stages/1/submit")
def submit_stage1(diagnosis_id: UUID, user: User, repo: Repo) -> dict[str, object]:
    result = repo.submit(user.id, diagnosis_id)
    if result == "not_found":
        raise HTTPException(status_code=404, detail={"code": result})
    if result != "submitted":
        raise HTTPException(status_code=409, detail={"code": result})
    diagnosis = find_diagnosis(repo, user.id, diagnosis_id)
    return {"stage1_submitted_at": diagnosis.stage1_submitted_at}
