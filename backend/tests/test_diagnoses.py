from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from test_auth import USER_ID, FakeProfiles, token

from app.ai.schemas import Boxplot
from app.diagnoses.repository import AnswerConflict, get_diagnoses
from app.diagnoses.schemas import (
    Answer,
    AnswerInput,
    AnswerRow,
    Assessment,
    Choice,
    Concept,
    Diagnosis,
    GradingRow,
    Item,
    MisconceptionRow,
    Question,
    QuestionChoice,
    QuestionSlot,
    ReportRow,
    RubricRow,
    StandardLink,
    StartResult,
    Unit,
)
from app.main import app
from app.profiles import Profile, get_profiles

pytest_plugins = ["test_auth"]

FIGURE = Boxplot.model_validate(
    {
        "kind": "boxplot",
        "axis_min": 0,
        "axis_max": 10,
        "axis_step": 1,
        "series": [{"label": "가", "min": 1, "q1": 2, "median": 3, "q3": 4, "max": 5}],
    }
)
NOW = datetime.now(UTC)
QUESTION = uuid4()
EXTRA_QUESTION = uuid4()


class FakeDiagnoses:
    def __init__(self) -> None:
        self.rows: dict[UUID, Diagnosis] = {}
        self.item_rows: list[Item] = []
        self.answer_rows: dict[int, AnswerRow] = {}
        self.events: list[str | tuple[str, tuple[UUID, ...]]] = []
        self.conflict = False
        self.written = False
        self.grade_rows: dict[int, GradingRow] = {}
        self.report_rows: dict[UUID, ReportRow] = {}

    def expire(self, user_id: UUID) -> None:
        self.events.append("expire")
        for diagnosis in self.rows.values():
            if (
                diagnosis.user_id == user_id
                and diagnosis.status in ("stage1", "stage2")
                and diagnosis.started_at < datetime.now(UTC) - timedelta(days=3)
                and not (diagnosis.status == "stage1" and diagnosis.stage1_submitted_at)
            ):
                diagnosis.status = "aborted"
                diagnosis.abort_reason = "expired"

    def units(self) -> list[Unit]:
        self.events.append("units")
        return [
            Unit(
                id=1, grade="중1", number=1, name="단원", publisher="출판사", aliases=[]
            ),
            Unit(
                id=2,
                grade="중1",
                number=2,
                name="준비 중",
                publisher="출판사",
                aliases=[],
            ),
        ]

    def standards(self) -> list[StandardLink]:
        return [StandardLink(display_unit_id=1, standard_code="S")]

    def concepts(self) -> list[Concept]:
        return [Concept(id="S-C2", standard_code="S")]

    def assessments(self) -> list[Assessment]:
        return [
            Assessment(
                id="a",
                concept_id="S-C2",
                level="정의 이해",
                question_type="multiple_choice",
            )
        ]

    def _all_questions(self) -> list[Question]:
        return [
            Question(
                id=QUESTION,
                assessment_item_id="a",
                variant=1,
                question_type="written" if self.written else "multiple_choice",
                body="문제",
                figure=FIGURE,
                difficulty="normal",
                status="approved",
            ),
            Question(
                id=EXTRA_QUESTION,
                assessment_item_id="unused",
                variant=1,
                question_type="multiple_choice",
                body="다른 문제",
                difficulty="normal",
                status="approved",
            ),
        ]

    def question_slots(self) -> list[QuestionSlot]:
        self.events.append("question_slots")
        return [
            QuestionSlot.model_validate(q.model_dump()) for q in self._all_questions()
        ]

    def questions_by_ids(self, ids: list[UUID]) -> list[Question]:
        self.events.append(("questions_by_ids", tuple(ids)))
        wanted = set(ids)
        return [q for q in self._all_questions() if q.id in wanted]

    def history(self, user_id: UUID) -> dict[UUID, datetime]:
        return {}

    def in_progress(self, user_id: UUID) -> list[Diagnosis]:
        return [
            d
            for d in self.rows.values()
            if d.user_id == user_id and d.status in ("stage1", "stage2")
        ]

    def start(
        self, user_id: UUID, unit_id: int, restart: bool, ids: list[UUID]
    ) -> StartResult:
        current = next(
            (d for d in self.in_progress(user_id) if d.display_unit_id == unit_id), None
        )
        if current and not restart:
            return StartResult(result="in_progress", diagnosis_id=current.id)
        if current:
            current.status, current.abort_reason = "aborted", "restarted"
        diagnosis = Diagnosis(
            id=uuid4(),
            user_id=user_id,
            display_unit_id=unit_id,
            status="stage1",
            abort_reason=None,
            started_at=NOW,
            stage1_submitted_at=None,
        )
        self.rows[diagnosis.id] = diagnosis
        for qid in ids:
            self.item_rows.append(
                Item(
                    id=len(self.item_rows) + 1,
                    diagnosis_id=diagnosis.id,
                    user_id=user_id,
                    stage=1,
                    position=1,
                    question_id=qid,
                    assessment_item_id="a",
                )
            )
        return StartResult(result="created", diagnosis_id=diagnosis.id)

    def diagnosis(self, user_id: UUID, diagnosis_id: UUID) -> Diagnosis | None:
        self.events.append("diagnosis")
        d = self.rows.get(diagnosis_id)
        return d if d and d.user_id == user_id else None

    def items(self, user_id: UUID, diagnosis_id: UUID) -> list[Item]:
        return [
            i
            for i in self.item_rows
            if i.user_id == user_id and i.diagnosis_id == diagnosis_id
        ]

    def choices(self, question_id: UUID) -> list[Choice]:
        return [Choice(no=2, text="나"), Choice(no=1, text="가", figure=FIGURE)]

    def answers(self, user_id: UUID, item_ids: list[int]) -> list[AnswerRow]:
        return [a for i, a in self.answer_rows.items() if i in item_ids]

    def save_answer(self, user_id: UUID, item_id: int, answer: AnswerInput) -> Answer:
        if self.conflict:
            raise AnswerConflict
        row = AnswerRow(
            diagnosis_item_id=item_id,
            selected_choice=answer.selected_choice,
            written_text=answer.written_text,
            updated_at=NOW,
        )
        self.answer_rows[item_id] = row
        return Answer.model_validate(row.model_dump())

    def question_choices(self, question_id: UUID) -> list[QuestionChoice]:
        return [
            QuestionChoice(no=1, text="가", is_correct=True, misconception_id=None),
            QuestionChoice(no=2, text="나", is_correct=False, misconception_id=None),
        ]

    def rubric(self, question_id: UUID) -> list[RubricRow]:
        return [RubricRow(id=1, no=1, description="설명", points=1, required=True)]

    def misconceptions(self) -> list[MisconceptionRow]:
        return []

    def gradings(self, user_id: UUID, item_ids: list[int]) -> list[GradingRow]:
        return [g for key, g in self.grade_rows.items() if key in item_ids]

    def report(self, user_id: UUID, diagnosis_id: UUID) -> ReportRow | None:
        return self.report_rows.get(diagnosis_id)

    def answers_changed(self, gradings: list[dict[str, object]]) -> bool:
        for grade in gradings:
            item = GradingRow.model_validate(grade)
            current = self.answer_rows.get(item.diagnosis_item_id)
            value = grade.get("answer_updated_at")
            if not current or not isinstance(value, str):
                return True
            if current.updated_at != datetime.fromisoformat(value):
                return True
        return False

    def create_report(
        self,
        user_id: UUID,
        diagnosis_id: UUID,
        gradings: list[dict[str, object]],
        report: dict[str, object],
    ) -> str:
        if diagnosis_id in self.report_rows:
            return "exists"
        if self.answers_changed(gradings):
            return "answers_changed"
        for grade in gradings:
            row = GradingRow.model_validate(grade)
            self.grade_rows[row.diagnosis_item_id] = row
        self.report_rows[diagnosis_id] = ReportRow.model_validate(report)
        return "created"

    def submit_stage(
        self,
        user_id: UUID,
        diagnosis_id: UUID,
        stage: int,
        gradings: list[dict[str, object]],
        question_ids: list[UUID],
    ) -> str:
        self.events.append("submit")
        d = self.diagnosis(user_id, diagnosis_id)
        if d is None:
            return "not_found"
        if d.status != f"stage{stage}":
            return "not_in_progress"
        if self.answers_changed(gradings):
            return "answers_changed"
        if any(
            i.id not in self.answer_rows
            for i in self.items(user_id, diagnosis_id)
            if i.stage == stage
        ):
            return "unanswered"
        for grade in gradings:
            row = GradingRow.model_validate(grade)
            self.grade_rows[row.diagnosis_item_id] = row
        if stage == 1:
            d.stage1_submitted_at = NOW
        d.status = "stage2" if question_ids else "completed"
        for position, qid in enumerate(question_ids, 1):
            question = next(q for q in self._all_questions() if q.id == qid)
            self.item_rows.append(
                Item(
                    id=len(self.item_rows) + 1,
                    diagnosis_id=diagnosis_id,
                    user_id=user_id,
                    stage=2,
                    position=position,
                    question_id=qid,
                    assessment_item_id=question.assessment_item_id,
                )
            )
        return "submitted"


def test_api(client: tuple[TestClient, ec.EllipticCurvePrivateKey]) -> None:
    tc, key = client
    profiles = FakeProfiles()
    profiles.rows[USER_ID] = Profile(
        id=USER_ID, signup_status="completed", signup_completed_at=NOW
    )
    repo = FakeDiagnoses()
    app.dependency_overrides[get_profiles] = lambda: profiles
    app.dependency_overrides[get_diagnoses] = lambda: repo
    headers = {"Authorization": f"Bearer {token(key)}"}
    assert tc.get("/units").status_code == 401
    profiles.rows.clear()
    assert tc.get("/units", headers=headers).status_code == 403
    profiles.complete_signup(USER_ID)
    units = tc.get("/units", headers=headers)
    assert [u["status"] for u in units.json()] == ["full", "unavailable"]
    assert repo.events[0] == "expire"
    assert (
        tc.post("/diagnoses", headers=headers, json={"display_unit_id": 99}).status_code
        == 404
    )
    assert (
        tc.post("/diagnoses", headers=headers, json={"display_unit_id": 2}).status_code
        == 422
    )
    start = tc.post("/diagnoses", headers=headers, json={"display_unit_id": 1})
    assert start.status_code == 201
    did = start.json()["diagnosis_id"]
    assert tc.post("/diagnoses", headers=headers, json={"display_unit_id": 1}).json()[
        "detail"
    ] == {"code": "in_progress", "diagnosis_id": did}
    detail = tc.get(f"/diagnoses/{did}", headers=headers)
    assert detail.status_code == 200
    item = detail.json()["items"][0]
    assert [c["no"] for c in item["choices"]] == [1, 2]
    assert item["figure"]["kind"] == "boxplot"
    assert item["choices"][0]["figure"]["kind"] == "boxplot"
    assert all(
        "is_correct" not in c and "misconception_id" not in c for c in item["choices"]
    )
    assert set(item) == {
        "id",
        "stage",
        "position",
        "question_type",
        "body",
        "figure",
        "choices",
        "answer",
    }
    path = f"/diagnoses/{did}/items/{item['id']}/answer"
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json()["detail"][
            "code"
        ]
        == "unanswered"
    )
    for body in (
        {},
        {"selected_choice": 6},
        {"selected_choice": 1, "written_text": "x"},
        {"selected_choice": 1, "written_text": None},
        {"written_text": "x"},
        {"written_text": "x" * 1001},
    ):
        assert tc.put(path, headers=headers, json=body).status_code == 422
    repo.conflict = True
    assert tc.put(path, headers=headers, json={"selected_choice": 1}).status_code == 409
    repo.conflict = False
    assert tc.put(path, headers=headers, json={"selected_choice": 1}).status_code == 200
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).status_code == 200
    )
    assert tc.put(path, headers=headers, json={"selected_choice": 2}).status_code == 409
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json()["detail"][
            "code"
        ]
        == "not_in_progress"
    )
    repo.rows[UUID(did)].user_id = uuid4()
    for method, url in [
        ("get", f"/diagnoses/{did}"),
        ("put", path),
        ("post", f"/diagnoses/{did}/stages/1/submit"),
    ]:
        repo.events.clear()
        response = tc.request(
            method,
            url,
            headers=headers,
            json={"selected_choice": 1} if method == "put" else None,
        )
        assert response.status_code == 404
        assert repo.events[0] == "expire"
    preflight = tc.options(
        path,
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PUT",
        },
    )
    assert preflight.status_code == 200
    assert "PUT" in preflight.headers["access-control-allow-methods"]


def test_question_bank_load_split(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    tc, key = client
    profiles = FakeProfiles()
    profiles.complete_signup(USER_ID)
    repo = FakeDiagnoses()
    app.dependency_overrides[get_profiles] = lambda: profiles
    app.dependency_overrides[get_diagnoses] = lambda: repo
    headers = {"Authorization": f"Bearer {token(key)}"}

    repo.events.clear()
    assert tc.get("/units", headers=headers).status_code == 200
    assert "question_slots" in repo.events
    assert not any(event[0] == "questions_by_ids" for event in repo.events)

    repo.events.clear()
    start = tc.post("/diagnoses", headers=headers, json={"display_unit_id": 1})
    assert start.status_code == 201
    did = start.json()["diagnosis_id"]
    assert "question_slots" in repo.events
    assert not any(event[0] == "questions_by_ids" for event in repo.events)

    repo.events.clear()
    assert tc.get(f"/diagnoses/{did}", headers=headers).status_code == 200
    by_ids = [event for event in repo.events if event[0] == "questions_by_ids"]
    assert len(by_ids) == 1
    assert set(by_ids[0][1]) == {QUESTION}
    assert EXTRA_QUESTION not in set(by_ids[0][1])


def test_restart_written_and_expiry(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    tc, key = client
    profiles = FakeProfiles()
    profiles.complete_signup(USER_ID)
    repo = FakeDiagnoses()
    repo.written = True
    app.dependency_overrides[get_profiles] = lambda: profiles
    app.dependency_overrides[get_diagnoses] = lambda: repo
    headers = {"Authorization": f"Bearer {token(key)}"}
    first = tc.post("/diagnoses", headers=headers, json={"display_unit_id": 1}).json()[
        "diagnosis_id"
    ]
    second = tc.post(
        "/diagnoses", headers=headers, json={"display_unit_id": 1, "restart": True}
    ).json()["diagnosis_id"]
    assert repo.rows[UUID(first)].abort_reason == "restarted"
    detail = tc.get(f"/diagnoses/{second}", headers=headers).json()
    assert detail["items"][0]["choices"] == []
    path = f"/diagnoses/{second}/items/{detail['items'][0]['id']}/answer"
    assert tc.put(path, headers=headers, json={"selected_choice": 1}).status_code == 422
    assert (
        tc.put(path, headers=headers, json={"written_text": "풀이"}).status_code == 200
    )
    repo.rows[UUID(second)].started_at = NOW - timedelta(days=4)
    repo.events.clear()
    result = tc.get(f"/diagnoses/{second}", headers=headers)
    assert repo.events[0] == "expire"
    assert result.json()["abort_reason"] == "expired"
    assert (
        tc.put(path, headers=headers, json={"written_text": "수정"}).status_code == 409
    )
    assert (
        tc.post(f"/diagnoses/{second}/stages/1/submit", headers=headers).json()[
            "detail"
        ]["code"]
        == "not_in_progress"
    )
