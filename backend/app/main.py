from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    auth,
    gestion_categorias,
    gestion_ingredientes,
    gestion_productos,
    health,
    ingredientes,
    lotes,
    productos,
)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(gestion_productos.router)
app.include_router(gestion_categorias.router)
app.include_router(gestion_ingredientes.router)
app.include_router(productos.router)
app.include_router(ingredientes.router)
app.include_router(lotes.router)

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
