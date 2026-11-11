# HU10 — Medición del tiempo de respuesta (PT10-13, OE4)

**Fecha:** 2026-11-11 22:14
**Meta (OE4):** al menos el 95 % de las consultas públicas responde en 2 s o menos.
**Resultado:** **100.0 % de las 100 consultas respondió con 200 en 2000 ms o menos: CUMPLE.**

## Resumen

| Medida | Valor |
|---|---|
| n (consultas medidas) | 100 |
| p50 | 15.5 ms |
| p95 | 24.9 ms |
| Máximo | 31.1 ms |
| Mínimo / media | 10.6 ms / 16.9 ms |
| % ≤ 2000 ms (solo respuestas 200) | 100.0 % |
| Consultas fallidas (código distinto de 200) | 0 |
| Consultas con estado inesperado (200 pero `estado_elaboracion` distinto del esperado) | 0 |

Percentiles por el método del rango más cercano. Mediciones por consulta: `oe4_mediciones.csv` (n, variante, código HTTP, ms).

### Por variante

| Variante | n | p50 (ms) | p95 (ms) | Máximo (ms) | Fallidas |
|---|---|---|---|---|---|
| `sin_parametros` | 25 | 16.8 | 26.7 | 28.8 | 0 |
| `codigo` | 25 | 15.8 | 24.1 | 31.1 | 0 |
| `fecha` | 25 | 15.5 | 24.6 | 28.5 | 0 |
| `codigo_inexistente` | 25 | 13.8 | 22.9 | 26.7 | 0 |

### Consultas fallidas

Ninguna: las 100 consultas respondieron 200.

## Método

- **Cliente:** `backend/scripts/medir_oe4_hu10.py`, con `httpx` 0.28.1 (Python 3.12.16), contra la API real en ejecución en `http://localhost:8000`; no usa `TestClient`. Corre dentro del contenedor del backend. Una sola conexión reutilizada y consultas **secuenciales**, sin token (como un consumidor).
- **Solo lee:** únicamente `GET /publico/productos/{id_publico}`; no crea, modifica ni borra datos.
- **Calentamiento:** 5 consultas descartadas, antes de las 100.
- **Variantes** (25 de cada una, alternadas): sin parámetros; `?codigo=` de una elaboración visible; `?fecha=` de una elaboración visible; `?codigo=NO-EXISTE-OE4` (código inexistente, responde 200 con `no_disponible`). Los códigos y fechas rotan entre las elaboraciones visibles.
- **Tiempo:** `time.perf_counter()` desde que se envía la solicitud hasta leer todo el cuerpo.
- **Descubrimiento (no medido):** una consulta sin parámetros y una por código para conocer las elaboraciones visibles y contar insumos.

## Entorno

- **Equipo:** Docker Desktop en Windows 11 Pro, 8 CPU, 12 GB
- **Servidor:** FastAPI con `uvicorn --reload` (modo de desarrollo, un solo proceso), en el contenedor `trazapp-backend`.
- **Base de datos:** PostgreSQL 16.15 en el contenedor `trazapp-database` (base local de desarrollo).
- **Producto medido:** «Queque de chocolate» (`id_publico` `Hpz74Rsz15_kkmwoETmz6g`): 1 elaboraciones visibles (E-002); insumos por elaboración: E-002: 8 (mínimo 8, máximo 8).

## Limitación

La medición se hace en local, entre el cliente y el servidor en la misma máquina: mide el servidor y la base de datos, **no la red móvil** ni la latencia real de un despliegue. Con un producto pequeño (1 elaboraciones y hasta 8 insumos) no se puede extrapolar a productos con muchas elaboraciones; la lista de elaboraciones crece con la frecuencia de producción. Una sola ejecución, de un solo cliente: no mide concurrencia.
