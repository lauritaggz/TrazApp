from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ComposicionIngrediente, Ingrediente


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class IngredienteRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        productor_id: int,
        codigo_interno: str,
        nombre: str,
        descripcion: str | None,
        tipo: str,
    ) -> Ingrediente:
        ingrediente = Ingrediente(
            productor_id=productor_id,
            codigo_interno=codigo_interno,
            nombre=nombre,
            descripcion=descripcion,
            tipo=tipo,
            activo=True,
        )
        self.db.add(ingrediente)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateCodigoInternoError(
                "Ya existe un ingrediente con ese código interno."
            ) from exc
        self.db.refresh(ingrediente)
        return ingrediente

    def has_componentes(self, ingrediente_id: int) -> bool:
        count = self.db.scalar(
            select(func.count())
            .select_from(ComposicionIngrediente)
            .where(ComposicionIngrediente.ingrediente_compuesto_id == ingrediente_id)
        )
        return bool(count)

    def list_by_productor(self, productor_id: int) -> list[Ingrediente]:
        stmt = (
            select(Ingrediente)
            .where(
                Ingrediente.productor_id == productor_id,
                Ingrediente.activo.is_(True),
            )
            .order_by(Ingrediente.created_at.desc().nullslast(), Ingrediente.id.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id_and_productor(
        self,
        ingrediente_id: int,
        productor_id: int,
        *,
        active_only: bool = True,
    ) -> Ingrediente | None:
        stmt = select(Ingrediente).where(
            Ingrediente.id == ingrediente_id,
            Ingrediente.productor_id == productor_id,
        )
        if active_only:
            stmt = stmt.where(Ingrediente.activo.is_(True))
        return self.db.scalar(stmt)

    def update(self, ingrediente: Ingrediente, **fields: object) -> Ingrediente:
        for key, value in fields.items():
            setattr(ingrediente, key, value)
        self.db.add(ingrediente)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateCodigoInternoError(
                "Ya existe un ingrediente con ese código interno."
            ) from exc
        self.db.refresh(ingrediente)
        return ingrediente

    def deactivate(self, ingrediente: Ingrediente) -> Ingrediente:
        ingrediente.activo = False
        self.db.add(ingrediente)
        self.db.commit()
        self.db.refresh(ingrediente)
        return ingrediente
