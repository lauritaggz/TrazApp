"""Response-time measurement of the public consultation of HU10 (T10-06, PT10-13, OE4).

OE4: at least 95 % of the public consultations answer in 2 s or less.

It talks HTTP to the REAL API that is already running (httpx; no TestClient) and only READS: it only sends
`GET /publico/productos/{id_publico}` (no token, as a consumer would). It never creates, modifies or deletes data.

Method
- Discovery (not measured): one query without parameters to learn the visible elaboraciones (code and date) and one
  per code to count the supplies. If the product is not available (404) it stops and writes nothing.
- Warm-up: 5 queries, discarded.
- Measurement: 100 sequential queries, one connection kept alive, split in four variants of 25 that alternate:
  without parameters, `?codigo=` of a visible elaboración, `?fecha=` of a visible elaboración and `?codigo=` of a
  code that does not exist (answers 200 with `no_disponible`). Codes and dates rotate among the visible ones.
- Time: `time.perf_counter()` around the request until the whole body is read.
- Every answer whose HTTP code is not 200 counts as FAILED and is reported; a failed query is never counted as
  within the 2 s.

Use (inside the backend container, against the API in the same container):

    python scripts/medir_oe4_hu10.py --salida /tmp/oe4
    python scripts/medir_oe4_hu10.py --id-publico <otro> --salida /tmp/prueba     # a dry run on another product

It writes `oe4_mediciones.csv` (n, variante, codigo_http, ms) and `oe4_resultados.md` in `--salida` (by default
`docs/validacion_hu10` of the repository). It measures the server and the database in the local environment, NOT the
mobile network.
"""

from __future__ import annotations

import argparse
import csv
import math
import platform
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

ID_PUBLICO_POR_DEFECTO = "Hpz74Rsz15_kkmwoETmz6g"
BASE_POR_DEFECTO = "http://localhost:8000"
CALENTAMIENTO = 5
CONSULTAS = 100
LIMITE_MS = 2000.0
OBJETIVO_PORCENTAJE = 95.0
VARIANTES = ("sin_parametros", "codigo", "fecha", "codigo_inexistente")
CODIGO_INEXISTENTE = "NO-EXISTE-OE4"
TIMEOUT_SEGUNDOS = 30.0

RAIZ_REPO = Path(__file__).resolve().parents[2]
SALIDA_POR_DEFECTO = RAIZ_REPO / "docs" / "validacion_hu10"


class MedicionAbortada(Exception):
    """The product cannot be measured (not available, no visible elaboraciones, API down)."""


def percentil(valores: list[float], p: float) -> float:
    """Nearest-rank percentile (the smallest value with at least p % of the data at or below it)."""
    ordenados = sorted(valores)
    posicion = max(math.ceil(p / 100 * len(ordenados)), 1)
    return ordenados[posicion - 1]


def descubrir(cliente: httpx.Client, ruta: str) -> dict[str, Any]:
    """Reads the visible elaboraciones and counts the supplies of each one (setup, not measured)."""
    try:
        base = cliente.get(ruta)
    except httpx.HTTPError as exc:
        raise MedicionAbortada(f"No se pudo llegar a la API: {type(exc).__name__}") from exc
    if base.status_code != 200:
        raise MedicionAbortada(
            f"La consulta pública del producto responde {base.status_code}, no 200: el producto no está disponible "
            "(¿despublicado, eliminado o id_publico incorrecto?). No se midió ni se escribió nada."
        )
    cuerpo = base.json()
    elaboraciones = cuerpo.get("elaboraciones") or []
    if not elaboraciones:
        raise MedicionAbortada("El producto no tiene elaboraciones visibles: no hay nada que consultar por código o fecha.")
    insumos_por_codigo: dict[str, int] = {}
    for item in elaboraciones:
        detalle = cliente.get(ruta, params={"codigo": item["codigo"]})
        if detalle.status_code != 200:
            raise MedicionAbortada(f"La elaboración {item['codigo']} responde {detalle.status_code} en el descubrimiento.")
        elaboracion = detalle.json().get("elaboracion") or {}
        insumos_por_codigo[item["codigo"]] = len(elaboracion.get("insumos") or [])
    return {
        "nombre_producto": cuerpo["producto"]["nombre"],
        "elaboraciones": [(e["codigo"], e["fecha"]) for e in elaboraciones],
        "insumos_por_codigo": insumos_por_codigo,
    }


def parametros_de(variante: str, indice: int, datos: dict[str, Any]) -> dict[str, str]:
    elaboraciones: list[tuple[str, str]] = datos["elaboraciones"]
    if variante == "sin_parametros":
        return {}
    if variante == "codigo":
        return {"codigo": elaboraciones[indice % len(elaboraciones)][0]}
    if variante == "fecha":
        return {"fecha": elaboraciones[indice % len(elaboraciones)][1]}
    return {"codigo": CODIGO_INEXISTENTE}


def consultar(cliente: httpx.Client, ruta: str, params: dict[str, str]) -> tuple[int, float, str]:
    """One timed query: (HTTP code or 0 on a transport error, milliseconds, estado_elaboracion or an error note)."""
    inicio = time.perf_counter()
    try:
        respuesta = cliente.get(ruta, params=params)
        codigo = respuesta.status_code
        contenido = respuesta.content  # the whole body is part of the time
    except httpx.HTTPError as exc:
        return 0, (time.perf_counter() - inicio) * 1000, type(exc).__name__
    ms = (time.perf_counter() - inicio) * 1000
    estado = ""
    if codigo == 200:
        try:
            estado = str(httpx.Response(200, content=contenido).json().get("estado_elaboracion", ""))
        except ValueError:
            estado = "cuerpo_no_json"
    return codigo, ms, estado


def estado_esperado(variante: str) -> str:
    return "no_disponible" if variante == "codigo_inexistente" else "ok"


def medir(base_url: str, id_publico: str) -> dict[str, Any]:
    ruta = f"/publico/productos/{id_publico}"
    with httpx.Client(base_url=base_url, timeout=TIMEOUT_SEGUNDOS) as cliente:
        datos = descubrir(cliente, ruta)
        for i in range(CALENTAMIENTO):
            consultar(cliente, ruta, parametros_de(VARIANTES[i % 4], i, datos))
        filas: list[dict[str, Any]] = []
        inesperadas = 0
        for n in range(CONSULTAS):
            variante = VARIANTES[n % 4]
            codigo, ms, estado = consultar(cliente, ruta, parametros_de(variante, n // 4, datos))
            if codigo == 200 and estado != estado_esperado(variante):
                inesperadas += 1
            filas.append({"n": n + 1, "variante": variante, "codigo_http": codigo, "ms": round(ms, 2)})
    return {"datos": datos, "filas": filas, "inesperadas": inesperadas}


def resumen(filas: list[dict[str, Any]]) -> dict[str, Any]:
    tiempos = [f["ms"] for f in filas]
    fallidas = [f for f in filas if f["codigo_http"] != 200]
    validas = [f for f in filas if f["codigo_http"] == 200 and f["ms"] <= LIMITE_MS]
    return {
        "n": len(filas),
        "p50": percentil(tiempos, 50),
        "p95": percentil(tiempos, 95),
        "maximo": max(tiempos),
        "minimo": min(tiempos),
        "media": sum(tiempos) / len(tiempos),
        "fallidas": len(fallidas),
        "validas": len(validas),
        "porcentaje": 100 * len(validas) / len(filas),
        "lentas": sum(1 for f in filas if f["ms"] > LIMITE_MS),
    }


def version_postgres() -> str:
    """Read-only `select version()`; the measurement itself never depends on it."""
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from sqlalchemy import text

        from app.db.session import SessionLocal

        with SessionLocal() as db:
            return str(db.execute(text("select version()")).scalar()).split(" on ")[0]
    except Exception:  # noqa: BLE001 - informational only
        return "no disponible desde el script"


def escribir_csv(ruta: Path, filas: list[dict[str, Any]]) -> None:
    with ruta.open("w", newline="", encoding="utf-8") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=["n", "variante", "codigo_http", "ms"])
        escritor.writeheader()
        escritor.writerows(filas)


def escribir_md(ruta: Path, args: argparse.Namespace, resultado: dict[str, Any], datos_resumen: dict[str, Any]) -> None:
    filas = resultado["filas"]
    datos = resultado["datos"]
    cumple = datos_resumen["porcentaje"] >= OBJETIVO_PORCENTAJE
    insumos = list(datos["insumos_por_codigo"].values())
    por_variante = []
    for variante in VARIANTES:
        sub = [f for f in filas if f["variante"] == variante]
        tiempos = [f["ms"] for f in sub]
        fallidas = sum(1 for f in sub if f["codigo_http"] != 200)
        por_variante.append(
            f"| `{variante}` | {len(sub)} | {percentil(tiempos, 50):.1f} | {percentil(tiempos, 95):.1f} | "
            f"{max(tiempos):.1f} | {fallidas} |"
        )
    fallidas = [f for f in filas if f["codigo_http"] != 200]
    detalle_fallidas = (
        "Ninguna: las 100 consultas respondieron 200."
        if not fallidas
        else "\n".join(f"- consulta {f['n']} ({f['variante']}): HTTP {f['codigo_http']}, {f['ms']} ms" for f in fallidas)
    )
    texto = f"""# HU10 — Medición del tiempo de respuesta (PT10-13, OE4)

**Fecha:** {datetime.now().strftime('%Y-%m-%d %H:%M')}
**Meta (OE4):** al menos el {OBJETIVO_PORCENTAJE:.0f} % de las consultas públicas responde en {LIMITE_MS / 1000:.0f} s o menos.
**Resultado:** **{datos_resumen['porcentaje']:.1f} % de las {datos_resumen['n']} consultas respondió con 200 en {LIMITE_MS:.0f} ms o menos: {'CUMPLE' if cumple else 'NO CUMPLE'}.**

## Resumen

| Medida | Valor |
|---|---|
| n (consultas medidas) | {datos_resumen['n']} |
| p50 | {datos_resumen['p50']:.1f} ms |
| p95 | {datos_resumen['p95']:.1f} ms |
| Máximo | {datos_resumen['maximo']:.1f} ms |
| Mínimo / media | {datos_resumen['minimo']:.1f} ms / {datos_resumen['media']:.1f} ms |
| % ≤ {LIMITE_MS:.0f} ms (solo respuestas 200) | {datos_resumen['porcentaje']:.1f} % |
| Consultas fallidas (código distinto de 200) | {datos_resumen['fallidas']} |
| Consultas con estado inesperado (200 pero `estado_elaboracion` distinto del esperado) | {resultado['inesperadas']} |

Percentiles por el método del rango más cercano. Mediciones por consulta: `oe4_mediciones.csv` (n, variante, código HTTP, ms).

### Por variante

| Variante | n | p50 (ms) | p95 (ms) | Máximo (ms) | Fallidas |
|---|---|---|---|---|---|
{chr(10).join(por_variante)}

### Consultas fallidas

{detalle_fallidas}

## Método

- **Cliente:** `backend/scripts/medir_oe4_hu10.py`, con `httpx` {httpx.__version__} (Python {platform.python_version()}), contra la API real en ejecución en `{args.base_url}`; no usa `TestClient`. Corre dentro del contenedor del backend. Una sola conexión reutilizada y consultas **secuenciales**, sin token (como un consumidor).
- **Solo lee:** únicamente `GET /publico/productos/{{id_publico}}`; no crea, modifica ni borra datos.
- **Calentamiento:** {CALENTAMIENTO} consultas descartadas, antes de las {CONSULTAS}.
- **Variantes** (25 de cada una, alternadas): sin parámetros; `?codigo=` de una elaboración visible; `?fecha=` de una elaboración visible; `?codigo={CODIGO_INEXISTENTE}` (código inexistente, responde 200 con `no_disponible`). Los códigos y fechas rotan entre las elaboraciones visibles.
- **Tiempo:** `time.perf_counter()` desde que se envía la solicitud hasta leer todo el cuerpo.
- **Descubrimiento (no medido):** una consulta sin parámetros y una por código para conocer las elaboraciones visibles y contar insumos.

## Entorno

- **Equipo:** {args.entorno_host}
- **Servidor:** FastAPI con `uvicorn --reload` (modo de desarrollo, un solo proceso), en el contenedor `trazapp-backend`.
- **Base de datos:** {version_postgres()} en el contenedor `trazapp-database` (base local de desarrollo).
- **Producto medido:** «{datos['nombre_producto']}» (`id_publico` `{args.id_publico}`): {len(datos['elaboraciones'])} elaboraciones visibles ({', '.join(c for c, _ in datos['elaboraciones'])}); insumos por elaboración: {', '.join(f'{c}: {n}' for c, n in datos['insumos_por_codigo'].items())} (mínimo {min(insumos)}, máximo {max(insumos)}).

## Limitación

La medición se hace en local, entre el cliente y el servidor en la misma máquina: mide el servidor y la base de datos, **no la red móvil** ni la latencia real de un despliegue. Con un producto pequeño ({len(datos['elaboraciones'])} elaboraciones y hasta {max(insumos)} insumos) no se puede extrapolar a productos con muchas elaboraciones; la lista de elaboraciones crece con la frecuencia de producción. Una sola ejecución, de un solo cliente: no mide concurrencia.
"""
    ruta.write_text(texto, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Mide la consulta pública de HU10 (OE4). Solo lee.")
    parser.add_argument("--base-url", default=BASE_POR_DEFECTO)
    parser.add_argument("--id-publico", default=ID_PUBLICO_POR_DEFECTO)
    parser.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    parser.add_argument("--entorno-host", default="Docker Desktop en Windows")
    args = parser.parse_args()

    try:
        resultado = medir(args.base_url, args.id_publico)
    except MedicionAbortada as exc:
        print(f"ABORTADO: {exc}", file=sys.stderr)
        return 2

    datos_resumen = resumen(resultado["filas"])
    args.salida.mkdir(parents=True, exist_ok=True)
    escribir_csv(args.salida / "oe4_mediciones.csv", resultado["filas"])
    escribir_md(args.salida / "oe4_resultados.md", args, resultado, datos_resumen)
    print(
        f"n={datos_resumen['n']} p50={datos_resumen['p50']:.1f} ms p95={datos_resumen['p95']:.1f} ms "
        f"max={datos_resumen['maximo']:.1f} ms  <=2000ms={datos_resumen['porcentaje']:.1f}%  "
        f"fallidas={datos_resumen['fallidas']} inesperadas={resultado['inesperadas']}"
    )
    return 0 if datos_resumen["fallidas"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
