from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_producto_formulacion_service
from app.models import Productor
from app.schemas.producto import (
    FormulacionComponenteCreate,
    FormulacionComponenteRead,
    FormulacionComponenteUpdate,
)
from app.services.ingrediente_service import IngredienteNotFoundError
from app.services.producto_formulacion_service import (
    FormulacionImmutableError,
    FormulacionNotFoundError,
    InvalidFormulacionError,
    ProductoFormulacionService,
    VersionProductoNotFoundError,
)
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion/productos", tags=["gestion-productos"])


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


@router.post(
    "/{producto_id}/versiones/{version_id}/formulacion",
    response_model=FormulacionComponenteRead,
    status_code=status.HTTP_201_CREATED,
)
def agregar_linea_formulacion(
    producto_id: int,
    version_id: int,
    payload: FormulacionComponenteCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> FormulacionComponenteRead:
    try:
        return service.add_formulacion_line_mine(
            current_productor,
            producto_id,
            version_id,
            payload,
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
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FormulacionImmutableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except InvalidFormulacionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{producto_id}/versiones/{version_id}/formulacion/{linea_id}",
    response_model=FormulacionComponenteRead,
)
def actualizar_linea_formulacion(
    producto_id: int,
    version_id: int,
    linea_id: int,
    payload: FormulacionComponenteUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> FormulacionComponenteRead:
    try:
        return service.update_formulacion_line_mine(
            current_productor,
            producto_id,
            version_id,
            linea_id,
            payload,
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
    except FormulacionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FormulacionImmutableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except InvalidFormulacionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{producto_id}/versiones/{version_id}/formulacion/{linea_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_linea_formulacion(
    producto_id: int,
    version_id: int,
    linea_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoFormulacionService = Depends(get_producto_formulacion_service),
) -> None:
    try:
        service.delete_formulacion_line_mine(
            current_productor,
            producto_id,
            version_id,
            linea_id,
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
    except FormulacionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FormulacionImmutableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
