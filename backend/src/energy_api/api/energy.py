from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from energy_api.schemas.energy import EnergyCheckin, EnergyCreate, EnergyHistory
from energy_api.services.energy.checkins import EnergyService, get_energy_service

router = APIRouter(prefix='/energy/checkins', tags=['energy'])
Service = Annotated[EnergyService, Depends(get_energy_service)]


@router.post('', response_model=EnergyCheckin, status_code=201)
async def create(payload: EnergyCreate, service: Service) -> EnergyCheckin:
    return await service.create(payload)


@router.get('', response_model=EnergyHistory)
async def history(service: Service, limit: Annotated[int, Query(ge=1, le=100)] = 20,
                  offset: Annotated[int, Query(ge=0)] = 0) -> EnergyHistory:
    return await service.history(limit, offset)


@router.get('/{checkin_id}', response_model=EnergyCheckin)
async def detail(checkin_id: UUID, service: Service) -> EnergyCheckin:
    return await service.get(checkin_id)
