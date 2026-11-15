import asyncio
from datetime import datetime, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, HTTPException

from energy_api.core.config import Settings, get_settings
from energy_api.schemas.prediction import EnergyPrediction
from energy_api.services.caffeine.logs import CaffeineService, get_caffeine_service
from energy_api.services.energy.checkins import get_energy_now
from energy_api.services.naps.sessions import NapService, get_nap_service
from energy_api.services.profiles import ProfileService, get_profile_service
from energy_api.services.sleep.sessions import SleepService, get_sleep_service
from energy_api.services.prediction.formulas import Dose, Interval, predict, utc


class PredictionService:
    def __init__(self, sleep: SleepService, naps: NapService, caffeine: CaffeineService,
                 profiles: ProfileService, settings: Settings, now: datetime):
        self.sleep, self.naps, self.caffeine, self.profiles = sleep, naps, caffeine, profiles
        self.params, self.now = settings.prediction, utc(now)

    async def _history(self, service: Any, timestamp: str, *, completed: bool = False) -> list[Any]:
        since = self.now - timedelta(days=self.params.history_days)
        params = {'order': 'id.asc', 'limit': '500'}
        if completed:
            params.update({'ended_at': f'gte.{since.isoformat()}', 'started_at': f'lte.{self.now.isoformat()}'})
        else:
            params['and'] = f'({timestamp}.gte.{since.isoformat()},{timestamp}.lte.{self.now.isoformat()})'
        rows: list[Any] = []
        while True:
            page = await service._request('GET', params={**params, 'offset': str(len(rows))})
            if not page:
                return rows
            rows.extend(page)

    async def _profile(self):
        try:
            return await self.profiles.get()
        except HTTPException as error:
            if error.status_code == 404:
                return None
            raise

    async def get(self, zone_name: str) -> EnergyPrediction:
        try:
            zone = ZoneInfo(zone_name)
        except (ZoneInfoNotFoundError, ValueError):
            raise HTTPException(422, 'Use an explicit valid IANA timezone') from None
        sleep, naps, caffeine, active_sleep, active_nap, profile = await asyncio.gather(
            self._history(self.sleep, 'started_at', completed=True),
            self._history(self.naps, 'started_at', completed=True),
            self._history(self.caffeine, 'consumed_at'),
            self.sleep.active(), self.naps.active(), self._profile(),
        )
        def intervals(rows):
            return [Interval(row.started_at, row.ended_at) for row in rows if row.ended_at is not None]
        wake = profile.usual_wake_time if profile else None
        active = any(row is not None and utc(row.started_at) <= self.now for row in (active_sleep, active_nap))
        return predict(now=self.now, zone=zone, sleep=intervals(sleep), naps=intervals(naps),
            doses=[Dose(row.consumed_at, float(row.caffeine_mg)) for row in caffeine], active=active,
            params=self.params, wake_hour=(wake.hour + wake.minute / 60 if wake else None),
            personal_goal=profile.sleep_goal_minutes if profile else None)


def get_prediction_service(
    sleep: Annotated[SleepService, Depends(get_sleep_service)],
    naps: Annotated[NapService, Depends(get_nap_service)],
    caffeine: Annotated[CaffeineService, Depends(get_caffeine_service)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    now: Annotated[datetime, Depends(get_energy_now)],
) -> PredictionService:
    return PredictionService(sleep, naps, caffeine, profiles, settings, now)
