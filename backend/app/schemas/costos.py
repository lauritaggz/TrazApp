"""Schemas of the cost calculator endpoints (HU14 / T14-05).

How numbers travel in the JSON (the frontend relies on it): every Decimal is a STRING with a fixed
number of decimals, never a JSON number, so nothing is lost on the way:

- costs and totals (line cost, totals, cost per batch and per unit): 4 decimals, "250.0000";
- prices and amounts of other costs: 2 decimals, "1000.00";
- quantities and contents: 3 decimals, "250.000".

The same strings are accepted on input (a JSON number is accepted too).
"""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    model_validator,
)

from app.core import costos_calculo
from app.services import costos_service as cs

UnidadCosto = Literal["g", "kg", "ml", "L", "unidad"]
RENDIMIENTO_MAXIMO = 1_000_000
MAX_CANTIDADES = 200
MAX_OTROS_COSTOS = 50
MENSAJES_FALTANTES = {
    cs.FALTA_CANTIDAD: "Falta la cantidad del ingrediente en la tanda",
    cs.FALTA_INSUMO: "Falta elegir un insumo",
    cs.FALTA_PRECIO: "El insumo no tiene precio",
    cs.FALTA_CONTENIDO: "El insumo no tiene contenido",
    cs.FALTA_UNIDADES: "La unidad de la cantidad y la del contenido del insumo no son comparables",
}


def _texto(decimales: int):
    exponente = Decimal(1).scaleb(-decimales)

    def a_texto(valor: Decimal) -> str:
        return format(valor.quantize(exponente, rounding=ROUND_HALF_UP), "f")

    return PlainSerializer(a_texto, return_type=str, when_used="json")


Costo = Annotated[Decimal, _texto(4)]
Precio = Annotated[Decimal, _texto(2)]
Cantidad = Annotated[Decimal, _texto(3)]


# --- reading ---------------------------------------------------------------------------------


class FaltanteRead(BaseModel):
    codigo: str
    mensaje: str


class InsumoCostoRead(BaseModel):
    id: int
    nombre: str
    marca_origen: str
    presentacion: str | None
    habitual: bool
    precio_referencia: Precio | None
    precio_fuente: str | None
    precio_fecha: datetime | None
    contenido_cantidad: Cantidad | None
    contenido_unidad: str | None
    contenido_fuente: str | None


class LineaCostoRead(BaseModel):
    ingrediente_id: int
    ingrediente_nombre: str
    orden: int | None
    cantidad: Cantidad | None
    unidad: str | None
    insumo: InsumoCostoRead | None
    origen_insumo: str | None
    # "ultimo_inactivo": the supply the last elaboración used is inactive or now belongs to another ingredient.
    aviso_insumo: str | None
    insumos_disponibles: list[InsumoCostoRead]
    costo: Costo | None
    faltantes: list[FaltanteRead]


class OtroCostoRead(BaseModel):
    id: int
    nombre: str
    monto: Precio
    orden: int


class ResumenCostoRead(BaseModel):
    completo: bool
    lineas_incompletas: int
    total_ingredientes: Costo | None
    total_otros_costos: Costo
    costo_tanda: Costo | None
    costo_unidad: Costo | None
    precio_mas_antiguo: datetime | None


class CostosProductoRead(BaseModel):
    producto_id: int
    producto_nombre: str
    tiene_formulacion: bool
    version_id: int | None
    rendimiento: int | None
    lineas: list[LineaCostoRead]
    otros_costos: list[OtroCostoRead]
    resumen: ResumenCostoRead


def _insumo(insumo: cs.InsumoDisponible) -> InsumoCostoRead:
    return InsumoCostoRead(
        id=insumo.id,
        nombre=insumo.nombre,
        marca_origen=insumo.marca_origen,
        presentacion=insumo.presentacion,
        habitual=insumo.habitual,
        precio_referencia=insumo.precio_referencia,
        precio_fuente=insumo.precio_fuente,
        precio_fecha=insumo.precio_fecha,
        contenido_cantidad=insumo.contenido_cantidad,
        contenido_unidad=insumo.contenido_unidad,
        contenido_fuente=insumo.contenido_fuente,
    )


def costos_a_read(calculo: cs.CalculoCostos) -> CostosProductoRead:
    """The service's dataclasses as the response of the endpoints."""
    resumen = calculo.resumen
    return CostosProductoRead(
        producto_id=calculo.producto_id,
        producto_nombre=calculo.producto_nombre,
        tiene_formulacion=calculo.tiene_formulacion,
        version_id=calculo.version_id,
        rendimiento=calculo.rendimiento,
        lineas=[
            LineaCostoRead(
                ingrediente_id=linea.ingrediente_id,
                ingrediente_nombre=linea.ingrediente_nombre,
                orden=linea.orden,
                cantidad=linea.cantidad,
                unidad=linea.unidad,
                insumo=_insumo(linea.insumo) if linea.insumo else None,
                origen_insumo=linea.origen_insumo,
                aviso_insumo=linea.aviso_insumo,
                insumos_disponibles=[_insumo(i) for i in linea.insumos_disponibles],
                costo=linea.costo,
                faltantes=[FaltanteRead(codigo=f, mensaje=MENSAJES_FALTANTES[f]) for f in linea.faltantes],
            )
            for linea in calculo.lineas
        ],
        otros_costos=[
            OtroCostoRead(id=o.id, nombre=o.nombre, monto=o.monto, orden=o.orden) for o in calculo.otros_costos
        ],
        resumen=ResumenCostoRead(
            completo=resumen.completo,
            lineas_incompletas=resumen.lineas_incompletas,
            total_ingredientes=resumen.total_ingredientes,
            total_otros_costos=resumen.total_otros_costos,
            costo_tanda=resumen.costo_tanda,
            costo_unidad=resumen.costo_unidad,
            precio_mas_antiguo=resumen.precio_mas_antiguo,
        ),
    )


# --- the ?insumo=<ingrediente_id>:<insumo_id> parameter ---------------------------------------------


def parsear_alternativas(valores: list[str]) -> dict[int, int]:
    """`["3:10", "4:12"]` -> {3: 10, 4: 12}. Raises ValueError (message for the 422) on a malformed
    value or an ingredient that appears twice."""
    alternativas: dict[int, int] = {}
    for valor in valores:
        partes = valor.split(":")
        if len(partes) != 2 or not all(p.isascii() and p.isdigit() for p in partes):
            raise ValueError(f"El parámetro insumo debe tener la forma <ingrediente_id>:<insumo_id> (recibido: {valor!r})")
        ingrediente_id, insumo_id = int(partes[0]), int(partes[1])
        if ingrediente_id <= 0 or insumo_id <= 0 or ingrediente_id > 2**31 - 1 or insumo_id > 2**31 - 1:
            raise ValueError(f"Los identificadores del parámetro insumo no son válidos (recibido: {valor!r})")
        if ingrediente_id in alternativas:
            raise ValueError(f"El ingrediente {ingrediente_id} aparece más de una vez en el parámetro insumo")
        alternativas[ingrediente_id] = insumo_id
    return alternativas


# --- writing -----------------------------------------------------------------------------------


class CantidadIngredienteInput(BaseModel):
    """Quantity of one ingredient in a batch. `cantidad` and `unidad` go together; both null removes it."""

    model_config = ConfigDict(extra="forbid")

    ingrediente_id: int = Field(gt=0, le=2**31 - 1)
    cantidad: Decimal | None = Field(default=None, max_digits=12, decimal_places=3)
    unidad: UnidadCosto | None = None

    @model_validator(mode="after")
    def _juntas_y_positiva(self) -> "CantidadIngredienteInput":
        if (self.cantidad is None) != (self.unidad is None):
            raise ValueError("La cantidad y la unidad van juntas: envía las dos, o ninguna para borrarla")
        if self.cantidad is not None and not self.cantidad.is_finite():
            raise ValueError("La cantidad no es válida")
        if self.cantidad is not None and self.cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor que cero")
        return self


class OtroCostoInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    monto: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class CostosProductoUpdate(BaseModel):
    """What the productor saves in the calculator. An omitted field is not touched."""

    model_config = ConfigDict(extra="forbid")

    rendimiento: int | None = Field(default=None, gt=0, le=RENDIMIENTO_MAXIMO)
    cantidades: list[CantidadIngredienteInput] | None = Field(default=None, max_length=MAX_CANTIDADES)
    otros_costos: list[OtroCostoInput] | None = Field(default=None, max_length=MAX_OTROS_COSTOS)

    @model_validator(mode="after")
    def _listas_no_nulas(self) -> "CostosProductoUpdate":
        for campo in ("cantidades", "otros_costos"):
            if campo in self.model_fields_set and getattr(self, campo) is None:
                raise ValueError(f"{campo} no puede ser null: envía una lista (vacía para quitar todo)")
        return self
