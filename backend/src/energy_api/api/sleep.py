from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from energy_api.schemas.sleep import SleepHistory, SleepQuality, SleepSession, SleepStart, SleepStop
from energy_api.services.sleep.sessions import SleepService, get_sleep_service

router = APIRouter(prefix="/sleep/sessions", tags=["sleep"])
Service = Annotated[SleepService, Depends(get_sleep_service)]


@router.post("/start", response_model=SleepSession, status_code=201)
async def start(service: Service, payload: SleepStart = Body(default_factory=SleepStart)) -> SleepSession:
    return await service.start(payload)


@router.get("/active", response_model=SleepSession | None)
async def active(service: Service) -> SleepSession | None:
    return await service.active()


@router.get("", response_model=SleepHistory)
async def history(service: Service, limit: Annotated[int, Query(ge=1, le=100)] = 20,
                  offset: Annotated[int, Query(ge=0)] = 0) -> SleepHistory:
    return await service.history(limit, offset)


@router.get("/{session_id}", response_model=SleepSession)
async def detail(session_id: UUID, service: Service) -> SleepSession:
    return await service.get(session_id)


@router.post("/{session_id}/stop", response_model=SleepSession)
async def stop(session_id: UUID, service: Service, payload: SleepStop = Body(default_factory=SleepStop)) -> SleepSession:
    return await service.stop(session_id, payload)


@router.put("/{session_id}/quality", response_model=SleepSession)
async def quality(session_id: UUID, payload: SleepQuality, service: Service) -> SleepSession:
    return await service.rate(session_id, payload.sleep_quality)
