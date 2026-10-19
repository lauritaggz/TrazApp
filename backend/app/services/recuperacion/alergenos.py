"""Allergen detection from a source's labels and ingredient text (HU13 / T13-04).

A pure function: no database, no network. It only names catalog codes; the service ties them to the
catalog rows. Everything it returns is a SUGGESTION for the productor, who confirms it by saving.

What it does, in this order:
1. Labels of the source («allergens» -> contains, «traces» -> traces) are mapped to catalog codes.
   A label that cannot be mapped goes to manual assignment (`sin_reconocer`), never silently away.
2. The ingredient text is searched for Spanish keywords. What follows a «may contain» phrase, up to the
   next full stop, is trace; the rest of the text is "contains".
3. «Contains» wins over «traces», wherever each one comes from; an allergen appears once.

The doubtful cases favour detection: they are either suggested or sent to `sin_reconocer`.
"""

import re
import unicodedata
from dataclasses import dataclass

from app.core.alergenos_palabras import (
    AMBIGUAS,
    CALIFICADORES_A_REVISAR,
    CALIFICADORES_CUBIERTOS,
    CALIFICADORES_LECHE_VEGETAL,
    ETIQUETAS_OFF,
    FRASES_TRAZAS,
    IGNORAR_SI_SIGUE,
    NEGACIONES,
    NO_NEGABLES,
    PALABRAS_CLAVE,
    PALABRAS_LACTEAS_CALIFICABLES,
    PATRONES_CLAVE,
    RELLENOS_NEGACION,
)

ORIGEN_ETIQUETA = "etiqueta"
ORIGEN_TEXTO = "texto"

CODIGO_LACTEOS = "lacteos"


@dataclass(frozen=True)
class AlergenoDetectado:
    codigo: str
    origen: str


@dataclass(frozen=True)
class Deteccion:
    contiene: tuple[AlergenoDetectado, ...] = ()
    trazas: tuple[AlergenoDetectado, ...] = ()
    # Labels or words that could not be tied to the catalog: the productor assigns them by hand.
    sin_reconocer: tuple[str, ...] = ()


def normalizar_texto(texto: str) -> str:
    """Lower case, no accents («maní» -> «mani»), single spaces."""
    descompuesto = unicodedata.normalize("NFD", texto.lower())
    sin_tildes = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", sin_tildes).strip()


# --- compiled patterns ---------------------------------------------------------------------------

_SIN_LETRA_ANTES = r"(?<![a-z0-9])"
_SIN_LETRA_DESPUES = r"(?![a-z0-9])"
_PLURAL = r"(?:s|es)?"


def _alternativas(palabras: tuple[str, ...]) -> str:
    # Longest first, so «castana de caju» wins over «caju».
    return "|".join(re.escape(p) for p in sorted(palabras, key=len, reverse=True))


def _compilar_codigo(codigo: str) -> re.Pattern[str]:
    partes = [f"(?:{_alternativas(PALABRAS_CLAVE[codigo])}){_PLURAL}"] if codigo in PALABRAS_CLAVE else []
    partes.extend(PATRONES_CLAVE.get(codigo, ()))
    return re.compile(f"{_SIN_LETRA_ANTES}(?:{'|'.join(partes)}){_SIN_LETRA_DESPUES}")


_PATRONES_CODIGO = {codigo: _compilar_codigo(codigo) for codigo in PALABRAS_CLAVE}
_FRASES_TRAZAS = re.compile(
    f"{_SIN_LETRA_ANTES}(?:{'|'.join(f'(?:{frase})' for frase in FRASES_TRAZAS)}){_SIN_LETRA_DESPUES}"
)
_FIN_DE_FRASE = re.compile(r"\.(?:\s|$)")

_RELLENOS = "|".join(re.escape(r) for r in sorted(RELLENOS_NEGACION, key=len, reverse=True))
# «sin gluten», «libre de gluten», «sin gluten ni lactosa»: the text before the word ends with a
# negation, optional filler words, and any earlier words of a «... ni ...» list.
_NEGACION_ANTES = re.compile(
    f"{_SIN_LETRA_ANTES}(?:{'|'.join(NEGACIONES)}) (?:(?:{_RELLENOS}) )*"
    r"(?:[a-z]+(?: [a-z]+)? ni )*$"
)

_CALIFICADOR_LECHE = re.compile(
    rf"^ de (?:(?:la|las|los) )?(?P<q>{_alternativas(CALIFICADORES_LECHE_VEGETAL)}){_PLURAL}{_SIN_LETRA_DESPUES}"
)
_CALIFICADOR_CUBIERTO = re.compile(
    rf"^ de (?:(?:la|las|los) )?(?P<q>{_alternativas(CALIFICADORES_CUBIERTOS)}){_PLURAL}{_SIN_LETRA_DESPUES}"
)
_CALIFICADOR_A_REVISAR = re.compile(
    rf"^ de (?:(?:la|las|los) )?(?P<q>{_alternativas(CALIFICADORES_A_REVISAR)}){_PLURAL}{_SIN_LETRA_DESPUES}"
)
_PALABRA_LACTEA_CALIFICABLE = re.compile(
    f"^(?:{_alternativas(PALABRAS_LACTEAS_CALIFICABLES)}){_PLURAL}$"
)
_AMBIGUAS = {
    palabra: re.compile(f"{_SIN_LETRA_ANTES}{re.escape(palabra)}{_PLURAL}{_SIN_LETRA_DESPUES}")
    for palabra in AMBIGUAS
}
_ESPECIFICADA = re.compile(r"^ de [a-z]")


# --- the text ------------------------------------------------------------------------------------


@dataclass
class _Hallazgo:
    codigo: str
    posicion: int
    en_trazas: bool


def _zonas_de_trazas(texto: str) -> list[tuple[int, int]]:
    """Spans after a «may contain» phrase, up to the next full stop (or the end)."""
    zonas = []
    for frase in _FRASES_TRAZAS.finditer(texto):
        fin = _FIN_DE_FRASE.search(texto, frase.end())
        zonas.append((frase.start(), fin.start() if fin else len(texto)))
    return zonas


def _en_alguna_zona(posicion: int, zonas: list[tuple[int, int]]) -> bool:
    return any(inicio <= posicion < fin for inicio, fin in zonas)


def _es_no_negable(palabra: str) -> bool:
    return any(palabra in (base, base + "s", base + "es") for base in NO_NEGABLES)


def _negada(texto: str, inicio: int) -> bool:
    return _NEGACION_ANTES.search(texto[:inicio]) is not None


def _buscar_en_texto(texto: str) -> tuple[list[_Hallazgo], list[tuple[str, str]]]:
    """Allergens found in the text, and the doubtful phrases as (phrase, code it might stand for)."""
    zonas = _zonas_de_trazas(texto)
    hallazgos: list[_Hallazgo] = []
    dudosas: list[tuple[str, str]] = []

    for codigo, patron in _PATRONES_CODIGO.items():
        for coincidencia in patron.finditer(texto):
            palabra = coincidencia.group(0)
            resto = texto[coincidencia.end() :]

            if not _es_no_negable(palabra) and _negada(texto, coincidencia.start()):
                continue

            ignorar = IGNORAR_SI_SIGUE.get(palabra)
            if ignorar is not None and re.match(ignorar, resto):
                continue

            if codigo == CODIGO_LACTEOS and _PALABRA_LACTEA_CALIFICABLE.match(palabra):
                if palabra.startswith("leche"):
                    vegetal = _CALIFICADOR_LECHE.match(resto)
                    if vegetal:
                        frase = texto[coincidencia.start() : coincidencia.end() + vegetal.end()]
                        dudosas.append((frase, CODIGO_LACTEOS))
                        continue
                else:
                    if _CALIFICADOR_CUBIERTO.match(resto):
                        continue
                    a_revisar = _CALIFICADOR_A_REVISAR.match(resto)
                    if a_revisar:
                        frase = texto[coincidencia.start() : coincidencia.end() + a_revisar.end()]
                        dudosas.append((frase, CODIGO_LACTEOS))
                        continue

            hallazgos.append(
                _Hallazgo(codigo, coincidencia.start(), _en_alguna_zona(coincidencia.start(), zonas))
            )

    for palabra, patron in _AMBIGUAS.items():
        for coincidencia in patron.finditer(texto):
            if _negada(texto, coincidencia.start()):
                continue
            if _ESPECIFICADA.match(texto[coincidencia.end() :]):
                continue
            dudosas.append((coincidencia.group(0), AMBIGUAS[palabra]))

    hallazgos.sort(key=lambda h: h.posicion)
    return hallazgos, dudosas


# --- the result ----------------------------------------------------------------------------------


def _mapear_etiquetas(
    etiquetas: tuple[str, ...], sin_reconocer: list[str]
) -> list[str]:
    codigos = []
    for etiqueta in etiquetas:
        codigo = ETIQUETAS_OFF.get(etiqueta.strip().lower())
        if codigo is None:
            if etiqueta.strip() and etiqueta.strip() not in sin_reconocer:
                sin_reconocer.append(etiqueta.strip())
        else:
            codigos.append(codigo)
    return codigos


def detectar_alergenos(
    etiquetas_contiene: tuple[str, ...],
    etiquetas_trazas: tuple[str, ...],
    texto_ingredientes: str | None,
) -> Deteccion:
    """Suggest allergens from the labels of a source and its ingredient text.

    Returns the codes that the productor should compare with the package. Nothing here registers
    or reviews anything.
    """
    sin_reconocer: list[str] = []
    # code -> (class, origin); a dict keeps the order in which each allergen first appeared.
    contiene: dict[str, str] = {}
    trazas: dict[str, str] = {}

    for codigo in _mapear_etiquetas(tuple(etiquetas_contiene or ()), sin_reconocer):
        contiene.setdefault(codigo, ORIGEN_ETIQUETA)
    for codigo in _mapear_etiquetas(tuple(etiquetas_trazas or ()), sin_reconocer):
        if codigo not in contiene:
            trazas.setdefault(codigo, ORIGEN_ETIQUETA)

    if texto_ingredientes and texto_ingredientes.strip():
        texto = normalizar_texto(texto_ingredientes)
        hallazgos, dudosas = _buscar_en_texto(texto)

        for hallazgo in hallazgos:
            if hallazgo.en_trazas:
                continue
            # «Contains» from the text beats a trace from a label.
            trazas.pop(hallazgo.codigo, None)
            contiene.setdefault(hallazgo.codigo, ORIGEN_TEXTO)
        for hallazgo in hallazgos:
            if hallazgo.en_trazas and hallazgo.codigo not in contiene:
                trazas.setdefault(hallazgo.codigo, ORIGEN_TEXTO)

        for frase, codigo in dudosas:
            # A doubt about an allergen that is already suggested leaves nothing to decide.
            if codigo not in contiene and frase not in sin_reconocer:
                sin_reconocer.append(frase)

    return Deteccion(
        contiene=tuple(AlergenoDetectado(c, o) for c, o in contiene.items()),
        trazas=tuple(AlergenoDetectado(c, o) for c, o in trazas.items()),
        sin_reconocer=tuple(sin_reconocer),
    )
