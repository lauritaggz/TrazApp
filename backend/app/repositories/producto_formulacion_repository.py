from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models import (
    FormulacionVersionProducto,
    Ingrediente,
    Producto,
    VersionProducto,
)


class ProductoFormulacionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_version_by_id_and_producto(
        self,
        version_id: int,
        producto_id: int,
    ) -> VersionProducto | None:
        stmt = select(VersionProducto).where(
            VersionProducto.id == version_id,
            VersionProducto.producto_id == producto_id,
        )
        return self.db.scalar(stmt)

    def get_version_by_id(self, version_id: int) -> VersionProducto | None:
        return self.db.get(VersionProducto, version_id)

    def mark_version_usada(self, version: VersionProducto) -> VersionProducto:
        version.usada_en_elaboracion = True
        self.db.add(version)
        self.db.flush()
        return version

    def list_formulacion(
        self,
        version_producto_id: int,
    ) -> list[FormulacionVersionProducto]:
        stmt = (
            select(FormulacionVersionProducto)
            .options(selectinload(FormulacionVersionProducto.ingrediente))
            .where(FormulacionVersionProducto.version_producto_id == version_producto_id)
            .order_by(
                FormulacionVersionProducto.orden.asc().nulls_last(),
                FormulacionVersionProducto.id.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def list_versiones_con_cantidad_lineas(
        self,
        producto_id: int,
    ) -> list[tuple[VersionProducto, int]]:
        cantidad = func.count(FormulacionVersionProducto.id)
        stmt = (
            select(VersionProducto, cantidad)
            .outerjoin(
                FormulacionVersionProducto,
                FormulacionVersionProducto.version_producto_id == VersionProducto.id,
            )
            .where(VersionProducto.producto_id == producto_id)
            .group_by(VersionProducto.id)
            .order_by(VersionProducto.numero_version.desc())
        )
        return [(version, total) for version, total in self.db.execute(stmt).all()]

    # --- HU03: formulation replacement. These methods only flush; the service
    # commits or rolls back the whole replacement as one transaction. ---

    def lock_producto_for_productor(
        self,
        producto_id: int,
        productor_id: int,
    ) -> Producto | None:
        stmt = (
            select(Producto)
            .where(Producto.id == producto_id, Producto.productor_id == productor_id)
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def get_version_vigente(self, producto_id: int) -> VersionProducto | None:
        stmt = (
            select(VersionProducto)
            .where(
                VersionProducto.producto_id == producto_id,
                VersionProducto.vigente.is_(True),
            )
            .order_by(VersionProducto.numero_version.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def next_numero_version(self, producto_id: int) -> int:
        current = self.db.scalar(
            select(func.max(VersionProducto.numero_version)).where(
                VersionProducto.producto_id == producto_id
            )
        )
        return (current or 0) + 1

    def list_ingredientes_for_productor(
        self,
        productor_id: int,
        ingrediente_ids: list[int],
    ) -> list[Ingrediente]:
        stmt = select(Ingrediente).where(
            Ingrediente.productor_id == productor_id,
            Ingrediente.id.in_(ingrediente_ids),
        )
        return list(self.db.scalars(stmt).all())

    def apagar_vigentes(self, producto_id: int) -> None:
        self.db.execute(
            update(VersionProducto)
            .where(
                VersionProducto.producto_id == producto_id,
                VersionProducto.vigente.is_(True),
            )
            .values(vigente=False)
            .execution_options(synchronize_session="fetch")
        )

    def create_version_vigente(
        self,
        *,
        producto_id: int,
        numero_version: int,
        descripcion: str,
    ) -> VersionProducto:
        version = VersionProducto(
            producto_id=producto_id,
            numero_version=numero_version,
            descripcion=descripcion,
            vigente=True,
            usada_en_elaboracion=False,
        )
        self.db.add(version)
        self.db.flush()
        return version

    def stage_formulacion_line(self, **fields: object) -> FormulacionVersionProducto:
        linea = FormulacionVersionProducto(**fields)
        self.db.add(linea)
        return linea

    def stage_delete_formulacion_line(self, linea: FormulacionVersionProducto) -> None:
        self.db.delete(linea)

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()
