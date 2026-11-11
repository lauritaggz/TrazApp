"""Public consultation of a product (HU10, T10-01).

The response is built ONLY from the conserved copy of each use (RT-03): nothing is read from the
live supply. Visibility is decided by the HU09 rules (T09-04), reused as they are.

`armar_ficha` is the single place that assembles the response. It receives rows already read and
does no query and no visibility check, so the authenticated preview of T10-05 can call it too.
"""

import logging
import re
from datetime import date
from typing import Any

from app.repositories.consulta_publica_repository import ConsultaPublicaRepository
from app.schemas.consulta_publica import (
    AlergenoGrupoPublicoRead,
    AlergenoPublicoRead,
    AlergenosAgrupadosRead,
    ElaboracionPublicaRead,
    ElaboracionResumenPublicoRead,
    FichaPublicaRead,
    InsumoPublicoRead,
    ProductoPublicoRead,
)
from app.services.producto_service import ProductoNotFoundError
from app.services.elaboracion_service import (
    elaboracion_visible_publicamente,
    producto_disponible_publicamente,
)

logger = logging.getLogger(__name__)

MENSAJE_NO_DISPONIBLE = "Información no disponible"
MENSAJE_CODIGO_Y_FECHA = "Indica el código o la fecha de la elaboración, pero no ambos."
MENSAJE_FECHA_INVALIDA = "La fecha debe tener el formato AAAA-MM-DD."
_FORMATO_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Declaration type stored in the copy -> public wording.
_TIPO_PUBLICO = {"contiene": "contiene", "trazas": "puede_contener"}


class FichaNoDisponibleError(Exception):
    """Product not published, deleted or unknown: all three look the same from outside (404)."""


class ParametrosInvalidosError(Exception):
    """Invalid `codigo` / `fecha` parameters (422). Raised before the product is looked up."""


def normalizar_codigo(codigo: str) -> str:
    """Both sides of a code comparison: trimmed and case-folded. Inner spaces are kept."""
    return codigo.strip().casefold()


def validar_parametros(codigo: str | None, fecha: str | None) -> tuple[str | None, date | None]:
    """Validate the selection parameters without touching the database (same 422 for any product)."""
    if codigo is not None and fecha is not None:
        raise ParametrosInvalidosError(MENSAJE_CODIGO_Y_FECHA)
    if fecha is None:
        return codigo, None
    if not _FORMATO_FECHA.match(fecha):
        raise ParametrosInvalidosError(MENSAJE_FECHA_INVALIDA)
    try:
        return None, date.fromisoformat(fecha)
    except ValueError:
        raise ParametrosInvalidosError(MENSAJE_FECHA_INVALIDA) from None


def resolver_seleccion(
    visibles: list[Any], codigo: str | None, fecha: date | None
) -> tuple[str, Any | None, list[Any]]:
    """(state, chosen elaboración, matches) among the VISIBLE elaboraciones only.

    Hidden ones, borradores and codes of other products never get here, so they cannot be told
    from an unknown code. `visibles` come in "Predeterminada" order, which `coincidencias` keeps.
    Never picks one silently when several share the date.
    """
    if not visibles:
        return "sin_elaboraciones", None, []
    if codigo is not None:
        clave = normalizar_codigo(codigo)
        for fila in visibles:
            if normalizar_codigo(fila.codigo) == clave:
                return "ok", fila, []
        return "no_disponible", None, []
    if fecha is not None:
        del_dia = [fila for fila in visibles if fila.fecha_elaboracion == fecha]
        if not del_dia:
            return "no_disponible", None, []
        if len(del_dia) > 1:
            return "varias", None, del_dia
        return "ok", del_dia[0], []
    return "ok", visibles[0], []


class InformacionConservadaIncompletaError(Exception):
    """A conserved copy lacks a key. Fail closed: a missing allergen list is not "no allergens".

    Carries only the id of the use and the missing key, never the content of the copy.
    """

    def __init__(self, uso_id: int, clave: str) -> None:
        self.uso_id = uso_id
        self.clave = clave
        super().__init__(f"Copia conservada incompleta (uso {uso_id}): falta «{clave}»")


def _exigir(uso_id: int, contenedor: Any, clave: str, ruta: str, tipo: type) -> Any:
    valor = contenedor.get(clave) if isinstance(contenedor, dict) else None
    if not isinstance(valor, tipo):
        logger.error("Copia conservada incompleta: uso %s, falta %s", uso_id, ruta)
        raise InformacionConservadaIncompletaError(uso_id, ruta)
    return valor


def proyectar_insumo(uso_id: int, copia: Any) -> InsumoPublicoRead:
    """Public view of one conserved copy: each field is picked by hand (whitelist)."""
    ingrediente = _exigir(uso_id, copia, "ingrediente", "ingrediente", dict)
    insumo = _exigir(uso_id, copia, "insumo", "insumo", dict)
    alergenos = _exigir(uso_id, copia, "alergenos", "alergenos", list)
    publicos = []
    for declarado in alergenos:
        tipo = _exigir(uso_id, declarado, "tipo", "alergenos.tipo", str)
        if tipo not in _TIPO_PUBLICO:
            logger.error("Copia conservada incompleta: uso %s, tipo de alergeno desconocido", uso_id)
            raise InformacionConservadaIncompletaError(uso_id, "alergenos.tipo")
        publicos.append(
            AlergenoPublicoRead(
                codigo=_exigir(uso_id, declarado, "codigo", "alergenos.codigo", str),
                nombre=_exigir(uso_id, declarado, "nombre", "alergenos.nombre", str),
                tipo=_TIPO_PUBLICO[tipo],
            )
        )
    return InsumoPublicoRead(
        ingrediente=_exigir(uso_id, ingrediente, "nombre", "ingrediente.nombre", str),
        nombre=_exigir(uso_id, insumo, "nombre", "insumo.nombre", str),
        marca_origen=_exigir(uso_id, insumo, "marca_origen", "insumo.marca_origen", str),
        ingredientes_declarados=insumo.get("ingredientes_declarados"),
        advertencias=insumo.get("advertencias"),
        alergenos=publicos,
    )


def agrupar_alergenos(copias: list[tuple[int, Any]]) -> AlergenosAgrupadosRead:
    """Union of the allergens of the conserved copies, deduplicated by code (D4).

    An allergen declared "contiene" by any supply goes ONLY in `contiene`, even if another supply
    declares it as traces. Order, same as the productor's screens (`ordenar_declarados`): the ones
    mandatory in Chile first, then by name. Call it after `proyectar_insumo` has validated the copies.
    """
    contiene: list[dict] = []
    trazas: list[dict] = []
    for _, copia in copias:
        for declarado in copia["alergenos"]:
            lista = contiene if declarado["tipo"] == "contiene" else trazas
            if all(x["codigo"] != declarado["codigo"] for x in lista):
                lista.append(declarado)
    codigos_contiene = {x["codigo"] for x in contiene}
    trazas = [x for x in trazas if x["codigo"] not in codigos_contiene]

    def publico(lista: list[dict]) -> list[AlergenoGrupoPublicoRead]:
        ordenada = sorted(lista, key=lambda x: (not x.get("obligatorio_chile", False), x["nombre"], x["codigo"]))
        return [AlergenoGrupoPublicoRead(codigo=x["codigo"], nombre=x["nombre"]) for x in ordenada]

    return AlergenosAgrupadosRead(contiene=publico(contiene), puede_contener=publico(trazas))


def armar_ficha(
    producto: Any,
    categorias: list[str],
    visibles: list[Any],
    estado: str,
    seleccionada: Any | None,
    coincidencias: list[Any],
    copias: list[tuple[int, Any]],
) -> FichaPublicaRead:
    """The public response. `visibles` are the visible elaboraciones, in "Predeterminada" order;
    `seleccionada` is the chosen one (or None) and `copias` its conserved copies."""
    nombre_negocio = (producto.nombre_negocio or "").strip()
    elaboracion = None
    if seleccionada is not None:
        insumos = [proyectar_insumo(uso_id, copia) for uso_id, copia in copias]
        elaboracion = ElaboracionPublicaRead(
            codigo=seleccionada.codigo,
            fecha=seleccionada.fecha_elaboracion,
            insumos=insumos,
            alergenos=agrupar_alergenos(copias),
            # No current version (None) also counts as "previous": it is not the current one.
            version_anterior=seleccionada.version_producto_id != producto.version_vigente_id,
        )
    return FichaPublicaRead(
        producto=ProductoPublicoRead(
            id_publico=producto.id_publico,
            nombre=producto.nombre,
            contenido_neto=producto.contenido_neto,
            unidad_medida=producto.unidad_medida,
            presentacion=producto.presentacion,
            imagen_url=producto.imagen_url,
            categorias=categorias,
            elaborado_por=nombre_negocio or None,
        ),
        elaboraciones=[
            ElaboracionResumenPublicoRead(codigo=fila.codigo, fecha=fila.fecha_elaboracion) for fila in visibles
        ],
        elaboracion=elaboracion,
        estado_elaboracion=estado,
        coincidencias=[
            ElaboracionResumenPublicoRead(codigo=fila.codigo, fecha=fila.fecha_elaboracion) for fila in coincidencias
        ],
    )


class _ProductoComoPublicado:
    """A product seen AS IF it were published (preview): only `publicado` changes.

    The HU09 visibility rules (T09-04) are reused untouched; they just receive this view, so the
    preview shows what the consumer would see (hidden elaboraciones and borradores stay out) and
    nothing is written to the product.
    """

    publicado = True

    def __init__(self, producto: Any) -> None:
        self._producto = producto

    def __getattr__(self, nombre: str) -> Any:
        return getattr(self._producto, nombre)


class ConsultaPublicaService:
    def __init__(self, repository: ConsultaPublicaRepository) -> None:
        self.repository = repository

    def consultar(
        self, id_publico: str, codigo: str | None = None, fecha: date | None = None
    ) -> FichaPublicaRead:
        """Ficha of a published product: its visible elaboraciones and the requested (or default) one.

        `codigo` / `fecha` come already validated (`validar_parametros`). An unavailable product
        answers the same 404 whatever the parameters.
        """
        producto = self.repository.get_producto_por_id_publico(id_publico)
        # One check, one error: not published, deleted and unknown cannot be told apart.
        if producto is None or not producto_disponible_publicamente(producto):
            raise FichaNoDisponibleError(MENSAJE_NO_DISPONIBLE)
        return self._ficha(producto, producto, codigo, fecha)

    def previsualizar(
        self, productor_id: int, producto_id: int, codigo: str | None = None, fecha: date | None = None
    ) -> FichaPublicaRead:
        """The ficha the consumer WOULD see for a product of this productor, published or not (CA10).

        Same assembly (`armar_ficha`) and same visibility rules as `consultar`: hidden
        elaboraciones and borradores do not appear. It writes nothing: it does not publish and
        does not create the public id. A product that is not the productor's, a deleted one and an
        unknown id raise ProductoNotFoundError (404).
        """
        producto = self.repository.get_producto_de_productor(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")
        return self._ficha(producto, _ProductoComoPublicado(producto), codigo, fecha)

    def _ficha(self, producto: Any, vista: Any, codigo: str | None, fecha: date | None) -> FichaPublicaRead:
        """Single source of the ficha. `vista` is what the visibility rules judge (the product itself
        for the public consultation; the product as if published for the preview)."""
        filas = self.repository.filas_elaboraciones(producto.id)
        visibles = [fila for fila in filas if elaboracion_visible_publicamente(vista, fila, fila.oculta)]
        estado, seleccionada, coincidencias = resolver_seleccion(visibles, codigo, fecha)
        copias = self.repository.copias_conservadas(seleccionada.id) if seleccionada is not None else []
        categorias = self.repository.nombres_categorias(producto.id)
        return armar_ficha(producto, categorias, visibles, estado, seleccionada, coincidencias, copias)
