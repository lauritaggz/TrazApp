from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Categoria, Producto


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class InvalidCategoriaIdsError(Exception):
    """Raised when one or more category ids do not exist."""


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
        costo_produccion: Decimal | None = None,
        precio_venta: Decimal | None = None,
        imagen_url: str | None = None,
        categoria_ids: list[int] | None = None,
    ) -> Producto:
        categorias = self._resolve_categorias(categoria_ids or [])
        producto = Producto(
            productor_id=productor_id,
            codigo_interno=codigo_interno,
            nombre=nombre,
            descripcion=descripcion,
            contenido_neto=contenido_neto,
            unidad_medida=unidad_medida,
            presentacion=presentacion,
            costo_produccion=costo_produccion,
            precio_venta=precio_venta,
            imagen_url=imagen_url,
            activo=True,
            categorias=categorias,
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
        return self._reload_with_categorias(producto.id)

    def list_by_productor(self, productor_id: int) -> list[Producto]:
        stmt = (
            select(Producto)
            .options(selectinload(Producto.categorias))
            .where(
                Producto.productor_id == productor_id,
                Producto.activo.is_(True),
            )
            .order_by(Producto.created_at.desc().nullslast(), Producto.id.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id_and_productor(
        self,
        producto_id: int,
        productor_id: int,
        *,
        active_only: bool = True,
    ) -> Producto | None:
        stmt = (
            select(Producto)
            .options(selectinload(Producto.categorias))
            .where(
                Producto.id == producto_id,
                Producto.productor_id == productor_id,
            )
        )
        if active_only:
            stmt = stmt.where(Producto.activo.is_(True))
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
        categoria_ids = fields.pop("categoria_ids", None)
        if categoria_ids is not None:
            producto.categorias = self._resolve_categorias(categoria_ids)

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
        return self._reload_with_categorias(producto.id)

    def deactivate(self, producto: Producto) -> Producto:
        producto.activo = False
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        return producto

    def _resolve_categorias(self, categoria_ids: list[int]) -> list[Categoria]:
        if not categoria_ids:
            return []

        stmt = select(Categoria).where(Categoria.id.in_(categoria_ids))
        categorias = list(self.db.scalars(stmt).all())
        if len(categorias) != len(set(categoria_ids)):
            raise InvalidCategoriaIdsError("Una o más categorías no existen.")
        categorias_by_id = {categoria.id: categoria for categoria in categorias}
        return [categorias_by_id[categoria_id] for categoria_id in categoria_ids]

    def _reload_with_categorias(self, producto_id: int) -> Producto:
        stmt = (
            select(Producto)
            .options(selectinload(Producto.categorias))
            .where(Producto.id == producto_id)
        )
        producto = self.db.scalar(stmt)
        if producto is None:
            raise RuntimeError(f"Producto {producto_id} no encontrado tras persistir.")
        return producto
