from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    false,
    func,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

FUENTE_MANUAL = "manual"

# How an allergen is declared on the supply label (HU04, CA05).
TIPO_CONTIENE = "contiene"
TIPO_TRAZAS = "trazas"
TIPOS_DECLARACION = (TIPO_CONTIENE, TIPO_TRAZAS)


class InsumoComercial(Base):
    """Commercial product actually bought and used as supply for a generic ingredient.

    "Leche Colun sin lactosa" is not an ingredient: it is an insumo asociado al
    ingrediente "Leche" (HU04). Belongs exclusively to one productor.
    """

    __tablename__ = "insumos_comerciales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    productor_id: Mapped[int] = mapped_column(
        ForeignKey("productores.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Same-productor ownership of the ingredient is validated in the service (T04-03).
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    # Brand, manufacturer or origin, e.g. "Ambrosoli" or "Feria local".
    marca_origen: Mapped[str] = mapped_column(String(255), nullable=False)
    presentacion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    codigo_barras: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # What the productor sees, edits and later copies (HU05): own columns, not the JSONB.
    ingredientes_declarados: Mapped[str | None] = mapped_column(Text, nullable=True)
    advertencias: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Raw data returned by an external source (HU13/HU07). JSONB on PostgreSQL.
    ficha: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
    )
    fuente: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=FUENTE_MANUAL,
        server_default=FUENTE_MANUAL,
    )
    fecha_recuperacion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    habitual: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
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

    productor: Mapped["Productor"] = relationship(back_populates="insumos")
    ingrediente: Mapped["Ingrediente"] = relationship(back_populates="insumos")
    alergenos_declarados: Mapped[list["InsumoAlergeno"]] = relationship(
        back_populates="insumo",
        cascade="all, delete-orphan",
    )


class InsumoAlergeno(Base):
    """Allergen declared by a commercial supply, with its declaration type (HU04).

    Same pattern as ingredientes_alergenos (HU02): composite primary key, so an allergen
    appears once per supply (never as "contiene" and "trazas" at the same time); deleting
    the supply removes its rows (CASCADE) and a catalog allergen in use cannot be deleted
    (RESTRICT). Unlike HU02 this is a mapped class because it carries "tipo".
    """

    __tablename__ = "insumos_alergenos"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('contiene', 'trazas')",
            name="ck_insumos_alergenos_tipo",
        ),
    )

    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_comerciales.id", ondelete="CASCADE"),
        primary_key=True,
    )
    alergeno_id: Mapped[int] = mapped_column(
        ForeignKey("alergenos.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)

    insumo: Mapped["InsumoComercial"] = relationship(back_populates="alergenos_declarados")
    alergeno: Mapped["Alergeno"] = relationship(back_populates="insumos")


# Plain indexes on the foreign keys: every query filters by productor and the supplies
# of an ingredient are listed together.
Index("ix_insumos_comerciales_productor_id", InsumoComercial.productor_id)
Index("ix_insumos_comerciales_ingrediente_id", InsumoComercial.ingrediente_id)

# Partial unique indexes: the rule must hold in the database, not only in the service.
# Declared for both dialects because the test schema is built with create_all on SQLite.
Index(
    "uq_insumos_productor_codigo_barras",
    InsumoComercial.productor_id,
    InsumoComercial.codigo_barras,
    unique=True,
    postgresql_where=text("codigo_barras IS NOT NULL"),
    sqlite_where=text("codigo_barras IS NOT NULL"),
)
Index(
    "uq_insumos_habitual_por_ingrediente",
    InsumoComercial.ingrediente_id,
    unique=True,
    postgresql_where=text("habitual = true"),
    sqlite_where=text("habitual = 1"),
)
