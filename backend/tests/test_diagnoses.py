from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from test_auth import USER_ID, FakeProfiles, token

from app.diagnoses.repository import AnswerConflict, get_diagnoses
from app.diagnoses.schemas import (
    Answer,
    AnswerInput,
    AnswerRow,
    Assessment,
    Choice,
    Concept,
    Diagnosis,
    Item,
    Question,
    StandardLink,
    StartResult,
    Unit,
)
from app.main import app
from app.profiles import Profile, get_profiles

pytest_plugins = ["test_auth"]

NOW = datetime.now(UTC)
QUESTION = uuid4()


class FakeDiagnoses:
    def __init__(self) -> None:
        self.rows: dict[UUID, Diagnosis] = {}
        self.item_rows: list[Item] = []
        self.answer_rows: dict[int, AnswerRow] = {}
        self.events: list[str] = []
        self.conflict = False
        self.written = False

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

    def questions(self) -> list[Question]:
        return [
            Question(
                id=QUESTION,
                assessment_item_id="a",
                variant=1,
                question_type="written" if self.written else "multiple_choice",
                body="문제",
                difficulty="normal",
                status="approved",
            )
        ]

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
        return [Choice(no=2, text="나"), Choice(no=1, text="가")]

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

    def submit(self, user_id: UUID, diagnosis_id: UUID) -> str:
        self.events.append("submit")
        d = self.diagnosis(user_id, diagnosis_id)
        if d is None:
            return "not_found"
        if d.stage1_submitted_at:
            return "already_submitted"
        if d.status != "stage1":
            return "not_in_progress"
        if any(i.id not in self.answer_rows for i in self.items(user_id, diagnosis_id)):
            return "unanswered"
        d.stage1_submitted_at = NOW
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
    assert set(item) == {
        "id",
        "stage",
        "position",
        "question_type",
        "body",
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
        == "already_submitted"
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
