from __future__ import annotations

from typing import TYPE_CHECKING

from app.models import Producto, Productor
from app.repositories.producto_repository import ProductoRepository
from app.schemas.producto import (
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
)

if TYPE_CHECKING:
    from app.services.product_image_service import ProductImageService


class ProductoNotFoundError(Exception):
    """Raised when a product is not visible to the authenticated productor."""


class ProductoService:
    def __init__(
        self,
        repository: ProductoRepository,
        image_service: ProductImageService | None = None,
    ) -> None:
        self.repository = repository
        self.image_service = image_service

    def create(
        self,
        productor: Productor,
        payload: ProductoGestionCreate,
    ) -> ProductoGestionRead:
        data = payload.model_dump()
        categoria_ids = data.pop("categoria_ids", [])
        producto = self.repository.create(
            productor_id=productor.id,
            categoria_ids=categoria_ids,
            **data,
        )
        return ProductoGestionRead.model_validate(producto)

    def list_mine(self, productor: Productor) -> list[ProductoGestionRead]:
        productos = self.repository.list_by_productor(productor.id)
        return [ProductoGestionRead.model_validate(p) for p in productos]

    def get_mine(
        self,
        productor: Productor,
        producto_id: int,
    ) -> ProductoGestionRead:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        return ProductoGestionRead.model_validate(producto)

    def update_mine(
        self,
        productor: Productor,
        producto_id: int,
        payload: ProductoGestionUpdate,
    ) -> ProductoGestionRead:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        updates = payload.model_dump(exclude_unset=True)
        if (
            "imagen_url" in updates
            and updates["imagen_url"] is None
            and producto.imagen_url
            and self.image_service is not None
        ):
            self.image_service.delete_stored_image(producto.imagen_url)
        updated = self.repository.update(producto, **updates)
        return ProductoGestionRead.model_validate(updated)

    def delete_mine(self, productor: Productor, producto_id: int) -> None:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        self.repository.deactivate(producto)

    def _get_owned_or_raise(self, productor_id: int, producto_id: int) -> Producto:
        producto = self.repository.get_by_id_and_productor(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")
        return producto
