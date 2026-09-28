from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_producto_formulacion_service
from app.models import Productor
from app.schemas.producto import (
    FormulacionComponenteRead,
    FormulacionGuardadaRead,
    FormulacionReemplazo,
    FormulacionVigenteRead,
    VersionProductoHistorialRead,
)
from app.services.ingrediente_service import IngredienteNotFoundError
from app.services.producto_formulacion_service import (
    FormulacionConflictError,
    InvalidFormulacionError,
    ProductoFormulacionService,
    VersionProductoNotFoundError,
)
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion/productos", tags=["gestion-productos"])


@router.get("/{producto_id}/formulacion", response_model=FormulacionVigenteRead)
def obtener_formulacion_vigente(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> FormulacionVigenteRead:
    try:
        return service.get_formulacion_vigente_mine(current_productor, producto_id)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/{producto_id}/versiones", response_model=list[VersionProductoHistorialRead])
def listar_versiones(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> list[VersionProductoHistorialRead]:
    try:
        return service.list_versiones_mine(current_productor, producto_id)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put("/{producto_id}/formulacion", response_model=FormulacionGuardadaRead)
def reemplazar_formulacion(
    producto_id: int,
    payload: FormulacionReemplazo,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> FormulacionGuardadaRead:
    try:
        return service.reemplazar_formulacion_mine(current_productor, producto_id, payload)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except (IngredienteNotFoundError, InvalidFormulacionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except FormulacionConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "/{producto_id}/versiones/{version_id}/formulacion",
    response_model=list[FormulacionComponenteRead],
)
def listar_formulacion_version(
    producto_id: int,
    version_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> list[FormulacionComponenteRead]:
    try:
        return service.list_formulacion_mine(
            current_productor,
            producto_id,
            version_id,
        )
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except VersionProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
