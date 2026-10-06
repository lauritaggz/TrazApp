from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Elaboracion,
    FormulacionVersionProducto,
    InsumoAlergeno,
    InsumoComercial,
    LoteInsumo,
    Producto,
    UsoInsumo,
)
from app.models.elaboracion import ESTADO_FINALIZADA


class ElaboracionRepository:
    """Data access for elaboraciones.

    Writes do not commit by themselves: creating a borrador touches the elaboración, its
    uses and the version flag, and must be one transaction, so the service commits.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _with_relations():
        return (
            joinedload(Elaboracion.producto),
            joinedload(Elaboracion.version_producto),
            selectinload(Elaboracion.usos),
        )

    def cargar_asignacion_vigente(self, elaboracion_id: int) -> None:
        """Load the live supplies, allergens and lots of a borrador's uses (not for a finalizada)."""
        stmt = (
            select(UsoInsumo)
            .options(
                joinedload(UsoInsumo.insumo)
                .selectinload(InsumoComercial.alergenos_declarados)
                .joinedload(InsumoAlergeno.alergeno),
                joinedload(UsoInsumo.lote),
            )
            .where(UsoInsumo.elaboracion_id == elaboracion_id)
        )
        self.db.scalars(stmt).unique().all()

    def get_producto_activo(self, producto_id: int, productor_id: int) -> Producto | None:
        stmt = select(Producto).where(
            Producto.id == producto_id,
            Producto.productor_id == productor_id,
            Producto.activo.is_(True),
        )
        return self.db.scalar(stmt)

    def lock_producto(self, producto_id: int, productor_id: int) -> Producto | None:
        """Lock the product row (no-op on SQLite).

        Creations of the same product are serialized, and so are they with the formulation
        edits, which lock the same row: a version cannot change between reading it and
        flagging it as used.
        """
        stmt = (
            select(Producto)
            .where(
                Producto.id == producto_id,
                Producto.productor_id == productor_id,
                Producto.activo.is_(True),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def list_lineas_formulacion(self, version_id: int) -> list[FormulacionVersionProducto]:
        stmt = (
            select(FormulacionVersionProducto)
            .options(joinedload(FormulacionVersionProducto.ingrediente))
            .where(FormulacionVersionProducto.version_producto_id == version_id)
            .order_by(
                FormulacionVersionProducto.orden.asc().nulls_last(),
                FormulacionVersionProducto.id.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def list_codigos(self, producto_id: int) -> list[str]:
        return list(
            self.db.scalars(select(Elaboracion.codigo).where(Elaboracion.producto_id == producto_id))
        )

    def find_by_codigo(self, producto_id: int, codigo: str) -> Elaboracion | None:
        """Elaboración of the product with that code, ignoring case."""
        stmt = select(Elaboracion).where(
            Elaboracion.producto_id == producto_id,
            func.lower(Elaboracion.codigo) == codigo.lower(),
        )
        return self.db.scalar(stmt)

    def habituales_activos(
        self,
        productor_id: int,
        ingrediente_ids: list[int],
    ) -> dict[int, int]:
        """Active habitual supply of each ingredient (ingrediente_id -> insumo_id)."""
        stmt = select(InsumoComercial.ingrediente_id, InsumoComercial.id).where(
            InsumoComercial.productor_id == productor_id,
            InsumoComercial.ingrediente_id.in_(ingrediente_ids),
            InsumoComercial.habitual.is_(True),
            InsumoComercial.activo.is_(True),
        )
        return {ingrediente_id: insumo_id for ingrediente_id, insumo_id in self.db.execute(stmt)}

    def get_by_id_and_productor(
        self,
        elaboracion_id: int,
        productor_id: int,
    ) -> Elaboracion | None:
        stmt = (
            select(Elaboracion)
            .options(*self._with_relations())
            .where(
                Elaboracion.id == elaboracion_id,
                Elaboracion.productor_id == productor_id,
            )
        )
        return self.db.scalar(stmt)

    def list_resumenes(
        self,
        productor_id: int,
        *,
        producto_id: int | None = None,
        estado: str | None = None,
    ) -> list[tuple[Elaboracion, int, int]]:
        """Elaboraciones of the productor with their ingredient and pending counts."""
        pendiente = or_(
            UsoInsumo.insumo_id.is_(None),
            and_(UsoInsumo.lote_id.is_(None), UsoInsumo.sin_lote.is_(False)),
        )
        conteos = (
            select(
                UsoInsumo.elaboracion_id.label("elaboracion_id"),
                func.count(UsoInsumo.id).label("total"),
                func.sum(case((pendiente, 1), else_=0)).label("pendientes"),
            )
            .group_by(UsoInsumo.elaboracion_id)
            .subquery()
        )
        stmt = (
            select(
                Elaboracion,
                func.coalesce(conteos.c.total, 0),
                func.coalesce(conteos.c.pendientes, 0),
            )
            .options(joinedload(Elaboracion.producto), joinedload(Elaboracion.version_producto))
            .outerjoin(conteos, conteos.c.elaboracion_id == Elaboracion.id)
            .where(Elaboracion.productor_id == productor_id)
            .order_by(Elaboracion.fecha_elaboracion.desc(), Elaboracion.id.desc())
        )
        if producto_id is not None:
            stmt = stmt.where(Elaboracion.producto_id == producto_id)
        if estado is not None:
            stmt = stmt.where(Elaboracion.estado == estado)
        return [(fila[0], int(fila[1]), int(fila[2])) for fila in self.db.execute(stmt).unique()]

    def lineas_por_ingrediente(self, version_id: int) -> dict[int, FormulacionVersionProducto]:
        return {linea.ingrediente_id: linea for linea in self.list_lineas_formulacion(version_id)}

    def lock_elaboracion(self, elaboracion_id: int, productor_id: int) -> Elaboracion | None:
        """Lock the elaboración row (no-op on SQLite) so two changes to it are serialized.

        Plain select on purpose: FOR UPDATE cannot be combined with the outer joins of the
        eager loading used by the reads.
        """
        stmt = (
            select(Elaboracion)
            .where(
                Elaboracion.id == elaboracion_id,
                Elaboracion.productor_id == productor_id,
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def usos_por_ingrediente(self, elaboracion_id: int) -> dict[int, UsoInsumo]:
        stmt = select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id)
        return {uso.ingrediente_id: uso for uso in self.db.scalars(stmt)}

    def get_insumo_propio(self, insumo_id: int, productor_id: int) -> InsumoComercial | None:
        """Supply of the productor, active or not (the service decides what is usable)."""
        stmt = select(InsumoComercial).where(
            InsumoComercial.id == insumo_id,
            InsumoComercial.productor_id == productor_id,
        )
        return self.db.scalar(stmt)

    def lock_insumos_compartido(
        self,
        productor_id: int,
        insumo_ids: list[int],
    ) -> dict[int, InsumoComercial]:
        """Supplies of the productor with their allergens, locked FOR SHARE (no-op on SQLite).

        Nobody can change them until the transaction ends: the copy taken while finalizing is
        the state they have when the elaboración is finalized. Allergen changes renew the
        supply row (`touch`), so they wait too.
        """
        if not insumo_ids:
            return {}
        stmt = (
            select(InsumoComercial)
            .options(
                selectinload(InsumoComercial.alergenos_declarados).joinedload(InsumoAlergeno.alergeno)
            )
            .where(
                InsumoComercial.id.in_(insumo_ids),
                InsumoComercial.productor_id == productor_id,
            )
            .order_by(InsumoComercial.id)
            .with_for_update(read=True)
        )
        return {insumo.id: insumo for insumo in self.db.scalars(stmt)}

    def lotes_por_id(self, lote_ids: list[int]) -> dict[int, LoteInsumo]:
        if not lote_ids:
            return {}
        stmt = select(LoteInsumo).where(LoteInsumo.id.in_(lote_ids))
        return {lote.id: lote for lote in self.db.scalars(stmt)}

    def marcar_finalizada(self, elaboracion: Elaboracion, finalizada_at) -> None:
        elaboracion.estado = ESTADO_FINALIZADA
        elaboracion.finalizada_at = finalizada_at
        self.db.flush()

    def get_lote(self, lote_id: int) -> LoteInsumo | None:
        return self.db.get(LoteInsumo, lote_id)

    def find_lote_by_codigo(self, insumo_id: int, codigo: str) -> LoteInsumo | None:
        """Lot of the supply with that code, ignoring case."""
        stmt = select(LoteInsumo).where(
            LoteInsumo.insumo_id == insumo_id,
            func.lower(LoteInsumo.codigo) == codigo.lower(),
        )
        return self.db.scalar(stmt)

    def list_lotes(self, insumo_id: int) -> list[LoteInsumo]:
        stmt = (
            select(LoteInsumo)
            .where(LoteInsumo.insumo_id == insumo_id)
            .order_by(LoteInsumo.created_at.desc(), LoteInsumo.id.desc())
        )
        return list(self.db.scalars(stmt).all())

    def add_lote(self, lote: LoteInsumo) -> None:
        self.db.add(lote)

    def add(self, elaboracion: Elaboracion) -> None:
        self.db.add(elaboracion)

    def add_uso(self, uso: UsoInsumo) -> None:
        self.db.add(uso)

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def reload(self, elaboracion_id: int, productor_id: int) -> Elaboracion:
        """Fresh read of the elaboración after the transaction ended."""
        self.db.expire_all()
        elaboracion = self.get_by_id_and_productor(elaboracion_id, productor_id)
        assert elaboracion is not None
        return elaboracion
