from datetime import datetime
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Categoria,
    Elaboracion,
    ElaboracionOculta,
    FormulacionVersionProducto,
    Producto,
    VersionProducto,
)
from app.models.elaboracion import ESTADO_FINALIZADA


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class InvalidCategoriaIdsError(Exception):
    """Raised when one or more category ids do not exist."""


class IdPublicoDuplicadoError(Exception):
    """Raised when the generated id_publico collides with another product's (unique index)."""


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

    def conteos_elaboraciones(self, producto_ids: list[int]) -> dict[int, tuple[int, int]]:
        """Per product: (finalized elaboraciones, of those the ones not hidden from the public).

        One grouped query for any number of products. Borradores never count; a product without
        elaboraciones is absent from the result.
        """
        if not producto_ids:
            return {}
        stmt = (
            select(
                Elaboracion.producto_id,
                func.count(Elaboracion.id),
                func.sum(case((ElaboracionOculta.elaboracion_id.is_(None), 1), else_=0)),
            )
            .outerjoin(ElaboracionOculta, ElaboracionOculta.elaboracion_id == Elaboracion.id)
            .where(
                Elaboracion.producto_id.in_(producto_ids),
                Elaboracion.estado == ESTADO_FINALIZADA,
            )
            .group_by(Elaboracion.producto_id)
        )
        return {fila[0]: (int(fila[1]), int(fila[2] or 0)) for fila in self.db.execute(stmt)}

    def ids_con_formulacion(self, producto_ids: list[int]) -> set[int]:
        """Of those products, the ones whose CURRENT version has at least one ingredient line.

        One query for any number of products. A line of an older, no longer current version does
        not count: an elaboración is always registered against the current version.
        """
        if not producto_ids:
            return set()
        stmt = (
            select(VersionProducto.producto_id)
            .join(
                FormulacionVersionProducto,
                FormulacionVersionProducto.version_producto_id == VersionProducto.id,
            )
            .where(
                VersionProducto.producto_id.in_(producto_ids),
                VersionProducto.vigente.is_(True),
            )
            .distinct()
        )
        return set(self.db.scalars(stmt).all())

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

    def tiene_elaboracion_finalizada(self, producto_id: int) -> bool:
        """The product has at least one elaboración in state 'finalizada' (a borrador does not count)."""
        stmt = (
            select(Elaboracion.id)
            .where(Elaboracion.producto_id == producto_id, Elaboracion.estado == ESTADO_FINALIZADA)
            .limit(1)
        )
        return self.db.scalar(stmt) is not None

    def bloquear(self, producto: Producto) -> None:
        """Reload the product holding its row (FOR UPDATE on PostgreSQL): two simultaneous first
        enablings cannot both generate an id_publico."""
        self.db.refresh(producto, with_for_update=True)

    def publicar(self, producto: Producto, id_publico: str, publicado_en: datetime) -> Producto:
        producto.id_publico = id_publico
        producto.publicado = True
        producto.publicado_en = publicado_en
        self.db.add(producto)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            if "id_publico" in str(exc.orig):
                raise IdPublicoDuplicadoError(id_publico) from exc
            raise
        self.db.refresh(producto)
        return producto

    def despublicar(self, producto: Producto) -> Producto:
        """publicado_en and id_publico are kept on purpose."""
        producto.publicado = False
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        return producto

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
