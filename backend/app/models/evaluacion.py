"""Anonymous usefulness answers of the public consultation (HU11 / T11-01).

ANONYMITY: this table is the whole record of an answer and it must stay this small. There is no
IP, user agent, session, productor, full token or anything else that could identify who answered
(CA6). `nonce_hash` is the SHA-256 of the random nonce inside the signed consultation token: it
only exists so that one consultation (one token) can be answered once.
"""

from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EvaluacionUtilidad(Base):
    __tablename__ = "evaluaciones_utilidad"
    __table_args__ = (
        UniqueConstraint("nonce_hash", name="uq_evaluaciones_utilidad_nonce_hash"),
        CheckConstraint("length(nonce_hash) = 64", name="ck_evaluaciones_utilidad_nonce_hash"),
        Index("ix_evaluaciones_utilidad_producto_elaboracion", "producto_id", "elaboracion_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", name="fk_evaluaciones_utilidad_producto", ondelete="RESTRICT"),
        nullable=False,
    )
    elaboracion_id: Mapped[int] = mapped_column(
        ForeignKey("elaboraciones.id", name="fk_evaluaciones_utilidad_elaboracion", ondelete="RESTRICT"),
        nullable=False,
    )
    util: Mapped[bool] = mapped_column(Boolean, nullable=False)
    nonce_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # Day only (Santiago), no time: less to correlate with other records.
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
