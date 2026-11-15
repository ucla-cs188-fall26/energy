from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from energy_api.core.config import get_settings
from energy_api.api.users import router as users_router
from energy_api.api.sleep import router as sleep_router
from energy_api.api.caffeine import router as caffeine_router
from energy_api.api.naps import router as naps_router
from energy_api.api.energy import router as energy_router
from energy_api.api.prediction import router as prediction_router

settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "PUT", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(users_router)
app.include_router(sleep_router)
app.include_router(caffeine_router)
app.include_router(naps_router)
app.include_router(energy_router)
app.include_router(prediction_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
