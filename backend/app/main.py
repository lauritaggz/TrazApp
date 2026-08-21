from fastapi import FastAPI

from app.api.routes import health
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "API de trazabilidad histórica de alimentos elaborados. "
        "Prototipo de mitigación RT-01."
    ),
    version="0.1.0",
)

app.include_router(health.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": f"{settings.app_name} API",
        "docs": "/docs",
        "health": "/health",
    }
