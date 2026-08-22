from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Ingrediente(Base):
    __tablename__ = "ingredientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    versiones: Mapped[list["VersionIngrediente"]] = relationship(
        back_populates="ingrediente",
        cascade="all, delete-orphan",
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
