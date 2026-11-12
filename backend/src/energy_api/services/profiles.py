"""Access profiles through Supabase using the caller's RLS identity."""

from typing import Annotated

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from energy_api.core.auth import AuthenticatedUser, bearer, get_auth_client, get_current_user
from energy_api.core.config import Settings, get_settings
from energy_api.schemas.profiles import ProfilePreferences, UserProfile

PROFILE_COLUMNS = ",".join(UserProfile.model_fields)


class ProfileService:
    def __init__(
        self, client: httpx.AsyncClient, settings: Settings,
        user: AuthenticatedUser, credentials: HTTPAuthorizationCredentials,
    ):
        supabase_url = settings.supabase_url
        publishable_key = settings.supabase_publishable_key
        if supabase_url is None or publishable_key is None:
            raise HTTPException(503, "Profile service is not configured")
        self.client = client
        self.user_id = user.id
        self.url = str(supabase_url).rstrip("/") + "/rest/v1/user_profiles"
        self.headers = {
            "apikey": publishable_key.get_secret_value(),
            "Authorization": f"Bearer {credentials.credentials}",
        }

    async def _request(self, method: str, *, body=None, upsert=False) -> UserProfile:
        params = {"select": PROFILE_COLUMNS}
        if upsert:
            params["on_conflict"] = "id"
        else:
            params["id"] = f"eq.{self.user_id}"
        headers = dict(self.headers)
        headers["Prefer"] = (
            "resolution=merge-duplicates,missing=default,return=representation"
            if upsert else "return=representation"
        )
        try:
            response = await self.client.request(
                method, self.url, params=params, headers=headers, json=body,
            )
        except httpx.RequestError:
            raise HTTPException(503, "Profile service unavailable") from None
        if not response.is_success:
            if response.status_code == 401:
                raise HTTPException(401, "Missing or invalid access token", headers={"WWW-Authenticate": "Bearer"})
            if response.status_code == 403:
                raise HTTPException(403, "Profile access denied")
            try:
                error = response.json()
                code = error.get("code") if isinstance(error, dict) else None
            except ValueError:
                code = None
            if code in {"23514", "23502", "22P02"}:
                raise HTTPException(422, "Profile violates database constraints; completion requires all preferences")
            if code == "23505":
                raise HTTPException(409, "Profile already exists")
            raise HTTPException(503, "Profile service unavailable")
        try:
            rows = response.json()
            if not isinstance(rows, list) or len(rows) > 1:
                raise ValueError("Invalid result")
            if not rows:
                raise HTTPException(404, "Profile not found")
            profile = UserProfile.model_validate(rows[0])
            if profile.id != self.user_id:
                raise ValueError("Unexpected profile owner")
            return profile
        except (ValueError, ValidationError):
            raise HTTPException(503, "Invalid profile service response") from None

    async def get(self) -> UserProfile:
        return await self._request("GET")

    async def save(self, preferences: ProfilePreferences) -> UserProfile:
        body = preferences.model_dump(mode="json", exclude_unset=True)
        body["id"] = str(self.user_id)
        return await self._request("POST", body=body, upsert=True)

    async def complete(self) -> UserProfile:
        # The database constraint validates the current row atomically.
        return await self._request("PATCH", body={"preferences_completed": True})


def get_profile_service(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_auth_client)],
) -> ProfileService:
    return ProfileService(client, settings, user, credentials)
