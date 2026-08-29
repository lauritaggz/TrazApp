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


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        UniqueConstraint(
            "productor_id",
            "codigo_interno",
            name="uq_producto_productor_codigo_interno",
        ),
        CheckConstraint(
            "unidad_medida IS NULL OR unidad_medida IN ('g', 'kg', 'ml', 'L', 'unidad')",
            name="ck_producto_unidad_medida",
        ),
        CheckConstraint(
            "contenido_neto IS NULL OR contenido_neto > 0",
            name="ck_producto_contenido_neto_positivo",
        ),
        CheckConstraint(
            "costo_produccion IS NULL OR costo_produccion >= 0",
            name="ck_producto_costo_produccion_no_negativo",
        ),
        CheckConstraint(
            "precio_venta IS NULL OR precio_venta >= 0",
            name="ck_producto_precio_venta_no_negativo",
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
    contenido_neto: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    unidad_medida: Mapped[str | None] = mapped_column(String(20), nullable=True)
    presentacion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    costo_produccion: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )
    precio_venta: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )
    imagen_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
    )

    productor: Mapped["Productor | None"] = relationship(back_populates="productos")
    categorias: Mapped[list["Categoria"]] = relationship(
        secondary="productos_categorias",
        back_populates="productos",
    )
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
