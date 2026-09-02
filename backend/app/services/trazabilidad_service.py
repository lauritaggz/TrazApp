from app.models import Ingrediente, Producto
from app.repositories.trazabilidad_repository import TrazabilidadRepository
from app.schemas.lote import (
    LoteIngredienteCreate,
    LoteIngredienteRead,
    LoteProductoCreate,
    LoteProductoRead,
    TrazabilidadIngredienteRead,
    TrazabilidadProductoRead,
    TrazabilidadRead,
)
from app.schemas.ingrediente import (
    IngredienteCreate,
    IngredienteRead,
    VersionIngredienteCreate,
    VersionIngredienteRead,
)
from app.schemas.producto import (
    ProductoCreate,
    ProductoRead,
    VersionProductoCreate,
    VersionProductoRead,
)


class TrazabilidadService:
    def __init__(self, repository: TrazabilidadRepository) -> None:
        self.repository = repository

    def crear_producto(self, payload: ProductoCreate) -> ProductoRead:
        producto = self.repository.create_producto(payload.nombre)
        return ProductoRead.model_validate(producto)

    def crear_version_producto(
        self,
        producto_id: int,
        payload: VersionProductoCreate,
    ) -> VersionProductoRead:
        self._require_legacy_producto(producto_id)
        version = self.repository.create_version_producto(
            producto_id=producto_id,
            descripcion=payload.descripcion,
            vigente=payload.vigente,
        )
        return VersionProductoRead.model_validate(version)

    def listar_versiones_producto(self, producto_id: int) -> list[VersionProductoRead]:
        self._require_legacy_producto(producto_id)
        versiones = self.repository.list_versiones_producto(producto_id)
        return [VersionProductoRead.model_validate(v) for v in versiones]

    def crear_ingrediente(self, payload: IngredienteCreate) -> IngredienteRead:
        ingrediente = self.repository.create_ingrediente(payload.nombre)
        return IngredienteRead.model_validate(ingrediente)

    def crear_version_ingrediente(
        self,
        ingrediente_id: int,
        payload: VersionIngredienteCreate,
    ) -> VersionIngredienteRead:
        self._require_legacy_ingrediente(ingrediente_id)
        version = self.repository.create_version_ingrediente(
            ingrediente_id=ingrediente_id,
            composicion_declarada=payload.composicion_declarada,
            alergenos_declarados=payload.alergenos_declarados,
            vigente=payload.vigente,
        )
        return VersionIngredienteRead.model_validate(version)

    def listar_versiones_ingrediente(self, ingrediente_id: int) -> list[VersionIngredienteRead]:
        self._require_legacy_ingrediente(ingrediente_id)
        versiones = self.repository.list_versiones_ingrediente(ingrediente_id)
        return [VersionIngredienteRead.model_validate(v) for v in versiones]

    def crear_lote_ingrediente(self, payload: LoteIngredienteCreate) -> LoteIngredienteRead:
        version = self.repository.get_version_ingrediente(payload.version_ingrediente_id)
        if version is None:
            raise LookupError("Versión de ingrediente no encontrada")
        self._require_legacy_ingrediente(version.ingrediente_id)
        lote = self.repository.create_lote_ingrediente(
            codigo_lote=payload.codigo_lote,
            version_ingrediente_id=payload.version_ingrediente_id,
        )
        return LoteIngredienteRead.model_validate(lote)

    def crear_lote_producto(self, payload: LoteProductoCreate) -> LoteProductoRead:
        version = self.repository.get_version_producto(payload.version_producto_id)
        if version is None:
            raise LookupError("Versión de producto no encontrada")
        self._require_legacy_producto(version.producto_id)
        try:
            lote = self.repository.create_lote_producto(
                codigo_lote=payload.codigo_lote,
                version_producto_id=payload.version_producto_id,
                codigos_lotes_ingredientes=payload.lotes_ingredientes,
            )
        except ValueError as exc:
            raise LookupError(str(exc)) from exc
        return LoteProductoRead.model_validate(lote)

    def obtener_trazabilidad_historica(self, codigo_lote: str) -> TrazabilidadRead:
        lote_producto = self.repository.get_lote_producto_by_codigo(codigo_lote)
        if lote_producto is None:
            raise LookupError("Lote de producto no encontrado")

        version_producto = lote_producto.version_producto
        producto = version_producto.producto
        if producto.productor_id is not None:
            # Owned HU01 products are outside the unauthenticated RT-01 surface.
            raise LookupError("Lote de producto no encontrado")

        ingredientes_utilizados: list[TrazabilidadIngredienteRead] = []
        for uso in lote_producto.usos_ingredientes:
            lote_ingrediente = uso.lote_ingrediente
            version_ingrediente = lote_ingrediente.version_ingrediente
            ingrediente = version_ingrediente.ingrediente
            ingredientes_utilizados.append(
                TrazabilidadIngredienteRead(
                    ingrediente=ingrediente.nombre,
                    lote=lote_ingrediente.codigo_lote,
                    version=version_ingrediente.numero_version,
                    composicion_declarada=version_ingrediente.composicion_declarada,
                    alergenos_declarados=version_ingrediente.alergenos_declarados,
                )
            )

        return TrazabilidadRead(
            lote_producto=lote_producto.codigo_lote,
            producto=TrazabilidadProductoRead(
                nombre=producto.nombre,
                version=version_producto.numero_version,
                descripcion=version_producto.descripcion,
            ),
            ingredientes_utilizados=ingredientes_utilizados,
        )

    def _require_legacy_producto(self, producto_id: int) -> Producto:
        """Allow RT-01 legacy operations only on products without an owner."""
        producto = self.repository.get_producto(producto_id)
        if producto is None or producto.productor_id is not None:
            raise LookupError("Producto no encontrado")
        return producto

    def _require_legacy_ingrediente(self, ingrediente_id: int) -> Ingrediente:
        """Allow RT-01 legacy operations only on ingredients without an owner."""
        ingrediente = self.repository.get_ingrediente(ingrediente_id)
        if ingrediente is None or ingrediente.productor_id is not None:
            raise LookupError("Ingrediente no encontrado")
        return ingrediente
