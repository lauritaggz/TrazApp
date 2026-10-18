from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AlergenoSugeridoRead(BaseModel):
    alergeno_id: int
    codigo: str
    nombre: str
    # Where the suggestion comes from: the source's label or the ingredient text.
    origen: str


class AlergenosSugeridosRead(BaseModel):
    contiene: list[AlergenoSugeridoRead] = []
    trazas: list[AlergenoSugeridoRead] = []
    # Labels or words that could not be tied to the catalog: the productor assigns them by hand.
    sin_reconocer: list[str] = []


class ProductoPropuestoRead(BaseModel):
    nombre: str | None
    marca_origen: str | None
    presentacion: str | None
    ingredientes_declarados: str | None


class ConsultaCodigoRead(BaseModel):
    """A proposal for the supply form. Nothing is registered until the productor confirms."""

    codigo_barras: str
    encontrado: bool
    fuente: str
    fecha_recuperacion: datetime
    producto: ProductoPropuestoRead | None = None
    alergenos: AlergenosSugeridosRead = AlergenosSugeridosRead()
    ficha: dict[str, Any] | None = None
