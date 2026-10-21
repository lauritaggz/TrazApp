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
    url: str | None = None
    # Raw subset of what the source returned; it ends up in the supply's `ficha`.
    ficha: dict[str, Any] = field(default_factory=dict)
