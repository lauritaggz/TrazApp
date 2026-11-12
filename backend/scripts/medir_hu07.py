"""Measurement of the product lookup of HU07 against a reference set (T07-09, CA13).

For each row of `docs/test/validacion_hu07/referencia.csv` it runs the real flow:

- with a barcode: `FuenteCombinada` (Open Food Facts by code, completed with Jumbo only if the `gtin`
  matches), the same one the `consulta-codigo` route uses;
- when Open Food Facts does not find the code or fails: the search in Jumbo by "name brand", FIRST result, as the app
  offers (T07-08); the path used is recorded (code, name fallback, name);
- without a barcode: the search by name in Jumbo, taking the FIRST result (as a productor would pick it).

and records the final source, the allergens it proposes («contiene» / «puede contener»), whether the
ingredients are present, the total time and the error, if any. It then computes:

- recovery (% found, by path), accuracy (% correct among the found) and global (% correct over the total, CA13),
  where correct is the allergens of «contiene» AND of «puede contener» exactly as in the reference;
- % with ingredients (of the products whose reference has them);
- p90 of the time and % of lookups within 10 s (CA13: >= 70 % correct, >= 90 % within 10 s);
- a table of discrepancies by product.

Good citizen of the sources: a generic User-Agent (the one of the settings), NO retries, 2 s of pause after
every product that went to the network, and a local cache of every answer OUTSIDE the repository so that a
second run repeats no query. The time of a cached answer is the one measured when it was fetched.

Use (from `backend/`):

    python scripts/medir_hu07.py --estimar        # how many real queries it would make; touches no network
    python scripts/medir_hu07.py                  # runs the measurement (real queries!)
    python scripts/medir_hu07.py --limite 5       # only the first five products

It writes `resultados.csv` and `resultados.md` (metrics and the discrepancy table) in docs/test/validacion_hu07.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import math
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

import httpx

RAIZ_BACKEND = Path(__file__).resolve().parents[1]
if str(RAIZ_BACKEND) not in sys.path:
    sys.path.insert(0, str(RAIZ_BACKEND))

from app.core.alergenos_palabras import PALABRAS_CLAVE  # noqa: E402
from app.core.codigo_barras import formas_equivalentes, validar_codigo_barras  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.services.recuperacion.alergenos import Deteccion, detectar_alergenos, normalizar_texto  # noqa: E402
from app.services.recuperacion.base import FuenteNoDisponibleError  # noqa: E402
from app.services.recuperacion.combinacion import combinar_alergenos  # noqa: E402
from app.services.recuperacion.combinada import FuenteCombinada  # noqa: E402
from app.services.recuperacion.jumbo import JumboFuente  # noqa: E402
from app.services.recuperacion.modelos import ProductoFuente  # noqa: E402
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente  # noqa: E402

REFERENCIA_POR_DEFECTO = RAIZ_BACKEND.parent / "docs" / "test" / "validacion_hu07" / "referencia.csv"
SALIDA_POR_DEFECTO = REFERENCIA_POR_DEFECTO.parent
CACHE_POR_DEFECTO = Path.home() / ".cache" / "trazapp" / "validacion_hu07"
PAUSA_POR_DEFECTO = 2.0
LIMITE_DE_TIEMPO = 10.0
UMBRAL_CORRECTAS = 70.0
UMBRAL_EN_TIEMPO = 90.0
NO_INDICA = "no_indica"

# The way a product was looked for (the flow of the app, T07-08).
CAMINO_CODIGO = "codigo"
CAMINO_RESPALDO = "respaldo_nombre"
CAMINO_NOMBRE = "nombre"
CAMINOS = (CAMINO_CODIGO, CAMINO_RESPALDO, CAMINO_NOMBRE)

# How a catalog allergen is shown.
NOMBRE_VISIBLE = {
    "gluten": "Gluten", "crustaceos": "Crustáceos", "huevos": "Huevo", "pescado": "Pescado", "cacahuetes": "Maní",
    "soja": "Soya", "lacteos": "Leche", "frutos_cascara": "Nueces", "sulfitos": "Sulfitos", "apio": "Apio",
    "mostaza": "Mostaza", "sesamo": "Sésamo", "altramuces": "Altramuces", "moluscos": "Moluscos",
}  # fmt: skip

MOTIVO_DISTINTO = "producto distinto"
CAUSA_SIN_DATO = "fuente sin dato"
CAUSA_DATO_INCORRECTO = "dato incorrecto de la fuente"
CAUSA_DETECTOR = "detector no reconoce el término"
PRIMERA_CORRIDA_POR_DEFECTO = REFERENCIA_POR_DEFECTO.parent / "resultados_primera_corrida.csv"
REVISION_POR_DEFECTO = REFERENCIA_POR_DEFECTO.parent / "revision_identidad.csv"

NOMBRES_DE_CAMINO = {
    CAMINO_CODIGO: "Por código",
    CAMINO_RESPALDO: "Respaldo por nombre (el código no se encontró o la fuente falló)",
    CAMINO_NOMBRE: "Por nombre (sin código)",
}

# One User-Agent for every source, from the settings. False: the generic one of Jumbo; True: the one of Open Food
# Facts, which also carries the URL of the repository.
USER_AGENT_CON_URL = False

COLUMNAS = (
    "id,nombre,marca,codigo_barras,contiene,puede_contener,tiene_ingredientes,tipo_referencia,fecha,notas"
).split(",")

# The allergens of the catalog (codes), to catch a typo in the reference before measuring.
CODIGOS_DEL_CATALOGO = frozenset(
    {
        "gluten", "crustaceos", "huevos", "pescado", "cacahuetes", "soja", "lacteos",
        "frutos_cascara", "sulfitos", "apio", "mostaza", "sesamo", "altramuces", "moluscos",
    }
)  # fmt: skip

# The names of the catalog as the producer sees them (migrations 009 and 011) -> its code.
NOMBRES_DEL_CATALOGO = {
    "gluten": "gluten", "crustaceos": "crustaceos", "huevo": "huevos", "pescado": "pescado", "mani": "cacahuetes",
    "soya": "soja", "leche": "lacteos", "nueces": "frutos_cascara", "sulfitos": "sulfitos", "apio": "apio",
    "mostaza": "mostaza", "sesamo": "sesamo", "altramuces": "altramuces", "moluscos": "moluscos",
}  # fmt: skip

# Queries per product, at most: Open Food Facts twice (a 12-digit code is asked again as EAN-13) + the search in
# Jumbo + up to three sheets (FuenteCombinada.MAX_CANDIDATOS). Without barcode: the search and one sheet.
MAX_CONSULTAS_CON_CODIGO = 6
MAX_CONSULTAS_CON_CODIGO_EAN13 = 5
MAX_CONSULTAS_SIN_CODIGO = 2


# --- the reference -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class FilaReferencia:
    id: str
    nombre: str
    marca: str
    codigo_barras: str
    contiene: frozenset[str]
    puede_contener: frozenset[str]
    tiene_ingredientes: bool
    tipo_referencia: str
    fecha: str
    notas: str

    @property
    def es_ejemplo(self) -> bool:
        return self.id.lower().startswith("ejemplo")


def _sin_acentos(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", texto.strip().casefold())
    return "".join(letra for letra in descompuesto if unicodedata.category(letra) != "Mn")


def _codigos(texto: str) -> tuple[frozenset[str], list[str]]:
    """The catalog codes of a «;» list written with the catalog names (or the codes); and what is not in it."""
    codigos: set[str] = set()
    desconocidos: list[str] = []
    for parte in texto.split(";"):
        if not parte.strip():
            continue
        clave = _sin_acentos(parte)
        codigo = NOMBRES_DEL_CATALOGO.get(clave) or (clave if clave in CODIGOS_DEL_CATALOGO else None)
        if codigo is None:
            desconocidos.append(parte.strip())
        else:
            codigos.add(codigo)
    return frozenset(codigos), desconocidos


def leer_referencia(ruta: Path, incluir_ejemplos: bool = False) -> list[FilaReferencia]:
    """The rows of the reference. The example rows are left out unless asked for. A malformed row stops the run."""
    filas: list[FilaReferencia] = []
    with ruta.open(encoding="utf-8", newline="") as archivo:
        lector = csv.DictReader(archivo)
        faltan = [columna for columna in COLUMNAS if columna not in (lector.fieldnames or [])]
        if faltan:
            raise ValueError(f"Faltan columnas en la referencia: {', '.join(faltan)}")
        errores: list[str] = []
        for numero, registro in enumerate(lector, start=2):
            try:
                fila = _fila(registro, numero)
            except ValueError as exc:
                errores.append(str(exc))
                continue
            if fila.es_ejemplo and not incluir_ejemplos:
                continue
            filas.append(fila)
        if errores:
            raise ValueError("\n".join(errores))
    ids = [fila.id for fila in filas]
    if len(ids) != len(set(ids)):
        raise ValueError("Hay ids repetidos en la referencia.")
    return filas


def _fila(registro: dict[str, str], numero: int) -> FilaReferencia:
    def campo(nombre: str) -> str:
        return (registro.get(nombre) or "").strip()

    if not campo("id") or not campo("nombre"):
        raise ValueError(f"Línea {numero}: faltan el id o el nombre.")
    codigo = campo("codigo_barras")
    if codigo:
        try:
            validar_codigo_barras(codigo)
        except ValueError as exc:
            raise ValueError(f"Línea {numero}: código de barras no válido ({exc}).") from exc
    contiene, mal_contiene = _codigos(campo("contiene"))
    crudo = campo("puede_contener")
    if not crudo:
        raise ValueError(f"Línea {numero}: puede_contener va con alérgenos del catálogo o «{NO_INDICA}».")
    puede_contener, mal_puede = (frozenset(), []) if crudo == NO_INDICA else _codigos(crudo)
    desconocidos = mal_contiene + mal_puede
    if desconocidos:
        raise ValueError(f"Línea {numero}: alérgenos fuera del catálogo: {', '.join(desconocidos)}.")
    if campo("tiene_ingredientes") not in ("si", "no"):
        raise ValueError(f"Línea {numero}: tiene_ingredientes va con «si» o «no».")
    return FilaReferencia(
        id=campo("id"),
        nombre=campo("nombre"),
        marca=campo("marca"),
        codigo_barras=codigo,
        contiene=contiene,
        puede_contener=puede_contener,
        tiene_ingredientes=campo("tiene_ingredientes") == "si",
        tipo_referencia=campo("tipo_referencia"),
        fecha=campo("fecha"),
        notas=campo("notas"),
    )


def estimar_consultas(filas: list[FilaReferencia]) -> dict[str, int]:
    """The real queries the run would make, at most (a cache hit costs none)."""
    con_codigo = [fila for fila in filas if fila.codigo_barras]
    ean13 = sum(1 for fila in con_codigo if len(fila.codigo_barras) == 13)
    otros = len(con_codigo) - ean13
    sin_codigo = len(filas) - len(con_codigo)
    return {
        "productos": len(filas),
        "con_codigo": len(con_codigo),
        "sin_codigo": sin_codigo,
        "maximo": ean13 * MAX_CONSULTAS_CON_CODIGO_EAN13
        + otros * MAX_CONSULTAS_CON_CODIGO
        + sin_codigo * MAX_CONSULTAS_SIN_CODIGO,
    }


# --- the result of one product -----------------------------------------------------------------------------


@dataclass
class Resultado:
    id: str
    encontrado: bool = False
    fuente: str = ""
    contiene: frozenset[str] = frozenset()
    trazas: frozenset[str] = frozenset()
    sin_reconocer: tuple[str, ...] = ()
    ingredientes: bool = False
    camino: str = ""
    # The product that came back (T07-09): to see whether it is the one that was asked for.
    nombre_recuperado: str = ""
    gtin_recuperado: str = ""
    mismo_producto: str = ""  # «si» / «no» / «» (not checked: the path by name is reviewed by hand)
    # Everything the source said, normalized, and where each detected allergen came from: for the cause of a gap.
    evidencia: str = ""
    origenes: dict[str, str] = field(default_factory=dict)
    tiempo: float = 0.0
    consultas_reales: int = 0
    error: str = ""


def detalle_alergenos(producto: ProductoFuente) -> Deteccion:
    """The detection the proposal would carry, exactly as the service computes it."""
    if producto.fuentes_campos:
        return combinar_alergenos(detectar_alergenos, producto)
    return detectar_alergenos(producto.etiquetas_alergenos, producto.etiquetas_trazas, producto.ingredientes)


def evidencia_de(producto: ProductoFuente) -> str:
    """Everything the source said about ingredients and allergens, normalized."""
    partes = [producto.ingredientes or "", *producto.trazas_texto, *producto.etiquetas_alergenos, *producto.etiquetas_trazas]
    return normalizar_texto(" ".join(partes))


def alergenos_de(producto: ProductoFuente) -> tuple[frozenset[str], frozenset[str], tuple[str, ...]]:
    """The allergens the proposal would carry, exactly as the service computes them."""
    deteccion = detalle_alergenos(producto)
    return (
        frozenset(a.codigo for a in deteccion.contiene),
        frozenset(a.codigo for a in deteccion.trazas),
        tuple(deteccion.sin_reconocer),
    )


# --- the cache and the network -----------------------------------------------------------------------------


class TransporteConCache(httpx.BaseTransport):
    """Answers from the local cache when it can; otherwise asks the network once, with no retries, and keeps it.

    Only definite answers (2xx and 404) are kept: a 429, a 5xx or a timeout must be asked again next time.
    `tiempo` accumulates the time of the answers (measured when fetched, recorded when replayed).
    """

    def __init__(self, carpeta: Path, real: httpx.BaseTransport | None = None) -> None:
        self.carpeta = carpeta
        self.carpeta.mkdir(parents=True, exist_ok=True)
        self._real = real or httpx.HTTPTransport()
        self.consultas_reales = 0
        self.aciertos = 0
        self.tiempo = 0.0

    @staticmethod
    def _clave(request: httpx.Request) -> str:
        huella = hashlib.sha256(f"{request.method} {request.url}".encode() + request.content).hexdigest()
        return huella

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        archivo = self.carpeta / f"{self._clave(request)}.json"
        if archivo.exists():
            datos = json.loads(archivo.read_text(encoding="utf-8"))
            self.aciertos += 1
            self.tiempo += float(datos["duracion"])
            return httpx.Response(
                datos["status"],
                headers={"content-type": datos["content_type"]},
                content=base64.b64decode(datos["contenido"]),
                request=request,
            )
        inicio = time.monotonic()
        respuesta = self._real.handle_request(request)
        contenido = respuesta.read()
        duracion = time.monotonic() - inicio
        self.consultas_reales += 1
        self.tiempo += duracion
        tipo = respuesta.headers.get("content-type", "application/octet-stream")
        if respuesta.status_code < 300 or respuesta.status_code == 404:
            archivo.write_text(
                json.dumps(
                    {
                        "solicitud": f"{request.method} {request.url}",
                        "status": respuesta.status_code,
                        "content_type": tipo,
                        "duracion": duracion,
                        "contenido": base64.b64encode(contenido).decode(),
                    }
                ),
                encoding="utf-8",
            )
        return httpx.Response(respuesta.status_code, headers={"content-type": tipo}, content=contenido, request=request)

    def close(self) -> None:
        self._real.close()


@dataclass
class Fuentes:
    combinada: FuenteCombinada
    jumbo: JumboFuente
    transporte: TransporteConCache
    settings: Settings = field(default_factory=lambda: Settings(_env_file=None))


def construir_fuentes(carpeta_cache: Path, settings: Settings | None = None) -> Fuentes:
    settings = settings or Settings(_env_file=None)
    agente = settings.off_user_agent if USER_AGENT_CON_URL else settings.jumbo_user_agent
    settings = settings.model_copy(update={"off_user_agent": agente, "jumbo_user_agent": agente})
    transporte = TransporteConCache(carpeta_cache)
    jumbo = JumboFuente(settings, transport=transporte)
    combinada = FuenteCombinada(
        OpenFoodFactsFuente(settings, transport=transporte),
        jumbo,
        presupuesto=settings.recuperacion_presupuesto_seconds,
    )
    return Fuentes(combinada=combinada, jumbo=jumbo, transporte=transporte, settings=settings)


def producto_por_nombre(fila: FilaReferencia, jumbo: JumboFuente) -> ProductoFuente | None:
    """The search by name, taking the first result, as the screen of «Buscar por nombre» would."""
    texto = " ".join(parte for parte in (fila.nombre, fila.marca) if parte)
    resultados = jumbo.buscar_por_nombre(texto)
    if not resultados:
        return None
    producto = jumbo.obtener(resultados[0])
    if producto is None:
        return None
    campos = {
        campo: "jumbo"
        for campo, valor in (
            ("nombre", producto.nombre),
            ("marca_origen", producto.marca),
            ("presentacion", producto.presentacion),
            ("ingredientes_declarados", producto.ingredientes),
        )
        if valor
    }
    if producto.trazas_texto:
        campos["trazas_texto"] = "jumbo"
    return replace(producto, fuente="jumbo", fuentes_campos=campos)


def _mismo_producto(fila: FilaReferencia, resultado: Resultado) -> str:
    """By the code the product is the one asked for; in the name fallback its gtin must be the reference's."""
    if resultado.camino == CAMINO_CODIGO:
        return "si"
    if resultado.camino == CAMINO_RESPALDO:
        gtin = resultado.gtin_recuperado
        return "si" if gtin and gtin in formas_equivalentes(fila.codigo_barras) else "no"
    return ""


class _ErrorDeMedicion(Exception):
    """A failure already described for the record (the path that failed is in the message)."""


def medir_fila(fila: FilaReferencia, fuentes: Fuentes) -> Resultado:
    """Runs the flow of one product and records what it proposes. A failure of a source is recorded, not raised."""
    resultado = Resultado(id=fila.id)
    transporte = fuentes.transporte
    tiempo_antes, reales_antes = transporte.tiempo, transporte.consultas_reales
    try:
        if fila.codigo_barras:
            resultado.camino = CAMINO_CODIGO
            producto = None
            error_codigo = ""
            try:
                producto = fuentes.combinada.buscar(fila.codigo_barras)
            except FuenteNoDisponibleError as exc:
                error_codigo = f"fuente no disponible: {exc.motivo}"
            if producto is None:
                # As the app does (T07-08): the code is not found (or the source failed), so it searches by name.
                resultado.camino = CAMINO_RESPALDO
                try:
                    producto = producto_por_nombre(fila, fuentes.jumbo)
                except FuenteNoDisponibleError as exc:
                    detalle = f"respaldo por nombre: fuente no disponible: {exc.motivo}"
                    raise _ErrorDeMedicion(f"{error_codigo}; {detalle}" if error_codigo else detalle) from exc
                if producto is None and error_codigo:
                    resultado.error = error_codigo
        else:
            resultado.camino = CAMINO_NOMBRE
            producto = producto_por_nombre(fila, fuentes.jumbo)
        if producto is not None:
            resultado.encontrado = True
            resultado.fuente = producto.fuente or "open_food_facts"
            deteccion = detalle_alergenos(producto)
            resultado.contiene = frozenset(a.codigo for a in deteccion.contiene)
            resultado.trazas = frozenset(a.codigo for a in deteccion.trazas)
            resultado.sin_reconocer = tuple(deteccion.sin_reconocer)
            resultado.origenes = {
                **{f"contiene:{a.codigo}": a.origen for a in deteccion.contiene},
                **{f"trazas:{a.codigo}": a.origen for a in deteccion.trazas},
            }
            resultado.ingredientes = bool((producto.ingredientes or "").strip())
            resultado.nombre_recuperado = producto.nombre or ""
            resultado.gtin_recuperado = producto.codigo_barras or ""
            resultado.mismo_producto = _mismo_producto(fila, resultado)
            resultado.evidencia = evidencia_de(producto)
    except _ErrorDeMedicion as exc:
        resultado.error = str(exc)
    except FuenteNoDisponibleError as exc:
        resultado.error = f"fuente no disponible: {exc.motivo}"
    except Exception as exc:  # noqa: BLE001 - a measurement must report a failure, not stop at it
        resultado.error = f"{type(exc).__name__}: {exc}"
    resultado.tiempo = transporte.tiempo - tiempo_antes
    resultado.consultas_reales = transporte.consultas_reales - reales_antes
    return resultado


# --- the metrics -------------------------------------------------------------------------------------------


def percentil(valores: list[float], porcentaje: float) -> float:
    """Nearest-rank percentile (the smallest value with at least `porcentaje` % of the values at or below it)."""
    if not valores:
        return 0.0
    ordenados = sorted(valores)
    posicion = max(1, math.ceil(porcentaje / 100 * len(ordenados)))
    return ordenados[posicion - 1]


@dataclass(frozen=True)
class Discrepancia:
    id: str
    nombre: str
    campo: str
    esperado: str
    obtenido: str
    fuente: str


def _texto(codigos: frozenset[str]) -> str:
    return ";".join(sorted(codigos)) if codigos else NO_INDICA


def calcular_metricas(
    filas: list[FilaReferencia], resultados: list[Resultado], corregir_distintos: bool = False
) -> tuple[dict[str, Any], list[Discrepancia]]:
    """The metrics of CA13 and the discrepancies by product. A product that was not found or failed is incorrect.

    With `corregir_distintos`, a product of the name fallback whose gtin is not the reference's counts as not found
    (and its sheet as incorrect): the official metric of CA13 is the one WITHOUT this correction.
    """
    if corregir_distintos:
        resultados = [
            replace(resultado, encontrado=False, error=MOTIVO_DISTINTO) if resultado.mismo_producto == "no" else resultado
            for resultado in resultados
        ]
    por_id = {resultado.id: resultado for resultado in resultados}
    discrepancias: list[Discrepancia] = []
    correctas = 0
    con_referencia_de_ingredientes = 0
    con_ingredientes = 0
    for fila in filas:
        resultado = por_id[fila.id]
        if fila.tiene_ingredientes:
            con_referencia_de_ingredientes += 1
        if not resultado.encontrado:
            if resultado.error == MOTIVO_DISTINTO:
                esperado, motivo = "mismo producto", f"{MOTIVO_DISTINTO}: {resultado.nombre_recuperado} (gtin {resultado.gtin_recuperado or 'sin gtin'})"
            else:
                esperado, motivo = "encontrado", resultado.error or "no encontrado"
            discrepancias.append(Discrepancia(fila.id, fila.nombre, "producto", esperado, motivo, resultado.fuente))
            continue
        exacto = True
        if resultado.contiene != fila.contiene:
            exacto = False
            discrepancias.append(
                Discrepancia(fila.id, fila.nombre, "contiene", _texto(fila.contiene), _texto(resultado.contiene), resultado.fuente)
            )
        if resultado.trazas != fila.puede_contener:
            exacto = False
            discrepancias.append(
                Discrepancia(
                    fila.id, fila.nombre, "puede_contener", _texto(fila.puede_contener), _texto(resultado.trazas), resultado.fuente
                )
            )
        correctas += exacto
        if fila.tiene_ingredientes:
            if resultado.ingredientes:
                con_ingredientes += 1
            else:
                discrepancias.append(Discrepancia(fila.id, fila.nombre, "ingredientes", "si", "no", resultado.fuente))
    total = len(filas)
    tiempos = [resultado.tiempo for resultado in resultados if resultado.id in {fila.id for fila in filas}]
    en_tiempo = sum(1 for tiempo in tiempos if tiempo <= LIMITE_DE_TIEMPO)
    pct = lambda parte, todo: round(100.0 * parte / todo, 1) if todo else 0.0  # noqa: E731
    encontrados = sum(1 for fila in filas if por_id[fila.id].encontrado)
    por_camino: dict[str, dict[str, Any]] = {}
    for camino in CAMINOS:
        del_camino = [por_id[fila.id] for fila in filas if por_id[fila.id].camino == camino]
        if del_camino:
            hallados = sum(1 for resultado in del_camino if resultado.encontrado)
            por_camino[camino] = {"total": len(del_camino), "encontrados": hallados, "pct": pct(hallados, len(del_camino))}
    metricas = {
        "productos": total,
        "encontrados": encontrados,
        "pct_recuperacion": pct(encontrados, total),
        "por_camino": por_camino,
        "correctas": correctas,
        "pct_exactitud": pct(correctas, encontrados),
        "pct_correctas": pct(correctas, total),
        "con_ingredientes": con_ingredientes,
        "referencia_con_ingredientes": con_referencia_de_ingredientes,
        "pct_con_ingredientes": pct(con_ingredientes, con_referencia_de_ingredientes),
        "p90_segundos": round(percentil(tiempos, 90), 2),
        "en_tiempo": en_tiempo,
        "pct_en_tiempo": pct(en_tiempo, total),
        "cumple_correctas": pct(correctas, total) >= UMBRAL_CORRECTAS,
        "cumple_tiempo": pct(en_tiempo, total) >= UMBRAL_EN_TIEMPO,
    }
    return metricas, discrepancias


def resumen_md(
    metricas: dict[str, Any], discrepancias: list[Discrepancia], consultas: dict[str, int], comparacion: str = "", clasificacion: str = ""
) -> str:
    def marca(cumple: bool) -> str:
        return "cumple" if cumple else "NO cumple"

    lineas = [
        "# Medición de HU07 (T07-09, CA13)",
        "",
        "La medición replica el flujo de la aplicación: con código, Open Food Facts completado con Jumbo si el "
        "código coincide; si no lo encuentra o falla, busca en Jumbo por «nombre marca» y toma el primer resultado; "
        "sin código, la búsqueda por nombre.",
        "",
        f"Productos medidos: {metricas['productos']} (encontrados: {metricas['encontrados']}).",
        f"Consultas reales: {consultas['reales']}; respuestas desde la caché: {consultas['cache']}.",
        "",
        *([comparacion] if comparacion else []),
        "## Esta corrida (identidad verificada)" if comparacion else "## Métricas",
        "",
        "| Métrica | Resultado | Meta |",
        "|---|---|---|",
        f"| Recuperación (productos encontrados) | {_pct(metricas['pct_recuperacion'])} "
        f"({metricas['encontrados']}/{metricas['productos']}) | — |",
        f"| Exactitud (correctas entre los encontrados) | {_pct(metricas['pct_exactitud'])} "
        f"({metricas['correctas']}/{metricas['encontrados']}) | — |",
        f"| **Global** (correctas sobre el total; contiene y puede contener exactos) | {_pct(metricas['pct_correctas'])} "
        f"({metricas['correctas']}/{metricas['productos']}) | ≥ {UMBRAL_CORRECTAS:.0f} % — {marca(metricas['cumple_correctas'])} |",
        f"| Con ingredientes (de los que la referencia dice que los tienen) | {_pct(metricas['pct_con_ingredientes'])} "
        f"({metricas['con_ingredientes']}/{metricas['referencia_con_ingredientes']}) | — |",
        f"| Tiempo p90 | {_pct_s(metricas['p90_segundos'])} | — |",
        f"| Consultas dentro de {LIMITE_DE_TIEMPO:.0f} s | {_pct(metricas['pct_en_tiempo'])} "
        f"({metricas['en_tiempo']}/{metricas['productos']}) | ≥ {UMBRAL_EN_TIEMPO:.0f} % — {marca(metricas['cumple_tiempo'])} |",
        "",
        "## Recuperación por camino",
        "",
        "| Camino | Encontrados | % |",
        "|---|---|---|",
        *[
            f"| {NOMBRES_DE_CAMINO[camino]} | {datos['encontrados']}/{datos['total']} | {_pct(datos['pct'])} |"
            for camino, datos in metricas["por_camino"].items()
        ],
        "",
        "## Discrepancias por producto",
        "",
    ]
    if not discrepancias:
        lineas.append("Ninguna.")
    else:
        lineas += ["| Producto | Campo | Esperado | Obtenido | Fuente |", "|---|---|---|---|---|"]
        lineas += [
            f"| {d.id} · {d.nombre} | {d.campo} | {d.esperado} | {d.obtenido} | {d.fuente or '—'} |" for d in discrepancias
        ]
    texto = "\n".join(lineas) + "\n"
    return texto + ("\n" + clasificacion if clasificacion else "")


# --- what each discrepancy is and why --------------------------------------------------------------------


@dataclass(frozen=True)
class Clasificada:
    id: str
    nombre: str
    campo: str
    alergeno: str
    tipo: str  # omisión / exceso / producto distinto / no encontrado
    causa: str
    fuente: str


def _terminos(codigo: str) -> list[str]:
    nombre = normalizar_texto(NOMBRE_VISIBLE[codigo])
    return sorted({*PALABRAS_CLAVE.get(codigo, ()), nombre}, key=len, reverse=True)


def _nombra(codigo: str, evidencia: str) -> bool:
    """The text of the source names this allergen (by a keyword of the detector or by its catalog name)."""
    return any(re.search(rf"(?<![a-z0-9]){re.escape(t)}(?:s|es)?(?![a-z0-9])", evidencia) for t in _terminos(codigo))


def clasificar(filas: list[FilaReferencia], resultados: list[Resultado]) -> list[Clasificada]:
    """Every gap against the reference as omission (the package says it, the sheet does not), excess (the sheet
    says one the package does not) or different product, with the probable cause."""
    por_id = {resultado.id: resultado for resultado in resultados}
    filas_clasificadas: list[Clasificada] = []
    for fila in filas:
        r = por_id[fila.id]
        if not r.encontrado:
            filas_clasificadas.append(Clasificada(fila.id, fila.nombre, "producto", "—", "no encontrado", r.error or "—", r.fuente))
            continue
        if r.mismo_producto == "no":
            filas_clasificadas.append(
                Clasificada(fila.id, fila.nombre, "producto", "—", MOTIVO_DISTINTO, "el primer resultado de la búsqueda no es el producto", r.fuente)
            )
            continue
        campos = (
            ("contiene", fila.contiene, r.contiene, fila.puede_contener, r.trazas),
            ("puede_contener", fila.puede_contener, r.trazas, fila.contiene, r.contiene),
        )
        for campo, esperado, obtenido, esperado_otro, obtenido_otro in campos:
            for codigo in sorted(esperado - obtenido):
                if codigo in obtenido_otro:
                    causa = f"{CAUSA_DATO_INCORRECTO} (lo informa en la otra clase)"
                elif _nombra(codigo, r.evidencia):
                    causa = CAUSA_DETECTOR
                else:
                    causa = CAUSA_SIN_DATO + (" (ingredientes no visibles)" if "no visible" in r.evidencia else "")
                filas_clasificadas.append(Clasificada(fila.id, fila.nombre, campo, NOMBRE_VISIBLE[codigo], "omisión", causa, r.fuente))
            for codigo in sorted(obtenido - esperado):
                origen = r.origenes.get(f"{campo if campo == 'contiene' else 'trazas'}:{codigo}", "")
                if codigo in esperado_otro:
                    causa = f"{CAUSA_DATO_INCORRECTO} (la informa en la otra clase)"
                elif origen == "texto":
                    causa = f"{CAUSA_DATO_INCORRECTO} (su texto lo nombra)"
                else:
                    causa = CAUSA_DATO_INCORRECTO
                filas_clasificadas.append(Clasificada(fila.id, fila.nombre, campo, NOMBRE_VISIBLE[codigo], "exceso", causa, r.fuente))
    return filas_clasificadas


def clasificacion_md(clasificadas: list[Clasificada]) -> str:
    lineas = ["## Discrepancias clasificadas", ""]
    if not clasificadas:
        return "\n".join([*lineas, "Ninguna.", ""])
    lineas += ["| Producto | Campo | Alérgeno | Tipo | Causa probable | Fuente |", "|---|---|---|---|---|---|"]
    lineas += [f"| {c.id} | {c.campo} | {c.alergeno} | {c.tipo} | {c.causa} | {c.fuente or '—'} |" for c in clasificadas]
    lineas += ["", "### Resumen por tipo", "", "| Tipo | Cantidad |", "|---|---|"]
    for tipo in ("omisión", "exceso", MOTIVO_DISTINTO, "no encontrado"):
        cantidad = sum(1 for c in clasificadas if c.tipo == tipo)
        if cantidad:
            lineas.append(f"| {tipo} | {cantidad} |")
    omisiones = [c for c in clasificadas if c.tipo == "omisión" and c.campo == "contiene"]
    lineas += ["", "### Omisiones de «contiene» (lo más grave: el envase dice que lo contiene)", ""]
    if not omisiones:
        lineas.append("Ninguna.")
    else:
        lineas += ["| Producto | Alérgeno omitido | Causa probable | Fuente |", "|---|---|---|---|"]
        lineas += [f"| {c.id} | {c.alergeno} | {c.causa} | {c.fuente or '—'} |" for c in omisiones]
    return "\n".join(lineas) + "\n"


# --- the official metric, the corrected one and the improvement after the measurement ----------------------


def leer_corrida(ruta: Path) -> list[Resultado]:
    """The results of a run saved as `resultados.csv` (the first run is kept as the official one)."""
    resultados = []
    with ruta.open(encoding="utf-8", newline="") as archivo:
        for registro in csv.DictReader(archivo):
            def codigos(texto: str) -> frozenset[str]:
                return frozenset() if texto in ("", NO_INDICA) else frozenset(texto.split(";"))

            resultados.append(
                Resultado(
                    id=registro["id"], encontrado=registro["encontrado"] == "si", fuente=registro["fuente"],
                    contiene=codigos(registro["contiene"]), trazas=codigos(registro["puede_contener"]),
                    sin_reconocer=tuple(x for x in registro["sin_reconocer"].split(";") if x),
                    ingredientes=registro["ingredientes"] == "si", camino=registro.get("camino", ""),
                    tiempo=float(registro["tiempo_s"]), consultas_reales=int(registro["consultas_reales"]),
                    error=registro["error"],
                )
            )  # fmt: skip
    return resultados


def _con_marcas_de_producto(base: list[Resultado], actuales: list[Resultado]) -> list[Resultado]:
    """The first run with the «same product» mark of the current one (the retrieval is the same, from the cache)."""
    marcas = {resultado.id: resultado for resultado in actuales}
    return [
        replace(
            resultado,
            mismo_producto=marcas[resultado.id].mismo_producto,
            nombre_recuperado=marcas[resultado.id].nombre_recuperado,
            gtin_recuperado=marcas[resultado.id].gtin_recuperado,
        )
        for resultado in base
    ]


def _pct(valor: float) -> str:
    return f"{valor:.1f} %".replace(".", ",")


def _pct_s(segundos: float) -> str:
    return f"{segundos:.2f} s".replace(".", ",")


def comparacion_md(filas: list[FilaReferencia], primera: list[Resultado], actuales: list[Resultado]) -> str:
    """CA13 verifies the identity of the product: a sheet of another product is not correct even if the allergens
    match. The first run, before that check, is shown next to it, and then the improvement of the detector."""
    primera_marcada = _con_marcas_de_producto(primera, actuales)
    antes, _ = calcular_metricas(filas, primera)
    oficial, _ = calcular_metricas(filas, primera_marcada, corregir_distintos=True)
    mejorada, _ = calcular_metricas(filas, actuales, corregir_distintos=True)
    columnas = (antes, oficial, mejorada)

    def fila_de(nombre: str, clave: str) -> str:
        return f"| {nombre} | " + " | ".join(_pct(m[clave]) for m in columnas) + " |"

    distintos = [r for r in primera_marcada if r.mismo_producto == "no"]
    por_id_primera = {resultado.id: resultado for resultado in primera}
    exactos = {
        fila.id
        for fila in filas
        if por_id_primera[fila.id].encontrado
        and por_id_primera[fila.id].contiene == fila.contiene
        and por_id_primera[fila.id].trazas == fila.puede_contener
    }
    distintos_contados_correctos = [r for r in distintos if r.id in exactos]
    por_camino = {camino: [r for r in actuales if r.camino == camino] for camino in CAMINOS}
    lineas = [
        "## Resultado de CA13",
        "",
        f"**CA13 (fichas correctas, con la identidad del producto verificada): {_pct(oficial['pct_correctas'])}** "
        f"({oficial['correctas']}/{oficial['productos']}; meta ≥ {UMBRAL_CORRECTAS:.0f} %). Una ficha de otro producto no "
        "es correcta aunque coincidan los alérgenos. El valor **antes de verificar la identidad** fue "
        f"{_pct(antes['pct_correctas'])} ({antes['correctas']}/{antes['productos']}).",
        "",
        "| Métrica | Antes de verificar la identidad (1.ª corrida) | **CA13 oficial** (1.ª corrida, identidad verificada) | Con el detector mejorado (identidad verificada) |",
        "|---|---|---|---|",
        fila_de("Recuperación (encontrados)", "pct_recuperacion"),
        fila_de("Exactitud (correctas entre los encontrados)", "pct_exactitud"),
        fila_de("**Global** (correctas sobre el total)", "pct_correctas"),
        fila_de("Con ingredientes", "pct_con_ingredientes"),
        fila_de("Consultas dentro de 10 s", "pct_en_tiempo"),
        "| Tiempo p90 | " + " | ".join(_pct_s(m["p90_segundos"]) for m in columnas) + " |",
        "",
        "### Verificación de la identidad",
        "",
        f"- Por código ({len(por_camino[CAMINO_CODIGO])}): el código identifica el producto.",
        f"- Respaldo por nombre ({len(por_camino[CAMINO_RESPALDO])}): se compara el gtin recuperado con el código de la "
        f"referencia (un gtin vacío cuenta como distinto): {sum(r.mismo_producto == 'si' for r in por_camino[CAMINO_RESPALDO])} "
        f"coinciden y {sum(r.mismo_producto == 'no' for r in por_camino[CAMINO_RESPALDO])} no.",
        f"- Por nombre, sin código ({len(por_camino[CAMINO_NOMBRE])}): revisados a mano por la desarrolladora: "
        f"{sum(r.mismo_producto == 'si' for r in por_camino[CAMINO_NOMBRE])} son el mismo producto y "
        f"{sum(r.mismo_producto == 'no' for r in por_camino[CAMINO_NOMBRE])} no"
        + (f"; sin revisar: {sum(r.mismo_producto == '' for r in por_camino[CAMINO_NOMBRE])}." if any(r.mismo_producto == "" for r in por_camino[CAMINO_NOMBRE]) else "."),
        "",
        f"Productos distintos: **{len(distintos)}**"
        + (": " + ", ".join(f"`{r.id}` ({r.nombre_recuperado or 'sin nombre'}, gtin {r.gtin_recuperado or 'vacío'})" for r in distintos) if distintos else "."),
        "",
        f"- De ellos, contaban como correctos antes de verificar la identidad: **{len(distintos_contados_correctos)}**"
        + (": " + ", ".join(f"`{r.id}`" for r in distintos_contados_correctos) if distintos_contados_correctos else "."),
        f"- Global: {_pct(antes['pct_correctas'])} → {_pct(oficial['pct_correctas'])} "
        f"({oficial['correctas'] - antes['correctas']:+d} fichas correctas de {antes['productos']}).",
        f"- Recuperación: {_pct(antes['pct_recuperacion'])} → {_pct(oficial['pct_recuperacion'])}. "
        f"«Con ingredientes» también baja ({_pct(antes['pct_con_ingredientes'])} → {_pct(oficial['pct_con_ingredientes'])}) "
        "porque los ingredientes de un producto distinto no cuentan.",
        "",
        "### Mejoras posteriores a la medición (columna 3)",
        "",
        "Sobre las mismas respuestas guardadas en la caché (sin nuevas consultas); el valor oficial no cambia.",
        "",
    ]
    antes_sin_reconocer = [(r.id, r.sin_reconocer) for r in primera if r.sin_reconocer]
    despues_sin_reconocer = [(r.id, r.sin_reconocer) for r in actuales if r.sin_reconocer]
    lineas += [
        "1. **Etiquetas con prefijo de idioma** (`es:Maní`): ahora se traducen al alérgeno del catálogo.",
        f"   - Antes: {len(antes_sin_reconocer)} producto(s) con términos sin reconocer"
        + (": " + "; ".join(f"`{i}` → {', '.join(t)}" for i, t in antes_sin_reconocer) if antes_sin_reconocer else "."),
        f"   - Después: {len(despues_sin_reconocer)} producto(s) con términos sin reconocer"
        + (": " + "; ".join(f"`{i}` → {', '.join(t)}" for i, t in despues_sin_reconocer) if despues_sin_reconocer else "."),
        "2. **Especies de pescado y mariscos** (pejerrey, corvina, lenguado, albacora, tilapia, gamba, centolla, cholga, "
        "macha, sepia, caracol, etc., además de las que ya estaban: atún, salmón, jurel, merluza, reineta, camarón, "
        "chorito, jaiba): mejora general del detector.",
    ]
    actuales_por_id = {resultado.id: resultado for resultado in actuales}
    cambios = [
        (fila, por_id_primera[fila.id], actuales_por_id[fila.id])
        for fila in filas
        if (por_id_primera[fila.id].contiene, por_id_primera[fila.id].trazas)
        != (actuales_por_id[fila.id].contiene, actuales_por_id[fila.id].trazas)
    ]
    if cambios:
        lineas.append("   - Productos cuya ficha cambió:")
        for fila, previa, despues in cambios:
            lineas.append(
                f"     - `{fila.id}`: contiene {_texto(previa.contiene)} → {_texto(despues.contiene)}; "
                f"puede contener {_texto(previa.trazas)} → {_texto(despues.trazas)}"
            )
    else:
        lineas.append("   - Sin efecto en este conjunto: ninguna ficha cambió.")
    lineas += [
        "",
        f"Global con identidad verificada: {_pct(oficial['pct_correctas'])} (oficial) → {_pct(mejorada['pct_correctas'])} (detector mejorado).",
        "",
    ]
    return "\n".join(lineas) + "\n"


def revision_manual_md(filas: list[FilaReferencia], resultados: list[Resultado]) -> str:
    """The products found by name, which the developer reviews (no code to compare)."""
    por_id = {resultado.id: resultado for resultado in resultados}
    por_nombre = [(fila, por_id[fila.id]) for fila in filas if por_id[fila.id].camino == CAMINO_NOMBRE]
    if not por_nombre:
        return ""
    lineas = [
        "## Revisados a mano: productos recuperados por nombre",
        "",
        "Sin código no se puede verificar el gtin: la identidad viene de `revision_identidad.csv` (revisión a mano).",
        "",
        "| Referencia | Recuperado | gtin recuperado |",
        "|---|---|---|",
        *[f"| {fila.id} · {fila.nombre} {fila.marca} | {r.nombre_recuperado or '—'} | {r.gtin_recuperado or '—'} |" for fila, r in por_nombre],
    ]
    return "\n".join(lineas) + "\n"


# --- the run -----------------------------------------------------------------------------------------------


def _escribir_resultados(carpeta: Path, filas: list[FilaReferencia], resultados: list[Resultado]) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    por_id = {resultado.id: resultado for resultado in resultados}
    with (carpeta / "resultados.csv").open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(
            ["id", "nombre", "camino", "fuente", "encontrado", "nombre_recuperado", "gtin_recuperado", "mismo_producto", "contiene", "puede_contener", "sin_reconocer", "ingredientes", "tiempo_s", "consultas_reales", "error"]
        )
        for fila in filas:
            r = por_id[fila.id]
            escritor.writerow(
                [
                    r.id, fila.nombre, r.camino, r.fuente, "si" if r.encontrado else "no", r.nombre_recuperado, r.gtin_recuperado, r.mismo_producto, _texto(r.contiene), _texto(r.trazas),
                    ";".join(r.sin_reconocer), "si" if r.ingredientes else "no", f"{r.tiempo:.2f}", r.consultas_reales, r.error,
                ]
            )  # fmt: skip


def leer_revision_identidad(ruta: Path) -> dict[str, str]:
    """The identity of the products found by name, reviewed by hand: id -> «si» / «no» (columns id, mismo_producto)."""
    if not ruta.exists():
        return {}
    with ruta.open(encoding="utf-8", newline="") as archivo:
        revisiones = {r["id"].strip(): r["mismo_producto"].strip().lower() for r in csv.DictReader(archivo)}
    malas = {i: v for i, v in revisiones.items() if v not in ("si", "no")}
    if malas:
        raise ValueError(f"revision_identidad.csv: mismo_producto va con «si» o «no» ({', '.join(malas)}).")
    return revisiones


def aplicar_revision_identidad(resultados: list[Resultado], revisiones: dict[str, str]) -> list[Resultado]:
    """Marks the products found by name with the identity the developer reviewed (the others are not touched)."""
    return [
        replace(resultado, mismo_producto=revisiones[resultado.id])
        if resultado.camino == CAMINO_NOMBRE and resultado.id in revisiones
        else resultado
        for resultado in resultados
    ]


def _primera_corrida(ruta: Path, filas: list[FilaReferencia]) -> list[Resultado] | None:
    """The official first run, if it was kept and covers these products."""
    if not ruta.exists():
        return None
    resultados = leer_corrida(ruta)
    ids = {resultado.id for resultado in resultados}
    return resultados if all(fila.id in ids for fila in filas) else None


def ejecutar(args: argparse.Namespace) -> int:
    try:
        filas = leer_referencia(Path(args.referencia), incluir_ejemplos=args.incluir_ejemplos)
    except ValueError as exc:
        print(f"La referencia tiene errores:\n{exc}")
        return 1
    if args.validar:
        print(f"La referencia es válida: {len(filas)} productos.")
        return 0
    if args.limite:
        filas = filas[: args.limite]
    estimacion = estimar_consultas(filas)
    print(
        f"{estimacion['productos']} productos ({estimacion['con_codigo']} con código, {estimacion['sin_codigo']} sin código): "
        f"como máximo {estimacion['maximo']} consultas reales."
    )
    if args.estimar:
        return 0
    if not filas:
        print("La referencia no tiene filas para medir (las de ejemplo se omiten).")
        return 1

    cache = Path(args.cache)
    fuentes = construir_fuentes(cache)
    print(f"User-Agent: {fuentes.settings.off_user_agent} | {fuentes.settings.jumbo_user_agent}")
    print(f"Caché local: {cache}")
    resultados: list[Resultado] = []
    for posicion, fila in enumerate(filas, start=1):
        resultado = medir_fila(fila, fuentes)
        resultados.append(resultado)
        estado = resultado.error or ("ok" if resultado.encontrado else "no encontrado")
        print(f"[{posicion}/{len(filas)}] {fila.id}: {estado} [{resultado.camino}] ({resultado.tiempo:.1f} s, {resultado.consultas_reales} consultas reales)")
        if resultado.consultas_reales > 0 and posicion < len(filas):
            time.sleep(args.pausa)

    resultados = aplicar_revision_identidad(resultados, leer_revision_identidad(Path(args.revision_identidad)))
    # The metric of CA13 verifies the identity: a sheet of another product is not correct even if the allergens match.
    metricas, discrepancias = calcular_metricas(filas, resultados, corregir_distintos=True)
    consultas = {"reales": fuentes.transporte.consultas_reales, "cache": fuentes.transporte.aciertos}
    salida = Path(args.salida)
    _escribir_resultados(salida, filas, resultados)
    primera = _primera_corrida(Path(args.primera_corrida), filas)
    comparacion = comparacion_md(filas, primera, resultados) if primera else ""
    clasificacion = clasificacion_md(clasificar(filas, resultados)) + "\n" + revision_manual_md(filas, resultados)
    resumen = resumen_md(metricas, discrepancias, consultas, comparacion, clasificacion)
    (salida / "resultados.md").write_text(resumen, encoding="utf-8")
    print()
    print(resumen)
    print(f"Resultados en {salida}")
    return 0


def main() -> int:
    analizador = argparse.ArgumentParser(description="Mide el flujo de HU07 contra la referencia (T07-09).")
    analizador.add_argument("--referencia", default=str(REFERENCIA_POR_DEFECTO))
    analizador.add_argument("--cache", default=str(CACHE_POR_DEFECTO), help="Carpeta de la caché local (fuera del repositorio).")
    analizador.add_argument("--salida", default=str(SALIDA_POR_DEFECTO), help="Carpeta de resultados.")
    analizador.add_argument("--pausa", type=float, default=PAUSA_POR_DEFECTO, help="Segundos entre productos que usaron la red.")
    analizador.add_argument(
        "--primera-corrida", default=str(PRIMERA_CORRIDA_POR_DEFECTO), help="resultados.csv de la primera corrida (la oficial)."
    )
    analizador.add_argument(
        "--revision-identidad", default=str(REVISION_POR_DEFECTO), help="revision_identidad.csv: la revisión a mano del camino por nombre."
    )
    analizador.add_argument("--limite", type=int, default=0, help="Mide solo los primeros N productos.")
    analizador.add_argument("--incluir-ejemplos", action="store_true", help="Incluye las filas de ejemplo.")
    analizador.add_argument("--validar", action="store_true", help="Solo valida la referencia y termina.")
    analizador.add_argument("--estimar", action="store_true", help="Solo calcula cuántas consultas reales haría; no usa la red.")
    return ejecutar(analizador.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
