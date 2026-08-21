from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_database_session
from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_database_session)) -> JSONResponse:
    """Verify API availability and PostgreSQL connectivity."""
    settings = get_settings()
    try:
        db.execute(text("SELECT 1"))
        database_status = "ok"
        http_status = status.HTTP_200_OK
    except Exception as exc:  # noqa: BLE001 - surface connectivity failures in health
        database_status = f"error: {exc.__class__.__name__}"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": "ok" if database_status == "ok" else "degraded",
        "app": settings.app_name,
        "environment": settings.app_env,
        "database": database_status,
    }
    return JSONResponse(content=payload, status_code=http_status)
