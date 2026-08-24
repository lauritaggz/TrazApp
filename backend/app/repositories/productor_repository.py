from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Productor


class ProductorRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, productor_id: int) -> Productor | None:
        return self.db.get(Productor, productor_id)

    def get_by_email(self, email: str) -> Productor | None:
        stmt = select(Productor).where(Productor.email == email)
        return self.db.scalar(stmt)

    def create(
        self,
        *,
        nombre: str,
        email: str,
        password_hash: str,
        activo: bool = True,
    ) -> Productor:
        productor = Productor(
            nombre=nombre,
            email=email,
            password_hash=password_hash,
            activo=activo,
        )
        self.db.add(productor)
        self.db.commit()
        self.db.refresh(productor)
        return productor
