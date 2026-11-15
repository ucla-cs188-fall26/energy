from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from energy_api.core.auth import AuthenticatedUser, bearer, get_auth_client, get_current_user
from energy_api.core.config import Settings, get_settings
from energy_api.schemas.energy import EnergyCheckin, EnergyCreate, EnergyHistory


def get_energy_now() -> datetime:
    return datetime.now(timezone.utc)


class EnergyService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, user: AuthenticatedUser,
                 credentials: HTTPAuthorizationCredentials, now: datetime):
        url, key = settings.supabase_url, settings.supabase_publishable_key
        if url is None or key is None:
            raise HTTPException(503, 'Energy service is not configured')
        self.client, self.user_id, self.now = client, user.id, now.astimezone(timezone.utc)
        self.url = str(url).rstrip('/') + '/rest/v1/energy_checkins'
        self.headers = {'apikey': key.get_secret_value(), 'Authorization': f'Bearer {credentials.credentials}',
                        'Prefer': 'return=representation'}

    async def _request(self, method: str, *, params=None, body=None) -> list[EnergyCheckin]:
        query = {'select': ','.join(EnergyCheckin.model_fields), **(params or {}), 'user_id': f'eq.{self.user_id}'}
        try:
            response = await self.client.request(method, self.url, params=query, headers=self.headers, json=body)
        except httpx.RequestError:
            raise HTTPException(503, 'Energy service unavailable') from None
        if not response.is_success:
            if response.status_code == 401:
                raise HTTPException(401, 'Missing or invalid access token', headers={'WWW-Authenticate': 'Bearer'})
            if response.status_code == 403:
                raise HTTPException(403, 'Energy check-in access denied')
            try:
                data = response.json()
                code = data.get('code') if isinstance(data, dict) else None
            except ValueError:
                code = None
            if code in {'23514', '23502', '22007', '22008', '22P02'}:
                raise HTTPException(422, 'Invalid energy check-in values')
            raise HTTPException(503, 'Energy service unavailable')
        try:
            data = response.json()
            if not isinstance(data, list):
                raise ValueError('Invalid response')
            rows = [EnergyCheckin.model_validate(item) for item in data]
            if any(row.user_id != self.user_id for row in rows):
                raise ValueError('Unexpected owner')
            return rows
        except ValueError:
            raise HTTPException(503, 'Invalid energy service response') from None

    def _one(self, rows: list[EnergyCheckin], identity: UUID | None = None) -> EnergyCheckin:
        if not rows:
            raise HTTPException(404, 'Energy check-in not found')
        if len(rows) != 1 or (identity is not None and rows[0].id != identity):
            raise HTTPException(503, 'Invalid energy service response')
        return rows[0]

    async def create(self, payload: EnergyCreate) -> EnergyCheckin:
        recorded = payload.recorded_at.astimezone(timezone.utc) if payload.recorded_at else self.now
        if recorded > self.now:
            raise HTTPException(422, 'Energy check-ins cannot be recorded in the future')
        return self._one(await self._request('POST', body={
            'user_id': str(self.user_id), 'energy_rating': payload.energy_rating, 'recorded_at': recorded.isoformat(),
        }))

    async def get(self, checkin_id: UUID) -> EnergyCheckin:
        return self._one(await self._request('GET', params={'id': f'eq.{checkin_id}'}), checkin_id)

    async def history(self, limit: int, offset: int) -> EnergyHistory:
        rows = await self._request('GET', params={
            'order': 'recorded_at.desc,id.desc', 'limit': str(limit + 1), 'offset': str(offset),
        })
        return EnergyHistory(items=rows[:limit], limit=limit, offset=offset, has_more=len(rows) > limit)


def get_energy_service(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_auth_client)],
    now: Annotated[datetime, Depends(get_energy_now)],
) -> EnergyService:
    return EnergyService(client, settings, user, credentials, now)
