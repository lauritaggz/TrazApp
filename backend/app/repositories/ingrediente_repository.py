from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Alergeno,
    ComposicionIngrediente,
    FormulacionVersionProducto,
    Ingrediente,
    InsumoComercial,
    Producto,
    VersionProducto,
)
from app.models.alergeno import ingredientes_alergenos


class DuplicateCodigoInternoError(Exception):
    """Raised when codigo_interno collides within the same productor."""


class DuplicateComposicionComponenteError(Exception):
    """Raised when a component is already part of the composition."""


class DuplicateIngredienteAlergenoError(Exception):
    """Raised when an allergen is already associated with the ingredient."""


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
        tipo: str | None = None,
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

    def list_productos_con_formulacion_vigente(
        self,
        ingrediente_id: int,
        productor_id: int,
    ) -> list[Any]:
        """Products of the productor whose CURRENT version lists the ingredient (HT08, CA1).

        One read-only query. Older, no longer current versions do not count; archived products
        (activo = false) are left out because their detail answers 404; unpublished ones stay.
        Rows carry `id`, `nombre` and `numero_version`; no quantities are read.
        """
        stmt = (
            select(Producto.id, Producto.nombre, VersionProducto.numero_version)
            .join(VersionProducto, VersionProducto.producto_id == Producto.id)
            .join(
                FormulacionVersionProducto,
                FormulacionVersionProducto.version_producto_id == VersionProducto.id,
            )
            .where(
                FormulacionVersionProducto.ingrediente_id == ingrediente_id,
                VersionProducto.vigente.is_(True),
                Producto.productor_id == productor_id,
                Producto.activo.is_(True),
            )
            .order_by(func.lower(Producto.nombre).asc(), Producto.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def list_insumos_asociados(
        self,
        ingrediente_id: int,
        productor_id: int,
    ) -> list[Any]:
        """Commercial supplies of the ingredient, active and inactive (HT08, CA2).

        One read-only query. It also filters by the supply's own productor, not only by the
        association with the ingredient. Active ones first, then by name.
        """
        stmt = (
            select(
                InsumoComercial.id,
                InsumoComercial.nombre,
                InsumoComercial.marca_origen,
                InsumoComercial.activo,
            )
            .where(
                InsumoComercial.ingrediente_id == ingrediente_id,
                InsumoComercial.productor_id == productor_id,
            )
            .order_by(
                InsumoComercial.activo.desc(),
                func.lower(InsumoComercial.nombre).asc(),
                InsumoComercial.id.asc(),
            )
        )
        return list(self.db.execute(stmt).all())

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

    def get_alergeno_by_id(self, alergeno_id: int) -> Alergeno | None:
        return self.db.get(Alergeno, alergeno_id)

    def list_alergenos_catalogo(self) -> list[Alergeno]:
        stmt = select(Alergeno).order_by(
            Alergeno.obligatorio_chile.desc(),
            Alergeno.nombre.asc(),
        )
        return list(self.db.scalars(stmt).all())

    def list_alergenos_for_ingrediente(self, ingrediente_id: int) -> list[Alergeno]:
        stmt = (
            select(Alergeno)
            .join(
                ingredientes_alergenos,
                ingredientes_alergenos.c.alergeno_id == Alergeno.id,
            )
            .where(ingredientes_alergenos.c.ingrediente_id == ingrediente_id)
            .order_by(Alergeno.codigo.asc())
        )
        return list(self.db.scalars(stmt).all())

    def has_alergeno_association(self, ingrediente_id: int, alergeno_id: int) -> bool:
        stmt = select(ingredientes_alergenos.c.ingrediente_id).where(
            ingredientes_alergenos.c.ingrediente_id == ingrediente_id,
            ingredientes_alergenos.c.alergeno_id == alergeno_id,
        )
        return self.db.scalar(stmt) is not None

    def add_alergeno_association(
        self,
        ingrediente: Ingrediente,
        alergeno: Alergeno,
    ) -> None:
        if self.has_alergeno_association(ingrediente.id, alergeno.id):
            raise DuplicateIngredienteAlergenoError(
                "El alérgeno ya está asociado al ingrediente."
            )
        ingrediente.alergenos.append(alergeno)
        self.db.add(ingrediente)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateIngredienteAlergenoError(
                "El alérgeno ya está asociado al ingrediente."
            ) from exc

    def remove_alergeno_association(
        self,
        ingrediente: Ingrediente,
        alergeno: Alergeno,
    ) -> None:
        if not self.has_alergeno_association(ingrediente.id, alergeno.id):
            return
        ingrediente.alergenos.remove(alergeno)
        self.db.add(ingrediente)
        self.db.commit()
