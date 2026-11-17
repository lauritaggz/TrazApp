"""Cost calculator data (HU14 / T14-02): quantities per product and ingredient, and other costs.

The calculator is an estimate: nothing here belongs to a product version or to an elaboración, so
saving these rows never creates a version and never touches a finalized elaboración.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Same vocabulary as the formulation and the product ("unidad" is shown as "un" on screen).
UNIDADES_COSTO = ("g", "kg", "ml", "L", "unidad")
UNIDADES_COSTO_SQL = "('g', 'kg', 'ml', 'L', 'unidad')"

# Where a price or a content comes from. Open Food Facts has no prices, so it is only a content source.
FUENTE_PRECIO_JUMBO = "jumbo"
FUENTE_PRECIO_MANUAL = "manual"
FUENTES_PRECIO = (FUENTE_PRECIO_JUMBO, FUENTE_PRECIO_MANUAL)
FUENTE_CONTENIDO_OFF = "open_food_facts"
FUENTES_CONTENIDO = (FUENTE_PRECIO_JUMBO, FUENTE_CONTENIDO_OFF, FUENTE_PRECIO_MANUAL)


class CantidadIngredienteProducto(Base):
    """Quantity of an ingredient used in one batch of a product (CA4).

    One row per product and ingredient, independent of the formulation version: if the ingredient
    leaves the current formulation the row is kept but not used.
    """

    __tablename__ = "producto_ingrediente_cantidades"
    __table_args__ = (
        UniqueConstraint(
            "producto_id",
            "ingrediente_id",
            name="uq_producto_ingrediente_cantidad",
        ),
        CheckConstraint("cantidad > 0", name="ck_producto_ingrediente_cantidad_positiva"),
        CheckConstraint(
            f"unidad IN {UNIDADES_COSTO_SQL}",
            name="ck_producto_ingrediente_cantidad_unidad",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unidad: Mapped[str] = mapped_column(String(20), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OtroCostoProducto(Base):
    """Another cost per batch (energy, packaging...) with a name and an amount (CA7)."""

    __tablename__ = "producto_otros_costos"
    __table_args__ = (
        CheckConstraint("length(trim(nombre)) > 0", name="ck_producto_otro_costo_nombre"),
        CheckConstraint("monto >= 0", name="ck_producto_otro_costo_monto"),
        CheckConstraint("orden >= 1", name="ck_producto_otro_costo_orden"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Not unique on purpose: replacing the whole list would trip a unique (producto, orden)
    # because the unit of work inserts before it deletes.
    orden: Mapped[int] = mapped_column(Integer, nullable=False)


Index(
    "ix_producto_otros_costos_producto_orden",
    OtroCostoProducto.producto_id,
    OtroCostoProducto.orden,
)
