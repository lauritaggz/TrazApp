from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import ComposicionIngrediente, Ingrediente


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class DuplicateComposicionComponenteError(Exception):
    """Raised when a component is already part of the composition."""


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

    def list_composicion(self, compuesto_id: int) -> list[ComposicionIngrediente]:
        stmt = (
            select(ComposicionIngrediente)
            .options(selectinload(ComposicionIngrediente.componente))
            .where(ComposicionIngrediente.ingrediente_compuesto_id == compuesto_id)
            .order_by(
                ComposicionIngrediente.orden.asc().nullslast(),
                ComposicionIngrediente.id.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_composicion_by_id_and_compuesto(
        self,
        composicion_id: int,
        compuesto_id: int,
    ) -> ComposicionIngrediente | None:
        stmt = (
            select(ComposicionIngrediente)
            .options(selectinload(ComposicionIngrediente.componente))
            .where(
                ComposicionIngrediente.id == composicion_id,
                ComposicionIngrediente.ingrediente_compuesto_id == compuesto_id,
            )
        )
        return self.db.scalar(stmt)

    def get_componente_ids_for_compuesto(self, compuesto_id: int) -> list[int]:
        stmt = select(ComposicionIngrediente.ingrediente_componente_id).where(
            ComposicionIngrediente.ingrediente_compuesto_id == compuesto_id
        )
        return list(self.db.scalars(stmt).all())

    def would_create_cycle(self, compuesto_id: int, componente_id: int) -> bool:
        """True if adding componente to compuesto would close a composition cycle."""
        if compuesto_id == componente_id:
            return True
        visited: set[int] = set()
        stack = [componente_id]
        while stack:
            current = stack.pop()
            if current == compuesto_id:
                return True
            if current in visited:
                continue
            visited.add(current)
            stack.extend(self.get_componente_ids_for_compuesto(current))
        return False

    def add_composicion(
        self,
        *,
        compuesto_id: int,
        componente_id: int,
        porcentaje: Decimal,
        orden: int | None,
    ) -> ComposicionIngrediente:
        composicion = ComposicionIngrediente(
            ingrediente_compuesto_id=compuesto_id,
            ingrediente_componente_id=componente_id,
            porcentaje=porcentaje,
            orden=orden,
        )
        self.db.add(composicion)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateComposicionComponenteError(
                "El componente ya forma parte de la composición."
            ) from exc
        self.db.refresh(composicion)
        loaded = self.get_composicion_by_id_and_compuesto(composicion.id, compuesto_id)
        if loaded is None:
            raise RuntimeError("Composición no encontrada tras persistir.")
        return loaded

    def update_composicion(
        self,
        composicion: ComposicionIngrediente,
        **fields: object,
    ) -> ComposicionIngrediente:
        for key, value in fields.items():
            setattr(composicion, key, value)
        self.db.add(composicion)
        self.db.commit()
        self.db.refresh(composicion)
        loaded = self.get_composicion_by_id_and_compuesto(
            composicion.id,
            composicion.ingrediente_compuesto_id,
        )
        if loaded is None:
            raise RuntimeError("Composición no encontrada tras actualizar.")
        return loaded

    def delete_composicion(self, composicion: ComposicionIngrediente) -> None:
        self.db.delete(composicion)
        self.db.commit()

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
