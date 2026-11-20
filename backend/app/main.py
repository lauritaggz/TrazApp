import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    auth,
    gestion_alergenos,
    gestion_categorias,
    gestion_elaboraciones,
    gestion_ingredientes,
    gestion_insumos,
    gestion_costos,
    gestion_producto_formulacion,
    gestion_vista_publica,
    gestion_productos,
    health,
    ingredientes,
    lotes,
    productos,
    publico,
)
from app.core.config import get_settings

settings = get_settings()


class _SinEvaluaciones(logging.Filter):
    """HU11: the access log (client IP + path + time) must not record who answered a consultation.

    Drops only the lines of the evaluation endpoint; every other request is logged as before. The
    token travels in the body, never in the URL. A hosting provider's own logs are out of reach.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        return "/evaluaciones" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(_SinEvaluaciones())

app = FastAPI(
    title=settings.app_name,
    description=(
        "API de trazabilidad histórica de alimentos elaborados. "
        "Prototipo de mitigación RT-01."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the browser page read the QR file name when the app and the API are on different origins.
    expose_headers=["Content-Disposition"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(gestion_productos.router)
app.include_router(gestion_producto_formulacion.router)
app.include_router(gestion_costos.router)
app.include_router(gestion_vista_publica.router)
app.include_router(gestion_categorias.router)
app.include_router(gestion_alergenos.router)
app.include_router(gestion_ingredientes.router)
app.include_router(gestion_insumos.router)
app.include_router(gestion_elaboraciones.router)
app.include_router(productos.router)
app.include_router(ingredientes.router)
app.include_router(lotes.router)
app.include_router(publico.router)

uploads_root = Path(settings.uploads_root)
uploads_root.mkdir(parents=True, exist_ok=True)
(uploads_root / "products").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": f"{settings.app_name} API",
        "docs": "/docs",
        "health": "/health",
    }
