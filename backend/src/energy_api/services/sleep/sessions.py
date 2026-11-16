"""Sleep persistence uses the user's token, ownership filters, and Supabase RLS."""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from energy_api.core.auth import AuthenticatedUser, bearer, get_auth_client, get_current_user
from energy_api.core.clock import not_future
from energy_api.core.config import Settings, get_settings
from energy_api.schemas.sleep import SleepHistory, SleepRecord, SleepSession, SleepStart, SleepStop

CYCLE_SECONDS = 90 * 60
COLUMNS = ",".join(SleepRecord.model_fields)


def get_sleep_now() -> datetime:
    return datetime.now(timezone.utc)


def present_session(row: SleepRecord, now: datetime) -> SleepSession:
    start = row.started_at.astimezone(timezone.utc)
    end = row.ended_at.astimezone(timezone.utc) if row.ended_at else now.astimezone(timezone.utc)
    elapsed = max(0.0, (end - start).total_seconds())
    return SleepSession(
        **{**row.model_dump(), "duration_seconds": elapsed if row.ended_at else None},
        elapsed_seconds=elapsed,
        estimated_completed_cycles=int(elapsed // CYCLE_SECONDS),
        estimated_cycle_progress_percent=round((elapsed % CYCLE_SECONDS) / CYCLE_SECONDS * 100, 2),
    )


class SleepService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings,
                 user: AuthenticatedUser, credentials: HTTPAuthorizationCredentials, now: datetime):
        url, key = settings.supabase_url, settings.supabase_publishable_key
        if url is None or key is None:
            raise HTTPException(503, "Sleep service is not configured")
        self.client, self.user_id, self.now = client, user.id, now.astimezone(timezone.utc)
        self.url = str(url).rstrip("/") + "/rest/v1/sleep_sessions"
        self.headers = {"apikey": key.get_secret_value(), "Authorization": f"Bearer {credentials.credentials}",
                        "Prefer": "return=representation"}

    async def _request(self, method: str, *, params=None, body=None) -> list[SleepRecord]:
        query = {"select": COLUMNS, "user_id": f"eq.{self.user_id}", **(params or {})}
        try:
            response = await self.client.request(method, self.url, params=query, headers=self.headers, json=body)
        except httpx.RequestError:
            raise HTTPException(503, "Sleep service unavailable") from None
        if not response.is_success:
            try:
                data = response.json()
                code = data.get("code") if isinstance(data, dict) else None
            except ValueError:
                code = None
            if response.status_code == 401:
                raise HTTPException(401, "Missing or invalid access token", headers={"WWW-Authenticate": "Bearer"})
            if response.status_code == 403:
                raise HTTPException(403, "Sleep session access denied")
            if code == "23505":
                raise HTTPException(409, "An active sleep session already exists")
            if code in {"23514", "23502", "22007", "22008", "22P02"}:
                raise HTTPException(422, "Invalid sleep session values")
            raise HTTPException(503, "Sleep service unavailable")
        try:
            data = response.json()
            if not isinstance(data, list):
                raise ValueError("Invalid response")
            rows = [SleepRecord.model_validate(item) for item in data]
            if any(row.user_id != self.user_id for row in rows):
                raise ValueError("Unexpected session owner")
            return rows
        except ValueError:
            raise HTTPException(503, "Invalid sleep service response") from None

    def _one(self, rows: list[SleepRecord], session_id: UUID | None = None) -> SleepRecord:
        if not rows:
            raise HTTPException(404, "Sleep session not found")
        if len(rows) != 1 or (session_id is not None and rows[0].id != session_id):
            raise HTTPException(503, "Invalid sleep service response")
        return rows[0]

    async def get(self, session_id: UUID) -> SleepSession:
        row = self._one(await self._request("GET", params={"id": f"eq.{session_id}"}), session_id)
        return present_session(row, self.now)

    async def start(self, payload: SleepStart) -> SleepSession:
        started = not_future(payload.started_at.astimezone(timezone.utc), self.now) if payload.started_at else self.now
        if started > self.now:
            raise HTTPException(422, "Sleep cannot start in the future")
        rows = await self._request("POST", body={"user_id": str(self.user_id), "started_at": started.isoformat()})
        return present_session(self._one(rows), self.now)

    async def active(self) -> SleepSession | None:
        rows = await self._request("GET", params={"ended_at": "is.null", "limit": "2"})
        if not rows:
            return None
        row = self._one(rows)
        if row.ended_at is not None:
            raise HTTPException(503, "Invalid sleep service response")
        return present_session(row, self.now)

    async def stop(self, session_id: UUID, payload: SleepStop) -> SleepSession:
        existing = await self.get(session_id)
        if existing.ended_at is not None:
            raise HTTPException(409, "Sleep session is already stopped")
        ended = not_future(payload.ended_at.astimezone(timezone.utc), self.now) if payload.ended_at else self.now
        if ended > self.now or ended <= existing.started_at.astimezone(timezone.utc):
            raise HTTPException(422, "Sleep must end after its start and cannot end in the future")
        body: dict[str, str | int] = {"ended_at": ended.isoformat()}
        if payload.sleep_quality is not None:
            body["sleep_quality"] = payload.sleep_quality
        rows = await self._request("PATCH", params={"id": f"eq.{session_id}", "ended_at": "is.null"}, body=body)
        if not rows:
            raise HTTPException(409, "Sleep session changed; reload before trying again")
        return present_session(self._one(rows, session_id), self.now)

    async def rate(self, session_id: UUID, quality: int) -> SleepSession:
        existing = await self.get(session_id)
        if existing.ended_at is None:
            raise HTTPException(409, "Stop the sleep session before rating it")
        rows = await self._request("PATCH", params={"id": f"eq.{session_id}", "ended_at": "not.is.null"},
                                   body={"sleep_quality": quality})
        if not rows:
            raise HTTPException(409, "Sleep session changed; reload before trying again")
        return present_session(self._one(rows, session_id), self.now)

    async def history(self, limit: int, offset: int) -> SleepHistory:
        rows = await self._request("GET", params={"ended_at": "not.is.null", "order": "started_at.desc,id.desc",
                                                  "limit": str(limit + 1), "offset": str(offset)})
        if any(row.ended_at is None for row in rows):
            raise HTTPException(503, "Invalid sleep service response")
        return SleepHistory(items=[present_session(row, self.now) for row in rows[:limit]],
                            limit=limit, offset=offset, has_more=len(rows) > limit)


def get_sleep_service(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_auth_client)],
    now: Annotated[datetime, Depends(get_sleep_now)],
) -> SleepService:
    return SleepService(client, settings, user, credentials, now)
