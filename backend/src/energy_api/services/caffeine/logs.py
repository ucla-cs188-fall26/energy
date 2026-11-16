from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from energy_api.core.auth import AuthenticatedUser, bearer, get_auth_client, get_current_user
from energy_api.core.clock import not_future
from energy_api.core.config import Settings, get_settings
from energy_api.schemas.caffeine import CaffeineCreate, CaffeineDailyTotal, CaffeineHistory, CaffeineLog, CaffeinePreset, CaffeineUpdate


def get_caffeine_now() -> datetime:
    return datetime.now(timezone.utc)


def day_bounds(day: date, zone_name: str) -> tuple[datetime, datetime]:
    try:
        zone = ZoneInfo(zone_name)
        start = datetime.combine(day, time.min, zone)
        end = datetime.combine(day + timedelta(days=1), time.min, zone)
        return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
    except (ZoneInfoNotFoundError, ValueError, OverflowError):
        raise HTTPException(422, 'Invalid date or IANA timezone') from None


class CaffeineService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, user: AuthenticatedUser,
                 credentials: HTTPAuthorizationCredentials, now: datetime):
        url, key = settings.supabase_url, settings.supabase_publishable_key
        if url is None or key is None:
            raise HTTPException(503, 'Caffeine service is not configured')
        self.client, self.user_id, self.now = client, user.id, now.astimezone(timezone.utc)
        self.url = str(url).rstrip('/') + '/rest/v1/'
        self.headers = {'apikey': key.get_secret_value(), 'Authorization': f'Bearer {credentials.credentials}',
                        'Prefer': 'return=representation'}

    async def _request(self, method: str, *, presets=False, params=None, body=None) -> list[Any]:
        model = CaffeinePreset if presets else CaffeineLog
        query = {'select': ','.join(model.model_fields), **(params or {})}
        if not presets:
            query['user_id'] = f'eq.{self.user_id}'
        try:
            response = await self.client.request(method, self.url + ('caffeine_presets' if presets else 'caffeine_logs'),
                                                 params=query, headers=self.headers, json=body)
        except httpx.RequestError:
            raise HTTPException(503, 'Caffeine service unavailable') from None
        if not response.is_success:
            if response.status_code == 401:
                raise HTTPException(401, 'Missing or invalid access token', headers={'WWW-Authenticate': 'Bearer'})
            if response.status_code == 403:
                raise HTTPException(403, 'Caffeine access denied')
            try:
                data = response.json()
                code = data.get('code') if isinstance(data, dict) else None
            except ValueError:
                code = None
            if code in {'23514', '23502', '22003', '22007', '22008', '22P02'}:
                raise HTTPException(422, 'Invalid caffeine log values')
            raise HTTPException(503, 'Caffeine service unavailable')
        try:
            data = response.json()
            if not isinstance(data, list):
                raise ValueError('Invalid response')
            rows = [model.model_validate(item) for item in data]
            if not presets and any(not isinstance(row, CaffeineLog) or row.user_id != self.user_id for row in rows):
                raise ValueError('Unexpected owner')
            return rows
        except ValueError:
            raise HTTPException(503, 'Invalid caffeine service response') from None

    def _one(self, rows, identity=None):
        if not rows:
            raise HTTPException(404, 'Caffeine record not found')
        if len(rows) != 1 or (identity is not None and rows[0].id != identity):
            raise HTTPException(503, 'Invalid caffeine service response')
        return rows[0]

    def _consumed(self, value: datetime | None) -> str:
        value = not_future(value.astimezone(timezone.utc), self.now) if value else self.now
        if value > self.now:
            raise HTTPException(422, 'Consumption timestamp cannot be in the future')
        return value.isoformat()

    async def presets(self) -> list[CaffeinePreset]:
        return await self._request('GET', presets=True, params={'order': 'beverage_name.asc,id.asc'})

    async def create(self, payload: CaffeineCreate) -> CaffeineLog:
        data = payload.model_dump(mode='json', exclude_none=True, exclude={'preset_id'})
        if payload.preset_id is not None:
            preset = self._one(await self._request('GET', presets=True, params={'id': f'eq.{payload.preset_id}'}), payload.preset_id)
            size = payload.serving_size_ml if payload.serving_size_ml is not None else preset.serving_size_ml
            # Scale only the estimate; explicit caffeine overrides always win.
            amount = payload.caffeine_mg if payload.caffeine_mg is not None else (
                preset.caffeine_mg * size / preset.serving_size_ml).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if amount >= Decimal('100000000'):
                raise HTTPException(422, 'Scaled caffeine amount exceeds storage precision')
            data.update(beverage_name=payload.beverage_name or preset.beverage_name,
                        caffeine_mg=str(amount), serving_size_ml=str(size))
        data.update(user_id=str(self.user_id), consumed_at=self._consumed(payload.consumed_at))
        return self._one(await self._request('POST', body=data))

    async def get(self, log_id: UUID) -> CaffeineLog:
        return self._one(await self._request('GET', params={'id': f'eq.{log_id}'}), log_id)

    async def update(self, log_id: UUID, payload: CaffeineUpdate) -> CaffeineLog:
        data = payload.model_dump(mode='json', exclude_unset=True)
        if 'consumed_at' in data:
            data['consumed_at'] = self._consumed(payload.consumed_at)
        return self._one(await self._request('PATCH', params={'id': f'eq.{log_id}'}, body=data), log_id)

    async def delete(self, log_id: UUID) -> None:
        self._one(await self._request('DELETE', params={'id': f'eq.{log_id}'}), log_id)

    async def history(self, limit: int, offset: int) -> CaffeineHistory:
        rows = await self._request('GET', params={'order': 'consumed_at.desc,id.desc', 'limit': str(limit + 1), 'offset': str(offset)})
        return CaffeineHistory(items=rows[:limit], limit=limit, offset=offset, has_more=len(rows) > limit)

    async def daily(self, day: date, zone_name: str) -> CaffeineDailyTotal:
        start, end = day_bounds(day, zone_name)
        total, count = Decimal('0'), 0
        # Iterate until empty so a lower PostgREST row cap cannot truncate totals.
        while True:
            rows = await self._request('GET', params={'and': f'(consumed_at.gte.{start.isoformat()},consumed_at.lt.{end.isoformat()})',
                'order': 'consumed_at.asc,id.asc', 'limit': '500', 'offset': str(count)})
            if not rows:
                break
            total += sum((r.caffeine_mg for r in rows), Decimal('0'))
            count += len(rows)
        return CaffeineDailyTotal(date=day, timezone=zone_name, total_caffeine_mg=total, log_count=count)


def get_caffeine_service(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_auth_client)],
    now: Annotated[datetime, Depends(get_caffeine_now)],
) -> CaffeineService:
    return CaffeineService(client, settings, user, credentials, now)
