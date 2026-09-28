from decimal import Decimal

from sqlalchemy.exc import IntegrityError

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
    FormulacionGuardadaRead,
    FormulacionLineaInput,
    FormulacionReemplazo,
    FormulacionVersionRead,
    ResultadoGuardadoFormulacion,
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


class FormulacionConflictError(Exception):
    """Raised when a concurrent save already created the same version number."""


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

    def obtener_version_vigente(
        self,
        productor: Productor,
        producto_id: int,
    ) -> VersionProducto | None:
        """Current version of an owned product, or None if it has no formulation yet."""
        self._ensure_owned_product_or_raise(productor.id, producto_id)
        return self.formulacion_repository.get_version_vigente(producto_id)

    def reemplazar_formulacion_mine(
        self,
        productor: Productor,
        producto_id: int,
        payload: FormulacionReemplazo,
    ) -> FormulacionGuardadaRead:
        """Replace the whole formulation of an owned product (HU03).

        A version used by an elaboración is never modified: the change goes to a
        new version that becomes the only vigente one.
        """
        repo = self.formulacion_repository
        try:
            producto = repo.lock_producto_for_productor(producto_id, productor.id)
            if producto is None:
                raise ProductoNotFoundError("Producto no encontrado")
            vigente = repo.get_version_vigente(producto.id)
            lineas_actuales = repo.list_formulacion(vigente.id) if vigente else []
            ingredientes = self._resolve_ingredientes_formulacion(
                productor.id,
                payload.lineas,
                {linea.ingrediente_id for linea in lineas_actuales},
            )

            resultado: ResultadoGuardadoFormulacion
            if vigente is not None and self._same_formulacion(lineas_actuales, payload.lineas):
                mismo_orden = [linea.ingrediente_id for linea in lineas_actuales] == [
                    linea.ingrediente_id for linea in payload.lineas
                ]
                # Reordering is not a recipe change: a used version keeps its order.
                if mismo_orden or vigente.usada_en_elaboracion:
                    repo.rollback()
                    return self._build_guardada("sin_cambios", vigente)

            if vigente is not None and not vigente.usada_en_elaboracion:
                self._replace_lines_in_place(vigente, lineas_actuales, payload.lineas, ingredientes)
                version = vigente
                resultado = "modificada_en_lugar"
            else:
                if vigente is not None:
                    repo.apagar_vigentes(producto.id)
                numero = repo.next_numero_version(producto.id)
                try:
                    version = repo.create_version_vigente(
                        producto_id=producto.id,
                        numero_version=numero,
                        descripcion=f"Versión {numero}",
                    )
                except IntegrityError as exc:
                    raise FormulacionConflictError(
                        "Otra modificación de la formulación se guardó al mismo tiempo. "
                        "Recargue la formulación e intente nuevamente."
                    ) from exc
                for orden, linea in enumerate(payload.lineas, start=1):
                    repo.stage_formulacion_line(
                        version_producto_id=version.id,
                        **self._line_fields(linea, orden, ingredientes[linea.ingrediente_id]),
                    )
                resultado = "version_creada" if vigente is None else "nueva_version"

            repo.flush()
            repo.commit()
        except BaseException:
            repo.rollback()
            raise
        return self._build_guardada(resultado, version)

    def marcar_version_usada(self, version_id: int) -> VersionProducto:
        """Flag a product version as used by an elaboración.

        Does not commit: the caller must commit in the same transaction that
        creates the elaboración, so a version is never left unflagged while
        an elaboración references it. Idempotent.
        """
        version = self.formulacion_repository.get_version_by_id(version_id)
        if version is None:
            raise VersionProductoNotFoundError("Versión de producto no encontrada.")
        if version.usada_en_elaboracion:
            return version
        return self.formulacion_repository.mark_version_usada(version)

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

    def _resolve_ingredientes_formulacion(
        self,
        productor_id: int,
        lineas: list[FormulacionLineaInput],
        ingredientes_vigentes: set[int],
    ) -> dict[int, Ingrediente]:
        ids = [linea.ingrediente_id for linea in lineas]
        if len(ids) != len(set(ids)):
            raise InvalidFormulacionError(
                "Un ingrediente no puede repetirse en la formulación."
            )
        encontrados = {
            ingrediente.id: ingrediente
            for ingrediente in self.formulacion_repository.list_ingredientes_for_productor(
                productor_id,
                ids,
            )
        }
        for ingrediente_id in ids:
            ingrediente = encontrados.get(ingrediente_id)
            if ingrediente is None:
                raise IngredienteNotFoundError("Ingrediente no encontrado")
            if not ingrediente.activo:
                if ingrediente_id in ingredientes_vigentes:
                    raise InvalidFormulacionError(
                        f"El ingrediente «{ingrediente.nombre}» está desactivado. "
                        "Quítelo de la formulación para poder guardar."
                    )
                raise InvalidFormulacionError(
                    "No se pueden usar ingredientes inactivos en la formulación."
                )
        return encontrados

    @staticmethod
    def _same_formulacion(
        actuales: list[FormulacionVersionProducto],
        nuevas: list[FormulacionLineaInput],
    ) -> bool:
        """Same recipe regardless of line order."""
        return {
            linea.ingrediente_id: (linea.porcentaje, linea.cantidad, linea.unidad, linea.notas)
            for linea in actuales
        } == {
            linea.ingrediente_id: (None, linea.cantidad, linea.unidad, linea.notas)
            for linea in nuevas
        }

    @staticmethod
    def _line_fields(
        linea: FormulacionLineaInput,
        orden: int,
        ingrediente: Ingrediente,
    ) -> dict[str, object]:
        return {
            "ingrediente_id": ingrediente.id,
            "ingrediente_nombre": ingrediente.nombre,
            "ingrediente_codigo_interno": ingrediente.codigo_interno,
            "ingrediente_tipo": ingrediente.tipo,
            "porcentaje": None,
            "cantidad": linea.cantidad,
            "unidad": linea.unidad,
            "orden": orden,
            "notas": linea.notas,
        }

    def _replace_lines_in_place(
        self,
        version: VersionProducto,
        actuales: list[FormulacionVersionProducto],
        nuevas: list[FormulacionLineaInput],
        ingredientes: dict[int, Ingrediente],
    ) -> None:
        # Existing lines are updated by ingredient instead of delete + insert: the
        # unit of work flushes inserts before deletes, which would trip the
        # (version, ingrediente) unique constraint when an ingredient is kept.
        por_ingrediente = {linea.ingrediente_id: linea for linea in actuales}
        conservados = {linea.ingrediente_id for linea in nuevas}
        for linea in actuales:
            if linea.ingrediente_id not in conservados:
                self.formulacion_repository.stage_delete_formulacion_line(linea)
        for orden, nueva in enumerate(nuevas, start=1):
            fields = self._line_fields(nueva, orden, ingredientes[nueva.ingrediente_id])
            existente = por_ingrediente.get(nueva.ingrediente_id)
            if existente is None:
                self.formulacion_repository.stage_formulacion_line(
                    version_producto_id=version.id,
                    **fields,
                )
            else:
                for key, value in fields.items():
                    setattr(existente, key, value)

    def _build_guardada(
        self,
        resultado: ResultadoGuardadoFormulacion,
        version: VersionProducto,
    ) -> FormulacionGuardadaRead:
        lineas = self.formulacion_repository.list_formulacion(version.id)
        return FormulacionGuardadaRead(
            resultado=resultado,
            version=FormulacionVersionRead(
                id=version.id,
                producto_id=version.producto_id,
                numero_version=version.numero_version,
                descripcion=version.descripcion,
                fecha_creacion=version.fecha_creacion,
                vigente=version.vigente,
                usada_en_elaboracion=version.usada_en_elaboracion,
                lineas=[FormulacionComponenteRead.from_formulacion(item) for item in lineas],
            ),
        )

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
        if has_cantidad != has_unidad:
            raise InvalidFormulacionError("cantidad y unidad deben indicarse juntas.")
