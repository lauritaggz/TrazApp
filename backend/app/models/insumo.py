from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
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
