from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

TipoIngrediente = str  # 'simple' | 'compuesto'


class Ingrediente(Base):
    __tablename__ = "ingredientes"
    __table_args__ = (
        UniqueConstraint(
            "productor_id",
            "codigo_interno",
            name="uq_ingrediente_productor_codigo_interno",
        ),
        CheckConstraint(
            "tipo IS NULL OR tipo IN ('simple', 'compuesto')",
            name="ck_ingrediente_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    productor_id: Mapped[int | None] = mapped_column(
        ForeignKey("productores.id", ondelete="RESTRICT"),
        nullable=True,
    )
    codigo_interno: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    tipo: Mapped[str | None] = mapped_column(String(20), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
    )

    productor: Mapped["Productor | None"] = relationship(back_populates="ingredientes")
    versiones: Mapped[list["VersionIngrediente"]] = relationship(
        back_populates="ingrediente",
        cascade="all, delete-orphan",
    )
    alergenos: Mapped[list["Alergeno"]] = relationship(
        secondary="ingredientes_alergenos",
        back_populates="ingredientes",
    )
    componentes: Mapped[list["ComposicionIngrediente"]] = relationship(
        back_populates="compuesto",
        foreign_keys="ComposicionIngrediente.ingrediente_compuesto_id",
        cascade="all, delete-orphan",
    )
    usado_en_compuestos: Mapped[list["ComposicionIngrediente"]] = relationship(
        back_populates="componente",
        foreign_keys="ComposicionIngrediente.ingrediente_componente_id",
    )
    formulaciones_producto: Mapped[list["FormulacionVersionProducto"]] = relationship(
        back_populates="ingrediente",
    )


class ComposicionIngrediente(Base):
    """Structured composition of a compound ingredient (HU02)."""

    __tablename__ = "ingredientes_composicion"
    __table_args__ = (
        UniqueConstraint(
            "ingrediente_compuesto_id",
            "ingrediente_componente_id",
            name="uq_ingrediente_composicion_par",
        ),
        CheckConstraint(
            "ingrediente_compuesto_id <> ingrediente_componente_id",
            name="ck_ingrediente_composicion_sin_autoreferencia",
        ),
        CheckConstraint(
            "porcentaje > 0 AND porcentaje <= 100",
            name="ck_ingrediente_composicion_porcentaje",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ingrediente_compuesto_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="CASCADE"),
        nullable=False,
    )
    ingrediente_componente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    porcentaje: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False)
    orden: Mapped[int | None] = mapped_column(Integer, nullable=True)

    compuesto: Mapped["Ingrediente"] = relationship(
        back_populates="componentes",
        foreign_keys=[ingrediente_compuesto_id],
    )
    componente: Mapped["Ingrediente"] = relationship(
        back_populates="usado_en_compuestos",
        foreign_keys=[ingrediente_componente_id],
    )


class VersionIngrediente(Base):
    __tablename__ = "versiones_ingrediente"
    __table_args__ = (
        UniqueConstraint("ingrediente_id", "numero_version", name="uq_version_ingrediente_numero"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    numero_version: Mapped[int] = mapped_column(Integer, nullable=False)
    composicion_declarada: Mapped[str] = mapped_column(Text, nullable=False)
    alergenos_declarados: Mapped[str] = mapped_column(Text, nullable=False, default="")
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    vigente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    ingrediente: Mapped["Ingrediente"] = relationship(back_populates="versiones")
    lotes_ingrediente: Mapped[list["LoteIngrediente"]] = relationship(
        back_populates="version_ingrediente",
    )
