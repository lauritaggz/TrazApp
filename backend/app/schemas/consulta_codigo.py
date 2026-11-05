from datetime import datetime
from typing import Any, ClassVar

from pydantic import BaseModel, GetJsonSchemaHandler, SerializerFunctionWrapHandler, model_serializer
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema


def _sin_opcionales(modelo: BaseModel, handler: SerializerFunctionWrapHandler, campos: tuple[str, ...]):
    """The answer without the optional HU07 fields that are None (pydantic 2.10 has no `exclude_if`)."""
    datos = handler(modelo)
    for campo in campos:
        if datos.get(campo) is None:
            datos.pop(campo, None)
    return datos


class _OmiteOpcionalesVacios(BaseModel):
    """Base for the answers whose optional HU07 fields are left out when None.

    The serializer returns a plain dict, so the OpenAPI schema would lose the properties; it is built
    from the model itself instead, as if there were no serializer.
    """

    OPCIONALES: ClassVar[tuple[str, ...]] = ()

    @model_serializer(mode="wrap")
    def _serializar(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        return _sin_opcionales(self, handler, self.OPCIONALES)

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return handler({k: v for k, v in core_schema.items() if k != "serialization"})


class AlergenoSugeridoRead(_OmiteOpcionalesVacios):
    OPCIONALES: ClassVar[tuple[str, ...]] = ("fuentes",)

    alergeno_id: int
    codigo: str
    nombre: str
    # Where the suggestion comes from: the source's label or the ingredient text.
    origen: str
    # HU07: every source that names this allergen ("jumbo", "open_food_facts", "ingredientes").
    # Optional and left out of the answer when empty, so HU13's answer is unchanged.
    fuentes: list[str] | None = None



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


class ConsultaCodigoRead(_OmiteOpcionalesVacios):
    OPCIONALES: ClassVar[tuple[str, ...]] = ("fuentes_campos", "fuentes_sin_respuesta")

    """A proposal for the supply form. Nothing is registered until the productor confirms."""

    codigo_barras: str
    encontrado: bool
    fuente: str
    fecha_recuperacion: datetime
    producto: ProductoPropuestoRead | None = None
    alergenos: AlergenosSugeridosRead = AlergenosSugeridosRead()
    ficha: dict[str, Any] | None = None
    # HU07, both optional and left out of the answer when empty (HU13's answer is unchanged):
    # which source supplied each field of `producto`, and the sources that did not answer in time.
    fuentes_campos: dict[str, str] | None = None
    fuentes_sin_respuesta: list[str] | None = None

