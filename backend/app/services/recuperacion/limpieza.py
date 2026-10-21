"""Cleans the ingredient text a source returns before it is proposed as «ingredientes declarados» (T13-10).

Labels often end with who made or packed the product and how to reach them («Elaborado y envasado por
Iansagro S.A., <address>, Las Condes»). That is not part of the ingredients, so it is cut from the first
manufacturer phrase or contact detail to the end. An allergen notice that follows the cut («Puede
contener trazas de maní», «Elaborado en una línea que procesa maní») is kept at the end.

A pure function. It only changes what is PROPOSED to the productor: the allergen detection and the
`ficha` keep working on the original text.
"""

import re
import unicodedata

# Where the manufacturer / contact part starts. «Elaborado en una línea…» is NOT here: it needs «por».
_PARTICIPIOS = r"(?:elaborad[oa]s?(?: y envasad[oa]s?)?|envasad[oa]s?|fabricad[oa]s?|importad[oa]s?|distribuid[oa]s?|producid[oa]s?|comercializad[oa]s?)"
_CORTES: tuple[re.Pattern[str], ...] = tuple(
    re.compile(patron)
    for patron in (
        rf"\b{_PARTICIPIOS}\s+por\b",
        r"\bfono\b",
        r"\btelefono\b",
        r"\btel[.:]",
        r"\bwww\.",
        r"https?://",
        r"[\w.+-]+@[\w-]+\.[\w.-]+",
        r"\bsitio web\b",
        r"\bcorreo(?: electronico)?\b",
    )
)

# Where an allergen notice starts, in the part that was cut.
_AVISOS = re.compile(
    r"\b(?:puede(?:n)? contener|podria(?:n)? contener|contiene(?:n)?|trazas? de"
    r"|(?:elaborad|producid|fabricad|envasad|procesad)[oa]s? en (?:una |un )?"
    r"(?:lineas?|instalaciones?|plantas?|fabricas?|talleres?)\b)"
)
_FIN_DE_FRASE = re.compile(r"\.(?=\s|$)")
_SOBRANTES = " \t\r\n,;:-–—"


def _plegar(texto: str) -> str:
    """Lower case and no accents, one character for one character (so indices still fit the original)."""
    return "".join(unicodedata.normalize("NFD", c)[0] for c in texto).lower()


def limpiar_ingredientes(texto: str | None) -> str | None:
    """The ingredient text without the manufacturer and contact details, keeping allergen notices.

    Returns the original when there is nothing to cut, or when the cut would leave no ingredients.
    """
    if not texto:
        return texto
    plegado = _plegar(texto)
    inicios = [m.start() for patron in _CORTES if (m := patron.search(plegado))]
    if not inicios:
        return texto
    corte = min(inicios)
    cabeza = texto[:corte].rstrip(_SOBRANTES)
    if not cabeza:
        return texto

    avisos: list[str] = []
    posicion = corte
    while (aviso := _AVISOS.search(plegado, posicion)) is not None:
        fin = _FIN_DE_FRASE.search(plegado, aviso.end())
        hasta = fin.end() if fin else len(texto)
        avisos.append(texto[aviso.start() : hasta].strip())
        posicion = hasta
    return " ".join([cabeza, *avisos])
