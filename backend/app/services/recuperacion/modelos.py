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


@dataclass(frozen=True)
class ResultadoBusqueda:
    """One hit of a search by name or brand: enough to show it and to ask the source for its sheet."""

    id: str
    nombre: str
    marca: str | None
    presentacion: str | None
    url: str | None = None
