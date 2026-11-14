import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import main as main_module
from app.auth import get_jwks_client
from app.main import app
from app.profiles import Profile, get_profiles
from app.settings import Settings, get_settings

USER_ID = uuid4()
ISSUER = "https://example.supabase.co/auth/v1"
ORIGIN = "http://localhost:3000"
LAN_ORIGIN = "http://192.0.2.10:3000"


class FakeProfiles:
    def __init__(self) -> None:
        self.rows: dict[UUID, Profile] = {}

    def get(self, user_id: UUID) -> Profile | None:
        return self.rows.get(user_id)

    def complete_signup(self, user_id: UUID) -> Profile:
        if user_id not in self.rows:
            self.rows[user_id] = Profile(
                id=user_id,
                signup_status="completed",
                signup_completed_at=datetime.now(UTC),
            )
        return self.rows[user_id]


@pytest.fixture
def client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, ec.EllipticCurvePrivateKey]]:
    settings = Settings(
        _env_file=None,
        SUPABASE_URL="https://example.supabase.co",
        KAKAO_ADMIN_KEY="example-key",
        SUPABASE_SECRET_KEY="sb_secret_test-only",
        FRONTEND_ORIGIN=f"{ORIGIN}, {LAN_ORIGIN}/",
    )
    private_key = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    jwk["kid"] = "test-key"
    jwk["alg"] = "ES256"
    jwks = jwt.PyJWKClient("https://example.invalid/jwks")
    monkeypatch.setattr(jwks, "fetch_data", lambda: {"keys": [jwk]})
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    profiles = FakeProfiles()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_jwks_client] = lambda: jwks
    app.dependency_overrides[get_profiles] = lambda: profiles
    try:
        with TestClient(app) as test_client:
            yield test_client, private_key
    finally:
        app.dependency_overrides.clear()


def token(
    private_key: ec.EllipticCurvePrivateKey,
    *,
    expires: datetime | None = None,
    audience: str = "authenticated",
    issuer: str = ISSUER,
    kid: str = "test-key",
    issued_at: datetime | None = None,
) -> str:
    claims: dict[str, object] = {
        "sub": str(USER_ID),
        "aud": audience,
        "iss": issuer,
        "exp": expires or datetime.now(UTC) + timedelta(minutes=5),
    }
    if issued_at is not None:
        claims["iat"] = issued_at
    return jwt.encode(
        claims,
        private_key,
        algorithm="ES256",
        headers={"kid": kid},
    )


@pytest.mark.parametrize("header", [None, "Basic x", "Bearer", "Bearer "])
def test_missing_or_malformed_header(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey], header: str | None
) -> None:
    test_client, _ = client
    headers = {"Authorization": header} if header is not None else {}
    response = test_client.get("/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.parametrize(
    "failure",
    [
        "signature",
        "expired",
        "future-iat",
        "aud",
        "iss",
        "unknown-kid",
        "no-exp",
        "hs256",
    ],
)
def test_invalid_token(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey], failure: str
) -> None:
    test_client, private_key = client
    if failure == "signature":
        encoded = token(ec.generate_private_key(ec.SECP256R1()))
    elif failure == "expired":
        # Beyond the 10-second clock-skew leeway (app/auth.py).
        encoded = token(private_key, expires=datetime.now(UTC) - timedelta(seconds=30))
    elif failure == "future-iat":
        encoded = token(
            private_key, issued_at=datetime.now(UTC) + timedelta(seconds=30)
        )
    elif failure == "aud":
        encoded = token(private_key, audience="other")
    elif failure == "iss":
        encoded = token(private_key, issuer="https://other.invalid/auth/v1")
    elif failure == "unknown-kid":
        encoded = token(private_key, kid="missing-key")
    elif failure == "no-exp":
        encoded = jwt.encode(
            {"sub": str(USER_ID), "aud": "authenticated", "iss": ISSUER},
            private_key,
            algorithm="ES256",
            headers={"kid": "test-key"},
        )
    else:
        encoded = jwt.encode(
            {
                "sub": str(USER_ID),
                "aud": "authenticated",
                "iss": ISSUER,
                "exp": 9999999999,
            },
            "x" * 32,
            algorithm="HS256",
            headers={"kid": "test-key"},
        )

    response = test_client.get("/me", headers={"Authorization": f"Bearer {encoded}"})
    assert response.status_code == 401
    assert encoded not in response.text


def test_me_and_complete_signup(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey],
) -> None:
    test_client, private_key = client
    headers = {"Authorization": f"Bearer {token(private_key)}"}

    pending = test_client.get("/me", headers=headers)
    first = test_client.post("/signup/complete", headers=headers)
    second = test_client.post("/signup/complete", headers=headers)
    completed = test_client.get("/me", headers=headers)

    assert pending.status_code == 200
    assert pending.json() == {"id": str(USER_ID), "signup_status": "pending"}
    assert first.status_code == second.status_code == completed.status_code == 200
    assert first.json() == second.json()
    assert first.json()["signup_status"] == "completed"
    assert completed.json() == {"id": str(USER_ID), "signup_status": "completed"}


@pytest.mark.parametrize("origin", [ORIGIN, LAN_ORIGIN, "https://other.invalid"])
def test_cors_preflight(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey], origin: str
) -> None:
    test_client, _ = client
    response = test_client.options(
        "/me",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    if origin in (ORIGIN, LAN_ORIGIN):
        assert response.headers["access-control-allow-origin"] == origin
    else:
        assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    "case",
    ["iat-5s-ahead", "exp-5s-ago"],
)
def test_small_clock_skew_is_accepted(
    client: tuple[TestClient, ec.EllipticCurvePrivateKey], case: str
) -> None:
    # A server clock a few seconds behind Supabase must not reject fresh
    # tokens (2026-11-11 dev E2E 401, docs/TEST_LOG.md).
    test_client, private_key = client
    now = datetime.now(UTC)
    encoded = (
        token(private_key, issued_at=now + timedelta(seconds=5))
        if case == "iat-5s-ahead"
        else token(private_key, expires=now - timedelta(seconds=5))
    )
    response = test_client.get("/me", headers={"Authorization": f"Bearer {encoded}"})
    assert response.status_code != 401
