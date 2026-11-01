# HU06 — Resultados de pruebas

**Rama:** `feature/hu06-historial-elaboraciones` (Pull Request draft hacia `main`)
**Historia:** HU06 — Consulta del historial de elaboraciones (Sprint 3)
**Criterios de referencia:** CA1 … CA7 y PT06-01 … PT06-10 (`docs/TrazApp_HU06_contexto_agente.md`, secciones 3 y 7)
**Entorno:** backend con Python 3.12 (contenedor `trazapp-backend`) sobre SQLite en memoria y sobre PostgreSQL 16 (contenedor `trazapp-database`, base aislada `trazapp_test`); frontend con Vitest. Las suites completas corren en GitHub Actions sobre el Pull Request.

**Línea base (medida al iniciar T06-01, commit `a085ad6`):** backend SQLite 1.281 aprobadas y 148 omitidas; backend PostgreSQL 1.429 aprobadas; frontend 42 archivos y 970 aprobadas.

Este documento tiene una sección por tarea. Se completa a medida que avanza la historia.

---

## T06-01 — Paginación, filtros y búsqueda en `GET /gestion/elaboraciones`

### Qué cambió

`GET /gestion/elaboraciones` pasa de devolver una lista a devolver `{items, total, limit, offset}` (`ElaboracionListaRead`).

| Parámetro | Regla |
|---|---|
| `producto_id`, `estado` | Sin cambios |
| `fecha_desde`, `fecha_hasta` | Inclusivas sobre `fecha_elaboracion`. `fecha_desde > fecha_hasta` → 422 con `detail {mensaje}` |
| `codigo` | Parcial y sin distinguir mayúsculas; se recorta y, si queda vacío, se ignora |
| `limit` | Por defecto 20, de 1 a 100 (fuera de rango: 422 estándar de FastAPI) |
| `offset` | Por defecto 0, mínimo 0 (fuera de rango: 422 estándar de FastAPI) |

- **Un solo `_filtrar`:** `ElaboracionRepository._filtrar` aplica todos los filtros (productor incluido) y lo usan tanto la página como el conteo del total, de modo que `total` siempre cuenta con los mismos filtros. `list_resumenes` devuelve `(filas, total)`.
- **Orden:** `fecha_elaboracion` desc, `id` desc, sin cambios; es un orden total, por lo que las páginas consecutivas no repiten ni saltan filas.
- **Búsqueda por código:** `lower(codigo) LIKE '%texto%' ESCAPE '\'`, con el texto recortado, en minúsculas y con `\`, `%` y `_` escapados (se buscan como texto). Es el mismo `lower()` del índice único `uq_elaboraciones_producto_codigo`.
- **Sin migración ni índice:** `ix_elaboraciones_productor_fecha (productor_id, fecha_elaboracion DESC)` cubre el filtro por productor, el rango de fechas y el orden. Un `LIKE '%…%'` no usa ningún índice btree.
- **Sin tocar:** el detalle (`GET /gestion/elaboraciones/{id}`), la información conservada y el frontend.

### Limitación conocida: `lower()` en SQLite

`lower()` de SQLite solo pliega letras ASCII; el de PostgreSQL pliega Unicode. Para códigos como `E-014` o `G-002` no hay diferencia. Con letras no ASCII (por ejemplo `É`), SQLite no encontraría `é` al buscar `É`, y PostgreSQL sí. Las pruebas usan solo ASCII para la capitalización (el código `lote-ñ` existe en la prueba, pero solo se busca con otras letras). En producción (PostgreSQL) la búsqueda pliega también las letras con tilde.

### Pruebas

Archivo nuevo: `backend/tests/test_historial_elaboraciones_hu06.py` (38 pruebas con los casos parametrizados).

| PT | Qué comprueba |
|---|---|
| PT06-01 | Forma de la respuesta; páginas consecutivas de 3 con 7 elaboraciones (fechas repetidas) sin repetir ni saltar; `offset` más allá del total; límite máximo 100; `limit` y `offset` fuera de rango → 422; orden fecha desc e id desc |
| PT06-02 | Cada filtro por separado; rango inclusivo en ambos extremos (`desde = hasta` incluido); filtros combinados; `total` con los mismos filtros que la página; `fecha_desde > fecha_hasta` → 422 con `{mensaje}`; fechas, estado y producto inválidos → 422 |
| PT06-03 | Código exacto, parcial, con otra capitalización, con espacios, vacío (se ignora), inexistente y comodines `%` y `_` como texto |
| PT06-04 | Cada fila trae su estado, `finalizada_at` y los pendientes |
| PT06-07 | El listado (con varios filtros) y el detalle no cambian conteos de elaboraciones, usos ni lotes, ni `updated_at` ni el estado de ninguna elaboración |
| PT06-08 | No aparecen elaboraciones de otro productor, ni filtrando por su producto, su código, su estado o su fecha; el detalle de una ajena responde 404 |

**Pruebas existentes de HU05 actualizadas** (11 aserciones en 5 archivos): leían la respuesta como lista y ahora leen `["items"]`, porque la respuesta es un objeto. Ninguna aserción se relajó ni se eliminó: `test_elaboracion_formulacion_hu05.py`, `test_finalizacion_elaboracion_hu05.py`, `test_gestion_elaboraciones_edicion_hu05.py`, `test_gestion_elaboraciones_hu05.py` y `test_gestion_usos_elaboracion_hu05.py`.

### Resultado local (solo las nuevas y las afectadas)

| Suite | Resultado |
|---|---|
| SQLite (`unset TEST_DATABASE_URL`) | 215 aprobadas (4 min 0 s) |
| PostgreSQL (`trazapp_test`) | 215 aprobadas (7 min 20 s) |

Un primer intento en PostgreSQL falló con 14 errores de preparación (`CREATE TABLE` sobre la base compartida) porque otra corrida de PostgreSQL seguía activa sobre `trazapp_test` al mismo tiempo; repetida a solas, pasa completa. No es un defecto de las pruebas: las suites de PostgreSQL no deben correr a la vez.

### Mutaciones (sobre `elaboracion_repository.py`, con copia y restauración)

| Mutación | Pruebas que fallan |
|---|---|
| Quitar el filtro por productor | 6 (PT06-08) |
| Invertir el orden | 3 |
| Volver exclusivo el límite de `fecha_hasta` | 2 |
| Ignorar `estado` cuando viene con otro filtro | 2 |
| Calcular `total` sin los filtros | 3 |

El archivo quedó idéntico a su copia después de cada serie y `git diff` muestra solo los cambios de la tarea.

### Suites completas

Las corre GitHub Actions sobre el Pull Request draft; el resultado se agrega aquí al cerrar la tarea.
