from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_ingrediente_service
from app.models import Productor
from app.repositories.ingrediente_repository import DuplicateCodigoInternoError
from app.schemas.ingrediente import (
    IngredienteGestionCreate,
    IngredienteGestionRead,
    IngredienteGestionUpdate,
)
from app.services.ingrediente_service import IngredienteNotFoundError, IngredienteService

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
