from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.ingrediente import VersionIngrediente
from app.models.producto import VersionProducto


class LoteIngrediente(Base):
    __tablename__ = "lotes_ingrediente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo_lote: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    version_ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("versiones_ingrediente.id", ondelete="RESTRICT"),
        nullable=False,
    )
    fecha_recepcion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    version_ingrediente: Mapped[VersionIngrediente] = relationship(
        back_populates="lotes_ingrediente",
    )
    usos: Mapped[list["UsoLoteIngrediente"]] = relationship(
        back_populates="lote_ingrediente",
    )


class LoteProducto(Base):
    __tablename__ = "lotes_producto"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo_lote: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    version_producto_id: Mapped[int] = mapped_column(
        ForeignKey("versiones_producto.id", ondelete="RESTRICT"),
        nullable=False,
    )
    fecha_elaboracion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    version_producto: Mapped[VersionProducto] = relationship(
        back_populates="lotes_producto",
    )
    usos_ingredientes: Mapped[list["UsoLoteIngrediente"]] = relationship(
        back_populates="lote_producto",
        cascade="all, delete-orphan",
    )


class UsoLoteIngrediente(Base):
    __tablename__ = "usos_lote_ingrediente"
    __table_args__ = (
        UniqueConstraint(
            "lote_producto_id",
            "lote_ingrediente_id",
            name="uq_uso_lote_producto_ingrediente",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lote_producto_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"),
        nullable=False,
    )
    lote_ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_ingrediente.id", ondelete="RESTRICT"),
        nullable=False,
    )

    lote_producto: Mapped[LoteProducto] = relationship(back_populates="usos_ingredientes")
    lote_ingrediente: Mapped[LoteIngrediente] = relationship(back_populates="usos")
