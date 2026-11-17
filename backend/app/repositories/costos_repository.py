"""Read-only queries of the cost calculator (HU14 / T14-04). This repository never writes."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import (
    CantidadIngredienteProducto,
    FormulacionVersionProducto,
    InsumoComercial,
    OtroCostoProducto,
    Producto,
    VersionProducto,
)


@dataclass(frozen=True)
class LineaFormulacion:
    ingrediente_id: int
    ingrediente_nombre: str
    orden: int | None


@dataclass(frozen=True)
class CantidadGuardada:
    cantidad: Decimal
    unidad: str


@dataclass(frozen=True)
class OtroCostoGuardado:
    id: int
    nombre: str
    monto: Decimal
    orden: int


@dataclass(frozen=True)
class InsumoDeCosto:
    """The columns of a supply the calculator needs (not the raw `ficha`)."""

    id: int
    ingrediente_id: int
    nombre: str
    marca_origen: str
    habitual: bool
    activo: bool
    precio_referencia: Decimal | None
    precio_fuente: str | None
    precio_fecha: datetime | None
    contenido_cantidad: Decimal | None
    contenido_unidad: str | None


class CostosRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_producto(self, producto_id: int, productor_id: int) -> Producto | None:
        return self.db.scalar(
            select(Producto).where(
                Producto.id == producto_id,
                Producto.productor_id == productor_id,
                Producto.activo.is_(True),
            )
        )

    def get_version_vigente_id(self, producto_id: int) -> int | None:
        return self.db.scalar(
            select(VersionProducto.id)
            .where(VersionProducto.producto_id == producto_id, VersionProducto.vigente.is_(True))
            .order_by(VersionProducto.numero_version.desc())
            .limit(1)
        )

    def lineas_formulacion(self, version_id: int) -> list[LineaFormulacion]:
        """The ingredients of a version in the same order the formulation shows them."""
        filas = self.db.execute(
            select(
                FormulacionVersionProducto.ingrediente_id,
                FormulacionVersionProducto.ingrediente_nombre,
                FormulacionVersionProducto.orden,
            )
            .where(FormulacionVersionProducto.version_producto_id == version_id)
            .order_by(
                FormulacionVersionProducto.orden.asc().nulls_last(),
                FormulacionVersionProducto.id.asc(),
            )
        )
        return [LineaFormulacion(f.ingrediente_id, f.ingrediente_nombre, f.orden) for f in filas]

    def cantidades(self, producto_id: int) -> dict[int, CantidadGuardada]:
        filas = self.db.execute(
            select(
                CantidadIngredienteProducto.ingrediente_id,
                CantidadIngredienteProducto.cantidad,
                CantidadIngredienteProducto.unidad,
            ).where(CantidadIngredienteProducto.producto_id == producto_id)
        )
        return {f.ingrediente_id: CantidadGuardada(f.cantidad, f.unidad) for f in filas}

    def otros_costos(self, producto_id: int) -> list[OtroCostoGuardado]:
        filas = self.db.execute(
            select(OtroCostoProducto.id, OtroCostoProducto.nombre, OtroCostoProducto.monto, OtroCostoProducto.orden)
            .where(OtroCostoProducto.producto_id == producto_id)
            .order_by(OtroCostoProducto.orden.asc(), OtroCostoProducto.id.asc())
        )
        return [OtroCostoGuardado(f.id, f.nombre, f.monto, f.orden) for f in filas]

    def insumos_para_costos(
        self,
        productor_id: int,
        ingrediente_ids: list[int],
        insumo_ids: list[int],
    ) -> list[InsumoDeCosto]:
        """In ONE query: the active supplies of those ingredients (for the selector and the habitual one)
        plus those specific supplies (last elaboración, chosen alternatives) whatever their state.
        Always of the productor: a supply of another productor never comes back."""
        condiciones = [and_(InsumoComercial.ingrediente_id.in_(ingrediente_ids), InsumoComercial.activo.is_(True))]
        if insumo_ids:
            condiciones.append(InsumoComercial.id.in_(insumo_ids))
        filas = self.db.execute(
            select(
                InsumoComercial.id,
                InsumoComercial.ingrediente_id,
                InsumoComercial.nombre,
                InsumoComercial.marca_origen,
                InsumoComercial.habitual,
                InsumoComercial.activo,
                InsumoComercial.precio_referencia,
                InsumoComercial.precio_fuente,
                InsumoComercial.precio_fecha,
                InsumoComercial.contenido_cantidad,
                InsumoComercial.contenido_unidad,
            ).where(InsumoComercial.productor_id == productor_id, or_(*condiciones))
        )
        return [InsumoDeCosto(*fila) for fila in filas]
