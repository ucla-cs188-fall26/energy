from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from energy_api.schemas.caffeine import CaffeineCreate, CaffeineDailyTotal, CaffeineHistory, CaffeineLog, CaffeinePreset, CaffeineUpdate
from energy_api.services.caffeine.logs import CaffeineService, get_caffeine_service

router = APIRouter(prefix='/caffeine', tags=['caffeine'])
Service = Annotated[CaffeineService, Depends(get_caffeine_service)]


@router.get('/presets', response_model=list[CaffeinePreset])
async def presets(service: Service):
    return await service.presets()


@router.get('/daily-total', response_model=CaffeineDailyTotal)
async def daily_total(service: Service, day: date, timezone: Annotated[str, Query(min_length=1, max_length=100)] = 'UTC'):
    return await service.daily(day, timezone)


@router.get('/logs', response_model=CaffeineHistory)
async def history(service: Service, limit: Annotated[int, Query(ge=1, le=100)] = 20,
                  offset: Annotated[int, Query(ge=0)] = 0):
    return await service.history(limit, offset)


@router.post('/logs', response_model=CaffeineLog, status_code=201)
async def create(payload: CaffeineCreate, service: Service):
    return await service.create(payload)


@router.get('/logs/{log_id}', response_model=CaffeineLog)
async def detail(log_id: UUID, service: Service):
    return await service.get(log_id)


@router.put('/logs/{log_id}', response_model=CaffeineLog)
async def update(log_id: UUID, payload: CaffeineUpdate, service: Service):
    return await service.update(log_id, payload)


@router.delete('/logs/{log_id}', status_code=204)
async def delete(log_id: UUID, service: Service):
    await service.delete(log_id)
    return Response(status_code=204)
