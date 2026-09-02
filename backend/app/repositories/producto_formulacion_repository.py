from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import FormulacionVersionProducto, LoteProducto, VersionProducto


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
