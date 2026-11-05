"""Barcode normalization and validation for commercial supplies (HU04 / T04-03).

Accepted formats: EAN-8, UPC-A (12 digits) and EAN-13, all with the GS1 check digit.
"""

import re

LARGOS_VALIDOS = frozenset({8, 12, 13})

MENSAJE_FORMATO = "El código de barras debe tener 8, 12 o 13 dígitos numéricos."
MENSAJE_DIGITO_VERIFICADOR = "El dígito verificador del código de barras no es válido."

_ESPACIOS = re.compile(r"\s+")


def normalizar_codigo_barras(value: str | None) -> str | None:
    """Remove every whitespace character; an empty result means "no barcode" (None)."""
    if value is None:
        return None
    normalizado = _ESPACIOS.sub("", value)
    return normalizado or None


def digito_verificador_valido(codigo: str) -> bool:
    """GS1 check digit: weights 3,1,3,1... from the digit next to the check digit, leftwards."""
    cuerpo, digito = codigo[:-1], int(codigo[-1])
    suma = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return (10 - suma % 10) % 10 == digito


def formas_equivalentes(codigo: str) -> tuple[str, ...]:
    """Every written form of the same product: a UPC-A (12 digits) is the EAN-13 with a leading 0.

    Readers and sources disagree on which form they report, so duplicates are looked up in both.
    The check digit is the same in both forms. The code itself comes first. EAN-8 has no twin.
    """
    if len(codigo) == 12:
        return (codigo, "0" + codigo)
    if len(codigo) == 13 and codigo.startswith("0"):
        return (codigo, codigo[1:])
    return (codigo,)


def es_circulacion_restringida(codigo: str) -> bool:
    """True for numbers that GS1 reserves for restricted circulation: they do not identify one product.

    Stores use them for bulk items, weighed goods and in-house labels (a PLU, a price-embedded code),
    so the same number can mean different things in each store. Per the GS1 General Specifications
    (GS1 Prefix list): EAN-13 starting with 02 or 20-29, GS1-8 starting with 0 or 2 (000-099 and
    200-299). A UPC-A is the EAN-13 with a leading 0, so a UPC-A starting with 2 is the 02 range.
    Expects a code already validated by `validar_codigo_barras`; returns False for any other shape.
    """
    if not (codigo.isascii() and codigo.isdigit()):
        return False
    if len(codigo) == 13:
        return codigo[0] == "2" or codigo.startswith("02")
    if len(codigo) == 12:
        return codigo[0] == "2"
    if len(codigo) == 8:
        return codigo[0] in "02"
    return False


def validar_codigo_barras(codigo: str) -> str:
    """Return the code if it is a valid EAN-8, UPC-A or EAN-13; raise ValueError otherwise."""
    if not (codigo.isascii() and codigo.isdigit()) or len(codigo) not in LARGOS_VALIDOS:
        raise ValueError(MENSAJE_FORMATO)
    if not digito_verificador_valido(codigo):
        raise ValueError(MENSAJE_DIGITO_VERIFICADOR)
    return codigo
