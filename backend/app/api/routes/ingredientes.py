from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_trazabilidad_service
from app.schemas.ingrediente import (
    IngredienteCreate,
    IngredienteRead,
    VersionIngredienteCreate,
    VersionIngredienteRead,
)
from app.services.trazabilidad_service import TrazabilidadService

router = APIRouter(prefix="/ingredientes", tags=["ingredientes"])


@router.post("", response_model=IngredienteRead, status_code=status.HTTP_201_CREATED)
def crear_ingrediente(
    payload: IngredienteCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> IngredienteRead:
    return service.crear_ingrediente(payload)


@router.post(
    "/{ingrediente_id}/versiones",
    response_model=VersionIngredienteRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_version_ingrediente(
    ingrediente_id: int,
    payload: VersionIngredienteCreate,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> VersionIngredienteRead:
    try:
        return service.crear_version_ingrediente(ingrediente_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{ingrediente_id}/versiones", response_model=list[VersionIngredienteRead])
def listar_versiones_ingrediente(
    ingrediente_id: int,
    service: TrazabilidadService = Depends(get_trazabilidad_service),
) -> list[VersionIngredienteRead]:
    try:
        return service.listar_versiones_ingrediente(ingrediente_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
