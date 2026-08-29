from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

productos_categorias = Table(
    "productos_categorias",
    Base.metadata,
    Column(
        "producto_id",
        ForeignKey("productos.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "categoria_id",
        ForeignKey("categorias.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    productos: Mapped[list["Producto"]] = relationship(
        secondary=productos_categorias,
        back_populates="categorias",
    )
