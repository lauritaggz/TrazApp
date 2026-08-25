from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Producto


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class ProductoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        productor_id: int,
        codigo_interno: str,
        nombre: str,
        descripcion: str,
        contenido_neto: Decimal,
        unidad_medida: str,
        presentacion: str | None,
    ) -> Producto:
        producto = Producto(
            productor_id=productor_id,
            codigo_interno=codigo_interno,
            nombre=nombre,
            descripcion=descripcion,
            contenido_neto=contenido_neto,
            unidad_medida=unidad_medida,
            presentacion=presentacion,
            activo=True,
        )
        self.db.add(producto)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateCodigoInternoError(
                "Ya existe un producto con ese código interno."
            ) from exc
        self.db.refresh(producto)
        return producto

    def list_by_productor(self, productor_id: int) -> list[Producto]:
        stmt = (
            select(Producto)
            .where(Producto.productor_id == productor_id)
            .order_by(Producto.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id_and_productor(
        self,
        producto_id: int,
        productor_id: int,
    ) -> Producto | None:
        stmt = select(Producto).where(
            Producto.id == producto_id,
            Producto.productor_id == productor_id,
        )
        return self.db.scalar(stmt)

    def exists_codigo_for_productor(
        self,
        productor_id: int,
        codigo_interno: str,
        exclude_producto_id: int | None = None,
    ) -> bool:
        stmt = select(Producto.id).where(
            Producto.productor_id == productor_id,
            Producto.codigo_interno == codigo_interno,
        )
        if exclude_producto_id is not None:
            stmt = stmt.where(Producto.id != exclude_producto_id)
        return self.db.scalar(stmt) is not None

    def update(self, producto: Producto, **fields: object) -> Producto:
        for key, value in fields.items():
            setattr(producto, key, value)
        self.db.add(producto)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateCodigoInternoError(
                "Ya existe un producto con ese código interno."
            ) from exc
        self.db.refresh(producto)
        return producto
