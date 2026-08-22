from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_trazabilidad_service
from app.schemas.lote import (
    LoteIngredienteCreate,
    LoteIngredienteRead,
    LoteProductoCreate,
    LoteProductoRead,
    TrazabilidadRead,
)
from app.services.trazabilidad_service import TrazabilidadService

router = APIRouter(tags=["lotes"])


@router.post(
    "/lotes-ingredientes",
    response_model=LoteIngredienteRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_lote_ingrediente(
    payload: LoteIngredienteCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> LoteIngredienteRead:
    try:
        return service.crear_lote_ingrediente(payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/lotes-productos",
    response_model=LoteProductoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_lote_producto(
    payload: LoteProductoCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> LoteProductoRead:
    try:
        return service.crear_lote_producto(payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/lotes-productos/{codigo}/trazabilidad",
    response_model=TrazabilidadRead,
)
def obtener_trazabilidad_historica(
    codigo: str,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> TrazabilidadRead:
    try:
        return service.obtener_trazabilidad_historica(codigo)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
