"""Allergen detection from a source's labels and ingredient text.

T13-03 only fixes the shape of the result; T13-04 implements the detection.
"""

from dataclasses import dataclass

ORIGEN_ETIQUETA = "etiqueta"
ORIGEN_TEXTO = "texto"


@dataclass(frozen=True)
class AlergenoDetectado:
    codigo: str
    origen: str


@dataclass(frozen=True)
class Deteccion:
    contiene: tuple[AlergenoDetectado, ...] = ()
    trazas: tuple[AlergenoDetectado, ...] = ()
    # Labels or words that could not be tied to the catalog: the productor assigns them by hand.
    sin_reconocer: tuple[str, ...] = ()


def detectar_alergenos(
    etiquetas_contiene: tuple[str, ...],
    etiquetas_trazas: tuple[str, ...],
    texto_ingredientes: str | None,
) -> Deteccion:
    """Placeholder (T13-03): returns nothing. T13-04 replaces the body."""
    return Deteccion()
