"""Union of the allergens that several sources name for one product (HU07 / T07-04, CA5, CA15, CA16).

A pure function over the existing detector: no database, no network. It only names catalog codes.

- The allergens are the UNION of what each source says: Open Food Facts' labels, Jumbo's «Puede
  contener» (always as traces), and what the ingredient text reveals. Nothing is intersected.
- «Contiene» beats «puede contener»: if one source says contains and another says traces, it is
  contains, and it lists only the sources that declare it as contains (a trace elsewhere is not listed).
- «Libre de…» (Jumbo's food conditions) is informative and never reaches this module: it cannot
  remove an allergen.
- A trace term that cannot be tied to a code goes to `sin_reconocer` (manual assignment).
"""

from collections.abc import Callable

from app.services.recuperacion.alergenos import (
    ORIGEN_ETIQUETA,
    AlergenoDetectado,
    Deteccion,
)
from app.services.recuperacion.modelos import ProductoFuente

Detector = Callable[[tuple[str, ...], tuple[str, ...], str | None], Deteccion]

FUENTE_INGREDIENTES = "ingredientes"
# Order in which the sources are listed for an allergen.
_ORDEN_FUENTES = ("jumbo", "open_food_facts", FUENTE_INGREDIENTES)


def _ordenar(fuentes: set[str]) -> tuple[str, ...]:
    conocidas = [f for f in _ORDEN_FUENTES if f in fuentes]
    return tuple(conocidas + sorted(fuentes - set(_ORDEN_FUENTES)))


def _detectar_traza_declarada(detector: Detector, termino: str) -> Deteccion:
    """One free-text trace term («nueces», «soya») read as «puede contener trazas de …»."""
    return detector((), (), f"Puede contener trazas de {termino}.")


def combinar_alergenos(detector: Detector, producto: ProductoFuente) -> Deteccion:
    """The allergens of a combined sheet, each with the list of sources that name it."""
    campos = producto.fuentes_campos
    fuente_etiquetas = campos.get("etiquetas_alergenos", "open_food_facts")
    fuente_trazas = campos.get("trazas_texto", "jumbo")

    # (source, detection, forced to traces)
    partes: list[tuple[str, Deteccion, bool]] = [
        (
            fuente_etiquetas,
            detector(producto.etiquetas_alergenos, producto.etiquetas_trazas, None),
            False,
        )
    ]
    sin_reconocer: list[str] = []
    for termino in producto.trazas_texto:
        deteccion = _detectar_traza_declarada(detector, termino)
        if not (deteccion.contiene or deteccion.trazas or deteccion.sin_reconocer):
            sin_reconocer.append(termino)
        partes.append((fuente_trazas, deteccion, True))
    partes.append((FUENTE_INGREDIENTES, detector((), (), producto.ingredientes), False))

    contiene: dict[str, str] = {}
    trazas: dict[str, str] = {}
    fuentes_contiene: dict[str, set[str]] = {}
    fuentes_trazas: dict[str, set[str]] = {}

    def anotar_traza(fuente: str, alergeno: AlergenoDetectado) -> None:
        fuentes_trazas.setdefault(alergeno.codigo, set()).add(fuente)
        trazas.setdefault(alergeno.codigo, _origen(fuente, alergeno))

    for fuente, deteccion, solo_trazas in partes:
        for alergeno in deteccion.contiene:
            if solo_trazas:
                anotar_traza(fuente, alergeno)
            else:
                fuentes_contiene.setdefault(alergeno.codigo, set()).add(fuente)
                contiene.setdefault(alergeno.codigo, _origen(fuente, alergeno))
        for alergeno in deteccion.trazas:
            anotar_traza(fuente, alergeno)
        for texto in deteccion.sin_reconocer:
            if texto not in sin_reconocer:
                sin_reconocer.append(texto)

    return Deteccion(
        # «Contiene» lists only the sources that declare it as contains; another source's trace of the
        # same allergen is not listed.
        contiene=tuple(
            AlergenoDetectado(codigo, origen, _ordenar(fuentes_contiene[codigo]))
            for codigo, origen in contiene.items()
        ),
        # An allergen that is also «contiene» somewhere is listed once, as contains.
        trazas=tuple(
            AlergenoDetectado(codigo, origen, _ordenar(fuentes_trazas[codigo]))
            for codigo, origen in trazas.items()
            if codigo not in contiene
        ),
        sin_reconocer=tuple(sin_reconocer),
    )


def _origen(fuente: str, alergeno: AlergenoDetectado) -> str:
    # What a source declares itself counts as a label; the ingredient text keeps its own origin.
    return alergeno.origen if fuente == FUENTE_INGREDIENTES else ORIGEN_ETIQUETA
