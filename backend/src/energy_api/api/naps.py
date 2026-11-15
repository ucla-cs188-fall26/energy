from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from energy_api.schemas.naps import NapHistory, NapRating, NapSession, NapStart, NapStop
from energy_api.services.naps.sessions import NapService, get_nap_service

router = APIRouter(prefix="/naps/sessions", tags=["nap"])
Service = Annotated[NapService, Depends(get_nap_service)]


@router.post("/start", response_model=NapSession, status_code=201)
async def start(service: Service, payload: NapStart = Body(default_factory=NapStart)) -> NapSession:
    return await service.start(payload)


@router.get("/active", response_model=NapSession | None)
async def active(service: Service) -> NapSession | None:
    return await service.active()


@router.get("", response_model=NapHistory)
async def history(service: Service, limit: Annotated[int, Query(ge=1, le=100)] = 20,
                  offset: Annotated[int, Query(ge=0)] = 0) -> NapHistory:
    return await service.history(limit, offset)


@router.get("/{session_id}", response_model=NapSession)
async def detail(session_id: UUID, service: Service) -> NapSession:
    return await service.get(session_id)


@router.post("/{session_id}/stop", response_model=NapSession)
async def stop(session_id: UUID, service: Service, payload: NapStop = Body(default_factory=NapStop)) -> NapSession:
    return await service.stop(session_id, payload)


@router.put("/{session_id}/rating", response_model=NapSession)
async def rating(session_id: UUID, payload: NapRating, service: Service) -> NapSession:
    return await service.rate(session_id, payload.refreshed_rating)
