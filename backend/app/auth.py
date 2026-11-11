from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException

from app.settings import Settings, get_settings

# Clock skew allowed between Supabase Auth and this server (RFC 7519 4.1.4
# allows a small leeway). Signature checks are unaffected. User decision
# 2026-11-11; 10 seconds has no further basis.
CLOCK_SKEW_SECONDS = 10


@dataclass(frozen=True)
class AuthUser:
    id: UUID


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def get_jwks_client(
    settings: Annotated[Settings, Depends(get_settings)],
) -> jwt.PyJWKClient:
    url = f"{str(settings.supabase_url).rstrip('/')}/auth/v1/.well-known/jwks.json"
    return _jwks_client(url)


def get_current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    jwks: Annotated[jwt.PyJWKClient, Depends(get_jwks_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    unauthorized = HTTPException(
        status_code=401, detail="Invalid authentication credentials"
    )
    if authorization is None:
        raise unauthorized
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token or " " in token:
        raise unauthorized

    try:
        signing_key = jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{str(settings.supabase_url).rstrip('/')}/auth/v1",
            options={"require": ["exp", "sub"]},
            leeway=CLOCK_SKEW_SECONDS,
        )
        return AuthUser(id=UUID(claims["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError, TypeError) as exc:
        raise unauthorized from exc
