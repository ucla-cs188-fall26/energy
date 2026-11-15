from typing import Annotated

from fastapi import APIRouter, Depends, Query

from energy_api.schemas.prediction import EnergyPrediction
from energy_api.services.prediction.service import PredictionService, get_prediction_service

router = APIRouter(prefix='/energy', tags=['energy prediction'])


@router.get('/predict', response_model=EnergyPrediction)
async def prediction(
    service: Annotated[PredictionService, Depends(get_prediction_service)],
    timezone: Annotated[str, Query(min_length=1, max_length=100)],
) -> EnergyPrediction:
    return await service.get(timezone)
