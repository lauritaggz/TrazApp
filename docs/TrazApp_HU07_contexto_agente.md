# TrazApp — Contexto de la HU07 para el agente de código

**HU07 — Recuperación de información de insumos mediante scraping** (Sprint 3)

*Creado el 05-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo) y a `TrazApp_HU06_contexto_agente.md` (metodología de Pull Request draft). Léelo completo antes de trabajar en la HU07. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Tarea por tarea.** Cada tarea tiene su propio prompt. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Modo ahorro por defecto** (salvo que el prompt diga lo contrario):
   - No uses el navegador ni levantes servidores; al final entrega una lista corta de qué debe revisar la desarrolladora visualmente.
   - **No hagas commit ni push ni esperes el CI.** Deja los cambios sin commit y entrega el mensaje de commit listo para copiar, terminado en la línea `Co-Authored-By` que ya usan los commits de HU06. La desarrolladora hace commit, push y revisa el CI.
   - Fase 1 (análisis sin código y espera) solo cuando el prompt la pida.
   - Pruebas locales: solo las nuevas y las afectadas. Mutaciones solo en lógica nueva (máximo 4 por tarea, salvo que el prompt pida más).
   - `docs/hu07-test-results.md` se completa en la tarea de cierre (T07-10); en cada tarea anota horas y desvíos en el reporte.
3. **Formato del reporte** (y nada más):
   1. Desvíos respecto de lo pedido (o "ninguno").
   2. Decisiones que necesitas (o "ninguna").
   3. Pruebas: nuevas / adaptadas (indica si alguna aserción cambió y por qué) / resultado local.
   4. Mutaciones: tabla mutación → pruebas que fallan.
   5. Horas reales.
   6. Qué revisar visualmente (si aplica).
   7. Mensaje de commit.
4. **Rama y PR:** trabajas solo en la rama de la historia, que tiene un Pull Request en **draft** hacia `main`. Nunca hagas merge, push a `main`, `push --force`, ni cambies el PR a "ready for review"; no borres ramas ni modifiques la configuración de la integración continua.
5. **Migraciones:** si una tarea necesita una, muéstrala y espera aprobación (mantenla como `.pendiente`). Usa el siguiente número libre e indícalo: la reserva del 018 para HU14 no es fija, se numera por orden de merge.
6. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta cambios de contrato de la API ni de comportamiento visible para el usuario.
7. **No borres datos ni estructuras existentes.** Nunca ejecutes `docker compose down -v`.
8. **Nunca escribas contraseñas, tokens ni cadenas de conexión** en el código, las pruebas o la salida. No imprimas el `.env`. No uses el correo de la desarrolladora en código, cabeceras ni documentos.
9. **Cuentas de prueba** para verificar con datos; nunca la cuenta real de la desarrolladora.
10. **Nunca uses el puerto 5175** (es el de la desarrolladora).
11. **Mutaciones:** copia el archivo original, restáuralo desde la copia y confirma con `git diff` que solo quedan los cambios de la tarea.
12. **Las pruebas existentes que cambien** se actualizan explicando por qué. Nunca se eliminan ni se relajan para que la suite pase.
13. **Red externa:** las pruebas automáticas **nunca** consultan Jumbo ni Open Food Facts reales; usan respuestas grabadas (fixtures). Las consultas reales solo se hacen en T07-01 y T07-09, en volumen mínimo, con pausa entre consultas y un `User-Agent` genérico de la aplicación (sin datos personales).

---

## 2. Estado y entorno

- **Rama:** `feature/hu07-scraping-insumos`, creada desde `main` actualizado **después del merge de HU06 (PR #22)**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442** (`.env` de la desarrolladora).
- **Migración vigente:** `017_alergenos_revisados_ht06` (HU06 no agregó migraciones).
- **Integración continua:** backend en SQLite, backend en PostgreSQL y frontend en cada push al PR draft. Línea base: la del último CI verde de `main` tras el merge de HU06.
- **Trampa del contenedor:** el backend en Docker trae `TEST_DATABASE_URL`; para pruebas en SQLite usa `unset TEST_DATABASE_URL`. Nunca dos suites a la vez sobre `trazapp_test`.
- **Convención de errores:** `404` inexistente o de otro productor; `422` datos inválidos; `409` conflicto de estado; `detail` con `{mensaje, ...}`.

---

## 3. Historia y criterios

**Como productor, quiero buscar un producto comercial y obtener automáticamente su información desde sitios de venta de productos, para registrar mis insumos sin transcribir manualmente su ficha.**

Prioridad P1 · 8 SP · 12 h · Depende de HU04 y HU13.

| ID | Criterio |
|---|---|
| CA1 | La información se obtiene mediante scraping de sitios públicos de venta de productos comerciales. |
| CA2 | El productor puede buscar un producto por nombre o marca. |
| CA3 | Los resultados muestran nombre, marca y presentación. |
| CA4 | Al seleccionar un resultado se recuperan ingredientes declarados, alérgenos y advertencias disponibles. |
| CA5 | Los alérgenos se asocian al catálogo, distinguiendo "contiene" de trazas; los no reconocidos se presentan para asignación manual. |
| CA6 | La información precarga el formulario de insumo (HU04); el productor la revisa, corrige y completa. |
| CA7 | Antes de confirmar, el productor asocia el insumo a uno de sus ingredientes. |
| CA8 | Si el producto ya está registrado como insumo del productor, se indica y se permite usar el registro existente. |
| CA9 | Nada se registra sin confirmación del productor. |
| CA10 | Sin resultados o fuente sin respuesta: se informa y se permite el ingreso manual. |
| CA11 | La ficha registrada conserva el origen: fuente y fecha de recuperación. |
| CA12 | La fuente de scraping es un adaptador adicional del componente de recuperación de HU13. |
| CA13 | Conjunto de validación de 50 productos con información de referencia; se mide el porcentaje de fichas correctas. |
| CA14 | Al escanear un código encontrado en Open Food Facts, se busca el mismo producto en Jumbo y se combina **solo si el código de barras coincide**. |
| CA15 | La ficha indica la fuente de cada campo y de cada alérgeno (Jumbo, Open Food Facts o detectado en los ingredientes). |
| CA16 | Los alérgenos se combinan por unión; un "libre de" **nunca** descarta un alérgeno. |
| CA17 | Si ninguna fuente informa "puede contener", se solicita al productor confirmarlo según el envase. |

**Flujo acordado**

- **Por código de barras:** Open Food Facts → con nombre y marca se busca en Jumbo → se combina solo si el `gtin` de la ficha de Jumbo coincide. Si Open Food Facts no encuentra el código, se ofrece la búsqueda por nombre.
- **Por nombre o marca:** búsqueda en Jumbo → el productor elige un resultado → se recupera su ficha.
- **Al final:** ingredientes de Jumbo (o de Open Food Facts si Jumbo no los tiene); "contiene" y "puede contener" por unión de las fuentes más lo detectado en el texto de ingredientes; cada dato con su fuente; si nadie informa "puede contener", se pregunta; nada se guarda sin confirmación.

**Marco normativo (DS 977, art. 107):** los alérgenos van en "Contiene"; "Puede contener" es obligatorio cuando hay riesgo de contaminación cruzada. Por eso CA16 y CA17 no son opcionales.

---

## 4. Lo que ya existe (punto de partida)

**Backend (`backend/app/services/recuperacion/`)**

- `base.py`: `FuenteProducto` (Protocol) con `nombre: str` y `buscar(codigo_barras) -> ProductoFuente | None`; `FuenteNoDisponibleError(motivo)` con motivos `timeout`, `sin_conexion`, `limite_de_uso`, `error_servidor`, `respuesta_invalida` y sus mensajes.
- `modelos.py`: `ProductoFuente` (frozen): `codigo_barras`, `nombre`, `marca`, `presentacion`, `ingredientes`, `etiquetas_alergenos`, `etiquetas_trazas`, `url`, `ficha` (dict crudo).
- `open_food_facts.py`: adaptador vigente. `alergenos.py`: detector de alérgenos (etiquetas + texto). `limpieza.py`: limpieza de ingredientes.
- `service.py`: `RecuperacionService.consultar(productor, codigo)`: valida el código, detecta duplicado (`DuplicateCodigoBarrasError`), llama a `fuente.buscar`, detecta alérgenos y devuelve `ConsultaCodigoRead`. **Solo lee; no guarda.**
- Ruta: `GET /gestion/insumos/consulta-codigo/{codigo}` en `api/routes/gestion_insumos.py`; la fuente se inyecta en `api/dependencies.py` (`get_recuperacion_service`).
- Modelo `Insumo`: `codigo_barras`, `ingredientes_declarados`, `advertencias`, `ficha` (JSON/JSONB), `fuente` (`String(50)`, por defecto manual), `fecha_recuperacion`, `alergenos_revisados_at`.
- `httpx` ya está en `requirements.txt`.

**Frontend**

- `types/consultaCodigo.ts`, `types/insumo.ts`, `hooks/useInsumoForm.ts` (precarga del formulario).
- Pruebas existentes de HU13 en `src/insumos/` (`hu13.origen`, `hu13.busqueda`, `hu13.ingrediente`, `hu13.precarga-lib`), además de `hu04.insumos` y `ht06.alergenos`. Son regresión obligatoria.

**Jumbo (observado en el análisis del sprint, a confirmar en T07-01)**

- `ai.txt` autoriza el scraping con atribución.
- Búsqueda: `POST /api/catalog` con `fullText`.
- La página del producto trae JSON-LD con `gtin`, precio, `additionalProperty` "alimentaryConditions" ("Libre de…") e ingredientes y "puede contener" dentro del bloque FAQ.
- Los alérgenos **no** vienen declarados de forma consistente: se obtienen de "puede contener" y de la detección en el texto de ingredientes.
- "Libre de…" es **solo informativo**: nunca elimina un alérgeno (ej.: queso "Libre de lactosa" con leche en los ingredientes → Leche en "contiene").

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en el análisis de T07-01 o de la tarea indicada.

### D1. Adaptador de Jumbo (propuesta)

- `JumboFuente` implementa `FuenteProducto` (`buscar(codigo_barras)`: búsqueda por texto del código y verificación del `gtin`).
- La búsqueda por nombre no existe en el Protocol actual. Propuesta: un segundo Protocol `FuenteBusquedaNombre` con `buscar_por_nombre(texto) -> list[ResultadoBusqueda]` y `obtener(id_o_url) -> ProductoFuente`, que Jumbo implementa además de `FuenteProducto`. **No se modifica `FuenteProducto`.**
- Solo `httpx` y parseo de JSON/JSON-LD; **sin navegador** (Playwright) en producción.
- Tiempo límite por consulta y total acorde a la meta de ≤ 10 s; los errores se mapean a `FuenteNoDisponibleError` con los motivos existentes.

### D2. Combinación de fuentes (propuesta)

- Un adaptador compuesto `FuenteCombinada` que también implementa `FuenteProducto`: Open Food Facts → Jumbo por nombre y marca → combina solo si el `gtin` coincide. Así `RecuperacionService` sigue recibiendo **una** fuente (CA12, PT07-13).
- Reglas por campo: ingredientes de Jumbo, si no de Open Food Facts; nombre, marca y presentación: Open Food Facts con respaldo de Jumbo (confirmar en T07-04).
- Alérgenos: unión de etiquetas de ambas fuentes + detección en el texto; "contiene" prevalece sobre "puede contener" si el mismo alérgeno aparece en ambas.
- **Decisión pendiente para T07-01:** CA15 exige la fuente por campo y por alérgeno. `ProductoFuente` y `ConsultaCodigoRead` no la tienen. Propón el cambio mínimo y **aditivo** (campos opcionales nuevos, sin romper HU13) y si implica tocar `RecuperacionService`, explica qué y por qué. PT07-13 se reinterpreta como "el contrato y el comportamiento de HU13 no cambian", no como "ningún archivo se toca".
- Si Jumbo falla o no responde, se sigue solo con Open Food Facts e informando (CA10, PT07-09).

### D3. Registro del origen (propuesta, T07-05)

- Sin migración: la lista de fuentes se guarda en `ficha` (`{"fuentes": [{"fuente", "fecha", "campos": [...]}], ...}`); la columna `fuente` guarda un valor corto (ej. `open_food_facts`, `jumbo`, `combinada`) y `fecha_recuperacion` la de la consulta.
- Si concluyes que hace falta una columna nueva, propón la migración y espera.

### D4. Búsqueda por nombre en la interfaz (T07-06)

- En el registro de insumos, junto al escaneo: campo de búsqueda → resultados (nombre, marca, presentación) → selección → precarga del formulario de HU04 → asociación del ingrediente → confirmación.
- Duplicados: si el resultado trae `gtin`, se usa la detección por código existente; si no, propón el criterio (ej. nombre + marca normalizados) y espera.
- Fuente visible por campo y por alérgeno (CA15); confirmación de "puede contener" cuando ninguna fuente lo informa (CA17).
- Vocabulario y tamaños según HT07 (textos ≥ 12 px, áreas táctiles de 44 px).

### D5. Conjunto de validación (T07-09)

- 50 productos con información de referencia **tomada del envase** (no de la fuente que se mide). La desarrolladora arma la referencia; el agente prepara el formato del archivo y el script de medición.
- Métricas: porcentaje de fichas correctas (meta provisional ≥ 70 %) y tiempo ≤ 10 s en al menos el 90 %. Define antes de medir qué cuenta como "ficha correcta" (por campo y global).

### Decisiones confirmadas en T07-01 (05-11-2026) — prevalecen sobre D1–D5

Hallazgos de Jumbo: la búsqueda con el código de barras como texto devuelve 0 resultados; "puede contener" no está en el JSON-LD ni en el FAQ sino en el HTML renderizado por el servidor (acordeón "Ingredientes"); el `gtin` puede no ser un EAN válido (granel con PLU); la ficha pesa ~1,5 MB y hay picos de hasta 16 s.

1. **D1:** `JumboFuente` implementa **solo** `FuenteBusquedaNombre` (`buscar_por_nombre`, `obtener`); no tiene `buscar(codigo)`. El adaptador que recibe `RecuperacionService` es `FuenteCombinada`, que implementa `FuenteProducto`. `FuenteProducto` no cambia.
2. **D2:** `FuenteCombinada` prueba hasta 3 candidatos de Jumbo, con `gtin` normalizado y validado. **Presupuesto total de 10 s por consulta, incluido Open Food Facts:** cada paso usa el tiempo restante; si se agota, se sigue solo con OFF e informando. Sin reintentos.
3. **CA15:** la fuente por alérgeno es una **lista** (un alérgeno puede venir de Jumbo, OFF y del texto a la vez). `ProductoFuente` recibe un campo opcional `fuente: str | None` explícito, además de los mapas de fuentes por campo. Todo aditivo y opcional; HU13 sin cambios de comportamiento.
4. **"Puede contener":** se parsea con `html.parser` de la biblioteca estándar, anclado en el texto "Puede contener"; no en clases CSS ni con regex sobre el HTML.
5. **Marca** en la búsqueda por nombre: se toma de la ficha (JSON-LD), no del `brand` de la búsqueda.
6. **Granel (PLU o `gtin` inválido):** no se combina y no se guarda como `codigo_barras`.
7. **Consultas reales:** se respeta el número que indique el prompt; si hace falta más, se pregunta. Todo exceso se reporta como desvío.
8. **Pendiente para T07-10:** agregar a la sección de riesgos de `docs/hu07-test-results.md` la fragilidad del HTML de Jumbo (el bloque "Puede contener" depende del marcado del servidor y puede cambiar sin aviso).
9. **Condiciones de uso (ai.txt/robots.txt):** solo `/api/catalog` y `/{slug}/p` sin query strings; atribución "Fuente: Jumbo" visible; `User-Agent` genérico; una consulta por acción del usuario.

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T07-01 | Verificar Jumbo: datos estructurados sin navegador, búsqueda por código como texto, cobertura sobre una muestra y condiciones de uso | 1 |
| T07-02 | Adaptador de Jumbo sobre `FuenteProducto`, con búsqueda por nombre o marca | 1,5 |
| T07-03 | Ficha de Jumbo desde sus datos estructurados: ingredientes, código de barras, "puede contener" y condiciones alimentarias (solo informativas) | 1,5 |
| T07-04 | Servicio de combinación: búsqueda en Jumbo con nombre y marca de Open Food Facts, verificación del código, reglas por campo y unión de alérgenos | 2 |
| T07-05 | Registrar en la ficha del insumo las fuentes, con fecha y campos aportados | 0,75 |
| T07-06 | Búsqueda por nombre en el registro de insumos: resultados, precarga, asociación del ingrediente y duplicados | 1,5 |
| T07-07 | Fuente de cada dato y alérgeno, y confirmación de "puede contener" | 1 |
| T07-08 | Ofrecer búsqueda por nombre cuando Open Food Facts no encuentra el código | 0,5 |
| T07-09 | Medir fichas correctas y tiempo sobre el conjunto de validación (OE5) | 1 |
| T07-10 | Ejecutar y documentar pruebas (respuestas grabadas, mutaciones, celular, `docs/hu07-test-results.md`) | 1,25 |

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT07-01 | Buscar "queso mantecoso" en Jumbo (respuesta grabada) | Resultados con nombre, marca y presentación | 1, 2, 3 |
| PT07-02 | Seleccionar un resultado con "puede contener" (Loncoleche) | Ingredientes y trazas desde los datos estructurados | 4, 5 |
| PT07-03 | Escanear 7802900001193 (queso Quilque): OFF y Jumbo con el mismo código | Combina e indica la fuente de cada dato | 14, 15 |
| PT07-04 | Código cuyo primer resultado en Jumbo tiene otro `gtin` | No combina; solo Open Food Facts | 14 |
| PT07-05 | Código que Open Food Facts no encuentra | Ofrece búsqueda por nombre | 10 |
| PT07-06 | A en OFF, B en Jumbo, C detectado en el texto | Quedan A, B y C, cada uno con su fuente | 5, 15, 16 |
| PT07-07 | "Libre de Lactosa" con "leche" en ingredientes | Leche en "contiene" | 16 |
| PT07-08 | Ninguna fuente informa "puede contener" | Se pide confirmarlo según el envase | 17 |
| PT07-09 | Jumbo no responde dentro del tiempo límite | Informa y continúa con OFF o ingreso manual | 10 |
| PT07-10 | Producto ya registrado como insumo | Lo indica y permite usar el existente | 8 |
| PT07-11 | Precargar y cancelar | No se escribe nada en la base | 6, 7, 9 |
| PT07-12 | Confirmar un insumo combinado | Guarda fuentes con fecha y campos aportados | 11, 15 |
| PT07-13 | Diseño del componente | Jumbo es adaptador; contrato y comportamiento de HU13 sin cambios | 12 |
| PT07-14 | Conjunto de validación de 50 productos | % de fichas correctas (≥ 70 %) y ≤ 10 s en ≥ 90 % | 13 |
| PT07-15 | Flujo completo en celular | Escaneo, combinación, revisión y confirmación funcionan | 2, 6, 14 |

**Mutaciones mínimas** (cada una debe hacer fallar al menos una prueba):

- combinar aunque el `gtin` no coincida;
- descartar un alérgeno por un "libre de";
- usar intersección en vez de unión de alérgenos;
- no pedir confirmación de "puede contener" cuando ninguna fuente lo informa;
- guardar el insumo al precargar (sin confirmación);
- perder la fuente de un campo al combinar.

---

## 8. Fuera de alcance

- Otros supermercados o fuentes adicionales (quedan como trabajo futuro).
- Precio del insumo: lo usa HU14 (calculadora), no esta historia. Si el parseo del JSON-LD lo trae sin costo, puede quedar en `ficha`, pero no se muestra ni se usa aquí.
- Actualización periódica o automática de fichas ya registradas.
- Scraping con navegador (Playwright o similar) en producción.
- Usar las condiciones "Libre de…" para quitar alérgenos.
