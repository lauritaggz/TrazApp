"""Net content parser (HU14 / T14-03): "1 kg", "500 g", "1 Litro", "6 x 200 ml" -> (quantity, unit).

A pure function. What it does not understand is None, never a guess: the productor types it in.

- Units: g, gr, grs, gramo(s) -> g; kg, kgs, kilo(s), kilogramo(s) -> kg; ml, cc, mililitro(s) -> ml;
  l, lt, lts, litro(s) -> L; un, unid, unidad(es) -> unidad.
- Decimals with a comma or a point. A point followed by exactly three digits ("1.000 g", "0.250 kg") is
  ambiguous (thousands or decimals?) and gives None.
- "N x Q unit", with an optional leading "Pack" and N from 2 to 100, is N times Q: the price is the
  pack's, so the cost per unit of content stays right.
"""

import re
from decimal import Decimal, InvalidOperation

UNIDADES_RECONOCIDAS = {
    "g": "g",
    "gr": "g",
    "grs": "g",
    "gramo": "g",
    "gramos": "g",
    "kg": "kg",
    "kgs": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kilogramo": "kg",
    "kilogramos": "kg",
    "ml": "ml",
    "cc": "ml",
    "mililitro": "ml",
    "mililitros": "ml",
    "l": "L",
    "lt": "L",
    "lts": "L",
    "litro": "L",
    "litros": "L",
    "un": "unidad",
    "unid": "unidad",
    "unidad": "unidad",
    "unidades": "unidad",
}

MULTIPLO_MIN = 2
MULTIPLO_MAX = 100
# The column is numeric(12, 3): at most 9 integer digits and 3 decimals.
_MAXIMO = Decimal("1000000000")
_DECIMALES = Decimal("0.001")

_NUMERO = r"[0-9]+(?:[.,][0-9]+)?"
_UNIDAD = "|".join(sorted(map(re.escape, UNIDADES_RECONOCIDAS), key=len, reverse=True))
_SIMPLE = re.compile(rf"^(?P<n>{_NUMERO})\s*(?P<u>{_UNIDAD})\.?$", re.IGNORECASE | re.ASCII)
_MULTIPLE = re.compile(
    rf"^(?:pack\s+)?(?P<m>[0-9]+)\s*x\s*(?P<n>{_NUMERO})\s*(?P<u>{_UNIDAD})\.?$",
    re.IGNORECASE | re.ASCII,
)
_PUNTO_Y_TRES_DIGITOS = re.compile(r"\.[0-9]{3}$")


def _numero(texto: str) -> Decimal | None:
    if _PUNTO_Y_TRES_DIGITOS.search(texto):
        return None  # "1.000": thousands or decimals? Not guessed.
    try:
        valor = Decimal(texto.replace(",", "."))
    except InvalidOperation:
        return None
    return valor if valor > 0 else None


def _valido(valor: Decimal) -> bool:
    return 0 < valor < _MAXIMO and valor == valor.quantize(_DECIMALES)


def parsear_contenido(texto: object) -> tuple[Decimal, str] | None:
    """The content as (quantity, unit) with the unit in the vocabulary of the app, or None."""
    if not isinstance(texto, str):
        return None
    limpio = " ".join(texto.split())
    if not limpio:
        return None

    multiple = _MULTIPLE.match(limpio)
    if multiple is not None:
        veces = int(multiple["m"])
        cantidad = _numero(multiple["n"])
        if cantidad is None or not MULTIPLO_MIN <= veces <= MULTIPLO_MAX:
            return None
        total = cantidad * veces
        unidad = UNIDADES_RECONOCIDAS[multiple["u"].lower()]
        return (total.quantize(_DECIMALES), unidad) if _valido(total) else None

    simple = _SIMPLE.match(limpio)
    if simple is None:
        return None
    cantidad = _numero(simple["n"])
    if cantidad is None or not _valido(cantidad):
        return None
    return cantidad.quantize(_DECIMALES), UNIDADES_RECONOCIDAS[simple["u"].lower()]
