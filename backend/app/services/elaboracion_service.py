import re
from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError

from app.db.triggers_elaboracion import MARCADOR_FINALIZADA, MARCADOR_NACE_BORRADOR, MARCADORES
from app.models import Elaboracion, LoteInsumo, Productor, UsoInsumo
from app.models.elaboracion import ESTADO_BORRADOR, ESTADO_FINALIZADA
from app.repositories.elaboracion_repository import ElaboracionRepository
from app.schemas.elaboracion import (
    CodigoSugeridoRead,
    ElaboracionCreate,
    ElaboracionRead,
    ElaboracionResumenRead,
    ElaboracionUpdate,
    EstadoElaboracion,
    LoteExistenteInput,
    LoteNuevoInput,
    LoteRead,
    ProductoResumenRead,
    SinLoteInput,
    UsoInsumoInput,
    UsosReemplazo,
    VersionResumenRead,
)
from app.schemas.insumo import AlergenoDeclaradoRead, ordenar_declarados
from app.services.insumo_service import InsumoNotFoundError
from app.services.producto_formulacion_service import ProductoFormulacionService
from app.services.producto_service import ProductoNotFoundError

ZONA_HORARIA = ZoneInfo("America/Santiago")
PREFIJO_CODIGO = "E-"
_CODIGO_NUMERADO = re.compile(r"^E-(\d+)$", re.IGNORECASE)

MENSAJE_SIN_FORMULACION = (
    "El producto no tiene una formulación vigente. Defínela antes de registrar una elaboración."
)
MENSAJE_FECHA_FUTURA = "La fecha de elaboración no puede ser futura."
MENSAJE_FINALIZADA = "La elaboración está finalizada y no puede modificarse."
MENSAJE_NACE_BORRADOR = "Una elaboración debe crearse como borrador."
MENSAJE_FINALIZADA_ELIMINAR = "La elaboración está finalizada y no puede eliminarse."
MENSAJE_FINALIZACION_INCOMPLETA = (
    "No se pudo finalizar: algún ingrediente no tiene su insumo o su información conservada."
)
MENSAJE_YA_FINALIZADA = "La elaboración ya está finalizada."
MENSAJE_FINALIZACION_BLOQUEADA = (
    "No se puede finalizar la elaboración: hay ingredientes con información pendiente o no disponible."
)
ESQUEMA_INFORMACION_CONSERVADA = 1
MENSAJE_INSUMO_NO_VALIDO = "Insumo no válido"
MENSAJE_LOTE_NO_VALIDO = "Lote no válido"


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


class ElaboracionFinalizadaError(ElaboracionConflictError):
    """The elaboración is finalizada: it cannot be modified."""


class FinalizacionBloqueadaError(ElaboracionConflictError):
    """The elaboración cannot be finalized: some lines are incomplete or unavailable.

    Each problem names the ingredient and what is missing: `insumo`, `lote`, `insumo_desactivado`
    or `ingrediente_desactivado`.
    """

    def __init__(self, problemas: list[dict[str, Any]]) -> None:
        self.problemas = problemas
        super().__init__(MENSAJE_FINALIZACION_BLOQUEADA)


class LoteRepetidoError(ElaboracionConflictError):
    """A new lot uses a code that the supply already has: the client can use the existing lot."""

    def __init__(self, codigo: str, ingrediente_id: int, lote_id: int) -> None:
        self.ingrediente_id = ingrediente_id
        self.lote_id = lote_id
        super().__init__(f"Ya existe un lote «{codigo}» para este insumo. Puedes usarlo.")


class InvalidElaboracionError(Exception):
    """Raised when the data of the request violates HU05 business rules (422).

    `ingrediente_id` tells the client which line of the assignment is wrong, when there is one.
    """

    def __init__(self, message: str, ingrediente_id: int | None = None) -> None:
        self.ingrediente_id = ingrediente_id
        super().__init__(message)


def traducir_error_de_base(exc: IntegrityError, mensaje_finalizada: str = MENSAJE_FINALIZADA) -> Exception | None:
    """409 error for a database trigger that protects a finalized elaboración, or None.

    The service checks the state first, so the triggers are only reached by a bug or a race: they
    answer the same 409 instead of a 500.
    """
    diag = getattr(getattr(exc, "orig", None), "diag", None)
    texto = getattr(diag, "message_primary", None) or str(getattr(exc, "orig", exc))
    if MARCADOR_FINALIZADA in texto:
        return ElaboracionFinalizadaError(mensaje_finalizada)
    if MARCADOR_NACE_BORRADOR in texto:
        return ElaboracionConflictError(MENSAJE_NACE_BORRADOR)
    if any(marcador in texto for marcador in MARCADORES):
        return ElaboracionConflictError(MENSAJE_FINALIZACION_INCOMPLETA)
    return None


def hoy_santiago() -> date:
    return datetime.now(ZONA_HORARIA).date()


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def construir_informacion_conservada(
    linea: Any,
    uso: Any,
    insumo: Any,
    lote: Any,
    conservada_en: datetime,
) -> dict[str, Any]:
    """Immutable copy of what was used for one ingredient (schema 1).

    Includes the supply as the productor sees it (not the raw `ficha` of an external source),
    its declared allergens with their type, and the lot. Built from plain values: nothing in
    it points back to the live rows.
    """
    return {
        "esquema": ESQUEMA_INFORMACION_CONSERVADA,
        "conservada_en": conservada_en.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ingrediente": {"id": linea.ingrediente_id, "nombre": linea.ingrediente_nombre},
        "insumo": {
            "id": insumo.id,
            "nombre": insumo.nombre,
            "marca_origen": insumo.marca_origen,
            "presentacion": insumo.presentacion,
            "codigo_barras": insumo.codigo_barras,
            "ingredientes_declarados": insumo.ingredientes_declarados,
            "advertencias": insumo.advertencias,
        },
        "alergenos": [
            AlergenoDeclaradoRead.from_declarado(declarado).model_dump()
            for declarado in ordenar_declarados(insumo.alergenos_declarados)
        ],
        "lote": (
            {
                "id": lote.id,
                "codigo": lote.codigo,
                "fecha_vencimiento": lote.fecha_vencimiento.isoformat() if lote.fecha_vencimiento else None,
            }
            if lote is not None
            else None
        ),
        "sin_lote": uso.sin_lote,
    }


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

    def replace_usos_mine(
        self,
        productor: Productor,
        elaboracion_id: int,
        payload: UsosReemplazo,
    ) -> ElaboracionRead:
        """Replace the whole assignment of supplies and lots of a borrador, in one transaction.

        The payload must cover every ingredient of the elaboración's version exactly once; a
        null supply or a missing lot keep the ingredient pending. New lots are created with
        the assignment. Any invalid entry leaves everything as it was.
        """
        # Read the id up front: after a failed flush the session cannot refresh ORM objects.
        productor_id = productor.id
        repo = self.repository
        try:
            elaboracion = repo.lock_elaboracion(elaboracion_id, productor_id)
            if elaboracion is None:
                raise ElaboracionNotFoundError("Elaboración no encontrada")
            if elaboracion.estado != ESTADO_BORRADOR:
                raise ElaboracionFinalizadaError(MENSAJE_FINALIZADA)
            version_id = elaboracion.version_producto_id
            lineas = repo.lineas_por_ingrediente(version_id)
            self._validar_ingredientes(payload.usos, lineas)

            usos = repo.usos_por_ingrediente(elaboracion_id)
            for item in payload.usos:
                insumo_id = self._resolver_insumo(productor_id, item)
                lote_id, sin_lote = self._resolver_lote(item, insumo_id)
                uso = usos.get(item.ingrediente_id)
                if uso is None:
                    uso = UsoInsumo(elaboracion_id=elaboracion_id, ingrediente_id=item.ingrediente_id)
                    repo.add_uso(uso)
                uso.insumo_id = insumo_id
                uso.lote_id = lote_id
                uso.sin_lote = sin_lote
            repo.flush()
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            traducido = traducir_error_de_base(exc)
            if traducido is not None:
                raise traducido from exc
            raise
        except BaseException:
            repo.rollback()
            raise
        return self._read(repo.reload(elaboracion_id, productor_id))

    def finalizar_mine(self, productor: Productor, elaboracion_id: int) -> ElaboracionRead:
        """Finalize a borrador: validate, copy what was used and change the state, in one transaction.

        Locks the elaboración (FOR UPDATE) and the assigned supplies (FOR SHARE), checks every line,
        writes the conserved information of each use and only then sets the state. If anything fails
        nothing is left behind: there is never a finalizada without its conserved information.
        """
        # Read the id up front: after a failed flush the session cannot refresh ORM objects.
        productor_id = productor.id
        repo = self.repository
        try:
            elaboracion = repo.lock_elaboracion(elaboracion_id, productor_id)
            if elaboracion is None:
                raise ElaboracionNotFoundError("Elaboración no encontrada")
            if elaboracion.estado != ESTADO_BORRADOR:
                raise ElaboracionFinalizadaError(MENSAJE_YA_FINALIZADA)
            lineas = repo.lineas_por_ingrediente(elaboracion.version_producto_id)
            usos = repo.usos_por_ingrediente(elaboracion_id)
            insumos = repo.lock_insumos_compartido(
                productor_id,
                [uso.insumo_id for uso in usos.values() if uso.insumo_id is not None],
            )
            problemas = self._problemas_de_finalizacion(lineas, usos, insumos)
            if problemas:
                raise FinalizacionBloqueadaError(problemas)

            lotes = repo.lotes_por_id([uso.lote_id for uso in usos.values() if uso.lote_id is not None])
            ahora = ahora_utc()
            for ingrediente_id, linea in lineas.items():
                uso = usos[ingrediente_id]
                uso.informacion_conservada = construir_informacion_conservada(
                    linea,
                    uso,
                    insumos[uso.insumo_id],
                    lotes.get(uso.lote_id),
                    ahora,
                )
            repo.flush()
            repo.marcar_finalizada(elaboracion, ahora)
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            traducido = traducir_error_de_base(exc)
            if traducido is not None:
                raise traducido from exc
            raise
        except BaseException:
            repo.rollback()
            raise
        return self._read(repo.reload(elaboracion_id, productor_id))

    @staticmethod
    def _problemas_de_finalizacion(lineas: dict, usos: dict, insumos: dict) -> list[dict[str, Any]]:
        problemas: list[dict[str, Any]] = []

        def problema(linea: Any, falta: str) -> None:
            problemas.append(
                {
                    "ingrediente_id": linea.ingrediente_id,
                    "ingrediente_nombre": linea.ingrediente_nombre,
                    "falta": falta,
                }
            )

        for ingrediente_id, linea in lineas.items():
            if not linea.ingrediente.activo:
                problema(linea, "ingrediente_desactivado")
            uso = usos.get(ingrediente_id)
            insumo = insumos.get(uso.insumo_id) if uso is not None and uso.insumo_id is not None else None
            if insumo is None:
                problema(linea, "insumo")
            elif not insumo.activo:
                problema(linea, "insumo_desactivado")
            elif uso.lote_id is None and not uso.sin_lote:
                problema(linea, "lote")
        return problemas

    def update_borrador_mine(
        self,
        productor: Productor,
        elaboracion_id: int,
        payload: ElaboracionUpdate,
    ) -> ElaboracionRead:
        """Change the code and/or the date of a borrador (same rules as the creation).

        A finalizada answers 409. The change is atomic: nothing is applied if any field is invalid.
        """
        # Read the id up front: after a failed flush the session cannot refresh ORM objects.
        productor_id = productor.id
        repo = self.repository
        cambios = payload.model_dump(exclude_unset=True)
        producto_id: int | None = None
        codigo: str | None = None
        try:
            elaboracion = repo.lock_elaboracion(elaboracion_id, productor_id)
            if elaboracion is None:
                raise ElaboracionNotFoundError("Elaboración no encontrada")
            if elaboracion.estado != ESTADO_BORRADOR:
                raise ElaboracionFinalizadaError(MENSAJE_FINALIZADA)
            producto_id = elaboracion.producto_id
            if "fecha" in cambios and cambios["fecha"] > hoy_santiago():
                raise InvalidElaboracionError(MENSAJE_FECHA_FUTURA)
            if "codigo" in cambios:
                codigo = cambios["codigo"]
                if repo.find_by_codigo(producto_id, codigo, exclude_id=elaboracion_id) is not None:
                    raise CodigoElaboracionRepetidoError(
                        codigo, sugerir_codigo(repo.list_codigos(producto_id))
                    )
                elaboracion.codigo = codigo
            if "fecha" in cambios:
                elaboracion.fecha_elaboracion = cambios["fecha"]
            repo.flush()
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            traducido = traducir_error_de_base(exc)
            if traducido is not None:
                raise traducido from exc
            if codigo is not None and producto_id is not None and repo.find_by_codigo(
                producto_id, codigo, exclude_id=elaboracion_id
            ) is not None:
                raise CodigoElaboracionRepetidoError(
                    codigo, sugerir_codigo(repo.list_codigos(producto_id))
                ) from exc
            raise
        except BaseException:
            repo.rollback()
            raise
        return self._read(repo.reload(elaboracion_id, productor_id))

    def delete_borrador_mine(self, productor: Productor, elaboracion_id: int) -> None:
        """Delete a borrador and its uses. A finalizada cannot be deleted (409).

        The product version stays flagged as used: it was used by this borrador while it existed.
        """
        productor_id = productor.id
        repo = self.repository
        try:
            elaboracion = repo.lock_elaboracion(elaboracion_id, productor_id)
            if elaboracion is None:
                raise ElaboracionNotFoundError("Elaboración no encontrada")
            if elaboracion.estado != ESTADO_BORRADOR:
                raise ElaboracionFinalizadaError(MENSAJE_FINALIZADA_ELIMINAR)
            repo.delete(elaboracion)
            repo.flush()
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            traducido = traducir_error_de_base(exc, MENSAJE_FINALIZADA_ELIMINAR)
            if traducido is not None:
                raise traducido from exc
            raise
        except BaseException:
            repo.rollback()
            raise

    def list_lotes_mine(self, productor: Productor, insumo_id: int) -> list[LoteRead]:
        if self.repository.get_insumo_propio(insumo_id, productor.id) is None:
            raise InsumoNotFoundError("Insumo no encontrado")
        return [LoteRead.model_validate(lote) for lote in self.repository.list_lotes(insumo_id)]

    @staticmethod
    def _validar_ingredientes(items: list[UsoInsumoInput], lineas: dict) -> None:
        vistos: set[int] = set()
        for item in items:
            if item.ingrediente_id in vistos:
                raise InvalidElaboracionError(
                    "Un ingrediente no puede repetirse en la asignación.",
                    item.ingrediente_id,
                )
            vistos.add(item.ingrediente_id)
        for item in items:
            if item.ingrediente_id not in lineas:
                raise InvalidElaboracionError(
                    "El ingrediente no pertenece a la formulación de la elaboración.",
                    item.ingrediente_id,
                )
        faltantes = [linea for ingrediente_id, linea in lineas.items() if ingrediente_id not in vistos]
        if faltantes:
            nombres = ", ".join(f"«{linea.ingrediente_nombre}»" for linea in faltantes)
            raise InvalidElaboracionError(
                f"Faltan ingredientes de la formulación en la asignación: {nombres}."
            )

    def _resolver_insumo(self, productor_id: int, item: UsoInsumoInput) -> int | None:
        if item.insumo_id is None:
            return None
        insumo = self.repository.get_insumo_propio(item.insumo_id, productor_id)
        if insumo is None or not insumo.activo or insumo.ingrediente_id != item.ingrediente_id:
            raise InvalidElaboracionError(MENSAJE_INSUMO_NO_VALIDO, item.ingrediente_id)
        return insumo.id

    def _resolver_lote(self, item: UsoInsumoInput, insumo_id: int | None) -> tuple[int | None, bool]:
        """(lote_id, sin_lote) of the assignment; creates the lot when it is new."""
        lote = item.lote
        if lote is None or insumo_id is None:
            return None, False
        if isinstance(lote, SinLoteInput):
            return None, True
        repo = self.repository
        if isinstance(lote, LoteExistenteInput):
            existente = repo.get_lote(lote.lote_id)
            if existente is None or existente.insumo_id != insumo_id:
                raise InvalidElaboracionError(MENSAJE_LOTE_NO_VALIDO, item.ingrediente_id)
            return existente.id, False
        assert isinstance(lote, LoteNuevoInput)
        repetido = repo.find_lote_by_codigo(insumo_id, lote.codigo)
        if repetido is not None:
            raise LoteRepetidoError(lote.codigo, item.ingrediente_id, repetido.id)
        nuevo = LoteInsumo(
            insumo_id=insumo_id,
            codigo=lote.codigo,
            fecha_vencimiento=lote.fecha_vencimiento,
        )
        repo.add_lote(nuevo)
        try:
            repo.flush()
        except IntegrityError as exc:
            # Another request created the same lot between the check and the insert.
            repo.rollback()
            concurrente = repo.find_lote_by_codigo(insumo_id, lote.codigo)
            if concurrente is None:
                raise
            raise LoteRepetidoError(lote.codigo, item.ingrediente_id, concurrente.id) from exc
        return nuevo.id, False

    def _read(self, elaboracion: Elaboracion) -> ElaboracionRead:
        lineas = self.repository.lineas_por_ingrediente(elaboracion.version_producto_id)
        if elaboracion.estado != ESTADO_FINALIZADA:
            # Only a borrador shows the live assignment; a finalizada is read from its copy.
            self.repository.cargar_asignacion_vigente(elaboracion.id)
        return ElaboracionRead.from_elaboracion(elaboracion, lineas)
