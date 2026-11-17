from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from energy_api.core.config import Settings, get_settings
from energy_api.api.users import router as users_router
from energy_api.api.sleep import router as sleep_router
from energy_api.api.caffeine import router as caffeine_router
from energy_api.api.naps import router as naps_router
from energy_api.api.energy import router as energy_router
from energy_api.api.prediction import router as prediction_router


def health() -> dict[str, str]:
    return {"status": "ok"}


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings if settings is not None else get_settings()
    application = FastAPI(title=configuration.app_name, debug=configuration.debug)
    if settings is not None:
        application.dependency_overrides[get_settings] = lambda: configuration
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configuration.cors_origins,
        allow_methods=["GET", "PUT", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    for router in (users_router, sleep_router, caffeine_router, naps_router, energy_router, prediction_router):
        application.include_router(router)
    if configuration.environment == "development":
        from energy_api.api.development_prediction import router as simulation_router
        application.include_router(simulation_router)
    application.add_api_route("/health", health, methods=["GET"])
    return application


app = create_app()
