from typing import Annotated

from fastapi import APIRouter, Depends

from energy_api.core.auth import AuthenticatedUser, get_current_user
from energy_api.schemas.profiles import ProfilePreferences, UserProfile
from energy_api.services.profiles import ProfileService, get_profile_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=AuthenticatedUser)
async def me(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    return user


@router.get("/me/profile", response_model=UserProfile)
async def get_profile(
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> UserProfile:
    return await profiles.get()


@router.put("/me/profile", response_model=UserProfile)
async def save_profile(
    preferences: ProfilePreferences,
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> UserProfile:
    return await profiles.save(preferences)


@router.post("/me/preferences/complete", response_model=UserProfile)
async def complete_preferences(
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> UserProfile:
    return await profiles.complete()
