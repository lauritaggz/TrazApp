# TrazApp — Contexto de la HU11 para el agente de código

**HU11 — Evaluación de utilidad de la información** (Sprint 3)

*Creado el 18-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU10_contexto_agente.md` (consulta pública y reglas de trabajo vigentes) y a `TrazApp_HU14_contexto_agente.md` (último estado del entorno). Léelo completo antes de trabajar en la HU11. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

Las reglas de la sección 1 de `TrazApp_HU10_contexto_agente.md` aplican completas: tarea por tarea, modo ahorro, pruebas locales solo nuevas y afectadas (la regresión la ejecuta el CI), formato del reporte, rama y PR draft, migraciones como `.pendiente`, dependencias nuevas con reconstrucción de la imagen, no borrar datos, sin secretos, cuentas de prueba, mutaciones restauradas con `git diff` o `cmp`, pruebas existentes que cambian se explican y nunca se relajan, inmutabilidad de las elaboraciones finalizadas y lista blanca en todo endpoint público.

**Puerto:** la desarrolladora revisa en `http://localhost:5175`. El agente no usa ese puerto, pero en "Qué revisar visualmente" siempre indica el 5175.

Además, para HU11:

1. **Anonimato.** La evaluación no guarda IP, user agent, cookies de sesión, token del productor ni ningún dato que identifique a quien responde. Tampoco se registran en logs junto a la evaluación.
2. **Primer endpoint público que escribe.** Valida todo en el servidor; nunca confía en datos del cliente que no estén firmados.
3. **La consulta pública sigue siendo de solo lectura.** El `GET` de la ficha no escribe en la base.

**Formato del reporte:**

1. Desvíos respecto de lo pedido (o "ninguno").
2. Decisiones que necesitas (o "ninguna").
3. Pruebas: nuevas / adaptadas (indica si alguna aserción cambió y por qué) / resultado local por archivo.
4. Mutaciones: tabla mutación → pruebas que fallan.
5. Horas reales.
6. Qué revisar visualmente (si aplica).
7. Mensaje de commit.

---

## 2. Estado y entorno

- **Rama:** `feature/hu11-evaluacion-utilidad`, creada desde `main` actualizado **después del merge de HU14**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442**. Pruebas en el contenedor (`unset TEST_DATABASE_URL` para SQLite; nunca dos suites a la vez sobre `trazapp_test`).
- **Migración vigente:** `019_costos_producto_hu14`. HU11 usa la **020**. Revisa las pruebas que fijan la cabeza de Alembic o comparan el estado tras `upgrade head` (las de la 019 ya quedaron preparadas para eso; verifica igual).
- **Convención de errores:** `404` con `detail` de texto; `409` y `422` con `{mensaje, …}` cuando llevan datos.
- **CI:** el job de PostgreSQL tarda unos 26 minutos (límite ampliado a 45).
- **Documento de resultados:** `docs/test/hu11-test-results.md` y evidencia en `docs/test/validacion_hu11/`.

---

## 3. Historia y criterios

**Como consumidor, quiero indicar de forma sencilla si la información consultada me resultó útil, para aportar retroalimentación sobre la consulta.**

Prioridad P2 · 3 SP · 3 h · Semana 4 · Depende de HU10. Primera historia en postergarse si el Sprint no alcanza.

| ID | Criterio |
|---|---|
| CA1 | Al final de la consulta se muestra la pregunta "¿Esta información te resultó útil?". |
| CA2 | El consumidor puede responder mediante "Sí" o "No". |
| CA3 | No se requiere cuenta ni información personal para responder. |
| CA4 | El sistema admite una sola respuesta por consulta, sin identificar al consumidor. |
| CA5 | La respuesta queda asociada al producto y a la elaboración consultada. |
| CA6 | Las respuestas se almacenan de forma anónima, y el productor visualiza sus resultados agregados. |
| CA7 | El productor puede consultar el porcentaje de respuestas positivas por producto. |

---

## 4. Lo que ya existe (punto de partida)

Verifica cada punto en el código antes de apoyarte en él.

- **Consulta pública (HU10):** `GET /publico/productos/{id_publico}?codigo=…|fecha=…`, `FichaPublicaRead` con lista blanca estricta, `estado_elaboracion` (`ok`, `no_disponible`, `varias`, `sin_elaboraciones`), 404 uniforme, `no-store`, `noindex`, máximo 4 consultas (`CONSULTAS_MAXIMAS`).
- **Identificador de la consulta (decisión D10 de HU10):** el par `(id_publico, codigo de la elaboración)`, con la normalización de T10-02 (`strip()` + `casefold()`). La selección vive en la URL.
- **Visibilidad (T09-04):** `producto_disponible_publicamente` y `elaboracion_visible_publicamente`. Reutilízalas: solo se puede evaluar una elaboración visible de un producto disponible.
- **Previsualización (T10-05):** `GET /gestion/productos/{id}/vista-publica`, mismo esquema y misma función `armar_ficha`. La vista `FichaVista` es compartida entre `/p/:idPublico` y la previsualización.
- **Publicaciones (HU09):** `/publicaciones` y `/publicaciones/:productoId`, con conteos por producto.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en la Fase 1 de T11-01.

### D1. "Una sola respuesta por consulta" sin identificar al consumidor (decidido por la desarrolladora el 18-11-2026, CA4)

Una consulta anónima no puede atarse a una persona. Para cumplir CA4 sin IP, cookies de seguimiento ni cuentas, se propone un **token de consulta firmado y de un solo uso**:

- El `GET` público incluye en la respuesta un `token_evaluacion` cuando `estado_elaboracion` es `ok`: un valor firmado (HMAC con la clave secreta de la aplicación) que contiene el `id_publico`, el código de la elaboración, un nonce aleatorio y la fecha de emisión. **No se escribe nada en la base al emitirlo** (el `GET` sigue siendo de solo lectura).
- El `POST` de la evaluación envía el token y la respuesta. El servidor verifica la firma, que no esté vencido (propón la vigencia, por ejemplo 24 h) y que la elaboración siga visible; guarda el **hash del nonce** con una restricción única. Un segundo envío con el mismo token responde 409 y no se registra (PT11-04).
- Definición de "consulta" que queda documentada: **cada carga de la ficha de una elaboración**. Recargar la página es una consulta nueva. Es una garantía por consulta, no por persona, y así se declara en el informe.
- **Decisión:** se usa el token firmado de un solo uso. Se descartan limitar por IP (contradice CA3 y CA6) y usar solo `localStorage` como garantía (no es una garantía del servidor).
- **Complemento en la interfaz (T11-02):** tras responder, el navegador recuerda en `localStorage` el par `(id_publico, código)` ya evaluado y, al recargar esa misma elaboración, muestra el agradecimiento en vez de la pregunta. No identifica a nadie y reduce las respuestas repetidas por recarga; no es una garantía (se borra con otro navegador o en modo incógnito). Lecturas y escrituras dentro de `try/catch`.
- **Límite de alcance (para el informe):** la garantía es por consulta, no por persona. Recargar la página en otro navegador o borrar los datos del sitio permite responder de nuevo.
- **Trabajo futuro:** limitación de solicitudes por origen sin guardar la IP junto a la evaluación, o mecanismos anti-bots, si el volumen o el abuso lo justifican.

### D2. Modelo (migración 020, propuesta)

- Tabla `evaluaciones_utilidad`: `id`, `producto_id` (FK), `elaboracion_id` (FK), `util` (booleano), `nonce_hash` (único), `fecha` (propón la precisión: fecha sin hora reduce la posibilidad de correlacionar con otros registros).
- **Sin** IP, user agent, token completo ni ningún dato de quien responde (CA6, PT11-05).
- `ON DELETE` coherente con las FK existentes (las elaboraciones finalizadas no se borran).
- Downgrade: se niega si hay evaluaciones (mismo criterio de la 018 y la 019).

### D3. Endpoint de evaluación (propuesta)

- `POST /publico/evaluaciones` (o bajo `/publico/productos/{id_publico}/…`; propón la forma) sin autenticación, con `{token, util}` y `extra="forbid"`.
- Respuestas: `201` sin datos internos; `409` si el token ya se usó; `422` si el token es inválido, está vencido o la firma no coincide (mismo cuerpo en los tres casos, para no dar pistas); `404` uniforme si el producto ya no está disponible o la elaboración dejó de ser visible.
- `no-store`, `noindex` y sin `Authorization` (igual que la consulta pública). Un token de productor presente se ignora.
- **Riesgo a documentar:** sin límite de solicitudes, un script puede pedir fichas y enviar evaluaciones en masa. El token exige pedir la ficha antes de cada envío, pero no lo impide. Queda como limitación (el rate limiting está fuera de alcance desde HU10).

### D4. Contrato público (propuesta)

- `FichaPublicaRead` suma `token_evaluacion: str | null`: presente solo con `estado_elaboracion = ok`, `null` en los demás estados.
- **Previsualización:** el token es `null` y la pregunta no se muestra, para que el productor no evalúe sus propios productos.
- La prueba de lista blanca de HU10 se actualiza con la clave nueva, explicándolo; no se relaja.

### D5. Interfaz pública (T11-02)

- Al final de la ficha (después del aviso al consumidor o justo antes, según el diseño de `ConsumerProduct.tsx`): "¿Esta información te resultó útil?" con botones "Sí" y "No" (44 px, texto, no solo íconos).
- Tras responder: agradecimiento y botones deshabilitados. Con 409, el mismo agradecimiento (la respuesta ya estaba registrada). Con 422 o red, un mensaje breve y la opción de reintentar.
- Al cambiar de elaboración (nueva consulta), la pregunta vuelve a aparecer con el token nuevo, salvo que esa elaboración ya esté marcada como evaluada en `localStorage` (D1).
- Sin token (`null`), la pregunta no se muestra.

### D6. Resultados para el productor (T11-03, propuesta)

- Endpoint autenticado (por ejemplo, en la respuesta de gestión del producto o uno propio) con, por producto: total de respuestas, respuestas "Sí" y porcentaje positivo. Sin respuestas → porcentaje `null` y la interfaz dice "Sin respuestas todavía", nunca "0 %".
- **Redondeo del porcentaje:** propón la regla (por ejemplo, entero con HALF_UP). PT11-06: 3 "Sí" y 1 "No" → 75 %.
- Dónde se muestra: propón entre Publicaciones (vista general y detalle) y el detalle del producto. Publicaciones es el lugar natural porque reúne lo que ve el consumidor.
- Opcional, si no cuesta: el desglose por elaboración en el detalle de la publicación (CA6 dice "resultados agregados"; CA7 exige solo por producto).
- Aislamiento: producto de otro productor → 404 (PT11-07).

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T11-01 | Modelo (migración 020) y endpoint anónimo de evaluación, con una sola respuesta por consulta | 1 |
| T11-02 | Pregunta "¿Esta información te resultó útil?" al final de la vista pública | 0,5 |
| T11-03 | Porcentaje de respuestas positivas por producto para el productor | 0,75 |
| T11-04 | Ejecutar y documentar pruebas (`docs/test/hu11-test-results.md`) | 0,75 |

**Evidencia esperada:** `docs/test/hu11-test-results.md` y la ejecución de la integración continua.

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT11-01 | Abrir una ficha pública | La pregunta aparece al final | 1 |
| PT11-02 | Responder "Sí" y luego, en otra consulta, "No" | Ambas respuestas se registran | 2 |
| PT11-03 | Responder sin sesión | Se registra sin pedir datos | 3 |
| PT11-04 | Intentar responder dos veces en la misma consulta | La segunda respuesta no se registra | 4 |
| PT11-05 | Revisar el registro guardado | Tiene producto, elaboración y respuesta; no tiene datos que identifiquen al consumidor | 5, 6 |
| PT11-06 | Con 3 respuestas "Sí" y 1 "No", ver el resultado como productor | Muestra 75 % de respuestas positivas | 6, 7 |
| PT11-07 | Ver los resultados de un producto de otro productor | Responde 404 | Aislamiento |

**Escenarios adicionales** (deben quedar cubiertos):

| Escenario | Resultado esperado |
|---|---|
| Token alterado, vencido o de otra elaboración | 422, sin registro, mismo cuerpo |
| Token de una elaboración que se ocultó o de un producto despublicado después de emitirlo | 404 uniforme, sin registro |
| `GET` de la ficha | No escribe en la base; el token solo aparece con `estado_elaboracion = ok` |
| Previsualización del productor | Token `null`; la pregunta no aparece |
| Con token de productor en la solicitud | Se ignora; la evaluación sigue siendo anónima |
| Producto sin respuestas | Porcentaje `null`, "Sin respuestas todavía" |
| Registro guardado | Conjunto exacto de columnas: ninguna con IP, user agent ni token completo |

**Mutaciones sugeridas:**

- aceptar dos veces el mismo token;
- no verificar la firma del token;
- guardar la IP o el user agent;
- emitir token en la previsualización;
- contar las respuestas "No" como positivas o calcular el porcentaje sobre otro total;
- omitir el filtro por productor en los resultados.

---

## 8. Fuera de alcance

- Comentarios de texto libre, estrellas o escalas.
- Límite de solicitudes y protección anti-bots (riesgo documentado).
- Exportar las evaluaciones o mostrarlas al consumidor.
- Cambiar una respuesta ya enviada.
