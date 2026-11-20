"""Writes and reads of the anonymous evaluations (HU11)."""

from datetime import date

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import EvaluacionUtilidad


class NonceYaUsadoError(Exception):
    """The unique constraint on `nonce_hash` rejected the row: the token was already answered."""


class EvaluacionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def existe_nonce(self, nonce_hash: str) -> bool:
        return bool(self.db.scalar(select(exists().where(EvaluacionUtilidad.nonce_hash == nonce_hash))))

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
