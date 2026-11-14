from functools import lru_cache
from typing import Annotated, Protocol
from uuid import UUID

import httpx2
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response
from supabase import Client

from app.auth import AuthUser, get_current_user
from app.profiles import _supabase_client
from app.settings import Settings, get_settings


class AccountAdmin(Protocol):
    def kakao_id(self, user_id: UUID) -> str | None: ...
    def unlink(self, kakao_id: str) -> None: ...
    def delete(self, user_id: UUID) -> None: ...


class KakaoUnlinker:
    def __init__(self, key: str, http: httpx2.Client) -> None:
        self._key = key
        self._http = http

    def unlink(self, kakao_id: str) -> None:
        response = self._http.post(
            "https://kapi.kakao.com/v1/user/unlink",
            headers={"Authorization": f"KakaoAK {self._key}"},
            data={"target_id_type": "user_id", "target_id": kakao_id},
        )
        if response.status_code == 400:
            try:
                if response.json().get("code") == -101:
                    return
            except (ValueError, AttributeError):
                pass
        response.raise_for_status()


class SupabaseAccountAdmin:
    def __init__(self, client: Client, unlinker: KakaoUnlinker) -> None:
        self._client = client
        self._unlinker = unlinker

    def kakao_id(self, user_id: UUID) -> str | None:
        user = self._client.auth.admin.get_user_by_id(str(user_id)).user
        if user is None or user.identities is None:
            raise ValueError("User identity unavailable")
        for identity in user.identities:
            if identity.provider == "kakao":
                # Supabase Auth serializes provider_id as id for SDK compatibility.
                subject = identity.id
                if not subject.isdecimal():
                    raise ValueError("Kakao identity unavailable")
                return subject
        return None

    def unlink(self, kakao_id: str) -> None:
        self._unlinker.unlink(kakao_id)

    def delete(self, user_id: UUID) -> None:
        self._client.auth.admin.delete_user(str(user_id))


@lru_cache
def _admin(url: str, secret: str, kakao_key: str) -> SupabaseAccountAdmin:
    return SupabaseAccountAdmin(
        _supabase_client(url, secret),
        KakaoUnlinker(kakao_key, httpx2.Client(timeout=10.0)),
    )


def get_account_admin(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AccountAdmin:
    return _admin(
        str(settings.supabase_url).rstrip("/"),
        settings.supabase_secret_key.get_secret_value(),
        settings.kakao_admin_key.get_secret_value(),
    )


router = APIRouter()


@router.delete("/account", status_code=204, response_class=Response)
def delete_account(
    user: Annotated[AuthUser, Depends(get_current_user)],
    admin: Annotated[AccountAdmin, Depends(get_account_admin)],
) -> Response:
    try:
        kakao_id = admin.kakao_id(user.id)
    except Exception:
        return JSONResponse(status_code=502, content={"code": "delete_failed"})
    if kakao_id is not None:
        try:
            admin.unlink(kakao_id)
        except Exception:
            return JSONResponse(
                status_code=502, content={"code": "kakao_unlink_failed"}
            )
    try:
        admin.delete(user.id)
    except Exception:
        return JSONResponse(status_code=502, content={"code": "delete_failed"})
    return Response(status_code=204)
