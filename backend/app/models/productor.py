from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Productor(Base):
    """Productor account entity prepared for future authentication."""

    __tablename__ = "productores"
    __table_args__ = (
        UniqueConstraint("email", name="uq_productores_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre_negocio: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    productos: Mapped[list["Producto"]] = relationship(
        back_populates="productor",
    )
    ingredientes: Mapped[list["Ingrediente"]] = relationship(
        back_populates="productor",
    )
