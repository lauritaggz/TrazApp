from decimal import Decimal

from app.models import FormulacionVersionProducto, Ingrediente, Productor, VersionProducto
from app.repositories.ingrediente_repository import IngredienteRepository
from app.repositories.producto_formulacion_repository import (
    DuplicateFormulacionIngredienteError,
    ProductoFormulacionRepository,
)
from app.repositories.producto_repository import ProductoRepository
from app.schemas.producto import (
    FormulacionComponenteCreate,
    FormulacionComponenteRead,
    FormulacionComponenteUpdate,
)
from app.services.ingrediente_service import IngredienteNotFoundError
from app.services.producto_service import ProductoNotFoundError


class VersionProductoNotFoundError(Exception):
    """Raised when a product version is not found for the owned product."""


class FormulacionNotFoundError(Exception):
    """Raised when a formulation line is not found for the version."""


class InvalidFormulacionError(Exception):
    """Raised when a formulation operation violates business rules."""


class FormulacionImmutableError(Exception):
    """Raised when mutating a version formulation that already has product lots."""


class ProductoFormulacionService:
    def __init__(
        self,
        formulacion_repository: ProductoFormulacionRepository,
        producto_repository: ProductoRepository,
        ingrediente_repository: IngredienteRepository,
    ) -> None:
        self.formulacion_repository = formulacion_repository
        self.producto_repository = producto_repository
        self.ingrediente_repository = ingrediente_repository

    def list_formulacion_mine(
        self,
        productor: Productor,
        producto_id: int,
        version_id: int,
    ) -> list[FormulacionComponenteRead]:
        version = self._get_owned_version_or_raise(productor.id, producto_id, version_id)
        lineas = self.formulacion_repository.list_formulacion(version.id)
        return [FormulacionComponenteRead.from_formulacion(item) for item in lineas]

    def add_formulacion_line_mine(
        self,
        productor: Productor,
        producto_id: int,
        version_id: int,
        payload: FormulacionComponenteCreate,
    ) -> FormulacionComponenteRead:
        version = self._get_mutable_version_or_raise(productor.id, producto_id, version_id)
        ingrediente = self._get_active_ingrediente_or_raise(
            productor.id,
            payload.ingrediente_id,
        )
        try:
            linea = self.formulacion_repository.add_formulacion_line(
                version_producto_id=version.id,
                ingrediente_id=ingrediente.id,
                ingrediente_nombre=ingrediente.nombre,
                ingrediente_codigo_interno=ingrediente.codigo_interno,
                ingrediente_tipo=ingrediente.tipo,
                porcentaje=payload.porcentaje,
                cantidad=payload.cantidad,
                unidad=payload.unidad,
                orden=payload.orden,
                notas=payload.notas,
            )
        except DuplicateFormulacionIngredienteError as exc:
            raise InvalidFormulacionError(str(exc)) from exc
        return FormulacionComponenteRead.from_formulacion(linea)

    def update_formulacion_line_mine(
        self,
        productor: Productor,
        producto_id: int,
        version_id: int,
        linea_id: int,
        payload: FormulacionComponenteUpdate,
    ) -> FormulacionComponenteRead:
        version = self._get_mutable_version_or_raise(productor.id, producto_id, version_id)
        linea = self._get_formulacion_line_or_raise(version.id, linea_id)
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return FormulacionComponenteRead.from_formulacion(linea)

        merged = self._merge_cuantificacion_updates(linea, updates)
        self._validate_cuantificacion_state(
            porcentaje=merged.get("porcentaje", linea.porcentaje),
            cantidad=merged.get("cantidad", linea.cantidad),
            unidad=merged.get("unidad", linea.unidad),
        )
        updated = self.formulacion_repository.update_formulacion_line(linea, **merged)
        return FormulacionComponenteRead.from_formulacion(updated)

    def delete_formulacion_line_mine(
        self,
        productor: Productor,
        producto_id: int,
        version_id: int,
        linea_id: int,
    ) -> None:
        version = self._get_mutable_version_or_raise(productor.id, producto_id, version_id)
        linea = self._get_formulacion_line_or_raise(version.id, linea_id)
        self.formulacion_repository.delete_formulacion_line(linea)

    def _get_owned_version_or_raise(
        self,
        productor_id: int,
        producto_id: int,
        version_id: int,
    ) -> VersionProducto:
        self._ensure_owned_product_or_raise(productor_id, producto_id)
        version = self.formulacion_repository.get_version_by_id_and_producto(
            version_id,
            producto_id,
        )
        if version is None:
            raise VersionProductoNotFoundError("Versión de producto no encontrada.")
        return version

    def _get_mutable_version_or_raise(
        self,
        productor_id: int,
        producto_id: int,
        version_id: int,
    ) -> VersionProducto:
        version = self._get_owned_version_or_raise(productor_id, producto_id, version_id)
        if self.formulacion_repository.version_has_lotes(version.id):
            raise FormulacionImmutableError(
                "La formulación no puede modificarse porque la versión tiene lotes asociados."
            )
        return version

    def _get_formulacion_line_or_raise(
        self,
        version_id: int,
        linea_id: int,
    ) -> FormulacionVersionProducto:
        linea = self.formulacion_repository.get_formulacion_line(linea_id, version_id)
        if linea is None:
            raise FormulacionNotFoundError("Línea de formulación no encontrada.")
        return linea

    def _ensure_owned_product_or_raise(self, productor_id: int, producto_id: int) -> None:
        producto = self.producto_repository.get_by_id_and_productor(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")

    def _get_active_ingrediente_or_raise(
        self,
        productor_id: int,
        ingrediente_id: int,
    ) -> Ingrediente:
        ingrediente = self.ingrediente_repository.get_by_id_and_productor(
            ingrediente_id,
            productor_id,
            active_only=True,
        )
        if ingrediente is None:
            ingrediente_inactive = self.ingrediente_repository.get_by_id_and_productor(
                ingrediente_id,
                productor_id,
                active_only=False,
            )
            if ingrediente_inactive is not None and not ingrediente_inactive.activo:
                raise InvalidFormulacionError(
                    "No se pueden usar ingredientes inactivos en la formulación."
                )
            raise IngredienteNotFoundError("Ingrediente no encontrado")
        return ingrediente

    @staticmethod
    def _merge_cuantificacion_updates(
        linea: FormulacionVersionProducto,
        updates: dict[str, object],
    ) -> dict[str, object]:
        merged = dict(updates)
        if "porcentaje" in merged and merged["porcentaje"] is not None:
            merged["cantidad"] = None
            merged["unidad"] = None
            return merged

        if "cantidad" in merged or "unidad" in merged:
            cantidad = merged.get("cantidad", linea.cantidad)
            unidad = merged.get("unidad", linea.unidad)
            if cantidad is not None or unidad is not None:
                merged["porcentaje"] = None
                merged["cantidad"] = cantidad
                merged["unidad"] = unidad
        return merged

    @staticmethod
    def _validate_cuantificacion_state(
        *,
        porcentaje: Decimal | None,
        cantidad: Decimal | None,
        unidad: str | None,
    ) -> None:
        has_porcentaje = porcentaje is not None
        has_cantidad = cantidad is not None
        has_unidad = unidad is not None

        if has_porcentaje and (has_cantidad or has_unidad):
            raise InvalidFormulacionError(
                "Indique porcentaje o cantidad con unidad, no ambos."
            )
        if not has_porcentaje and not (has_cantidad and has_unidad):
            raise InvalidFormulacionError("Debe indicar porcentaje o cantidad con unidad.")
        if has_cantidad != has_unidad:
            raise InvalidFormulacionError("cantidad y unidad deben indicarse juntas.")
