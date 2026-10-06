from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_current_productor, get_elaboracion_service
from app.models import Productor
from app.schemas.elaboracion import (
    CodigoSugeridoRead,
    ElaboracionCreate,
    ElaboracionRead,
    ElaboracionResumenRead,
    EstadoElaboracion,
)
from app.services.elaboracion_service import (
    CodigoElaboracionRepetidoError,
    ElaboracionConflictError,
    ElaboracionNotFoundError,
    ElaboracionService,
    IngredientesDesactivadosError,
    InvalidElaboracionError,
)
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion", tags=["gestion-elaboraciones"])


def _conflict_error(exc: ElaboracionConflictError) -> HTTPException:
    """409; some conflicts carry data the client needs to resolve them."""
    if isinstance(exc, CodigoElaboracionRepetidoError):
        detail: object = {"mensaje": str(exc), "codigo_sugerido": exc.codigo_sugerido}
    elif isinstance(exc, IngredientesDesactivadosError):
        detail = {"mensaje": str(exc), "ingredientes": exc.ingredientes}
    else:
        detail = str(exc)
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@router.get(
    "/productos/{producto_id}/elaboraciones/codigo-sugerido",
    response_model=CodigoSugeridoRead,
)
def obtener_codigo_sugerido(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ElaboracionService = Depends(get_elaboracion_service),
) -> CodigoSugeridoRead:
    try:
        return service.codigo_sugerido_mine(current_productor, producto_id)
    except ProductoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/productos/{producto_id}/elaboraciones",
    response_model=ElaboracionRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_elaboracion(
    producto_id: int,
    payload: ElaboracionCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: ElaboracionService = Depends(get_elaboracion_service),
) -> ElaboracionRead:
    try:
        return service.create_borrador(current_productor, producto_id, payload)
    except ProductoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ElaboracionConflictError as exc:
        raise _conflict_error(exc) from exc
    except InvalidElaboracionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("/elaboraciones", response_model=list[ElaboracionResumenRead])
def listar_elaboraciones(
    producto_id: int | None = Query(default=None, gt=0),
    estado: EstadoElaboracion | None = Query(default=None),
    current_productor: Productor = Depends(get_current_productor),
    service: ElaboracionService = Depends(get_elaboracion_service),
) -> list[ElaboracionResumenRead]:
    return service.list_mine(current_productor, producto_id=producto_id, estado=estado)


@router.get("/elaboraciones/{elaboracion_id}", response_model=ElaboracionRead)
def obtener_elaboracion(
    elaboracion_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ElaboracionService = Depends(get_elaboracion_service),
) -> ElaboracionRead:
    try:
        return service.get_mine(current_productor, elaboracion_id)
    except ElaboracionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
