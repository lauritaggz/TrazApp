"""Public consultation of a product (HU10, T10-01).

The response is built ONLY from the conserved copy of each use (RT-03): nothing is read from the
live supply. Visibility is decided by the HU09 rules (T09-04), reused as they are.

`armar_ficha` is the single place that assembles the response. It receives rows already read and
does no query and no visibility check, so the authenticated preview of T10-05 can call it too.
"""

import logging
from typing import Any

from app.repositories.consulta_publica_repository import ConsultaPublicaRepository
from app.schemas.consulta_publica import (
    AlergenoPublicoRead,
    ElaboracionPublicaRead,
    ElaboracionResumenPublicoRead,
    FichaPublicaRead,
    InsumoPublicoRead,
    ProductoPublicoRead,
)
from app.services.elaboracion_service import (
    elaboracion_visible_publicamente,
    producto_disponible_publicamente,
)

logger = logging.getLogger(__name__)

MENSAJE_NO_DISPONIBLE = "Información no disponible"
# Declaration type stored in the copy -> public wording.
_TIPO_PUBLICO = {"contiene": "contiene", "trazas": "puede_contener"}


class FichaNoDisponibleError(Exception):
    """Product not published, deleted or unknown: all three look the same from outside (404)."""


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


def armar_ficha(
    producto: Any,
    categorias: list[str],
    visibles: list[Any],
    copias: list[tuple[int, Any]],
) -> FichaPublicaRead:
    """The public response. `visibles` are the visible elaboraciones, in "Predeterminada" order;
    `copias` are the conserved copies of the first one (the default)."""
    nombre_negocio = (producto.nombre_negocio or "").strip()
    elaboracion = None
    if visibles:
        elaboracion = ElaboracionPublicaRead(
            codigo=visibles[0].codigo,
            fecha=visibles[0].fecha_elaboracion,
            insumos=[proyectar_insumo(uso_id, copia) for uso_id, copia in copias],
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
    )


class ConsultaPublicaService:
    def __init__(self, repository: ConsultaPublicaRepository) -> None:
        self.repository = repository

    def consultar(self, id_publico: str) -> FichaPublicaRead:
        """Ficha of a published product: its visible elaboraciones and the default one."""
        producto = self.repository.get_producto_por_id_publico(id_publico)
        # One check, one error: not published, deleted and unknown cannot be told apart.
        if producto is None or not producto_disponible_publicamente(producto):
            raise FichaNoDisponibleError(MENSAJE_NO_DISPONIBLE)
        filas = self.repository.filas_elaboraciones(producto.id)
        visibles = [fila for fila in filas if elaboracion_visible_publicamente(producto, fila, fila.oculta)]
        copias = self.repository.copias_conservadas(visibles[0].id) if visibles else []
        categorias = self.repository.nombres_categorias(producto.id)
        return armar_ficha(producto, categorias, visibles, copias)
