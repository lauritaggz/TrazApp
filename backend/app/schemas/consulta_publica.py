"""Public consultation payloads (HU10).

WHITELIST: this endpoint has no authentication, so everything below is visible to anyone on the
internet. Every field is declared here on purpose; these models are filled by hand from plain
values and never from an ORM object (no `from_attributes`). `extra="forbid"` makes adding an
undeclared field an error. Do not add a field without deciding that it is public.
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

# State of the requested elaboración (T10-02). "no_disponible" covers hidden, borrador, of another
# product, unknown, and "none that day": from outside they cannot be told apart.
EstadoElaboracionPublico = Literal["ok", "no_disponible", "varias", "sin_elaboraciones"]

# Public wording of the declaration type (the stored copy says "trazas").
TipoAlergenoPublico = Literal["contiene", "puede_contener"]


class _Publico(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AlergenoPublicoRead(_Publico):
    codigo: str
    nombre: str
    tipo: TipoAlergenoPublico


class AlergenoGrupoPublicoRead(_Publico):
    codigo: str
    nombre: str


class AlergenosAgrupadosRead(_Publico):
    """Union of the allergens of every supply of the elaboración (D4), each one in one group only."""

    contiene: list[AlergenoGrupoPublicoRead]
    puede_contener: list[AlergenoGrupoPublicoRead]


class InsumoPublicoRead(_Publico):
    ingrediente: str
    nombre: str
    marca_origen: str
    ingredientes_declarados: str | None
    advertencias: str | None
    alergenos: list[AlergenoPublicoRead]


class ElaboracionResumenPublicoRead(_Publico):
    """One entry of the list the consumer picks from: only what is printed on the package."""

    codigo: str
    fecha: date


class ElaboracionPublicaRead(_Publico):
    codigo: str
    fecha: date
    insumos: list[InsumoPublicoRead]
    alergenos: AlergenosAgrupadosRead
    # True when the elaboración was made with a version of the recipe other than the current one
    # (or the product has no current version). The version number or content is never exposed.
    version_anterior: bool


class ProductoPublicoRead(_Publico):
    # Echo of the identifier already in the URL: HU11 pairs it with the elaboración's code.
    id_publico: str
    nombre: str
    contenido_neto: Decimal | None
    unidad_medida: str | None
    presentacion: str | None
    imagen_url: str | None
    categorias: list[str]
    # Business name only; the productor's personal name and email are never public.
    elaborado_por: str | None


class FichaPublicaRead(_Publico):
    producto: ProductoPublicoRead
    # Finalized, visible elaboraciones, most recent first ("Predeterminada" order).
    elaboraciones: list[ElaboracionResumenPublicoRead]
    # The one requested by code or date, or the default; null unless estado_elaboracion is "ok".
    elaboracion: ElaboracionPublicaRead | None
    estado_elaboracion: EstadoElaboracionPublico
    # Only filled with "varias": the visible elaboraciones of the requested date, in list order.
    coincidencias: list[ElaboracionResumenPublicoRead]
