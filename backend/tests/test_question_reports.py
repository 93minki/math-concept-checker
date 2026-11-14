from uuid import UUID, uuid4

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from test_auth import USER_ID, token

from app.main import app
from app.question_reports import DuplicateReport, get_report_repository
from app.question_revision_ai import get_revision_engine

pytest_plugins = ["test_auth"]


class FakeReports:
    def __init__(self) -> None:
        self.question_id = uuid4()
        self.admin = False
        self.rev_id = uuid4()
        self.rev_status = "failed"
        self.replacement = uuid4()
        self.events: list[tuple[object, ...]] = []
        self.saved: list[dict[str, object]] = []

    def is_admin(self, user_id: UUID) -> bool:
        return self.admin and user_id == USER_ID

    def grouped_reports(self, report_status: str | None) -> list[dict[str, object]]:
        return [
            {
                "question_id": str(self.question_id),
                "report_count": 1,
                "status": report_status,
            }
        ]

    def question_details(self, question_id: UUID) -> dict[str, object] | None:
        return (
            {"question": {"id": str(question_id)}}
            if question_id == self.question_id
            else None
        )

    def save_revision(self, row: dict[str, object]) -> dict[str, object]:
        self.events.append(("save", row))
        return row

    def revision(self, revision_id: UUID) -> dict[str, object] | None:
        return (
            {"id": str(revision_id), "status": self.rev_status}
            if revision_id == self.rev_id
            else None
        )

    def replace_question(self, revision_id: UUID, admin_id: UUID) -> UUID:
        self.events.append(("replace", revision_id, admin_id))
        return self.replacement

    def update_reports(self, question_id: UUID, target: str, note: str | None) -> int:
        self.events.append(("update", question_id, target, note))
        return 1

    def question_for_item(self, user_id: UUID, item_id: int) -> UUID | None:
        return self.question_id if user_id == USER_ID and item_id == 1 else None

    def create(
        self,
        user_id: UUID,
        item_id: int,
        question_id: UUID,
        kind: str,
        description: str,
    ) -> dict[str, object]:
        if self.saved:
            raise DuplicateReport
        row: dict[str, object] = {
            "id": str(uuid4()),
            "status": "received",
            "kind": kind,
            "description": description,
        }
        self.saved.append(row)
        return row

    def list_own(self, user_id: UUID) -> list[dict[str, object]]:
        assert user_id == USER_ID
        return self.saved


def test_student_reports_are_authenticated_and_own_only(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    tc, key = client
    repo = FakeReports()
    app.dependency_overrides[get_report_repository] = lambda: repo
    payload = {"diagnosis_item_id": 1, "kind": "text", "description": "글 오류"}
    assert tc.post("/question-reports", json=payload).status_code == 401
    assert tc.get("/question-reports").status_code == 401
    headers = {"Authorization": f"Bearer {token(key)}"}
    assert (
        tc.post(
            "/question-reports",
            json={**payload, "diagnosis_item_id": 2},
            headers=headers,
        ).status_code
        == 404
    )
    assert (
        tc.post(
            "/question-reports",
            json={**payload, "description": "가" * 501},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        tc.post("/question-reports", json=payload, headers=headers).status_code == 201
    )
    assert (
        tc.post("/question-reports", json=payload, headers=headers).status_code == 409
    )
    response = tc.get("/question-reports", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert "explanation" not in response.text and "is_correct" not in response.text


def test_admin_endpoints_reject_non_admin(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    tc, key = client
    repo = FakeReports()
    app.dependency_overrides[get_report_repository] = lambda: repo
    headers = {"Authorization": f"Bearer {token(key)}"}
    q = str(uuid4())
    paths: list[tuple[str, str, dict[str, object] | None]] = [
        ("GET", "/admin/me", None),
        ("GET", "/admin/reports", None),
        ("GET", f"/admin/questions/{q}", None),
        ("POST", f"/admin/questions/{q}/revisions/ai", None),
        ("POST", f"/admin/questions/{q}/revisions", {"payload": {}}),
        ("POST", f"/admin/revisions/{q}/approve", None),
        ("POST", f"/admin/questions/{q}/no-issue", {"note": "확인"}),
        ("POST", f"/admin/questions/{q}/in-review", None),
    ]
    for method, path, data in paths:
        assert tc.request(method, path, headers=headers, json=data).status_code == 403
        assert tc.request(method, path, json=data).status_code == 401


class FakeRevisionEngine:
    def generate(self, details: dict[str, object]) -> dict[str, object]:
        return {
            "payload": {"body": "수정안"},
            "status": "passed",
            "checks": [],
            "ai_cost": "0",
        }

    def check_manual(
        self, details: dict[str, object], payload: dict[str, object]
    ) -> dict[str, object]:
        return {
            "payload": payload,
            "status": "failed",
            "checks": [{"issues": ["오류"]}],
            "ai_cost": "0",
        }


def test_admin_me(client: tuple[TestClient, ec.EllipticCurvePrivateKey]) -> None:
    tc, key = client
    repo = FakeReports()
    app.dependency_overrides[get_report_repository] = lambda: repo
    assert tc.get("/admin/me").status_code == 401
    headers = {"Authorization": f"Bearer {token(key)}"}
    assert tc.get("/admin/me", headers=headers).status_code == 403
    repo.admin = True
    assert tc.get("/admin/me", headers=headers).json() == {"admin": True}


def test_admin_workflow(client: tuple[TestClient, ec.EllipticCurvePrivateKey]) -> None:
    tc, key = client
    repo = FakeReports()
    repo.admin = True
    app.dependency_overrides[get_report_repository] = lambda: repo
    app.dependency_overrides[get_revision_engine] = lambda: FakeRevisionEngine()
    headers = {"Authorization": f"Bearer {token(key)}"}
    qid = repo.question_id
    assert (
        tc.get("/admin/reports?status=received", headers=headers).json()[0][
            "report_count"
        ]
        == 1
    )
    assert tc.get(f"/admin/questions/{qid}", headers=headers).status_code == 200
    assert tc.get(f"/admin/questions/{uuid4()}", headers=headers).status_code == 404
    ai = tc.post(f"/admin/questions/{qid}/revisions/ai", headers=headers)
    assert ai.status_code == 201 and ai.json()["status"] == "passed"
    manual = tc.post(
        f"/admin/questions/{qid}/revisions",
        headers=headers,
        json={"payload": {"body": "수정"}},
    )
    assert manual.status_code == 201 and manual.json()["status"] == "failed"
    assert (
        tc.post(f"/admin/revisions/{repo.rev_id}/approve", headers=headers).status_code
        == 409
    )
    repo.rev_status = "passed"
    approved = tc.post(f"/admin/revisions/{repo.rev_id}/approve", headers=headers)
    assert approved.json() == {
        "replacement_question_id": str(repo.replacement),
        "export_needed": True,
    }
    assert ("replace", repo.rev_id, USER_ID) in repo.events
    assert (
        tc.post(f"/admin/questions/{qid}/in-review", headers=headers).json()["updated"]
        == 1
    )
    assert (
        tc.post(
            f"/admin/questions/{qid}/no-issue", headers=headers, json={"note": "정상"}
        ).json()["updated"]
        == 1
    )
    assert ("update", qid, "in_review", None) in repo.events
    assert ("update", qid, "no_issue", "정상") in repo.events


def test_repository_enriches_admin_responses_without_leaking_answers_in_list() -> None:
    from types import SimpleNamespace
    from typing import cast
    from unittest.mock import MagicMock

    from supabase import Client

    from app.question_reports import SupabaseReports

    qid = str(uuid4())
    rows: dict[str, list[dict[str, object]]] = {
        "question_reports": [
            {"question_id": qid, "status": "received", "created_at": "2026-01-01"}
        ],
        "questions": [
            {
                "id": qid,
                "assessment_item_id": "a",
                "body": "가" * 90,
                "explanation": "관리자만",
            }
        ],
        "assessment_items": [
            {
                "id": "a",
                "level": "정의 이해",
                "concepts": {"name": "문자", "standard_code": "9수02-03"},
            }
        ],
        "display_unit_standards": [
            {"display_units": {"grade": "중1", "number": 3, "name": "문자의 사용과 식"}}
        ],
        "question_choices": [],
        "rubric_elements": [],
        "question_revisions": [],
    }
    client = MagicMock()

    def table(name: str) -> MagicMock:
        query = MagicMock()
        query.select.return_value = query
        query.eq.return_value = query
        query.order.return_value = query
        query.range.return_value = query
        query.execute.return_value = SimpleNamespace(data=rows[name])
        return query

    client.table.side_effect = table
    repo = SupabaseReports(cast(Client, client))
    result = repo.grouped_reports(None)[0]
    assert result["unit"] == {"grade": "중1", "number": 3, "name": "문자의 사용과 식"}
    assert result["assessment_item"] == {"id": "a", "name": "문자 · 정의 이해"}
    assert result["body_summary"] == "가" * 80
    assert "explanation" not in result
    detail = repo.question_details(UUID(qid))
    assert detail is not None
    assert detail["unit"] == result["unit"]
    assert detail["assessment_item"] == result["assessment_item"]
    assert cast(dict[str, object], detail["question"])["explanation"] == "관리자만"
