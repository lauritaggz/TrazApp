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

Prioridad P1 · 5 SP · 5 h · Semana 4 · Depende de HU05 y HU09. Objetivo específico relacionado: **OE3** (elaboraciones relacionadas).

| ID | Criterio |
|---|---|
| CA1 | El productor puede consultar las elaboraciones relacionadas con un insumo comercial. |
| CA2 | Puede consultar las elaboraciones relacionadas con un lote específico de un insumo. |
| CA3 | El resultado muestra producto, fecha y código de cada elaboración relacionada. |
| CA4 | El resultado incluye las elaboraciones finalizadas y en borrador, indicando el estado de cada una. |
| CA5 | En las elaboraciones finalizadas, la identificación se obtiene a partir de la información conservada. |
| CA6 | Al consultar por insumo, el resultado indica las elaboraciones en que el insumo se registró sin lote. |
| CA7 | El resultado indica si el producto de cada elaboración se encuentra publicado y si la elaboración está oculta. |
| CA8 | No se incluyen elaboraciones que no utilizaron el insumo o lote consultado. |
| CA9 | La consulta no modifica la información almacenada. |
| CA10 | Solo se consideran las elaboraciones del productor autenticado. |

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

Verifica si las columnas y la copia pueden divergir en una finalizada (por ejemplo, si un insumo o lote se elimina o se reasigna). Recomienda una opción y justifica cómo se cumple **CA5** ("en las finalizadas, la identificación se obtiene a partir de la información conservada"). Si eliges (a), la justificación debe demostrar que en una finalizada las columnas no pueden diferir de la copia, y debe haber una prueba que lo verifique. **Los datos que se muestran** (nombre del insumo, código del lote) salen de la copia conservada, no del insumo o lote vigente.

### D2. Borradores (resuelto por CA4)

Se incluyen finalizadas **y** borradores, indicando el estado de cada una. Un borrador no tiene información conservada: se identifica por su uso vigente. El resultado debe distinguir claramente ambos estados.

### D3. Elaboraciones sin lote en la consulta por lote (decisión pendiente, importante)

Si el fabricante retira el lote L-42 y una elaboración usó ese insumo **sin registrar lote**, TrazApp no puede descartar que haya usado L-42. Pero **CA8** y **PT08-02** exigen que la consulta por lote devuelva **solo** las elaboraciones de ese lote. Para no contradecirlos ni dar una falsa seguridad, la propuesta es:

- el resultado de la consulta por lote contiene **solo** las elaboraciones que usaron ese lote (CA8, PT08-02);
- **aparte del resultado**, la respuesta informa cuántas elaboraciones usaron **el mismo insumo sin lote registrado** (solo el número), y la interfaz muestra un aviso: "Hay N elaboraciones con este insumo sin lote registrado; no se puede descartar que usaran este lote", con un enlace a la consulta por insumo, donde aparecen marcadas.

En la consulta por insumo, las elaboraciones sin lote se marcan como "sin lote" (CA6, PT08-05). Confirma esta propuesta o propón otra que cumpla CA8 literalmente.

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

**Evidencia esperada:** `docs/hu08-test-results.md` con el conteo del escenario (métrica de OE3), la ejecución de la integración continua y capturas en el celular.

---

## 7. Plan de pruebas

**Escenario base:** un insumo usado en cuatro elaboraciones (dos productos, tres finalizadas y un borrador, una de ellas sin lote, otra oculta), un segundo lote del mismo insumo y elaboraciones que no lo usan.

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT08-01 | Consultar por el insumo | Devuelve las cuatro elaboraciones con producto, fecha y código | 1, 3 |
| PT08-02 | Consultar por uno de los lotes | Devuelve solo las elaboraciones de ese lote | 2 |
| PT08-03 | Revisar el estado en el resultado | Distingue finalizadas y borrador | 4 |
| PT08-04 | Después de finalizar, cambiar el insumo de un ingrediente en otro borrador y modificar la ficha del insumo | Las finalizadas siguen identificadas por su información conservada | 5 |
| PT08-05 | Revisar la elaboración registrada sin lote | Aparece indicada como "sin lote" | 6 |
| PT08-06 | Revisar publicación y visibilidad | Indica el producto publicado y la elaboración oculta | 7 |
| PT08-07 | Contar los resultados contra el conjunto esperado | 100 % de las relacionadas y 0 % de no relacionadas (OE3) | 8 |
| PT08-08 | Comparar la base antes y después de consultar | No cambia ningún registro | 9 |
| PT08-09 | Consultar un insumo o lote de otro productor | Responde 404 | 10 |
| PT08-10 | Consultar desde el detalle del insumo en un celular | La sección reemplaza "Próximamente" y se usa sin problemas | 1, 2 |

**PT08-07 (OE3)** se automatiza sobre el escenario base: conjunto esperado de elaboraciones (por id) contra el conjunto devuelto, para el insumo y para cada lote. El resultado se informa como porcentaje de relacionadas encontradas y de no relacionadas incluidas.

**Escenarios adicionales** (no están en el plan oficial, pero deben quedar cubiertos):

| Escenario | Resultado esperado |
|---|---|
| Datos mostrados de una finalizada tras modificar el insumo o el lote | Nombre del insumo y código del lote conservados, no los vigentes (RT-03) |
| Borrador que usa el lote consultado | Aparece en la consulta por lote, con estado borrador |
| Aviso de elaboraciones sin lote en la consulta por lote (según D3) | El número es correcto y esas elaboraciones no están en el resultado |
| Sin N+1 | Número de consultas constante |
| Si se eligió D1 (a) | En toda finalizada, las columnas del uso coinciden con la copia conservada |

**Mutaciones sugeridas:**

- excluir las elaboraciones sin lote de la consulta por insumo;
- incluir usos de otro lote del mismo insumo en la consulta por lote;
- excluir los borradores (CA4);
- omitir el filtro por productor;
- mostrar el nombre del insumo vigente en lugar del conservado;
- invertir la etiqueta de oculta o de publicado.

---

## 8. Fuera de alcance

- Acciones masivas (ocultar todas las elaboraciones afectadas de una vez, notificar a consumidores).
- Búsqueda por ingrediente genérico o por proveedor.
- Alertas automáticas de retiros publicados por fabricantes o autoridades.
- Exportar el resultado a un archivo.
