from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_costos_service, get_current_productor
from app.models import Productor
from app.schemas.costos import (
    CostosProductoRead,
    CostosProductoUpdate,
    costos_a_read,
    parsear_alternativas,
)
from app.services.costos_service import CostosService, CostosValidationError
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion/productos", tags=["gestion-costos"])

DESCRIPCION_INSUMO = (
    "Insumo alternativo para este cálculo, con la forma <ingrediente_id>:<insumo_id>. "
    "Repetible (uno por ingrediente). No se guarda."
)


def _alternativas(insumo: list[str] = Query(default=[], description=DESCRIPCION_INSUMO)) -> dict[int, int]:
    try:
        return parsear_alternativas(insumo)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"mensaje": str(exc)}) from exc


def _invalido(exc: CostosValidationError) -> HTTPException:
    detalle: dict[str, object] = {"mensaje": str(exc)}
    if exc.ingrediente_id is not None:
        detalle["ingrediente_id"] = exc.ingrediente_id
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detalle)


@router.get("/{producto_id}/costos", response_model=CostosProductoRead)
def obtener_costos(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    alternativas: dict[int, int] = Depends(_alternativas),
    service: CostosService = Depends(get_costos_service),
) -> CostosProductoRead:
    try:
        return costos_a_read(service.calcular(current_productor.id, producto_id, alternativas))
    except ProductoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CostosValidationError as exc:
        raise _invalido(exc) from exc


@router.put("/{producto_id}/costos", response_model=CostosProductoRead)
def guardar_costos(
    producto_id: int,
    payload: CostosProductoUpdate,
    current_productor: Productor = Depends(get_current_productor),
    alternativas: dict[int, int] = Depends(_alternativas),
    service: CostosService = Depends(get_costos_service),
) -> CostosProductoRead:
    try:
        return costos_a_read(service.guardar(current_productor.id, producto_id, payload, alternativas))
    except ProductoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CostosValidationError as exc:
        raise _invalido(exc) from exc
