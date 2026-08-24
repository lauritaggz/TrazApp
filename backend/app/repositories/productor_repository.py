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
        nombre_negocio: str,
        email: str,
        password_hash: str,
        activo: bool = True,
    ) -> Productor:
        productor = Productor(
            nombre=nombre,
            nombre_negocio=nombre_negocio,
            email=email,
            password_hash=password_hash,
            activo=activo,
        )
        self.db.add(productor)
        self.db.commit()
        self.db.refresh(productor)
        return productor

    def update_profile(
        self,
        productor: Productor,
        *,
        nombre: str,
        nombre_negocio: str,
    ) -> Productor:
        productor.nombre = nombre
        productor.nombre_negocio = nombre_negocio
        self.db.add(productor)
        self.db.commit()
        self.db.refresh(productor)
        return productor
