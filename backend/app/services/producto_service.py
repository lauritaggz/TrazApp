from app.models import Producto, Productor
from app.repositories.producto_repository import ProductoRepository
from app.schemas.producto import (
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
)


class ProductoNotFoundError(Exception):
    """Raised when a product is not visible to the authenticated productor."""


class ProductoService:
    def __init__(self, repository: ProductoRepository) -> None:
        self.repository = repository

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
        updated = self.repository.update(producto, **updates)
        return ProductoGestionRead.model_validate(updated)

    def _get_owned_or_raise(self, productor_id: int, producto_id: int) -> Producto:
        producto = self.repository.get_by_id_and_productor(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")
        return producto
