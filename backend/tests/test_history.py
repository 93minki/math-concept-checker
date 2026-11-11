from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock
from uuid import UUID, uuid4

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from test_auth import USER_ID, FakeProfiles, token
from test_diagnoses import FakeDiagnoses

from app.diagnoses.repository import SupabaseDiagnoses, get_diagnoses
from app.diagnoses.schemas import HistoryCursor, HistoryItem, HistoryUnit
from app.main import app
from app.profiles import get_profiles

pytest_plugins = ["test_auth"]


class HistoryRepo(FakeDiagnoses):
    def __init__(self) -> None:
        super().__init__()
        self.history_rows: list[tuple[UUID, HistoryItem]] = []

    def list_diagnoses(
        self, user_id: UUID, limit: int, before: HistoryCursor | None
    ) -> list[HistoryItem]:
        self.events.append("list")
        rows = [item for owner, item in self.history_rows if owner == user_id]
        if before:
            rows = [
                r for r in rows if (r.started_at, r.id) < (before.started_at, before.id)
            ]
        return sorted(rows, key=lambda r: (r.started_at, r.id), reverse=True)[:limit]


def test_history_api(client: tuple[TestClient, ec.EllipticCurvePrivateKey]) -> None:
    tc, key = client
    profiles = FakeProfiles()
    repo = HistoryRepo()
    app.dependency_overrides[get_profiles] = lambda: profiles
    app.dependency_overrides[get_diagnoses] = lambda: repo
    headers = {"Authorization": f"Bearer {token(key)}"}
    assert tc.get("/diagnoses").status_code == 401
    assert tc.get("/diagnoses", headers=headers).status_code == 403
    profiles.complete_signup(USER_ID)
    assert tc.get("/diagnoses", headers=headers).json() == {
        "items": [],
        "next_before": None,
    }
    now = datetime.now(UTC)
    unit = HistoryUnit(grade="중1", name="단원", publisher="출판사")
    for i in range(25):
        repo.history_rows.append(
            (
                USER_ID,
                HistoryItem(
                    id=uuid4(),
                    status="completed",
                    abort_reason=None,
                    started_at=now - timedelta(seconds=i // 4),
                    completed_at=now,
                    aborted_at=None,
                    unit=unit,
                ),
            )
        )
    other = repo.history_rows[0][1].model_copy(update={"id": uuid4()})
    repo.history_rows.append((uuid4(), other))
    repo.events.clear()
    first = tc.get("/diagnoses", headers=headers).json()
    assert repo.events == ["expire", "list"]
    assert len(first["items"]) == 20
    assert set(first["items"][0]) == {
        "id",
        "status",
        "abort_reason",
        "started_at",
        "completed_at",
        "aborted_at",
        "unit",
    }
    assert set(first["items"][0]["unit"]) == {"grade", "name", "publisher"}
    for value in ("0", "51", "no"):
        assert (
            tc.get("/diagnoses", headers=headers, params={"limit": value}).status_code
            == 422
        )
    for value in ("bad", "e30=", "", "!!!!"):
        assert (
            tc.get("/diagnoses", headers=headers, params={"before": value}).status_code
            == 422
        )
    expected = [
        str(item.id)
        for owner, item in sorted(
            repo.history_rows,
            key=lambda pair: (pair[1].started_at, pair[1].id),
            reverse=True,
        )
        if owner == USER_ID
    ]
    found: list[str] = []
    params: dict[str, str | int] = {"limit": 2}
    while True:
        response = tc.get("/diagnoses", headers=headers, params=params)
        assert response.status_code == 200
        page = response.json()
        found.extend(item["id"] for item in page["items"])
        if page["next_before"] is None:
            break
        params["before"] = page["next_before"]
    assert found == expected
    assert str(other.id) not in found


def test_history_query_filters_user_and_cursor() -> None:
    client = MagicMock()
    query = client.table.return_value.select.return_value.eq.return_value
    query.or_.return_value = query
    query.order.return_value = query
    query.limit.return_value = query
    query.execute.return_value.data = []
    user = uuid4()
    cursor = HistoryCursor(started_at=datetime.now(UTC), id=uuid4())
    assert SupabaseDiagnoses(client).list_diagnoses(user, 3, cursor) == []
    client.table.return_value.select.return_value.eq.assert_called_once_with(
        "user_id", str(user)
    )
    query.or_.assert_called_once_with(
        f"started_at.lt.{cursor.started_at.isoformat()},and(started_at.eq.{cursor.started_at.isoformat()},id.lt.{cursor.id})"
    )
    assert query.order.call_count == 2
    query.limit.assert_called_once_with(3)
