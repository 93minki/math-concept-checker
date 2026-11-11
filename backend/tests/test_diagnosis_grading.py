from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from test_auth import USER_ID, FakeProfiles, token
from test_diagnoses import FakeDiagnoses

from app.ai.prompts import PROMPT_VERSION
from app.ai.schemas import (
    ConceptData,
    Grading,
    Misconception,
    ReportInput,
    ReportText,
    RubricElement,
)
from app.ai.schemas import Question as AIQuestion
from app.diagnoses.ai import AIGrade, AIReport, FakeAI, get_ai
from app.diagnoses.repository import get_diagnoses
from app.diagnoses.schemas import (
    Assessment,
    Concept,
    MisconceptionRow,
    Question,
    QuestionChoice,
    RubricRow,
    StandardLink,
)
from app.diagnoses.service import student_description
from app.main import app
from app.profiles import get_profiles

pytest_plugins = ["test_auth"]
HARD, OLD = uuid4(), uuid4()


class RichRepo(FakeDiagnoses):
    def __init__(self) -> None:
        super().__init__()
        self.has_hard = True
        self.seen_hard = False

    def standards(self) -> list[StandardLink]:
        return [StandardLink(display_unit_id=1, standard_code="9수02-03")]

    def concepts(self) -> list[Concept]:
        return [Concept(id="9수02-03-C4", standard_code="9수02-03", name="등식의 성질")]

    def assessments(self) -> list[Assessment]:
        return [
            Assessment(
                id="a",
                concept_id="9수02-03-C4",
                level="이유 설명",
                question_type="written" if self.written else "multiple_choice",
            )
        ]

    def _all_questions(self) -> list[Question]:
        normal = super()._all_questions()[0]
        normal.explanation = "풀이 설명"
        normal.model_answer = "양변에 같은 수를 더해요"
        if not self.has_hard:
            return [normal]
        return [
            normal,
            normal.model_copy(
                update={"id": HARD, "difficulty": "hard", "variant": 1, "body": "심화"}
            ),
            normal.model_copy(
                update={
                    "id": OLD,
                    "difficulty": "hard",
                    "variant": 2,
                    "body": "이전 심화",
                }
            ),
        ]

    def history(self, user_id: UUID) -> dict[UUID, datetime]:
        return {OLD: datetime.now(UTC)} if self.seen_hard else {}

    def misconceptions(self) -> list[MisconceptionRow]:
        return [
            MisconceptionRow(
                id="9수02-03-M2",
                standard_code="9수02-03",
                local_id="M2",
                content="한쪽에만 연산",
                concept_ids=["9수02-03-C4"],
            )
        ]

    def question_choices(self, question_id: UUID) -> list[QuestionChoice]:
        return [
            QuestionChoice(no=1, text="가", is_correct=True, misconception_id=None),
            QuestionChoice(
                no=2, text="나", is_correct=False, misconception_id="9수02-03-M2"
            ),
        ]

    def rubric(self, question_id: UUID) -> list[RubricRow]:
        return [
            RubricRow(
                id=1,
                no=1,
                description="양변 설명",
                points=1,
                required=True,
                related_misconception_ids=["9수02-03-M2"],
            )
        ]


class TrackingAI(FakeAI):
    def __init__(self) -> None:
        self.grade_calls = 0
        self.report_calls = 0
        self.fail_grade = False
        self.fail_report = False
        self.detect = False

    def grade(
        self,
        question: AIQuestion,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade:
        self.grade_calls += 1
        assert [m.id for m in misconceptions] == ["M2"]
        assert rubric[0].related_misconception_ids == ["M2"]
        if self.fail_grade:
            raise ValueError("failed")
        result = super().grade(question, rubric, answer, misconceptions)
        if self.detect:
            return AIGrade(
                Grading(
                    element_results=result.grading.element_results,
                    detected_misconception_ids=["M2"],
                ),
                "fake",
                PROMPT_VERSION,
            )
        return result

    def report(self, data: ReportInput, context: ConceptData) -> AIReport:
        self.report_calls += 1
        if self.fail_report:
            raise ValueError("failed")
        return AIReport(
            ReportText(
                not_understood="설명",
                misconception_explanations="그럴 수 있어요",
                next_steps="다시 연습해요",
            ),
            "fake",
            PROMPT_VERSION,
        )


@pytest.fixture
def setup(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> tuple[TestClient, dict[str, str], RichRepo, TrackingAI]:
    tc, key = client
    repo = RichRepo()
    ai = TrackingAI()
    profiles = FakeProfiles()
    profiles.complete_signup(USER_ID)
    app.dependency_overrides[get_profiles] = lambda: profiles
    app.dependency_overrides[get_diagnoses] = lambda: repo
    app.dependency_overrides[get_ai] = lambda: ai
    return tc, {"Authorization": f"Bearer {token(key)}"}, repo, ai


def start(tc: TestClient, headers: dict[str, str]) -> tuple[str, int]:
    response = tc.post("/diagnoses", headers=headers, json={"display_unit_id": 1})
    assert response.status_code == 201
    did: str = response.json()["diagnosis_id"]
    return did, int(
        tc.get(f"/diagnoses/{did}", headers=headers).json()["items"][0]["id"]
    )


def test_choice_to_hard_and_submit_report(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    repo.seen_hard = True
    did, item_id = start(tc, headers)
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json()["detail"][
            "code"
        ]
        == "unanswered"
    )
    assert ai.grade_calls == 0 and "submit" not in repo.events
    assert (
        tc.put(
            f"/diagnoses/{did}/items/{item_id}/answer",
            headers=headers,
            json={"selected_choice": 1},
        ).status_code
        == 200
    )
    assert tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json() == {
        "status": "stage2",
        "report_ready": False,
    }
    assert repo.items(USER_ID, UUID(did))[-1].question_id == HARD
    detail = tc.get(f"/diagnoses/{did}", headers=headers).json()
    assert all(
        "result" not in item and "explanation" not in item for item in detail["items"]
    )
    hard_id = detail["items"][-1]["id"]
    assert (
        tc.put(
            f"/diagnoses/{did}/items/{hard_id}/answer",
            headers=headers,
            json={"selected_choice": 2},
        ).status_code
        == 200
    )
    assert tc.post(f"/diagnoses/{did}/stages/2/submit", headers=headers).json() == {
        "status": "completed",
        "report_ready": True,
    }
    report = tc.get(f"/diagnoses/{did}/report", headers=headers).json()
    assert report["unit_stage"] == "기본 이해"
    assert report["concepts"][0]["misconceptions"] == ["한쪽에만 연산"]
    assert "unit_score" not in report and "concept_id" not in report["concepts"][0]
    assert ai.report_calls == 1
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 200
    assert ai.report_calls == 1
    finished = tc.get(f"/diagnoses/{did}", headers=headers).json()["items"]
    assert finished[1]["result"]["correct_choice"] == 1
    assert finished[1]["result"]["passed"] is False
    assert "score" not in finished[1]["result"]


def test_written_failure_and_id_conversion(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    repo.written = True
    repo.has_hard = False
    ai.fail_grade = True
    did, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"written_text": "한쪽에만 더해요"},
    )
    response = tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers)
    assert (
        response.status_code == 503
        and response.json()["detail"]["code"] == "grading_failed"
    )
    assert "submit" not in repo.events and not repo.grade_rows
    ai.fail_grade = False
    ai.detect = True
    assert tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json() == {
        "status": "completed",
        "report_ready": True,
    }
    assert repo.grade_rows[item_id].detected_misconception_ids == ["9수02-03-M2"]
    assert (
        tc.get(f"/diagnoses/{did}", headers=headers).json()["items"][0]["result"][
            "elements"
        ][0]["met"]
        is True
    )


def test_aborted_report_grades_answered_and_no_report_for_stage1(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    did, item_id = start(tc, headers)
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 409
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"selected_choice": 1},
    )
    tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers)
    hard = repo.items(USER_ID, UUID(did))[-1]
    tc.put(
        f"/diagnoses/{did}/items/{hard.id}/answer",
        headers=headers,
        json={"selected_choice": 2},
    )
    repo.rows[UUID(did)].status = "aborted"
    repo.rows[UUID(did)].abort_reason = "expired"
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 200
    assert hard.id in repo.grade_rows
    assert ai.report_calls == 1


def test_report_failure_and_access(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    repo.has_hard = False
    ai.fail_report = True
    did, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"selected_choice": 2},
    )
    assert tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json() == {
        "status": "completed",
        "report_ready": False,
    }
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 503
    ai.fail_report = False
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 200
    assert tc.get(f"/diagnoses/{did}/report").status_code == 401
    repo.rows[UUID(did)].user_id = uuid4()
    assert tc.get(f"/diagnoses/{did}", headers=headers).status_code == 404
    assert tc.get(f"/diagnoses/{did}/report", headers=headers).status_code == 404
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).status_code == 404
    )
    assert (
        tc.post(f"/diagnoses/{did}/stages/2/submit", headers=headers).status_code == 404
    )


def test_start_does_not_call_ai(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    did, item_id = start(tc, headers)
    assert did and item_id
    assert ai.grade_calls == 0
    assert ai.report_calls == 0
    assert not repo.grade_rows


def test_missing_hard_is_distinguished_from_unanswered(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, _ = setup
    repo.has_hard = False
    did, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"selected_choice": 1},
    )
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).json()[
            "report_ready"
        ]
        is True
    )
    concept = tc.get(f"/diagnoses/{did}/report", headers=headers).json()["concepts"][0]
    assert concept["deep_not_measured"] is True
    assert concept["deep_not_attempted"] is False

    repo.has_hard = True
    second, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{second}/items/{item_id}/answer",
        headers=headers,
        json={"selected_choice": 1},
    )
    tc.post(f"/diagnoses/{second}/stages/1/submit", headers=headers)
    repo.rows[UUID(second)].status = "aborted"
    repo.rows[UUID(second)].abort_reason = "expired"
    concept = tc.get(f"/diagnoses/{second}/report", headers=headers).json()["concepts"][
        0
    ]
    assert concept["deep_not_attempted"] is True
    assert concept["deep_not_measured"] is False
    assert len(repo.grade_rows) == 2


def test_aborted_stage1_has_no_report(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
) -> None:
    tc, headers, repo, ai = setup
    did, _ = start(tc, headers)
    repo.rows[UUID(did)].status = "aborted"
    repo.rows[UUID(did)].abort_reason = "expired"
    response = tc.get(f"/diagnoses/{did}/report", headers=headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "no_report"
    assert ai.report_calls == 0


@pytest.mark.parametrize("stage", [1, 2])
def test_answer_changed_during_grading_rejects_submit(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
    monkeypatch: pytest.MonkeyPatch,
    stage: int,
) -> None:
    tc, headers, repo, ai = setup
    repo.written = True
    did, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"written_text": "처음 답"},
    )
    if stage == 2:
        assert (
            tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).status_code
            == 200
        )
        item_id = repo.items(USER_ID, UUID(did))[-1].id
        tc.put(
            f"/diagnoses/{did}/items/{item_id}/answer",
            headers=headers,
            json={"written_text": "심화 답"},
        )
    old_grade = ai.grade

    def grade_and_change(
        question: AIQuestion,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade:
        result = old_grade(question, rubric, answer, misconceptions)
        row = repo.answer_rows[item_id]
        repo.answer_rows[item_id] = row.model_copy(
            update={
                "written_text": "바뀐 답",
                "updated_at": row.updated_at + timedelta(seconds=1),
            }
        )
        return result

    monkeypatch.setattr(ai, "grade", grade_and_change)
    response = tc.post(f"/diagnoses/{did}/stages/{stage}/submit", headers=headers)
    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "answers_changed"}
    assert item_id not in repo.grade_rows
    assert repo.rows[UUID(did)].status == f"stage{stage}"
    assert UUID(did) not in repo.report_rows


def test_answer_changed_during_aborted_report_returns_conflict(
    setup: tuple[TestClient, dict[str, str], RichRepo, TrackingAI],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tc, headers, repo, ai = setup
    repo.written = True
    did, item_id = start(tc, headers)
    tc.put(
        f"/diagnoses/{did}/items/{item_id}/answer",
        headers=headers,
        json={"written_text": "기본 답"},
    )
    assert (
        tc.post(f"/diagnoses/{did}/stages/1/submit", headers=headers).status_code == 200
    )
    hard_id = repo.items(USER_ID, UUID(did))[-1].id
    tc.put(
        f"/diagnoses/{did}/items/{hard_id}/answer",
        headers=headers,
        json={"written_text": "심화 답"},
    )
    repo.rows[UUID(did)].status = "aborted"
    repo.rows[UUID(did)].abort_reason = "expired"
    old_grade = ai.grade

    def grade_and_change(
        question: AIQuestion,
        rubric: list[RubricElement],
        answer: str,
        misconceptions: list[Misconception],
    ) -> AIGrade:
        result = old_grade(question, rubric, answer, misconceptions)
        row = repo.answer_rows[hard_id]
        repo.answer_rows[hard_id] = row.model_copy(
            update={
                "written_text": "바뀐 답",
                "updated_at": row.updated_at + timedelta(seconds=1),
            }
        )
        return result

    monkeypatch.setattr(ai, "grade", grade_and_change)
    response = tc.get(f"/diagnoses/{did}/report", headers=headers)
    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "answers_changed"}
    assert hard_id not in repo.grade_rows
    assert UUID(did) not in repo.report_rows


@pytest.mark.parametrize(
    ("raw", "shown"),
    [
        ("필수: 양변에 같은 수를 더한다", "양변에 같은 수를 더한다"),
        ("필수 : 등호의 뜻", "등호의 뜻"),
        ("(필수) 이유를 쓴다", "이유를 쓴다"),
        ("[필수] 이유를 쓴다", "이유를 쓴다"),
        ("등호 양쪽이 같다 (필수: 아님)", "등호 양쪽이 같다 (필수: 아님)"),
    ],
)
def test_student_description_drops_required_label(raw: str, shown: str) -> None:
    assert student_description(raw) == shown
