from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_trazabilidad_service
from app.schemas.producto import (
    ProductoCreate,
    ProductoRead,
    VersionProductoCreate,
    VersionProductoRead,
)
from app.services.trazabilidad_service import TrazabilidadService

router = APIRouter(prefix="/productos", tags=["productos"])


@router.post("", response_model=ProductoRead, status_code=status.HTTP_201_CREATED)
def crear_producto(
    payload: ProductoCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> ProductoRead:
    return service.crear_producto(payload)


@router.post(
    "/{producto_id}/versiones",
    response_model=VersionProductoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_version_producto(
    producto_id: int,
    payload: VersionProductoCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> VersionProductoRead:
    try:
        return service.crear_version_producto(producto_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{producto_id}/versiones", response_model=list[VersionProductoRead])
def listar_versiones_producto(
    producto_id: int,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> list[VersionProductoRead]:
    try:
        return service.listar_versiones_producto(producto_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
