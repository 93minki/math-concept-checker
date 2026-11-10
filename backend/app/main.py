import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.auth import AuthUser, get_current_user
from app.diagnoses.router import router as diagnoses_router
from app.profiles import ProfilesRepository, get_profiles
from app.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if get_settings().ai_mode == "fake":
        logging.getLogger(__name__).warning(
            "AI_MODE=fake: simulated AI responses enabled"
        )
    yield


class ConfiguredCORSMiddleware(CORSMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(
            app,
            allow_origins=get_settings().cors_origins,
            allow_methods=["GET", "POST", "PUT"],
            allow_headers=["Authorization", "Content-Type"],
            allow_credentials=False,
        )


app = FastAPI(lifespan=lifespan)
app.add_middleware(ConfiguredCORSMiddleware)
app.include_router(diagnoses_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me")
def me(
    user: Annotated[AuthUser, Depends(get_current_user)],
    profiles: Annotated[ProfilesRepository, Depends(get_profiles)],
) -> dict[str, str]:
    profile = profiles.get(user.id)
    return {
        "id": str(user.id),
        "signup_status": profile.signup_status if profile else "pending",
    }


@app.post("/signup/complete")
def complete_signup(
    user: Annotated[AuthUser, Depends(get_current_user)],
    profiles: Annotated[ProfilesRepository, Depends(get_profiles)],
) -> dict[str, str]:
    profile = profiles.complete_signup(user.id)
    if profile.signup_completed_at is None:
        raise RuntimeError("Completed profile lacks completion time")
    return {
        "id": str(profile.id),
        "signup_status": profile.signup_status,
        "signup_completed_at": profile.signup_completed_at.isoformat(),
    }
