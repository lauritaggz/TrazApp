"""Measurement of the product lookup of HU07 against a reference set (T07-09, CA13).

For each row of `docs/validacion_hu07/referencia.csv` it runs the real flow:

- with a barcode: `FuenteCombinada` (Open Food Facts by code, completed with Jumbo only if the `gtin`
  matches), the same one the `consulta-codigo` route uses;
- without a barcode: the search by name in Jumbo, taking the FIRST result (as a productor would pick it).

and records the final source, the allergens it proposes («contiene» / «puede contener»), whether the
ingredients are present, the total time and the error, if any. It then computes:

- % of correct sheets (the allergens of «contiene» AND of «puede contener» exactly as in the reference);
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

It writes `resultados.csv`, `discrepancias.csv` and `resumen.md` in the output folder (outside the repo by default).
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import math
import sys
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

import httpx

RAIZ_BACKEND = Path(__file__).resolve().parents[1]
if str(RAIZ_BACKEND) not in sys.path:
    sys.path.insert(0, str(RAIZ_BACKEND))

from app.core.codigo_barras import validar_codigo_barras  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.services.recuperacion.alergenos import Deteccion, detectar_alergenos  # noqa: E402
from app.services.recuperacion.base import FuenteNoDisponibleError  # noqa: E402
from app.services.recuperacion.combinacion import combinar_alergenos  # noqa: E402
from app.services.recuperacion.combinada import FuenteCombinada  # noqa: E402
from app.services.recuperacion.jumbo import JumboFuente  # noqa: E402
from app.services.recuperacion.modelos import ProductoFuente  # noqa: E402
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente  # noqa: E402

REFERENCIA_POR_DEFECTO = RAIZ_BACKEND.parent / "docs" / "validacion_hu07" / "referencia.csv"
CACHE_POR_DEFECTO = Path.home() / ".cache" / "trazapp" / "validacion_hu07"
PAUSA_POR_DEFECTO = 2.0
LIMITE_DE_TIEMPO = 10.0
UMBRAL_CORRECTAS = 70.0
UMBRAL_EN_TIEMPO = 90.0
NO_INDICA = "no_indica"

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


def _codigos(texto: str) -> frozenset[str]:
    return frozenset(parte.strip() for parte in texto.split(";") if parte.strip())


def leer_referencia(ruta: Path, incluir_ejemplos: bool = False) -> list[FilaReferencia]:
    """The rows of the reference. The example rows are left out unless asked for. A malformed row stops the run."""
    filas: list[FilaReferencia] = []
    with ruta.open(encoding="utf-8", newline="") as archivo:
        lector = csv.DictReader(archivo)
        faltan = [columna for columna in COLUMNAS if columna not in (lector.fieldnames or [])]
        if faltan:
            raise ValueError(f"Faltan columnas en la referencia: {', '.join(faltan)}")
        for numero, registro in enumerate(lector, start=2):
            fila = _fila(registro, numero)
            if fila.es_ejemplo and not incluir_ejemplos:
                continue
            filas.append(fila)
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
    contiene = _codigos(campo("contiene"))
    crudo = campo("puede_contener")
    puede_contener = frozenset() if crudo == NO_INDICA else _codigos(crudo)
    if not crudo:
        raise ValueError(f"Línea {numero}: puede_contener va con códigos o «{NO_INDICA}».")
    desconocidos = (contiene | puede_contener) - CODIGOS_DEL_CATALOGO
    if desconocidos:
        raise ValueError(f"Línea {numero}: códigos fuera del catálogo: {', '.join(sorted(desconocidos))}.")
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
    tiempo: float = 0.0
    consultas_reales: int = 0
    error: str = ""


def alergenos_de(producto: ProductoFuente) -> tuple[frozenset[str], frozenset[str], tuple[str, ...]]:
    """The allergens the proposal would carry, exactly as the service computes them."""
    if producto.fuentes_campos:
        deteccion: Deteccion = combinar_alergenos(detectar_alergenos, producto)
    else:
        deteccion = detectar_alergenos(producto.etiquetas_alergenos, producto.etiquetas_trazas, producto.ingredientes)
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


def medir_fila(fila: FilaReferencia, fuentes: Fuentes) -> Resultado:
    """Runs the flow of one product and records what it proposes. A failure of a source is recorded, not raised."""
    resultado = Resultado(id=fila.id)
    transporte = fuentes.transporte
    tiempo_antes, reales_antes = transporte.tiempo, transporte.consultas_reales
    try:
        if fila.codigo_barras:
            producto = fuentes.combinada.buscar(fila.codigo_barras)
        else:
            producto = producto_por_nombre(fila, fuentes.jumbo)
        if producto is not None:
            resultado.encontrado = True
            resultado.fuente = producto.fuente or "open_food_facts"
            resultado.contiene, resultado.trazas, resultado.sin_reconocer = alergenos_de(producto)
            resultado.ingredientes = bool((producto.ingredientes or "").strip())
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
    filas: list[FilaReferencia], resultados: list[Resultado]
) -> tuple[dict[str, Any], list[Discrepancia]]:
    """The metrics of CA13 and the discrepancies by product. A product that was not found or failed is incorrect."""
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
            motivo = resultado.error or "no encontrado"
            discrepancias.append(Discrepancia(fila.id, fila.nombre, "producto", "encontrado", motivo, resultado.fuente))
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
    metricas = {
        "productos": total,
        "encontrados": sum(1 for fila in filas if por_id[fila.id].encontrado),
        "correctas": correctas,
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


def resumen_md(metricas: dict[str, Any], discrepancias: list[Discrepancia], consultas: dict[str, int]) -> str:
    def marca(cumple: bool) -> str:
        return "cumple" if cumple else "NO cumple"

    lineas = [
        "# Medición de HU07 (T07-09, CA13)",
        "",
        f"Productos medidos: {metricas['productos']} (encontrados: {metricas['encontrados']}).",
        f"Consultas reales: {consultas['reales']}; respuestas desde la caché: {consultas['cache']}.",
        "",
        "| Métrica | Resultado | Meta |",
        "|---|---|---|",
        f"| Fichas correctas (contiene y puede contener exactos) | {metricas['pct_correctas']} % "
        f"({metricas['correctas']}/{metricas['productos']}) | ≥ {UMBRAL_CORRECTAS:.0f} % — {marca(metricas['cumple_correctas'])} |",
        f"| Con ingredientes (de los que la referencia dice que los tienen) | {metricas['pct_con_ingredientes']} % "
        f"({metricas['con_ingredientes']}/{metricas['referencia_con_ingredientes']}) | — |",
        f"| Tiempo p90 | {metricas['p90_segundos']} s | — |",
        f"| Consultas dentro de {LIMITE_DE_TIEMPO:.0f} s | {metricas['pct_en_tiempo']} % "
        f"({metricas['en_tiempo']}/{metricas['productos']}) | ≥ {UMBRAL_EN_TIEMPO:.0f} % — {marca(metricas['cumple_tiempo'])} |",
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
    return "\n".join(lineas) + "\n"


# --- the run -----------------------------------------------------------------------------------------------


def _escribir_resultados(carpeta: Path, filas: list[FilaReferencia], resultados: list[Resultado], discrepancias: list[Discrepancia]) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    por_id = {resultado.id: resultado for resultado in resultados}
    with (carpeta / "resultados.csv").open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(
            ["id", "nombre", "fuente", "encontrado", "contiene", "puede_contener", "sin_reconocer", "ingredientes", "tiempo_s", "consultas_reales", "error"]
        )
        for fila in filas:
            r = por_id[fila.id]
            escritor.writerow(
                [
                    r.id, fila.nombre, r.fuente, "si" if r.encontrado else "no", _texto(r.contiene), _texto(r.trazas),
                    ";".join(r.sin_reconocer), "si" if r.ingredientes else "no", f"{r.tiempo:.2f}", r.consultas_reales, r.error,
                ]
            )  # fmt: skip
    with (carpeta / "discrepancias.csv").open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(["id", "nombre", "campo", "esperado", "obtenido", "fuente"])
        for d in discrepancias:
            escritor.writerow([d.id, d.nombre, d.campo, d.esperado, d.obtenido, d.fuente])


def ejecutar(args: argparse.Namespace) -> int:
    filas = leer_referencia(Path(args.referencia), incluir_ejemplos=args.incluir_ejemplos)
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
        print(f"[{posicion}/{len(filas)}] {fila.id}: {estado} ({resultado.tiempo:.1f} s, {resultado.consultas_reales} consultas reales)")
        if resultado.consultas_reales > 0 and posicion < len(filas):
            time.sleep(args.pausa)

    metricas, discrepancias = calcular_metricas(filas, resultados)
    consultas = {"reales": fuentes.transporte.consultas_reales, "cache": fuentes.transporte.aciertos}
    salida = Path(args.salida) if args.salida else cache / "resultados"
    _escribir_resultados(salida, filas, resultados, discrepancias)
    resumen = resumen_md(metricas, discrepancias, consultas)
    (salida / "resumen.md").write_text(resumen, encoding="utf-8")
    print()
    print(resumen)
    print(f"Resultados en {salida}")
    return 0


def main() -> int:
    analizador = argparse.ArgumentParser(description="Mide el flujo de HU07 contra la referencia (T07-09).")
    analizador.add_argument("--referencia", default=str(REFERENCIA_POR_DEFECTO))
    analizador.add_argument("--cache", default=str(CACHE_POR_DEFECTO), help="Carpeta de la caché local (fuera del repositorio).")
    analizador.add_argument("--salida", default="", help="Carpeta de resultados (por defecto, dentro de la caché).")
    analizador.add_argument("--pausa", type=float, default=PAUSA_POR_DEFECTO, help="Segundos entre productos que usaron la red.")
    analizador.add_argument("--limite", type=int, default=0, help="Mide solo los primeros N productos.")
    analizador.add_argument("--incluir-ejemplos", action="store_true", help="Incluye las filas de ejemplo.")
    analizador.add_argument("--estimar", action="store_true", help="Solo calcula cuántas consultas reales haría; no usa la red.")
    return ejecutar(analizador.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
