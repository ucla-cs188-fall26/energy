"""This router is not registered in production, even when debug=True."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energy_api.core.config import Settings, get_settings
from energy_api.services.prediction.service import PredictionService, get_prediction_service
from energy_api.services.prediction.simulation import SleepSimulationInput, SleepSimulationPrediction, simulate_sleep


def development_only(settings: Annotated[Settings, Depends(get_settings)]):
    # Also fail closed if configuration changes after route registration.
    if settings.environment != 'development':
        raise HTTPException(404, 'Not found')


router = APIRouter(prefix='/development/energy', tags=['development'], dependencies=[Depends(development_only)])


@router.post('/simulate', response_model=SleepSimulationPrediction)
async def simulation(payload: SleepSimulationInput,
                     service: Annotated[PredictionService, Depends(get_prediction_service)]):
    return await simulate_sleep(service, payload)
