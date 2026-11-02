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

### Suites completas (GitHub Actions, Pull Request #22, commit `9a3abfb`)

| Trabajo | Resultado |
|---|---|
| Backend (SQLite) | aprobado (9 min 0 s) |
| Backend (PostgreSQL) | aprobado (12 min 45 s) |
| Frontend | aprobado (1 min 38 s) |

---

## T06-04 — Panel de inicio y consumidores del listado paginado

Se adelantó antes de T06-02: con el backend de T06-01 el Dashboard fallaba (`elaboraciones.filter is not a function`), porque esperaba una lista y ahora llega `{items, total, limit, offset}`.

### Qué cambió (solo frontend)

- **Servicio y tipos:** `listElaboraciones` devuelve `ElaboracionLista` (`{items, total, limit, offset}`, en `src/types/elaboracion.ts`) y acepta `fechaDesde`, `fechaHasta`, `codigo`, `limit` y `offset`, además de `productoId` y `estado`. El código se recorta y los parámetros vacíos no se envían; un `offset` de 0 sí.
- **Elaboraciones del producto** (`ProductElaboracionesSection`): usa `.items` y pide `limit: 5`. Con más de 5, avisa «Mostrando las 5 más recientes de N» (con el `total`, igual que el panel) y deja preparado «Ver todas» hacia `/elaboraciones?producto=<id>`, oculto hasta T06-03 (constante `RUTA_HISTORIAL` en `ProductDetail.tsx`).
- **Panel de inicio** (`Dashboard`):
  - «Elaboraciones en curso»: `estado=borrador` con `limit=5`. La cifra y el aviso «Mostrando las 5 más recientes de N» salen del `total`; el filtro por estado lo hace el servidor.
  - «Primeros pasos» (paso 3): una consulta aparte con `limit=1` y su `total`.
  - «Ver todas»: preparado en `DashboardElaboracionesEnCurso` (propiedad `verTodasTo`) pero oculto, porque la ruta `/elaboraciones` llega con T06-03. Para activarlo basta dar valor a la constante `RUTA_BORRADORES` de `Dashboard.tsx`. Cuando se muestre mide 44 px.
  - Se eliminó el comentario de deuda técnica: el panel ya no descarga todas las elaboraciones.

### Pruebas

Archivo nuevo: `frontend/src/elaboraciones/hu06.listado.test.tsx` (13 pruebas): parámetros y respuesta del servicio, total y «Ver todas» de «Elaboraciones en curso», y aviso y «Ver todas» de las elaboraciones del producto. Más una prueba nueva en `hu02.dashboard.test.tsx` («Primeros pasos» usa el `total`) y dos reescritas en `ht06.accesos.test.tsx`.

**Pruebas existentes actualizadas, con su motivo:**
- Los mocks de `listElaboraciones` de `ht06.accesos`, `hu02.dashboard`, `hu05.elaboraciones` y `ht06.recorridos` devuelven la página `{items, total, limit, offset}` (ayuda `paginaElaboraciones` en `src/test/testUtils.tsx`). El mock de los recorridos respeta `limit` y calcula `total`.
- `hu05.elaboraciones`: la sección del producto se llama con `{ productoId: 5, limit: 5 }`.
- `ht06.accesos`, «pide las elaboraciones sin filtrar…»: ahora son dos consultas (borradores con límite 5 y una de una).
- `ht06.accesos`, «solo muestra como en curso los borradores»: el filtro por estado pasó al servidor; la prueba simula un servidor que filtra.
- `ht06.accesos`, «muestra como máximo 5»: el servidor entrega las cinco más recientes y el total (7).

No se relajó ninguna aserción ni se eliminó ninguna prueba.

**Local:** `tsc -b` limpio; Vitest de `dashboard`, `elaboraciones`, `recorridos` y `products`: 10 archivos y 327 pruebas aprobadas tras actualizar los mocks; con las pruebas nuevas, `dashboard` y `hu06.listado`: 3 archivos y 49 aprobadas. Las suites completas las corre GitHub Actions.

### Mutaciones (con copia y restauración)

| Mutación | Pruebas que fallan |
|---|---|
| «Primeros pasos» usa `items.length` en vez de `total` | 1 |
| Quitar el límite en los borradores | 1 |
| La cifra de «en curso» cuenta solo las filas descargadas | 2 |
| La sección del producto pide sin límite | 1 |
| Quitar el aviso «Mostrando las 5 más recientes de N» del producto | 1 |
| Calcular ese aviso con `items.length` en vez de `total` | 1 |

La primera mutación solo es detectable con una página sin filas pero con `total` mayor que 0; en la práctica una página de una fila trae siempre una fila cuando hay elaboraciones, de modo que `items.length` y `total` coinciden en ese caso. La prueba lo fija de todos modos.

### Verificación en el navegador

Un frontend propio en otro puerto (con proxy al backend con el listado paginado) y una cuenta de prueba con 7 borradores: el panel muestra «Elaboraciones en curso» con la cifra 7 y «Mostrando las 5 más recientes de 7.», «Primeros pasos» al 100 % y sin «Ver todas»; el detalle del producto lista sus elaboraciones; en escritorio y en celular, sin errores de consola. La pantalla negra ya no aparece.

### Suites completas de T06-04 (GitHub Actions, Pull Request #22, commit `32b9c26`)

| Trabajo | Resultado |
|---|---|
| Backend (SQLite) | aprobado (9 min 5 s) |
| Backend (PostgreSQL) | aprobado (14 min 27 s) |
| Frontend | aprobado (1 min 39 s) |

---

## T06-02 — Detalle de la elaboración

El detalle ya cumplía CA4 y CA5 (una finalizada se construye solo desde la información conservada). Esta tarea lo verifica con pruebas de backend y complementa la pantalla según el diseño (`docs/diseno/sprint3/src/pages/Elaborations.tsx`), sin tocar el backend, la información conservada ni los triggers.

### Qué cambió (frontend, `ElaboracionDetail.tsx`)

- **Bloque de datos:** Producto, Código, Fecha y **«Versión del producto»** (antes «Versión de la formulación»). El estado sigue solo como insignia del encabezado.
- **Aviso:** una caja con candado (`CandadoIcon`, nuevo en `components/detail/icons.tsx`), el título «Información histórica conservada», la frase «Estos datos corresponden al momento de la finalización y no cambian aunque se actualicen los insumos o el producto.» y debajo la fecha ya existente («Información conservada al finalizar el …»). Reemplaza al párrafo anterior: la fecha aparece una sola vez. Solo se muestra si la elaboración tiene `finalizada_at`.
- **Por insumo:** «Lote» (código o **«Sin lote registrado»**) y «Vencimiento» como campo propio (**«No registrado»** si no hay); «Ingredientes declarados» siempre visible, con **«No declarados»** si falta. Los alérgenos no cambian.
- **Fuera de alcance (según el contexto de la HU):** insignia de publicación, «Visibilidad», unidades producidas, cualquier cifra que no venga de la API y la forma de mostrar la cantidad de la formulación.

### Dónde más aparecía «versión de la formulación»

`ElaboracionRegistro.tsx:241` («Versión de la formulación», en el registro de un borrador): también se cambió a «Versión del producto», por consistencia con el detalle, y su prueba lo exige. Otras pantallas usan «Versión vigente: N» (formulación del producto) y «Versión N» o «versión N» (historial de versiones y mensajes de guardado), que no son ese texto.

### Pruebas

**Backend** (`test_historial_elaboraciones_hu06.py`, 3 pruebas nuevas):
- **PT06-05:** una finalizada con un insumo sin lote y otro con lote que vence: versión, insumo, marca, presentación, ingredientes declarados, alérgenos con su tipo, lote y vencimiento, o `sin_lote`. Una segunda con un lote sin vencimiento.
- **PT06-06:** se finaliza, se cambian la marca y el tipo de un alérgeno del insumo, y se comprueba que el insumo vigente sí cambió mientras el detalle devuelve exactamente los valores originales.

**Frontend** (`hu05.elaboraciones.test.tsx`, 4 pruebas nuevas y 2 actualizadas):
- **Nuevas:** «Versión del producto» sin «Estado» duplicado; aviso con la frase y la fecha una sola vez; sin `finalizada_at` no hay aviso; «No declarados» frente al texto del insumo.
- **Actualizadas, con su motivo:**
  - «omite la presentación y el código de barras»: «Ingredientes declarados» ya no se omite; ahora aparece con «No declarados».
  - «muestra el código y el vencimiento del lote, o “Sin lote”»: el vencimiento dejó de ir pegado al código («X123 · vence …») y es un campo propio; «Sin lote» pasó a «Sin lote registrado» y «No registrado».
  - No se relajó ninguna aserción.

**Local:** SQLite, `test_historial_elaboraciones_hu06.py` y `test_finalizacion_elaboracion_hu05.py`: 70 aprobadas; Vitest de `elaboraciones`, `recorridos`, `ui` y `dashboard`: 15 archivos y 351 aprobadas; `tsc -b` limpio. PostgreSQL y las suites completas, en GitHub Actions.

### Mutaciones

| Mutación | Pruebas que fallan |
|---|---|
| Backend: el detalle de una finalizada se construye desde el insumo vigente | 1 (PT06-06) |
| Frontend: mostrar el aviso aunque no haya `finalizada_at` | 1 |
