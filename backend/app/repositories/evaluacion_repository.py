"""Writes and reads of the anonymous evaluations (HU11)."""

from datetime import date

from sqlalchemy import case, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Elaboracion, EvaluacionUtilidad, Producto


class NonceYaUsadoError(Exception):
    """The unique constraint on `nonce_hash` rejected the row: the token was already answered."""


class EvaluacionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def existe_nonce(self, nonce_hash: str) -> bool:
        return bool(self.db.scalar(select(exists().where(EvaluacionUtilidad.nonce_hash == nonce_hash))))

    def producto_es_del_productor(self, producto_id: int, productor_id: int) -> bool:
        """Active product of THIS productor. One query, no relationships loaded."""
        return bool(
            self.db.scalar(
                select(
                    exists().where(
                        Producto.id == producto_id,
                        Producto.productor_id == productor_id,
                        Producto.activo.is_(True),
                    )
                )
            )
        )

    def resultados_por_elaboracion(self, producto_id: int) -> list[tuple[str, date, int, int]]:
        """(code, date, answers, positive answers) of every elaboración of the product WITH answers,
        hidden ones included, in the default order (date desc, id desc). One grouped query."""
        stmt = (
            select(
                Elaboracion.codigo,
                Elaboracion.fecha_elaboracion,
                func.count(EvaluacionUtilidad.id),
                func.sum(case((EvaluacionUtilidad.util.is_(True), 1), else_=0)),
            )
            .join(Elaboracion, Elaboracion.id == EvaluacionUtilidad.elaboracion_id)
            .where(EvaluacionUtilidad.producto_id == producto_id)
            .group_by(Elaboracion.id, Elaboracion.codigo, Elaboracion.fecha_elaboracion)
            .order_by(Elaboracion.fecha_elaboracion.desc(), Elaboracion.id.desc())
        )
        return [(f[0], f[1], int(f[2]), int(f[3] or 0)) for f in self.db.execute(stmt)]

    def registrar(
        self, producto_id: int, elaboracion_id: int, util: bool, nonce_hash: str, fecha: date
    ) -> None:
        """Insert and commit. Two simultaneous answers with the same token: the second one hits the
        unique constraint, is rolled back and reported as already used."""
        self.db.add(
            EvaluacionUtilidad(
                producto_id=producto_id,
                elaboracion_id=elaboracion_id,
                util=util,
                nonce_hash=nonce_hash,
                fecha=fecha,
            )
        )
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            if self.existe_nonce(nonce_hash):
                raise NonceYaUsadoError() from None
            raise
