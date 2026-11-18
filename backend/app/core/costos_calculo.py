"""Cost arithmetic of the calculator (HU14 / T14-04). Pure: no database, no float.

- Magnitudes: mass (g = 1, kg = 1000), volume (ml = 1, L = 1000), count (unidad = 1). Nothing converts
  between magnitudes.
- Line cost = (quantity x quantity factor x price) / (content x content factor). It multiplies before it
  divides, with Decimal at 28 digits of precision.
- Money is kept with 4 decimals (ROUND_HALF_UP). Whole pesos exist only to display (`redondear_pesos`):
  the frontend repeats the same rule, so the screen and the API agree.
"""

from decimal import ROUND_HALF_UP, Context, Decimal

PRECISION = 28
_CONTEXTO = Context(prec=PRECISION, rounding=ROUND_HALF_UP)
_DECIMALES_DINERO = Decimal("0.0001")
_PESOS = Decimal("1")

MASA = "masa"
VOLUMEN = "volumen"
CONTEO = "conteo"

# unit -> (magnitude, factor to the base unit of that magnitude)
UNIDADES: dict[str, tuple[str, Decimal]] = {
    "g": (MASA, Decimal(1)),
    "kg": (MASA, Decimal(1000)),
    "ml": (VOLUMEN, Decimal(1)),
    "L": (VOLUMEN, Decimal(1000)),
    "unidad": (CONTEO, Decimal(1)),
}


class UnidadesIncompatiblesError(ValueError):
    """The two units belong to different magnitudes (or one is unknown)."""


def magnitud(unidad: str) -> str | None:
    datos = UNIDADES.get(unidad)
    return datos[0] if datos is not None else None


def son_compatibles(unidad_a: str, unidad_b: str) -> bool:
    a, b = magnitud(unidad_a), magnitud(unidad_b)
    return a is not None and a == b


def redondear_dinero(valor: Decimal) -> Decimal:
    """Money with 4 decimals, half up."""
    return valor.quantize(_DECIMALES_DINERO, rounding=ROUND_HALF_UP)


def redondear_pesos(valor: Decimal) -> Decimal:
    """Whole pesos, half up. Only for display: totals are never built from rounded lines."""
    return valor.quantize(_PESOS, rounding=ROUND_HALF_UP)


def costo_linea(
    cantidad: Decimal,
    unidad_cantidad: str,
    precio: Decimal,
    contenido: Decimal,
    unidad_contenido: str,
) -> Decimal:
    """Cost of `cantidad` of a supply that costs `precio` per `contenido`, with 4 decimals.

    Raises UnidadesIncompatiblesError when the units are not of the same magnitude.
    """
    if not son_compatibles(unidad_cantidad, unidad_contenido):
        raise UnidadesIncompatiblesError(f"{unidad_cantidad} y {unidad_contenido} no son de la misma magnitud")
    if contenido <= 0:
        raise ValueError("El contenido debe ser mayor que cero")
    factor_cantidad = UNIDADES[unidad_cantidad][1]
    factor_contenido = UNIDADES[unidad_contenido][1]
    numerador = _CONTEXTO.multiply(_CONTEXTO.multiply(cantidad, factor_cantidad), precio)
    denominador = _CONTEXTO.multiply(contenido, factor_contenido)
    return redondear_dinero(_CONTEXTO.divide(numerador, denominador))


def sumar(valores: list[Decimal]) -> Decimal:
    """Sum of money values, with 4 decimals."""
    total = Decimal(0)
    for valor in valores:
        total = _CONTEXTO.add(total, valor)
    return redondear_dinero(total)


def dividir(total: Decimal, entre: int) -> Decimal:
    """Money divided by a whole number, with 4 decimals."""
    return redondear_dinero(_CONTEXTO.divide(total, Decimal(entre)))
