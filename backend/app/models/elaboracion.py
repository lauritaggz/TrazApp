from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Lifecycle of an elaboración (HU05): editable while borrador, immutable once finalizada.
ESTADO_BORRADOR = "borrador"
ESTADO_FINALIZADA = "finalizada"
ESTADOS_ELABORACION = (ESTADO_BORRADOR, ESTADO_FINALIZADA)


class Elaboracion(Base):
    """One production of a product version (HU05).

    Created as a borrador from the current formulation; finalizing it freezes the
    information of every supply used (see UsoInsumo.informacion_conservada). The code is
    what the productor prints on the package, so it is unique per product ignoring case.
    """

    __tablename__ = "elaboraciones"
    __table_args__ = (
        # (version, product) must be a real pair: a version cannot be borrowed from
        # another product. Needs uq_version_producto_id_producto on versiones_producto.
        ForeignKeyConstraint(
            ["version_producto_id", "producto_id"],
            ["versiones_producto.id", "versiones_producto.producto_id"],
            name="fk_elaboraciones_version_producto",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "estado IN ('borrador', 'finalizada')",
            name="ck_elaboraciones_estado",
        ),
        CheckConstraint(
            "(estado = 'finalizada') = (finalizada_at IS NOT NULL)",
            name="ck_elaboraciones_finalizada_at",
        ),
        CheckConstraint(
            "length(trim(codigo)) > 0",
            name="ck_elaboraciones_codigo_no_vacio",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    productor_id: Mapped[int] = mapped_column(
        ForeignKey("productores.id", ondelete="RESTRICT"),
        nullable=False,
    )
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Same-productor ownership of the product is validated in the service (T05-02).
    version_producto_id: Mapped[int] = mapped_column(Integer, nullable=False)
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_elaboracion: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ESTADO_BORRADOR,
        server_default=ESTADO_BORRADOR,
    )
    finalizada_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    productor: Mapped["Productor"] = relationship()
    producto: Mapped["Producto"] = relationship(foreign_keys=[producto_id])
    version_producto: Mapped["VersionProducto"] = relationship(
        primaryjoin="VersionProducto.id == Elaboracion.version_producto_id",
        foreign_keys=[version_producto_id],
        viewonly=True,
    )
    usos: Mapped[list["UsoInsumo"]] = relationship(
        back_populates="elaboracion",
        cascade="all, delete-orphan",
    )


class LoteInsumo(Base):
    """A lot of a commercial supply, reusable across elaboraciones (HU05, CA07).

    Lots are only created, never edited: their code and expiry are also copied into the
    information conserved when an elaboración is finalized.
    """

    __tablename__ = "lotes_insumo"
    __table_args__ = (
        # Target of the composite foreign key of usos_insumo: a use can only point to a
        # lot of its own supply.
        UniqueConstraint("id", "insumo_id", name="uq_lotes_insumo_id_insumo"),
        CheckConstraint(
            "length(trim(codigo)) > 0",
            name="ck_lotes_insumo_codigo_no_vacio",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_comerciales.id", ondelete="RESTRICT"),
        nullable=False,
    )
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_vencimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    insumo: Mapped["InsumoComercial"] = relationship()


class UsoInsumo(Base):
    """The commercial supply (and lot) used for one ingredient of an elaboración (HU05).

    One row per ingredient of the formulation, created with the borrador; insumo_id stays
    NULL while the ingredient is pending. The use points directly to the supply and the
    lot is optional (sin_lote), so a supply without lot is still identifiable.
    informacion_conservada is written once, when the elaboración is finalized.
    """

    __tablename__ = "usos_insumo"
    __table_args__ = (
        UniqueConstraint(
            "elaboracion_id",
            "ingrediente_id",
            name="uq_usos_insumo_elaboracion_ingrediente",
        ),
        # With a NULL lote_id the composite key is not checked, so the lot of another
        # supply is rejected only when both columns are set.
        ForeignKeyConstraint(
            ["lote_id", "insumo_id"],
            ["lotes_insumo.id", "lotes_insumo.insumo_id"],
            name="fk_usos_insumo_lote_del_insumo",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "lote_id IS NULL OR insumo_id IS NOT NULL",
            name="ck_usos_insumo_lote_requiere_insumo",
        ),
        CheckConstraint(
            "NOT (sin_lote AND lote_id IS NOT NULL)",
            name="ck_usos_insumo_sin_lote_excluye_lote",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    elaboracion_id: Mapped[int] = mapped_column(
        ForeignKey("elaboraciones.id", ondelete="CASCADE"),
        nullable=False,
    )
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Ownership and association of the supply with the ingredient are validated in the
    # service (T05-03).
    insumo_id: Mapped[int | None] = mapped_column(
        ForeignKey("insumos_comerciales.id", ondelete="RESTRICT"),
        nullable=True,
    )
    lote_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sin_lote: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    # Immutable copy of the supply and lot as they were when finalizing. JSONB on PostgreSQL.
    informacion_conservada: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    elaboracion: Mapped["Elaboracion"] = relationship(back_populates="usos")
    ingrediente: Mapped["Ingrediente"] = relationship()
    insumo: Mapped["InsumoComercial | None"] = relationship(foreign_keys=[insumo_id])
    lote: Mapped["LoteInsumo | None"] = relationship(
        primaryjoin="LoteInsumo.id == UsoInsumo.lote_id",
        foreign_keys=[lote_id],
        viewonly=True,
    )


# Unique code per product and unique lot code per supply, both ignoring case.
Index(
    "uq_elaboraciones_producto_codigo",
    Elaboracion.producto_id,
    func.lower(Elaboracion.codigo),
    unique=True,
)
Index(
    "uq_lotes_insumo_insumo_codigo",
    LoteInsumo.insumo_id,
    func.lower(LoteInsumo.codigo),
    unique=True,
)

# Lookups: the productor's list by date, "where was this version / supply / lot used".
Index(
    "ix_elaboraciones_productor_fecha",
    Elaboracion.productor_id,
    Elaboracion.fecha_elaboracion.desc(),
)
Index("ix_elaboraciones_version_producto_id", Elaboracion.version_producto_id)
Index("ix_usos_insumo_insumo_id", UsoInsumo.insumo_id)
Index("ix_usos_insumo_lote_id", UsoInsumo.lote_id)
