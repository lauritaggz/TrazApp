from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Ingrediente,
    LoteIngrediente,
    LoteProducto,
    Producto,
    UsoLoteIngrediente,
    VersionIngrediente,
    VersionProducto,
)


class TrazabilidadRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_producto(self, nombre: str) -> Producto:
        producto = Producto(nombre=nombre, activo=True)
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)
        return producto

    def get_producto(self, producto_id: int) -> Producto | None:
        return self.db.get(Producto, producto_id)

    def list_versiones_producto(self, producto_id: int) -> list[VersionProducto]:
        stmt = (
            select(VersionProducto)
            .where(VersionProducto.producto_id == producto_id)
            .order_by(VersionProducto.numero_version)
        )
        return list(self.db.scalars(stmt).all())

    def get_next_numero_version_producto(self, producto_id: int) -> int:
        stmt = select(func.max(VersionProducto.numero_version)).where(
            VersionProducto.producto_id == producto_id
        )
        current = self.db.scalar(stmt)
        return (current or 0) + 1

    def create_version_producto(
        self,
        producto_id: int,
        descripcion: str,
        vigente: bool,
    ) -> VersionProducto:
        version = VersionProducto(
            producto_id=producto_id,
            numero_version=self.get_next_numero_version_producto(producto_id),
            descripcion=descripcion,
            vigente=vigente,
        )
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version

    def create_ingrediente(self, nombre: str) -> Ingrediente:
        ingrediente = Ingrediente(nombre=nombre, activo=True)
        self.db.add(ingrediente)
        self.db.commit()
        self.db.refresh(ingrediente)
        return ingrediente

    def get_ingrediente(self, ingrediente_id: int) -> Ingrediente | None:
        return self.db.get(Ingrediente, ingrediente_id)

    def list_versiones_ingrediente(self, ingrediente_id: int) -> list[VersionIngrediente]:
        stmt = (
            select(VersionIngrediente)
            .where(VersionIngrediente.ingrediente_id == ingrediente_id)
            .order_by(VersionIngrediente.numero_version)
        )
        return list(self.db.scalars(stmt).all())

    def get_next_numero_version_ingrediente(self, ingrediente_id: int) -> int:
        stmt = select(func.max(VersionIngrediente.numero_version)).where(
            VersionIngrediente.ingrediente_id == ingrediente_id
        )
        current = self.db.scalar(stmt)
        return (current or 0) + 1

    def create_version_ingrediente(
        self,
        ingrediente_id: int,
        composicion_declarada: str,
        alergenos_declarados: str,
        vigente: bool,
    ) -> VersionIngrediente:
        version = VersionIngrediente(
            ingrediente_id=ingrediente_id,
            numero_version=self.get_next_numero_version_ingrediente(ingrediente_id),
            composicion_declarada=composicion_declarada,
            alergenos_declarados=alergenos_declarados,
            vigente=vigente,
        )
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version

    def get_version_producto(self, version_id: int) -> VersionProducto | None:
        return self.db.get(VersionProducto, version_id)

    def get_version_ingrediente(self, version_id: int) -> VersionIngrediente | None:
        return self.db.get(VersionIngrediente, version_id)

    def create_lote_ingrediente(
        self,
        codigo_lote: str,
        version_ingrediente_id: int,
    ) -> LoteIngrediente:
        lote = LoteIngrediente(
            codigo_lote=codigo_lote,
            version_ingrediente_id=version_ingrediente_id,
        )
        self.db.add(lote)
        self.db.commit()
        self.db.refresh(lote)
        return lote

    def get_lote_ingrediente_by_codigo(self, codigo_lote: str) -> LoteIngrediente | None:
        stmt = select(LoteIngrediente).where(LoteIngrediente.codigo_lote == codigo_lote)
        return self.db.scalar(stmt)

    def create_lote_producto(
        self,
        codigo_lote: str,
        version_producto_id: int,
        codigos_lotes_ingredientes: list[str],
    ) -> LoteProducto:
        lote = LoteProducto(
            codigo_lote=codigo_lote,
            version_producto_id=version_producto_id,
        )
        self.db.add(lote)
        self.db.flush()

        for codigo in codigos_lotes_ingredientes:
            lote_ingrediente = self.get_lote_ingrediente_by_codigo(codigo)
            if lote_ingrediente is None:
                raise ValueError(f"Lote de ingrediente no encontrado: {codigo}")
            uso = UsoLoteIngrediente(
                lote_producto_id=lote.id,
                lote_ingrediente_id=lote_ingrediente.id,
            )
            self.db.add(uso)

        self.db.commit()
        self.db.refresh(lote)
        return lote

    def get_lote_producto_by_codigo(self, codigo_lote: str) -> LoteProducto | None:
        stmt = (
            select(LoteProducto)
            .options(
                joinedload(LoteProducto.version_producto).joinedload(VersionProducto.producto),
                joinedload(LoteProducto.usos_ingredientes)
                .joinedload(UsoLoteIngrediente.lote_ingrediente)
                .joinedload(LoteIngrediente.version_ingrediente)
                .joinedload(VersionIngrediente.ingrediente),
            )
            .where(LoteProducto.codigo_lote == codigo_lote)
        )
        return self.db.scalar(stmt)
