from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

ingredientes_alergenos = Table(
    "ingredientes_alergenos",
    Base.metadata,
    Column(
        "ingrediente_id",
        ForeignKey("ingredientes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "alergeno_id",
        ForeignKey("alergenos.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class Alergeno(Base):
    """Global allergen catalog for HU02 ingredient management."""

    __tablename__ = "alergenos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    ingredientes: Mapped[list["Ingrediente"]] = relationship(
        secondary=ingredientes_alergenos,
        back_populates="alergenos",
    )
