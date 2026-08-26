from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_producto_service
from app.models import Productor
from app.repositories.producto_repository import DuplicateCodigoInternoError
from app.schemas.producto import (
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
)
from app.services.producto_service import ProductoNotFoundError, ProductoService

router = APIRouter(prefix="/gestion/productos", tags=["gestion-productos"])


@router.post(
    "",
    response_model=ProductoGestionRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_producto(
    payload: ProductoGestionCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoService = Depends(get_producto_service),
) -> ProductoGestionRead:
    try:
        return service.create(current_productor, payload)
    except DuplicateCodigoInternoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[ProductoGestionRead])
def listar_productos(
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoService = Depends(get_producto_service),
) -> list[ProductoGestionRead]:
    return service.list_mine(current_productor)


@router.get("/{producto_id}", response_model=ProductoGestionRead)
def obtener_producto(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoService = Depends(get_producto_service),
) -> ProductoGestionRead:
    try:
        return service.get_mine(current_productor, producto_id)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch("/{producto_id}", response_model=ProductoGestionRead)
def actualizar_producto(
    producto_id: int,
    payload: ProductoGestionUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoService = Depends(get_producto_service),
) -> ProductoGestionRead:
    try:
        return service.update_mine(current_productor, producto_id, payload)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DuplicateCodigoInternoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
