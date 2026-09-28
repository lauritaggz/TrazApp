from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    FormulacionVersionProducto,
    Ingrediente,
    LoteProducto,
    Producto,
    VersionProducto,
)


class DuplicateFormulacionIngredienteError(Exception):
    """Raised when an ingredient is already in the version formulation."""


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

    def version_has_lotes(self, version_producto_id: int) -> bool:
        count = self.db.scalar(
            select(func.count())
            .select_from(LoteProducto)
            .where(LoteProducto.version_producto_id == version_producto_id)
        )
        return bool(count)

    def list_formulacion(
        self,
        version_producto_id: int,
    ) -> list[FormulacionVersionProducto]:
        stmt = (
            select(FormulacionVersionProducto)
            .where(FormulacionVersionProducto.version_producto_id == version_producto_id)
            .order_by(
                FormulacionVersionProducto.orden.asc().nulls_last(),
                FormulacionVersionProducto.id.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_formulacion_line(
        self,
        linea_id: int,
        version_producto_id: int,
    ) -> FormulacionVersionProducto | None:
        stmt = select(FormulacionVersionProducto).where(
            FormulacionVersionProducto.id == linea_id,
            FormulacionVersionProducto.version_producto_id == version_producto_id,
        )
        return self.db.scalar(stmt)

    def add_formulacion_line(
        self,
        *,
        version_producto_id: int,
        ingrediente_id: int,
        ingrediente_nombre: str,
        ingrediente_codigo_interno: str | None,
        ingrediente_tipo: str | None,
        porcentaje: Decimal | None,
        cantidad: Decimal | None,
        unidad: str | None,
        orden: int | None,
        notas: str | None,
    ) -> FormulacionVersionProducto:
        linea = FormulacionVersionProducto(
            version_producto_id=version_producto_id,
            ingrediente_id=ingrediente_id,
            ingrediente_nombre=ingrediente_nombre,
            ingrediente_codigo_interno=ingrediente_codigo_interno,
            ingrediente_tipo=ingrediente_tipo,
            porcentaje=porcentaje,
            cantidad=cantidad,
            unidad=unidad,
            orden=orden,
            notas=notas,
        )
        self.db.add(linea)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateFormulacionIngredienteError(
                "El ingrediente ya forma parte de la formulación."
            ) from exc
        self.db.refresh(linea)
        loaded = self.get_formulacion_line(linea.id, version_producto_id)
        if loaded is None:
            raise RuntimeError("Línea de formulación no encontrada tras persistir.")
        return loaded

    def update_formulacion_line(
        self,
        linea: FormulacionVersionProducto,
        **fields: object,
    ) -> FormulacionVersionProducto:
        for key, value in fields.items():
            setattr(linea, key, value)
        self.db.add(linea)
        self.db.commit()
        self.db.refresh(linea)
        loaded = self.get_formulacion_line(linea.id, linea.version_producto_id)
        if loaded is None:
            raise RuntimeError("Línea de formulación no encontrada tras actualizar.")
        return loaded

    def delete_formulacion_line(self, linea: FormulacionVersionProducto) -> None:
        self.db.delete(linea)
        self.db.commit()
