from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Alergeno, Ingrediente, InsumoAlergeno, InsumoComercial


class InsumoRepository:
    """Data access for commercial supplies.

    Unlike the HU02 repositories, writes do not commit by themselves: the habitual-supply
    rules touch several rows and must happen in a single transaction, so the service
    decides when to commit.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _with_relations():
        return (
            joinedload(InsumoComercial.ingrediente),
            selectinload(InsumoComercial.alergenos_declarados).joinedload(
                InsumoAlergeno.alergeno
            ),
        )

    def get_by_id_and_productor(
        self,
        insumo_id: int,
        productor_id: int,
    ) -> InsumoComercial | None:
        stmt = (
            select(InsumoComercial)
            .options(*self._with_relations())
            .where(
                InsumoComercial.id == insumo_id,
                InsumoComercial.productor_id == productor_id,
            )
        )
        return self.db.scalar(stmt)

    def list_by_productor(
        self,
        productor_id: int,
        *,
        activo: bool,
        ingrediente_id: int | None = None,
    ) -> list[InsumoComercial]:
        stmt = (
            select(InsumoComercial)
            .options(*self._with_relations())
            .where(
                InsumoComercial.productor_id == productor_id,
                InsumoComercial.activo.is_(activo),
            )
            .order_by(InsumoComercial.created_at.desc(), InsumoComercial.id.desc())
        )
        if ingrediente_id is not None:
            stmt = stmt.where(InsumoComercial.ingrediente_id == ingrediente_id)
        return list(self.db.scalars(stmt).all())

    def find_by_codigo_barras(
        self,
        productor_id: int,
        codigo_barras: str,
        *,
        exclude_id: int | None = None,
    ) -> InsumoComercial | None:
        """Supply of the productor holding the barcode, active or not."""
        stmt = select(InsumoComercial).where(
            InsumoComercial.productor_id == productor_id,
            InsumoComercial.codigo_barras == codigo_barras,
        )
        if exclude_id is not None:
            stmt = stmt.where(InsumoComercial.id != exclude_id)
        return self.db.scalar(stmt)

    def get_active_ingrediente(
        self,
        productor_id: int,
        ingrediente_id: int,
    ) -> Ingrediente | None:
        stmt = select(Ingrediente).where(
            Ingrediente.id == ingrediente_id,
            Ingrediente.productor_id == productor_id,
            Ingrediente.activo.is_(True),
        )
        return self.db.scalar(stmt)

    def lock_ingrediente(self, ingrediente_id: int) -> None:
        """Serialize concurrent habitual changes on the same ingredient (no-op on SQLite)."""
        self.db.execute(
            select(Ingrediente.id).where(Ingrediente.id == ingrediente_id).with_for_update()
        )

    def clear_habitual(self, ingrediente_id: int, *, except_id: int | None = None) -> None:
        """Unmark the current habitual supply of the ingredient, flushing before any new mark."""
        stmt = (
            update(InsumoComercial)
            .where(
                InsumoComercial.ingrediente_id == ingrediente_id,
                InsumoComercial.habitual.is_(True),
            )
            .values(habitual=False)
            .execution_options(synchronize_session="fetch")
        )
        if except_id is not None:
            stmt = stmt.where(InsumoComercial.id != except_id)
        self.db.execute(stmt)
        self.db.flush()

    def get_alergeno(self, alergeno_id: int) -> Alergeno | None:
        return self.db.get(Alergeno, alergeno_id)

    def get_declarado(self, insumo_id: int, alergeno_id: int) -> InsumoAlergeno | None:
        stmt = (
            select(InsumoAlergeno)
            .options(joinedload(InsumoAlergeno.alergeno))
            .where(
                InsumoAlergeno.insumo_id == insumo_id,
                InsumoAlergeno.alergeno_id == alergeno_id,
            )
        )
        return self.db.scalar(stmt)

    def touch(self, insumo: InsumoComercial) -> None:
        """Renew updated_at: declared allergens are part of the supply but live in another table."""
        insumo.updated_at = func.now()

    def add_declarado(self, insumo_id: int, alergeno_id: int, tipo: str) -> None:
        self.db.add(InsumoAlergeno(insumo_id=insumo_id, alergeno_id=alergeno_id, tipo=tipo))

    def delete_declarado(self, declarado: InsumoAlergeno) -> None:
        self.db.delete(declarado)

    def add(self, insumo: InsumoComercial) -> None:
        self.db.add(insumo)

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def reload(self, insumo_id: int, productor_id: int) -> InsumoComercial:
        """Fresh copy with relations loaded, after a commit."""
        self.db.expire_all()
        insumo = self.get_by_id_and_productor(insumo_id, productor_id)
        if insumo is None:
            raise RuntimeError("Insumo no encontrado tras guardar.")
        return insumo
