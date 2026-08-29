from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from app.api.dependencies import get_current_productor, get_product_image_service, get_producto_service
from app.models import Productor
from app.repositories.producto_repository import (
    DuplicateCodigoInternoError,
    InvalidCategoriaIdsError,
)
from app.schemas.producto import (
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
)
from app.services.product_image_service import InvalidProductImageError, ProductImageService
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
    except InvalidCategoriaIdsError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
    except InvalidCategoriaIdsError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: ProductoService = Depends(get_producto_service),
) -> None:
    try:
        service.delete_mine(current_productor, producto_id)
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/{producto_id}/imagen", response_model=ProductoGestionRead)
async def subir_imagen_producto(
    producto_id: int,
    file: UploadFile = File(...),
    current_productor: Productor = Depends(get_current_productor),
    image_service: ProductImageService = Depends(get_product_image_service),
) -> ProductoGestionRead:
    try:
        return await image_service.upload_product_image(
            current_productor,
            producto_id,
            file,
        )
    except ProductoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidProductImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
