"""Validate access tokens with Supabase Auth"""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ValidationError

from energy_api.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str


async def get_auth_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        yield client


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_auth_client)],
) -> AuthenticatedUser:
    unauthorized = HTTPException(
        status_code=401,
        detail="Missing or invalid access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    url = str(settings.supabase_url).rstrip("/") + "/auth/v1/user"
    try:
        response = await client.get(
            url,
            headers={
                "apikey": settings.supabase_publishable_key.get_secret_value(),
                "Authorization": f"Bearer {credentials.credentials}",
            },
        )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from None
    if response.status_code in (400, 401, 403, 422):
        raise unauthorized
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    try:
        user = response.json()
        if user.get("role") != "authenticated" or user.get("is_anonymous", False):
            raise unauthorized
        return AuthenticatedUser.model_validate(user)
    except (ValueError, ValidationError, AttributeError):
        raise HTTPException(status_code=503, detail="Invalid authentication service response") from None
