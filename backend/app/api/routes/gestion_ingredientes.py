from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_ingrediente_service
from app.models import Productor
from app.repositories.ingrediente_repository import DuplicateCodigoInternoError
from app.schemas.ingrediente import (
    AlergenoRead,
    ComposicionComponenteCreate,
    ComposicionComponenteRead,
    ComposicionComponenteUpdate,
    IngredienteAlergenoCreate,
    IngredienteGestionCreate,
    IngredienteGestionRead,
    IngredienteGestionUpdate,
)
from app.services.ingrediente_service import (
    AlergenoNotFoundError,
    ComposicionNotFoundError,
    IngredienteAlergenoNotFoundError,
    IngredienteNotFoundError,
    IngredienteService,
    InvalidComposicionError,
    InvalidIngredienteAlergenoError,
    InvalidTipoIngredienteError,
)

router = APIRouter(prefix="/gestion/ingredientes", tags=["gestion-ingredientes"])


@router.post(
    "",
    response_model=IngredienteGestionRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_ingrediente(
    payload: IngredienteGestionCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> IngredienteGestionRead:
    try:
        return service.create(current_productor, payload)
    except DuplicateCodigoInternoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except InvalidTipoIngredienteError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[IngredienteGestionRead])
def listar_ingredientes(
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> list[IngredienteGestionRead]:
    return service.list_mine(current_productor)


@router.get("/{ingrediente_id}", response_model=IngredienteGestionRead)
def obtener_ingrediente(
    ingrediente_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> IngredienteGestionRead:
    try:
        return service.get_mine(current_productor, ingrediente_id)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch("/{ingrediente_id}", response_model=IngredienteGestionRead)
def actualizar_ingrediente(
    ingrediente_id: int,
    payload: IngredienteGestionUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> IngredienteGestionRead:
    try:
        return service.update_mine(current_productor, ingrediente_id, payload)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DuplicateCodigoInternoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except InvalidTipoIngredienteError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete("/{ingrediente_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_ingrediente(
    ingrediente_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> None:
    try:
        service.delete_mine(current_productor, ingrediente_id)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{ingrediente_id}/composicion",
    response_model=list[ComposicionComponenteRead],
)
def listar_composicion(
    ingrediente_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> list[ComposicionComponenteRead]:
    try:
        return service.list_composicion_mine(current_productor, ingrediente_id)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidComposicionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post(
    "/{ingrediente_id}/composicion",
    response_model=ComposicionComponenteRead,
    status_code=status.HTTP_201_CREATED,
)
def agregar_componente_composicion(
    ingrediente_id: int,
    payload: ComposicionComponenteCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> ComposicionComponenteRead:
    try:
        return service.add_composicion_component_mine(
            current_productor,
            ingrediente_id,
            payload,
        )
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidComposicionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{ingrediente_id}/composicion/{composicion_id}",
    response_model=ComposicionComponenteRead,
)
def actualizar_componente_composicion(
    ingrediente_id: int,
    composicion_id: int,
    payload: ComposicionComponenteUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> ComposicionComponenteRead:
    try:
        return service.update_composicion_component_mine(
            current_productor,
            ingrediente_id,
            composicion_id,
            payload,
        )
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ComposicionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidComposicionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{ingrediente_id}/composicion/{composicion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_componente_composicion(
    ingrediente_id: int,
    composicion_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> None:
    try:
        service.delete_composicion_component_mine(
            current_productor,
            ingrediente_id,
            composicion_id,
        )
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ComposicionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidComposicionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get(
    "/{ingrediente_id}/alergenos",
    response_model=list[AlergenoRead],
)
def listar_alergenos_ingrediente(
    ingrediente_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> list[AlergenoRead]:
    try:
        return service.list_alergenos_mine(current_productor, ingrediente_id)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{ingrediente_id}/alergenos",
    response_model=AlergenoRead,
    status_code=status.HTTP_201_CREATED,
)
def agregar_alergeno_ingrediente(
    ingrediente_id: int,
    payload: IngredienteAlergenoCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> AlergenoRead:
    try:
        return service.add_alergeno_mine(current_productor, ingrediente_id, payload)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AlergenoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidIngredienteAlergenoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{ingrediente_id}/alergenos/{alergeno_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_alergeno_ingrediente(
    ingrediente_id: int,
    alergeno_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> None:
    try:
        service.delete_alergeno_mine(current_productor, ingrediente_id, alergeno_id)
    except IngredienteNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AlergenoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except IngredienteAlergenoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
