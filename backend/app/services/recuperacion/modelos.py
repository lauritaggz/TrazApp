from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProductoFuente:
    """A product as a source describes it, already in the vocabulary of the supply form."""

    codigo_barras: str
    nombre: str | None
    marca: str | None
    presentacion: str | None
    ingredientes: str | None
    etiquetas_alergenos: tuple[str, ...] = ()
    etiquetas_trazas: tuple[str, ...] = ()
    # Traces a source declares as free text (not as labels), e.g. Jumbo's «Puede contener».
    trazas_texto: tuple[str, ...] = ()
    url: str | None = None
    # Which source built it (e.g. "jumbo"). Optional: HU13's adapter does not set it.
    fuente: str | None = None
    # Combined sheets (HU07): which source supplied each field, e.g. {"ingredientes": "jumbo"}.
    # Empty for a sheet that comes from one source.
    fuentes_campos: dict[str, str] = field(default_factory=dict)
    # Sources that were asked and did not answer in time (e.g. ("jumbo",)): the productor is told.
    fuentes_sin_respuesta: tuple[str, ...] = ()
    # Raw subset of what the source returned; it ends up in the supply's `ficha`.
    ficha: dict[str, Any] = field(default_factory=dict)
    # Thumbnail of the product (HU07): only the address, never downloaded or saved, and NOT part of `ficha`.
    imagen_url: str | None = None
    # The source of `imagen_url` ("jumbo" or "open_food_facts"), shown next to it as attribution.
    imagen_fuente: str | None = None


@dataclass(frozen=True)
class ResultadoBusqueda:
    """One hit of a search by name or brand: enough to show it and to ask the source for its sheet."""

    id: str
    nombre: str
    marca: str | None
    presentacion: str | None
    url: str | None = None
    # Thumbnail address (HU07), shown in the list of hits; never downloaded or saved.
    imagen_url: str | None = None


IMAGEN_MAX_LARGO = 500


def url_de_imagen(valor: Any) -> str | None:
    """The first usable picture address of what a source gave: a string or a list of them.

    Only https addresses of a sensible length are kept: the address ends up in an `<img>` of the page, so
    `javascript:`, `data:` and plain `http:` (mixed content) are dropped. Nothing is downloaded here.
    """
    candidatos = valor if isinstance(valor, list) else [valor]
    for candidato in candidatos:
        if isinstance(candidato, dict):
            candidato = candidato.get("url") or candidato.get("imageUrl")
        if not isinstance(candidato, str):
            continue
        candidato = candidato.strip()
        if candidato.startswith("https://") and len(candidato) <= IMAGEN_MAX_LARGO and " " not in candidato:
            return candidato
    return None
