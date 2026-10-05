from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_current_productor, get_insumo_service
from app.models import Productor
from app.schemas.insumo import InsumoCreate, InsumoRead, InsumoUpdate
from app.services.insumo_service import (
    DuplicateCodigoBarrasError,
    InsumoConflictError,
    InsumoNotFoundError,
    InsumoService,
    InvalidInsumoError,
)

router = APIRouter(prefix="/gestion/insumos", tags=["gestion-insumos"])


def _duplicate_codigo_error(exc: DuplicateCodigoBarrasError) -> HTTPException:
    """409 with the existing supply, so the client can use it or reactivate it."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "mensaje": str(exc),
            "insumo_id": exc.insumo_id,
            "activo": exc.activo,
        },
    )


@router.post(
    "",
    response_model=InsumoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_insumo(
    payload: InsumoCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.create(current_productor, payload)
    except DuplicateCodigoBarrasError as exc:
        raise _duplicate_codigo_error(exc) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidInsumoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[InsumoRead])
def listar_insumos(
    ingrediente_id: int | None = Query(default=None, gt=0),
    activo: bool = Query(default=True),
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> list[InsumoRead]:
    return service.list_mine(
        current_productor,
        activo=activo,
        ingrediente_id=ingrediente_id,
    )


@router.get("/{insumo_id}", response_model=InsumoRead)
def obtener_insumo(
    insumo_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.get_mine(current_productor, insumo_id)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{insumo_id}", response_model=InsumoRead)
def actualizar_insumo(
    insumo_id: int,
    payload: InsumoUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.update_mine(current_productor, insumo_id, payload)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateCodigoBarrasError as exc:
        raise _duplicate_codigo_error(exc) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidInsumoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete("/{insumo_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_insumo(
    insumo_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> None:
    try:
        service.delete_mine(current_productor, insumo_id)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
