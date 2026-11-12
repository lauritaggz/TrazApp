# TrazApp — Contexto de la HU08 para el agente de código

**HU08 — Identificación de elaboraciones relacionadas** (Sprint 3)

*Creado el 11-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU06_contexto_agente.md` (metodología de Pull Request draft), a `TrazApp_HU09_contexto_agente.md` (publicación y elaboraciones ocultas) y a `TrazApp_HU10_contexto_agente.md` (reglas de trabajo vigentes). Léelo completo antes de trabajar en la HU08. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

Las reglas de la sección 1 de `TrazApp_HU10_contexto_agente.md` aplican completas y sin cambios: tarea por tarea, modo ahorro, pruebas locales solo nuevas y afectadas (la regresión la ejecuta el CI), formato del reporte, rama y PR draft, migraciones como `.pendiente`, dependencias nuevas con reconstrucción de la imagen, no borrar datos, sin secretos, cuentas de prueba, puerto 5175 prohibido, mutaciones restauradas con `git diff` o `cmp`, pruebas existentes que cambian se explican y nunca se relajan, e inmutabilidad de las elaboraciones finalizadas.

Además, para HU08:

1. **Solo lectura.** HU08 consulta; no modifica elaboraciones, usos, insumos, lotes ni publicaciones. Ningún endpoint de esta historia escribe en la base.
2. **Aislamiento por productor.** Un insumo o lote de otro productor responde `404`, y los resultados nunca incluyen elaboraciones de otro productor.

**Formato del reporte** (igual que en HU10):

1. Desvíos respecto de lo pedido (o "ninguno").
2. Decisiones que necesitas (o "ninguna").
3. Pruebas: nuevas / adaptadas (indica si alguna aserción cambió y por qué) / resultado local por archivo.
4. Mutaciones: tabla mutación → pruebas que fallan.
5. Horas reales.
6. Qué revisar visualmente (si aplica).
7. Mensaje de commit.

---

## 2. Estado y entorno

- **Rama:** `feature/hu08-elaboraciones-relacionadas`, creada desde `main` actualizado **después del merge de HU10**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442**. Corre las pruebas en el contenedor (`unset TEST_DATABASE_URL` para SQLite; nunca dos suites a la vez sobre `trazapp_test`).
- **Migración vigente:** `018_publicacion_producto_hu09`. Si HU08 necesita índices, la siguiente libre es la **019** (se numeran por orden de merge; HU14 tomará la que siga).
- **Convención de errores:** `404` inexistente o de otro productor; `422` datos inválidos; `409` conflicto de estado; `detail` con `{mensaje, ...}`.
- **Prueba en celular (T08-05):** con la configuración de red local ya documentada en HU10 (`URL_PUBLICA_APP`, `VITE_API_URL` configurable desde `.env` y CORS con la IP).

---

## 3. Historia y criterios

**Como productor, quiero identificar en qué elaboraciones se utilizó un insumo o un lote determinado, para actuar rápidamente ante un problema informado por su fabricante.**

Prioridad P1 · 5 SP · 5 h · Depende de HU05, HU06 y HU09. Objetivo específico relacionado: **OE3** (elaboraciones relacionadas).

> **[PEGAR AQUÍ los 10 criterios de aceptación oficiales del Product Backlog (CA1 a CA10) en una tabla `| ID | Criterio |`.]**

**Escenario de uso:** el fabricante de un insumo comercial informa un problema (por ejemplo, un alérgeno no declarado o una contaminación) en un producto o en un lote específico. El productor busca ese insumo o ese lote en TrazApp y obtiene la lista de sus elaboraciones que lo usaron, con la información necesaria para actuar: qué producto, qué elaboración, cuándo, si está publicada y si está oculta al público.

---

## 4. Lo que ya existe (punto de partida)

Verifica cada punto en el código antes de apoyarte en él.

- **Elaboraciones (HU05):** estados borrador → finalizada. `UsoInsumo` relaciona la elaboración con el insumo usado y, si corresponde, con un lote, o se marca `sin_lote`. Al finalizar se guarda `informacion_conservada` (esquema 2: `insumo`, `ingrediente`, `alergenos`, `lote {id, codigo, fecha_vencimiento}` o `null`, `sin_lote`). Los triggers impiden modificar una elaboración finalizada y sus usos.
- **Historial (HU06):** listado paginado con filtros, orden de "Predeterminada" (`fecha_elaboracion` desc, `id` desc) y detalle con la información conservada.
- **Publicación (HU09):** `productos.publicado`, `id_publico`, tabla `elaboraciones_ocultas`, funciones de visibilidad en `elaboracion_service.py`, Publicaciones (`/publicaciones/:productoId`) con el interruptor de ocultar.
- **Insumos (HU04/HU07) y lotes de insumos:** detalle del insumo y detalle del lote en el frontend, con secciones **"Próximamente"** que esta historia reemplaza (T08-04).
- **Diseño:** `docs/diseno/DISEÑOS SPRINT 3/` (pantallas "Insumo · detalle" y, si existe, la del lote). Sistema de diseño real: `docs/DESIGN.md`.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en la Fase 1 de T08-01, que define el contrato de las dos consultas (T08-01 a T08-03).

### D1. Fuente de la relación (propuesta)

El planning dice que la consulta se construye "a partir de la información conservada en las finalizadas". Hay dos formas de implementarlo:

- **(a)** Columnas de `UsoInsumo` (`insumo_id`, `lote_id`, `sin_lote`): indexables, iguales en SQLite y PostgreSQL. En una finalizada son inmutables por los triggers, así que reflejan lo conservado.
- **(b)** Ids dentro del JSON `informacion_conservada`: es literalmente la copia conservada, pero consultar JSON difiere entre SQLite y PostgreSQL y es más difícil de indexar.

Verifica si las columnas y la copia pueden divergir en una finalizada (por ejemplo, si un insumo o lote se elimina o se reasigna). Recomienda una opción y justifica cómo se cumple "a partir de la información conservada". **Los datos que se muestran** (nombre del insumo, código del lote) salen de la copia conservada, no del insumo o lote vigente.

### D2. Borradores (propuesta)

T08-03 pide "el estado de cada elaboración", lo que implica que el resultado puede incluir borradores. Un borrador todavía no tiene información conservada, pero ante un retiro el productor necesita saber que tiene una elaboración **en curso** que usa ese insumo o lote. Propón si se incluyen y, si es así, de dónde salen sus datos (uso vigente) y cómo se distinguen en el resultado.

### D3. Elaboraciones sin lote en la consulta por lote (propuesta, importante)

Si el fabricante retira el lote L-42 y una elaboración usó ese insumo **sin registrar lote**, TrazApp no puede descartar que haya usado L-42. Excluirla daría una falsa seguridad. Propuesta: la consulta por lote devuelve dos grupos:

- elaboraciones que usaron **ese lote**;
- elaboraciones que usaron **el mismo insumo sin lote registrado**, con la indicación "no se puede descartar".

Lo mismo en la consulta por insumo: las elaboraciones sin lote se marcan (T08-01: "indicando las registradas sin lote").

### D4. Contenido de cada resultado (T08-03)

Por elaboración: producto (nombre), código, fecha de elaboración, estado (borrador/finalizada), si el producto está **publicado** y si la elaboración está **oculta**, más el lote usado (código, desde la copia conservada) o "sin lote". Enlaces al detalle de la elaboración (HU06) y a la gestión de la publicación (HU09), para que el productor pueda ocultarla rápido.

Propón también un **resumen** al inicio (por ejemplo: N elaboraciones, M productos, K finalizadas visibles al público), porque es lo que el productor necesita para decidir si actuar.

### D5. Orden, paginación y rendimiento (propuesta)

- Orden por `fecha_elaboracion` desc, `id` desc (el mismo de HU06).
- Paginación con el patrón de HU06 si el resultado puede ser largo.
- Sin N+1. Revisa si existen índices sobre `usos_insumo(insumo_id)` y `usos_insumo(lote_id)`; si no existen, propón la migración 019.

### D6. Interfaz (T08-04)

- Reemplaza las secciones "Próximamente" del detalle del insumo y del detalle del lote por la lista de elaboraciones relacionadas, fiel al diseño vigente.
- Estados: cargando, sin resultados ("Este insumo no se ha usado en ninguna elaboración"), error con "Reintentar".
- Etiquetas con texto, no solo color: "Borrador", "Finalizada", "Publicado", "Oculta al público", "Sin lote registrado".
- Móvil primero, textos de al menos 12 px y áreas táctiles de 44 px (HT07).

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T08-01 | Consulta de elaboraciones relacionadas con un insumo, a partir de la información conservada en las finalizadas, indicando las registradas sin lote | 1,5 |
| T08-02 | Consulta de elaboraciones relacionadas con un lote específico | 0,5 |
| T08-03 | Incluir en el resultado el estado de cada elaboración, la publicación del producto y si la elaboración está oculta | 0,5 |
| T08-04 | Interfaz en el detalle del insumo y del lote, reemplazando las secciones "Próximamente" | 1,5 |
| T08-05 | Ejecutar y documentar pruebas, incluidas mutaciones y prueba en celular | 1 |

**Evidencia esperada:** `docs/test/hu08-test-results.md`, capturas de la prueba en celular y la ejecución de la integración continua.

---

## 7. Plan de pruebas

> **[PEGAR AQUÍ el plan de pruebas oficial PT08-xx.]**

Escenarios que deben quedar cubiertos, estén o no en el plan oficial:

| Escenario | Resultado esperado |
|---|---|
| Insumo usado en elaboraciones de dos productos | Aparecen todas, con su producto |
| Insumo usado con lote y sin lote | Las sin lote quedan marcadas |
| Lote usado en una elaboración; el mismo insumo usado sin lote en otra | La primera en "usó este lote"; la segunda en "no se puede descartar" (según D3) |
| Otro lote del mismo insumo | No aparece en la consulta por lote |
| Insumo o lote modificado después de finalizar | Los datos mostrados son los conservados (RT-03) |
| Borrador que usa el insumo | Según D2 |
| Elaboración oculta y producto publicado | Las etiquetas lo indican |
| Insumo o lote de otro productor | 404 |
| La consulta no escribe | Ningún cambio en la base tras consultar |
| Sin N+1 | Número de consultas constante |

**Mutaciones sugeridas:**

- excluir las elaboraciones sin lote;
- incluir usos de otro lote del mismo insumo en la consulta por lote;
- omitir el filtro por productor;
- mostrar el nombre del insumo vigente en lugar del conservado;
- invertir la etiqueta de oculta o de publicado.

---

## 8. Fuera de alcance

- Acciones masivas (ocultar todas las elaboraciones afectadas de una vez, notificar a consumidores).
- Búsqueda por ingrediente genérico o por proveedor.
- Alertas automáticas de retiros publicados por fabricantes o autoridades.
- Exportar el resultado a un archivo.
