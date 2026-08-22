from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    versiones: Mapped[list["VersionProducto"]] = relationship(
        back_populates="producto",
        cascade="all, delete-orphan",
    )


class VersionProducto(Base):
    __tablename__ = "versiones_producto"
    __table_args__ = (
        UniqueConstraint("producto_id", "numero_version", name="uq_version_producto_numero"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    numero_version: Mapped[int] = mapped_column(Integer, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    vigente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    producto: Mapped["Producto"] = relationship(back_populates="versiones")
    lotes_producto: Mapped[list["LoteProducto"]] = relationship(
        back_populates="version_producto",
    )
