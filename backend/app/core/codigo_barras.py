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


def validar_codigo_barras(codigo: str) -> str:
    """Return the code if it is a valid EAN-8, UPC-A or EAN-13; raise ValueError otherwise."""
    if not (codigo.isascii() and codigo.isdigit()) or len(codigo) not in LARGOS_VALIDOS:
        raise ValueError(MENSAJE_FORMATO)
    if not digito_verificador_valido(codigo):
        raise ValueError(MENSAJE_DIGITO_VERIFICADOR)
    return codigo
