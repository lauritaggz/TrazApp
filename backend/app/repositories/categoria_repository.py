from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Categoria


class CategoriaRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Categoria]:
        stmt = select(Categoria).order_by(Categoria.nombre.asc())
        return list(self.db.scalars(stmt).all())
