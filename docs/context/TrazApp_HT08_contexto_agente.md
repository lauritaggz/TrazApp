# TrazApp — Contexto de la HT08 para el agente de código

**HT08 — Resolver las secciones "Próximamente", navegación entre productos y rediseño de interfaces** (Sprint 3)

*Creado el 20-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU10_contexto_agente.md` (reglas de trabajo vigentes), a `TrazApp_HU14_contexto_agente.md` (costos y cantidades) y a `TrazApp_HU11_contexto_agente.md` (último estado del entorno). Léelo completo antes de trabajar en la HT08. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

Las reglas de la sección 1 de `TrazApp_HU10_contexto_agente.md` aplican completas: tarea por tarea, modo ahorro (sin commit, sin push, sin navegador), Fase 1 cuando haya decisiones, pruebas locales solo nuevas y afectadas (la regresión la ejecuta el CI), formato del reporte, rama y PR draft, no borrar datos, sin secretos, cuentas de prueba, mutaciones (máximo 4) restauradas con `git diff` o `cmp`, pruebas existentes que cambian se explican y nunca se relajan, inmutabilidad de las elaboraciones finalizadas y lista blanca en todo endpoint público.

**Puerto:** la desarrolladora revisa en `http://localhost:5175`. El agente no usa ese puerto, pero en "Qué revisar visualmente" siempre indica el 5175.

Además, para HT08:

1. **Solo lectura.** Las consultas nuevas no escriben en la base ni crean migraciones. Si crees que hace falta una migración, detente y pregunta.
2. **Aislamiento por productor.** Toda consulta filtra por el productor autenticado. Un ingrediente, producto o insumo de otro productor responde 404.
3. **El rediseño lo hace Laura, no el agente.** Laura rediseña cuatro pantallas por su cuenta y sube sus commits a la **misma rama** con el prefijo `design(HT08): …`. El agente:
   - no modifica las pantallas en rediseño (lista de ingredientes, login, inicio y vista de insumos) ni sus estilos, salvo que un prompt lo pida;
   - no revierte, reformatea ni "corrige" commits `design`;
   - al iniciar cada tarea ejecuta `git pull` de la rama y revisa `git log --oneline` por commits `design` nuevos; si tocan archivos que la tarea necesita modificar, lo informa en la Fase 1 antes de editar;
   - si una prueba existente falla por un commit `design` (selector o texto cambiado), **no la adapta por su cuenta**: lo reporta con el archivo, la prueba y la causa, y espera instrucciones.
4. **Sin funciones prometidas.** No se agregan tarjetas, botones ni textos de funciones que no existan ("Próximamente", "podrás…", "muy pronto").

**Formato del reporte:** el de HU11 (desvíos, decisiones, pruebas, mutaciones, horas reales, qué revisar visualmente, mensaje de commit).

---

## 2. Estado y entorno

- **Rama:** `feature/ht08-proximamente-rediseno`, creada desde `main` actualizado **después del merge de HU11**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442**. Pruebas en el contenedor (`unset TEST_DATABASE_URL` para SQLite; nunca dos suites a la vez sobre `trazapp_test`).
- **Migración vigente:** `020` (HU11). HT08 **no** agrega migraciones.
- **Convención de errores:** `404` con `detail` de texto; `409` y `422` con `{mensaje, …}` cuando llevan datos.
- **CI:** el job de PostgreSQL tarda unos 26–29 minutos (límite 45).
- **Documento de resultados:** `docs/test/ht08-test-results.md` y evidencia en `docs/test/validacion_ht08/`.
- **Calendario:** el Sprint 3 cierra el domingo 22-11-2026 y después queda el cierre del MVP (regresión, métricas, tag `v3.0.0-sprint3`). Reporta las horas reales en cada tarea para poder decidir recortes.

---

## 3. Historia y criterios

**Como productor, quiero que las fichas de ingredientes y productos muestren solo información real, para entender el alcance de cada ingrediente y no encontrar funciones prometidas que no existen.**

Prioridad P3 · Depende de HU02, HU03, HU04 (y HU14 por las cantidades).

### 3.1 Secciones "Próximamente"

| ID | Criterio |
|---|---|
| CA1 | En el detalle del ingrediente, la sección "Uso en formulaciones" muestra los productos cuya **formulación vigente** incluye el ingrediente, con el nombre del producto y la **versión vigente** de la formulación. |
| CA2 | En el detalle del ingrediente, la sección "Insumos asociados" muestra los insumos comerciales asociados al ingrediente, con su marca u origen y su estado (activo o inactivo). |
| CA3 | Cada producto e insumo listado enlaza a su detalle. |
| CA4 | Si no hay datos, cada sección muestra un estado vacío con texto, no la tarjeta "Próximamente". |
| CA5 | Del detalle del producto se retiran las tarjetas "Trazabilidad de ingredientes" e "Información adicional". |
| CA6 | No queda ninguna tarjeta "Próximamente" en los detalles de ingrediente y producto. |
| CA7 | Las consultas son de solo lectura y consideran solo los datos del productor autenticado. |

**Ajuste al CA1 (decidido por Laura, 20-11-2026):** la versión original pedía cantidad y unidad. HU14 retiró las cantidades de la formulación y las llevó a la calculadora de costos, así que "Uso en formulaciones" muestra producto y versión, **sin cantidad**. No leas cantidades de las tablas de costos (019) para esta sección.

### 3.2 Navegación entre productos

| ID | Criterio |
|---|---|
| CA8 | El detalle del producto tiene botones "Anterior" y "Siguiente" para pasar al producto previo o siguiente del productor, en el mismo orden de la lista de productos. |
| CA9 | En el primer producto no hay "Anterior" activo, y en el último no hay "Siguiente" activo (deshabilitados u ocultos, con criterio accesible). |
| CA10 | La navegación solo recorre productos del productor autenticado. |

No va en la calculadora de costos. Propón en la Fase 1 de esa tarea si el orden sale de un endpoint (ids vecinos) o del frontend, y qué pasa con productos archivados o filtros activos en la lista.

### 3.3 Rediseño de interfaces (a cargo de Laura)

| ID | Criterio |
|---|---|
| CA11 | Se aplica el nuevo diseño de Laura a: **lista de ingredientes, inicio de sesión (login), inicio (pantalla principal tras ingresar) y vista de insumos**. |
| CA12 | El rediseño no cambia el comportamiento: mismas acciones, validaciones, mensajes de error y datos. Las pruebas existentes del frontend siguen pasando sin relajarse. |
| CA13 | Las pantallas rediseñadas se ven bien en escritorio y en el teléfono (Chrome Android). |

Esta parte **no es tarea del agente**. Se incluye para que conozca el alcance completo de HT08, sepa qué archivos no tocar y pueda documentarla en T-HT08-05 a partir de los commits `design` y de los resultados manuales que entregue Laura.

### 3.4 Fuera de alcance

- Asociar insumos desde el detalle del ingrediente ("podrás asociar más").
- Trazabilidad de ingredientes por producto (posible trabajo futuro).
- Sellos "libre de" o cualquier declaración certificada.
- Rediseñar pantallas no listadas en CA11.

---

## 4. Diferencias con el diseño que se registran

- **"Información adicional" (detalle del producto):** se retira porque el lote y la vigencia pertenecen a las elaboraciones y a los insumos, no al producto (SC-01), y porque los sellos como «Sin TACC» o «Sin conservantes» son declaraciones "libre de" que TrazApp no certifica (HU07 y CA9 de HU10) y que están reguladas.
- **"Trazabilidad de ingredientes" (detalle del producto):** se retira porque no corresponde a ninguna historia del backlog, y lo que propone ya está cubierto en parte por los requisitos de publicación (HU09) y por la validación al finalizar una elaboración (HU05). Queda como posible trabajo futuro.
- **"Uso en formulaciones" sin cantidad:** por la decisión de HU14 (sección 3.1).

---

## 5. Registro de cambio

| Campo | Valor |
|---|---|
| Identificador | SC-06 (o el siguiente libre) |
| Origen | Revisión visual de HU08 y de las pantallas del MVP por la desarrolladora |
| Descripción | Se agrega HT08 para resolver las secciones "Próximamente" (implementar dos en el detalle del ingrediente y retirar dos del detalle del producto), agregar navegación anterior/siguiente en el detalle del producto y rediseñar cuatro interfaces (lista de ingredientes, login, inicio y vista de insumos) |
| Motivo | Evitar secciones inconclusas en la versión final, retirar dos que contradicen el modelo de datos y la decisión de no certificar declaraciones "libre de", y mejorar la usabilidad y la presentación del MVP |
| Nivel de impacto | Medio (se incorpora al Sprint 3) |
| Decisión | Aprobada e incorporada al Sprint 3. Las secciones y la navegación las implementa el agente; el rediseño lo hace Laura en la misma rama (commits `design`). Si no alcanza, se ejecutan al menos T-HT08-03 y el retiro de las tarjetas "Próximamente" del ingrediente; las pantallas no rediseñadas quedan como trabajo futuro |
| Estado | En curso |

---

## 6. Tareas

**Tareas del agente:**

| ID | Tarea | Horas |
|---|---|---|
| T-HT08-01 | Consultas de solo lectura: productos con el ingrediente en su formulación vigente (producto y versión) e insumos asociados | 0,5 |
| T-HT08-02 | Interfaz de las dos secciones en el detalle del ingrediente, reemplazando "Próximamente" | 0,75 |
| T-HT08-03 | Retirar del detalle del producto "Trazabilidad de ingredientes" e "Información adicional", y registrarlo como diferencia con el diseño | 0,25 |
| T-HT08-04 | Navegación anterior/siguiente en el detalle del producto | 0,5 |
| T-HT08-05 | Pruebas y documentación de toda la HT08, incluido el rediseño (`docs/test/ht08-test-results.md`) | 0,5 |
| | **Subtotal agente** | **2,5** |

**Tareas de Laura (commits `design`):**

| ID | Tarea | Horas |
|---|---|---|
| T-HT08-D1 | Rediseño: login e inicio | 1 |
| T-HT08-D2 | Rediseño: lista de ingredientes y vista de insumos | 1 |
| | **Subtotal Laura** | **2** |

Total HT08: 4,5 h. La estimación original era 1,75 h (solo las secciones). La navegación y el rediseño suman 2,75 h.

T-HT08-05 se hace al final, cuando Laura confirme que terminó los commits `design`.

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT-HT08-01 | Ingrediente usado en la formulación vigente de 2 productos | "Uso en formulaciones" lista los 2, con nombre y versión vigente | 1 |
| PT-HT08-02 | Ingrediente que solo estaba en una versión anterior de una formulación | Ese producto no aparece | 1 |
| PT-HT08-03 | Ingrediente con un insumo activo y uno inactivo | "Insumos asociados" lista ambos, con marca u origen y estado | 2 |
| PT-HT08-04 | Hacer clic en un producto o insumo listado | Abre su detalle | 3 |
| PT-HT08-05 | Ingrediente sin productos ni insumos | Estados vacíos con texto; sin "Próximamente" | 4, 6 |
| PT-HT08-06 | Abrir el detalle de un producto | No aparecen "Trazabilidad de ingredientes", "Información adicional" ni "Próximamente" | 5, 6 |
| PT-HT08-07 | Ingrediente de otro productor | 404; no se filtran productos ni insumos de otro productor | 7 |
| PT-HT08-08 | Las consultas de las secciones | No escriben en la base | 7 |
| PT-HT08-09 | Navegar con "Siguiente" y "Anterior" desde el primer producto hasta el último | Recorre en el orden de la lista; en los extremos el botón correspondiente no está activo | 8, 9 |
| PT-HT08-10 | Navegación con productos de otro productor en la base | Nunca aparecen | 10 |
| PT-HT08-11 | Login, inicio, lista de ingredientes e insumos rediseñados (manual, Laura) | Se ven como el diseño en escritorio y en el teléfono; mismas acciones y mensajes | 11, 12, 13 |
| PT-HT08-12 | Login con credenciales incorrectas y correctas tras el rediseño (manual, Laura; más las pruebas existentes de login) | Mismo mensaje de error y mismo ingreso que antes | 12 |
| PT-HT08-13 | Búsqueda en el frontend de "Próximamente" | Sin resultados en los detalles de ingrediente y producto | 6 |

**Mutaciones sugeridas:**

- incluir versiones no vigentes de la formulación;
- omitir el filtro por productor en alguna de las consultas;
- volver a mostrar una tarjeta retirada;
- invertir el orden de anterior/siguiente o no deshabilitar el extremo.
