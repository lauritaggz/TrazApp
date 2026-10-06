import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError

from app.models import Elaboracion, Productor, UsoInsumo
from app.repositories.elaboracion_repository import ElaboracionRepository
from app.schemas.elaboracion import (
    CodigoSugeridoRead,
    ElaboracionCreate,
    ElaboracionRead,
    ElaboracionResumenRead,
    EstadoElaboracion,
    ProductoResumenRead,
    VersionResumenRead,
)
from app.services.producto_formulacion_service import ProductoFormulacionService
from app.services.producto_service import ProductoNotFoundError

ZONA_HORARIA = ZoneInfo("America/Santiago")
PREFIJO_CODIGO = "E-"
_CODIGO_NUMERADO = re.compile(r"^E-(\d+)$", re.IGNORECASE)

MENSAJE_SIN_FORMULACION = (
    "El producto no tiene una formulación vigente. Defínela antes de registrar una elaboración."
)
MENSAJE_FECHA_FUTURA = "La fecha de elaboración no puede ser futura."


class ElaboracionNotFoundError(Exception):
    """Raised when an elaboración is not visible to the authenticated productor (404)."""


class ElaboracionConflictError(Exception):
    """Raised when the state of the product or elaboración does not allow the operation (409)."""


class SinFormulacionError(ElaboracionConflictError):
    """The product has no current formulation, so there is nothing to elaborate."""


class IngredientesDesactivadosError(ElaboracionConflictError):
    """The current formulation contains deactivated ingredients."""

    def __init__(self, ingredientes: list[dict[str, object]]) -> None:
        self.ingredientes = ingredientes
        nombres = ", ".join(f"«{item['nombre']}»" for item in ingredientes)
        super().__init__(
            f"La formulación vigente incluye ingredientes desactivados: {nombres}. "
            "Corrige la formulación para poder registrar la elaboración."
        )


class CodigoElaboracionRepetidoError(ElaboracionConflictError):
    """The code is already used by another elaboración of the same product."""

    def __init__(self, codigo: str, codigo_sugerido: str) -> None:
        self.codigo_sugerido = codigo_sugerido
        super().__init__(f"Ya existe una elaboración con el código «{codigo}» para este producto.")


class InvalidElaboracionError(Exception):
    """Raised when the data of the request violates HU05 business rules (422)."""


def hoy_santiago() -> date:
    return datetime.now(ZONA_HORARIA).date()


def sugerir_codigo(codigos: list[str]) -> str:
    """Next `E-NNN` after the highest numbered code of the product (at least 3 digits)."""
    mayor = 0
    for codigo in codigos:
        coincidencia = _CODIGO_NUMERADO.match(codigo.strip())
        if coincidencia:
            mayor = max(mayor, int(coincidencia.group(1)))
    return f"{PREFIJO_CODIGO}{mayor + 1:03d}"


class ElaboracionService:
    def __init__(
        self,
        repository: ElaboracionRepository,
        formulacion_service: ProductoFormulacionService,
    ) -> None:
        self.repository = repository
        self.formulacion_service = formulacion_service

    def codigo_sugerido_mine(self, productor: Productor, producto_id: int) -> CodigoSugeridoRead:
        if self.repository.get_producto_activo(producto_id, productor.id) is None:
            raise ProductoNotFoundError("Producto no encontrado")
        return CodigoSugeridoRead(codigo=sugerir_codigo(self.repository.list_codigos(producto_id)))

    def create_borrador(
        self,
        productor: Productor,
        producto_id: int,
        payload: ElaboracionCreate,
    ) -> ElaboracionRead:
        """Create a borrador from the current formulation, in a single transaction.

        Locks the product, takes its current version, creates the elaboración and one use
        per ingredient (with the active habitual supply when there is one) and flags the
        version as used. Nothing is left behind if any step fails.
        """
        # Read the ids up front: after a failed flush the session cannot refresh ORM objects.
        productor_id = productor.id
        repo = self.repository
        elaboracion_id: int | None = None
        codigo: str | None = None
        try:
            if repo.lock_producto(producto_id, productor_id) is None:
                raise ProductoNotFoundError("Producto no encontrado")
            version = self.formulacion_service.obtener_version_vigente(productor, producto_id)
            if version is None:
                raise SinFormulacionError(MENSAJE_SIN_FORMULACION)
            version_id = version.id
            lineas = repo.list_lineas_formulacion(version_id)
            if not lineas:
                raise SinFormulacionError(MENSAJE_SIN_FORMULACION)
            desactivados = [
                {"id": linea.ingrediente_id, "nombre": linea.ingrediente_nombre}
                for linea in lineas
                if not linea.ingrediente.activo
            ]
            if desactivados:
                raise IngredientesDesactivadosError(desactivados)

            hoy = hoy_santiago()
            fecha = payload.fecha if payload.fecha is not None else hoy
            if fecha > hoy:
                raise InvalidElaboracionError(MENSAJE_FECHA_FUTURA)
            codigos = repo.list_codigos(producto_id)
            codigo = payload.codigo if payload.codigo is not None else sugerir_codigo(codigos)
            if repo.find_by_codigo(producto_id, codigo) is not None:
                raise CodigoElaboracionRepetidoError(codigo, sugerir_codigo(codigos))

            habituales = repo.habituales_activos(
                productor_id, [linea.ingrediente_id for linea in lineas]
            )
            elaboracion = Elaboracion(
                productor_id=productor_id,
                producto_id=producto_id,
                version_producto_id=version_id,
                codigo=codigo,
                fecha_elaboracion=fecha,
            )
            repo.add(elaboracion)
            repo.flush()
            elaboracion_id = elaboracion.id
            for linea in lineas:
                repo.add_uso(
                    UsoInsumo(
                        elaboracion_id=elaboracion_id,
                        ingrediente_id=linea.ingrediente_id,
                        insumo_id=habituales.get(linea.ingrediente_id),
                    )
                )
            self.formulacion_service.marcar_version_usada(version_id)
            repo.flush()
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            if codigo is None or repo.find_by_codigo(producto_id, codigo) is None:
                raise
            raise CodigoElaboracionRepetidoError(
                codigo, sugerir_codigo(repo.list_codigos(producto_id))
            ) from exc
        except BaseException:
            repo.rollback()
            raise
        assert elaboracion_id is not None
        return self._read(repo.reload(elaboracion_id, productor_id))

    def get_mine(self, productor: Productor, elaboracion_id: int) -> ElaboracionRead:
        elaboracion = self.repository.get_by_id_and_productor(elaboracion_id, productor.id)
        if elaboracion is None:
            raise ElaboracionNotFoundError("Elaboración no encontrada")
        return self._read(elaboracion)

    def list_mine(
        self,
        productor: Productor,
        *,
        producto_id: int | None = None,
        estado: EstadoElaboracion | None = None,
    ) -> list[ElaboracionResumenRead]:
        return [
            ElaboracionResumenRead(
                id=elaboracion.id,
                producto=ProductoResumenRead(
                    id=elaboracion.producto.id,
                    nombre=elaboracion.producto.nombre,
                ),
                version=VersionResumenRead(
                    id=elaboracion.version_producto.id,
                    numero_version=elaboracion.version_producto.numero_version,
                ),
                codigo=elaboracion.codigo,
                fecha=elaboracion.fecha_elaboracion,
                estado=elaboracion.estado,
                finalizada_at=elaboracion.finalizada_at,
                total_ingredientes=total,
                pendientes=pendientes,
            )
            for elaboracion, total, pendientes in self.repository.list_resumenes(
                productor.id,
                producto_id=producto_id,
                estado=estado,
            )
        ]

    def _read(self, elaboracion: Elaboracion) -> ElaboracionRead:
        # A finalizada will be read from its conserved copy (T05-04); until then every
        # elaboración is a borrador and shows live data.
        lineas = self.repository.lineas_por_ingrediente(elaboracion.version_producto_id)
        return ElaboracionRead.from_elaboracion(elaboracion, lineas)
