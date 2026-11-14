from typing import cast
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import httpx2
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from supabase import Client
from test_auth import USER_ID, token

from app.account import KakaoUnlinker, SupabaseAccountAdmin, get_account_admin
from app.main import app

pytest_plugins = ["test_auth"]


class FakeAdmin:
    def __init__(
        self,
        *,
        kakao: bool = False,
        fail_unlink: bool = False,
        fail_delete: bool = False,
    ) -> None:
        self.kakao = kakao
        self.fail_unlink = fail_unlink
        self.fail_delete = fail_delete
        self.events: list[tuple[str, object]] = []

    def kakao_id(self, user_id: UUID) -> str | None:
        self.events.append(("get", user_id))
        return "12345" if self.kakao else None

    def unlink(self, kakao_id: str) -> None:
        self.events.append(("unlink", kakao_id))
        if self.fail_unlink:
            raise RuntimeError("example-key")

    def delete(self, user_id: UUID) -> None:
        self.events.append(("delete", user_id))
        if self.fail_delete:
            raise RuntimeError("example-key")


def test_account_auth_and_identity(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    tc, key = client
    admin = FakeAdmin()
    app.dependency_overrides[get_account_admin] = lambda: admin
    assert tc.delete("/account").status_code == 401
    assert (
        tc.delete("/account", headers={"Authorization": "Bearer invalid"}).status_code
        == 401
    )
    other = str(uuid4())
    result = tc.request(
        "DELETE",
        f"/account?user_id={other}",
        headers={"Authorization": f"Bearer {token(key)}"},
        json={"user_id": other},
    )
    assert result.status_code == 204
    assert admin.events == [("get", USER_ID), ("delete", USER_ID)]


@pytest.mark.parametrize(
    "fail_unlink,fail_delete,code",
    [
        (False, False, None),
        (True, False, "kakao_unlink_failed"),
        (False, True, "delete_failed"),
    ],
)
def test_account_kakao_order_and_failures(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
    caplog: pytest.LogCaptureFixture,
    fail_unlink: bool,
    fail_delete: bool,
    code: str | None,
) -> None:
    tc, key = client
    admin = FakeAdmin(kakao=True, fail_unlink=fail_unlink, fail_delete=fail_delete)
    app.dependency_overrides[get_account_admin] = lambda: admin
    result = tc.delete("/account", headers={"Authorization": f"Bearer {token(key)}"})
    assert result.status_code == (204 if code is None else 502)
    if code:
        assert result.json() == {"code": code}
    assert admin.events == [("get", USER_ID), ("unlink", "12345")] + (
        [] if fail_unlink else [("delete", USER_ID)]
    )
    assert "example-key" not in result.text + caplog.text


def test_unlink_form_and_already_unlinked() -> None:
    seen: list[httpx2.Request] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(request)
        return httpx2.Response(400, json={"code": -101})

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as http:
        KakaoUnlinker("example-key", http).unlink("12345")
    assert seen[0].headers["authorization"] == "KakaoAK example-key"
    assert (
        seen[0].headers["content-type"].startswith("application/x-www-form-urlencoded")
    )
    assert seen[0].content == b"target_id_type=user_id&target_id=12345"


def test_supabase_identity_provider_id() -> None:
    sdk = MagicMock()
    identity = MagicMock()
    identity.provider = "kakao"
    identity.id = "12345"
    identity.identity_data = {}
    sdk.auth.admin.get_user_by_id.return_value.user.identities = [identity]
    with httpx2.Client() as http:
        admin = SupabaseAccountAdmin(
            cast(Client, sdk), KakaoUnlinker("example-key", http)
        )
        assert admin.kakao_id(USER_ID) == "12345"
    sdk.auth.admin.get_user_by_id.assert_called_once_with(str(USER_ID))
