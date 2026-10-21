# TrazApp — Contexto de la HU13 para el agente de código

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md`. Léelo completo antes de trabajar en la HU13. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**; si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Se trabaja tarea por tarea.** Para cada tarea recibirás un prompt específico. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Detente al terminar cada tarea** y entrega un reporte: qué hiciste, decisiones que conviene revisar, archivos creados y modificados, y resultado de las pruebas.
3. **No hagas commit, push ni merge.** La desarrolladora revisa cada tarea y hace los commits.
4. **Antes de crear o modificar una migración, muéstrala y espera aprobación.** Mantenla como `.pendiente` hasta entonces. Si una prueba de migración necesita una guarda temporal, márcala como `TEMPORAL` y elimínala al activar la migración.
5. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta decisiones de modelo de datos o de comportamiento visible para el usuario.
6. **No borres datos ni estructuras existentes** salvo que el prompt lo pida.
7. **Nunca escribas contraseñas, tokens ni cadenas de conexión en el código o las pruebas.**
8. **Nunca agregues al repositorio** respaldos (`*.sql`) ni certificados o claves (`*.pem`).
9. **Pruebas de mutación:** antes de modificar un archivo para verificar que una prueba detecta una falla, copia el original y restáuralo desde esa copia. Al terminar, confirma con `git diff` que solo quedan los cambios de la tarea.
10. **Las pruebas automatizadas nunca consultan servicios externos reales.** Toda llamada a Open Food Facts se simula con respuestas grabadas (ver sección 7). La integración continua se ejecuta sin acceso garantizado a internet y no debe depender de la disponibilidad de terceros.
11. **Alcance de las pruebas por tarea (regla vigente desde T13-07).**
    - **Por tarea:** corre solo los archivos de prueba nuevos o modificados y los directamente relacionados. En las pruebas de mutación, máximo 3 o 4 mutaciones: las de mayor riesgo.
    - **Suites completas locales** (backend en SQLite y PostgreSQL, y frontend con `npm run build`): solo en T13-08, o si la tarea toca algo compartido: modelos, `conftest`, configuración de Vite o Vitest, o el cliente de la API.
    - **Las suites completas las corre GitHub Actions** en cada push.
    - Nunca corras dos suites de PostgreSQL a la vez: comparten la base `trazapp_test`.

---

## 2. Estado del proyecto

### Entorno

- **No hay servidor de producción por ahora.** El proyecto se ejecuta solo en local (Docker Compose con PostgreSQL y el backend; frontend con `npm run dev`). La Definición de Terminado se verifica en local y en la integración continua, sin el paso de despliegue.
- **Integración continua:** `.github/workflows/ci.yml` ejecuta tres trabajos en cada Pull Request hacia `main`: backend en SQLite, backend en PostgreSQL (con `TEST_DATABASE_URL` a una base `trazapp_test` temporal) y frontend (Vitest y `npm run build`). La variable `UPLOADS_ROOT` se define en el paso de pruebas. Las pruebas nuevas deben pasar en los tres trabajos.
- **Revisión de la base:** `017_alergenos_revisados_ht06`. **La HU13 no agrega ninguna migración** (no existe la 018): las columnas `ficha`, `fuente` y `fecha_recuperacion` ya estaban desde la HU04. La siguiente migración que se necesite sería la 018 (identificador de máximo 32 caracteres).
- **Línea base de pruebas** (merge de HT06, al empezar la HU13): backend SQLite 896 aprobadas y 147 omitidas; backend PostgreSQL 1043 aprobadas; frontend 555 aprobadas en 23 archivos (553 al cierre de HT06-08 más las 2 pruebas de la prueba intermitente de los recorridos).
- **Cierre de la HU13 (T13-08):** SQLite 1250 aprobadas y 148 omitidas; PostgreSQL 1398 aprobadas; frontend 898 aprobadas en 39 archivos. Detalle en `docs/hu13-test-results.md`.
- **Pruebas de recorrido** (`frontend/src/recorridos`): miden los escenarios de uso con un contador de interacciones. HU13 no debe alargar el escenario B; si se agrega el escaneo al flujo de insumos, agrega o ajusta un recorrido que lo mida.

### Historias del Sprint 2

| ID | Historia | Estado |
|---|---|---|
| HT03 | Adecuación del modelo existente | Terminada |
| HT04 | Validación técnica de fuentes de información | Terminada |
| HU03 | Gestión de formulación y versiones del producto | Terminada |
| HU04 | Gestión de insumos comerciales | Terminada |
| HU05 | Registro de elaboración | Terminada |
| HT06 | Simplificación del flujo de elaboración y revisión de alérgenos | Terminada |
| **HU13** | **Búsqueda de insumos mediante código de barras** | **Implementada y con pruebas automatizadas; probada en Chrome para Android; falta Safari para iOS (CA12 parcialmente verificado)** |

---

## 3. Lo ya implementado que la HU13 reutiliza

### Insumos comerciales (HU04)

**Modelo `InsumoComercial`** (tabla `insumos_comerciales`): `nombre`, `marca_origen`, `presentacion`, `codigo_barras`, `ingredientes_declarados`, `advertencias`, `ficha` (JSONB en PostgreSQL, JSON en SQLite), `fuente` (`"manual"` u `"open_food_facts"`, por defecto `"manual"`), `fecha_recuperacion` (con zona horaria), `habitual`, `activo`, `ingrediente_id`, `productor_id`.

- Código de barras único por productor cuando no es nulo (índice parcial).
- Alérgenos en `insumos_alergenos` con `tipo` `"contiene"` o `"trazas"`; un alérgeno no puede estar dos veces en un insumo.
- **Estado de revisión (HT06):** columna `alergenos_revisados_at`. `NULL` = sin revisar; con fecha = el productor declaró o confirmó los alérgenos. Si un insumo tiene filas de alérgenos, está revisado. Una elaboración **no se puede finalizar** con insumos sin revisar.

**Endpoints** bajo `/gestion/insumos`:
- `POST` acepta `fuente`, `fecha_recuperacion`, `ficha` y **`alergenos: [{alergeno_id, tipo}]`** (HT06), además de los campos del insumo. Con `alergenos` presente (aunque sea `[]`), crea el insumo y sus alérgenos en una transacción y lo deja **revisado**; sin el campo, queda sin revisar. **La HU13 registra los insumos recuperados con este mismo endpoint, enviando siempre `alergenos`.**
- Código de barras repetido: `409` con `detail: {mensaje, insumo_id, activo}`. Desde la HU13 el duplicado se detecta también en la otra forma del código (UPC-A de 12 dígitos y EAN-13 con cero inicial), en el `POST`, el `PATCH` y la consulta.
- **Reglas agregadas por la HU13 (`POST` y `PATCH`),** con `422` y `detail: {mensaje, campo}`: una `fuente` distinta de `manual` exige `fecha_recuperacion` (campo `fecha_recuperacion`; en el `PATCH` se juzga el resultado final y solo cuando el pedido toca `fuente` o `fecha_recuperacion`), y si la `ficha` trae `url`, debe ser una dirección http o https (campo `ficha`).
- Endpoints de alérgenos del insumo: `/gestion/insumos/{id}/alergenos` (asociar, cambiar tipo, quitar) y `PUT /gestion/insumos/{id}/alergenos` (reemplaza la lista completa y marca revisado; `[]` = revisado sin alérgenos).

**Validación del código de barras:**
- Backend: `backend/app/core/codigo_barras.py` (normalización, formatos EAN-13, EAN-8 y UPC-A, dígito verificador GS1).
- Frontend: `frontend/src/lib/codigoBarras.ts`.
- **Valida el código antes de consultar cualquier fuente.** Un código con dígito verificador inválido no corresponde a ningún producto real.

**Frontend reutilizable:**
- `useInsumoForm` acepta `initialValues`, `extraPayload` (`fuente`, `ficha`, `fecha_recuperacion`) e **`initialAlergenos`** (HT06): **es el punto de entrada para precargar el formulario con los datos recuperados.**
- `AlergenosSelector` (HT06): componente controlado del formulario de creación (`{items, sinAlergenos}`). Exige declarar alérgenos o marcar "Este insumo no contiene alérgenos". Un valor inicial **no** cuenta como revisado: la revisión ocurre al guardar el formulario.
- `InsumoForm` con `embedded`, `ingredienteFijo` y `onUseExisting`.
- `InsumoCreateDialog`: el diálogo de registro de insumo desde la elaboración.
- `apiClient.ts`: `ApiError` conserva `detail` cuando es un objeto.

### Elaboraciones (HU05)

- La pantalla de registro de la elaboración abre `InsumoCreateDialog` desde cada línea. **El escaneo debe estar disponible también ahí**, porque es el momento real en que el productor tiene el envase en la mano.
- La información conservada de cada elaboración copia, entre otros, el `codigo_barras` y los alérgenos con su tipo. Un insumo recuperado debe quedar con esos datos correctos.

### Catálogo de alérgenos

Tabla `alergenos` con `id`, `codigo`, `nombre` y `obligatorio_chile`. Endpoint `GET /gestion/alergenos`. Los valores de `codigo` no se modifican nunca.

| codigo | nombre | Obligatorio en Chile |
|---|---|---|
| gluten | Gluten | Sí |
| crustaceos | Crustáceos | Sí |
| huevos | Huevo | Sí |
| pescado | Pescado | Sí |
| cacahuetes | Maní | Sí |
| soja | Soya | Sí |
| lacteos | Leche | Sí |
| frutos_cascara | Nueces | Sí |
| sulfitos | Sulfitos | Sí |
| apio | Apio | No |
| mostaza | Mostaza | No |
| sesamo | Sésamo | No |
| altramuces | Altramuces | No |
| moluscos | Moluscos | No |

Confirma estos códigos contra la base antes de usarlos: son la referencia de la migración 009 y de la HT03.

---

## 4. HU13 — Búsqueda de insumos mediante código de barras

**Prioridad:** P1 · **Story Points:** 8 · **Estimación:** 7,5 h · **Rama:** `feature/hu13-codigo-barras`

### Historia de usuario

Como productor, quiero escanear con la cámara de mi celular el código de barras de un insumo, para obtener su información sin digitarla.

### Criterios de aceptación

| ID | Criterio |
|---|---|
| CA01 | Desde el registro de un insumo, el sistema debe permitir activar la cámara del dispositivo para escanear un código de barras. |
| CA02 | El sistema debe reconocer los formatos EAN-13, EAN-8 y UPC-A. |
| CA03 | Al reconocer un código, el sistema debe buscar el producto en bases de datos abiertas de productos, como Open Food Facts. |
| CA04 | El sistema debe permitir ingresar manualmente el número del código de barras si la cámara no está disponible o no logra leerlo. |
| CA05 | Si el navegador no permite el acceso a la cámara o el productor lo deniega, el sistema debe informarlo y ofrecer el ingreso manual del número. |
| CA06 | Los alérgenos deben identificarse a partir de la información de la fuente y del texto de ingredientes, y asociarse al catálogo del sistema distinguiendo los que el insumo contiene de las trazas; los que no puedan reconocerse se presentarán al productor para su asignación manual. |
| CA07 | Antes de confirmar el registro, el productor debe asociar el insumo a uno de sus ingredientes; si el insumo ya está registrado, el sistema debe indicarlo y permitir utilizar el registro existente. |
| CA08 | La información encontrada debe completar previamente el formulario de registro del insumo (HU04), y ninguna información se registrará sin confirmación del productor. |
| CA09 | La recuperación debe implementarse en un componente aislado, con un adaptador por fuente, reutilizable por otras fuentes de información. |
| CA10 | Si el producto no se encuentra, el sistema debe informarlo y permitir ingresarlo manualmente. |
| CA11 | El código de barras leído debe quedar registrado en la ficha del insumo, junto con la fuente y la fecha de recuperación. |
| CA12 | El escaneo debe funcionar en Chrome para Android y en Safari para iOS. |
| CA13 | La cámara debe detenerse al cerrar el escáner o al reconocer un código. |

### Tareas

| ID | Tarea | Estimación |
|---|---|---|
| T13-01 | Integrar el lector de códigos de barras con el detector nativo BarcodeDetector y ZBar-WASM como alternativa, restringido a EAN-13, EAN-8 y UPC-A, reutilizando el prototipo de HT04 | 1,25 h |
| T13-02 | Implementar el ingreso manual del código y el manejo de permisos de la cámara | 0,5 h |
| T13-03 | Desarrollar en el backend el componente de recuperación de información, con una interfaz de fuente y el adaptador de Open Food Facts | 1,5 h |
| T13-04 | Implementar la detección de alérgenos desde la información de la fuente y el texto de ingredientes, y su asociación al catálogo con tipo de declaración | 1,25 h |
| T13-05 | Implementar la precarga del formulario de HU04, la asociación del ingrediente, la detección de duplicados y la confirmación del productor | 1 h |
| T13-06 | Registrar el código, la fuente y la fecha de recuperación en la ficha del insumo | 0,25 h |
| T13-07 | Probar el escaneo en Chrome para Android y Safari para iOS con productos del conjunto de validación | 1 h |
| T13-08 | Ejecutar y documentar pruebas automatizadas | 0,75 h |

**Estado de las tareas:** T13-01 a T13-06 y T13-08 terminadas. T13-07: la preparación (HTTPS de desarrollo y guía) está terminada; la prueba en Chrome para Android se hizo el 20-10-2026 (11 códigos aprobados) y la de **Safari para iOS está pendiente por falta de dispositivo** (tarea «Verificar HU13 en Safari iOS»); los resultados están en `docs/hu13-prueba-celular.md`. **T13-09** (crear un ingrediente sin salir del registro de insumo) y **T13-10** (limpiar el texto de ingredientes recuperado: se corta el fabricante y los datos de contacto, se conserva un aviso de alérgenos posterior; la detección y la ficha usan el texto original) terminadas; ambas nacieron de la prueba en Android. Los resultados de las pruebas están en `docs/hu13-test-results.md`.

### Plan de pruebas

| ID | Caso de prueba | Resultado esperado |
|---|---|---|
| PT13-01 | Escanear un código EAN-13 en Chrome para Android | El código se reconoce y se inicia la búsqueda. |
| PT13-02 | Escanear un código EAN-13 en Safari para iOS | El código se reconoce y se inicia la búsqueda. |
| PT13-03 | Escanear un código UPC-A | El código se reconoce correctamente. |
| PT13-04 | Denegar el acceso a la cámara | El sistema lo informa y ofrece el ingreso manual. |
| PT13-05 | Ingresar manualmente un código de barras | Se realiza la búsqueda del producto. |
| PT13-06 | Buscar un producto existente en la fuente | El formulario de registro del insumo se completa con la información encontrada. |
| PT13-07 | Buscar un producto cuyo alérgeno no está etiquetado en la fuente, pero sí en sus ingredientes (por ejemplo, leche sin lactosa) | El alérgeno se detecta desde el texto de ingredientes y se sugiere al productor. |
| PT13-08 | Buscar un producto con alérgenos no reconocibles | Se presentan al productor para su asignación manual. |
| PT13-09 | Buscar un producto no encontrado en la fuente | El sistema lo informa y permite el ingreso manual. |
| PT13-10 | Buscar un producto ya registrado como insumo del productor | El sistema lo indica y permite utilizar el registro existente. |
| PT13-11 | Confirmar el registro sin asociar un ingrediente | El sistema impide el registro. |
| PT13-12 | Cancelar el registro después de la búsqueda | No se registra ninguna información. |
| PT13-13 | Confirmar el registro de un insumo encontrado | El insumo queda registrado con su código, fuente y fecha de recuperación. |
| PT13-14 | Cerrar el escáner o reconocer un código | La cámara se detiene. |
| PT13-15 | Consultar la fuente sin conexión o con la fuente no disponible | El sistema lo informa y permite el ingreso manual. |

**Valor entregado:** permitir al productor registrar sus insumos comerciales escaneando el código de barras del envase, sin transcribir su información, y detectar los alérgenos incluso cuando la fuente pública no los tiene etiquetados, reduciendo la carga de registro y mejorando la calidad de la información que llega al consumidor.

---

## 5. Decisiones técnicas tomadas (no las replantees)

### Lector de códigos (frontend)

- **Detector nativo `BarcodeDetector`** cuando el navegador lo ofrece (Chrome para Android) y, como alternativa (Safari para iOS), **`@undecaf/barcode-detector-polyfill` 0.9.23** (versión fijada), que usa ZBar-WASM (`@undecaf/zbar-wasm` 0.9.16, LGPL-2.1+) y se carga con `import()` diferido solo cuando hace falta. El polyfill no permite indicar dónde está el `.wasm`: un alias de Vite (`frontend/vite.alias-zbar.ts`) reemplaza la URL fija de la CDN para que `zbar.wasm` se sirva desde la propia aplicación. Licencias en `docs/licencias-terceros.md`.
- **`html5-qrcode` está descartado:** su decodificador en JavaScript (ZXing-js) no lee códigos EAN en Safari para iOS. Cambiar a `@zxing/browser` tampoco sirve: es el mismo decodificador.
- **Dynamsoft está descartado:** requiere licencia de pago.
- Restringir la detección a EAN-13, EAN-8 y UPC-A mejora la velocidad y la exactitud.
- **El prototipo validado está en la rama `spike/ht04-validacion-tecnica`.** Se reutiliza la parte de cámara y lectura, no su arquitectura: el prototipo consultaba Open Food Facts desde el navegador y guardaba un historial en `localStorage`, y nada de eso va en TrazApp.
- El acceso a la cámara requiere un contexto seguro (HTTPS o `localhost`).

### Recuperación de información (backend)

- **La lectura del código ocurre en el frontend; la consulta a las fuentes ocurre en el backend.** El frontend nunca llama a Open Food Facts directamente.
- **Endpoint de consulta:** `GET /gestion/insumos/consulta-codigo/{codigo}` (declarado antes de `/{insumo_id}`). `200` con `encontrado` verdadero o falso (la propuesta de insumo, `contiene`, `trazas` y `sin_reconocer`, y la `fecha_recuperacion` de la consulta); `401` sin token; `422` con `{mensaje}` si el código es inválido; `409` con `{mensaje, insumo_id, activo}` si el productor ya lo tiene; `503` con `{mensaje, motivo}` si la fuente no está disponible. No escribe nada en la base.
- Código: paquete `backend/app/services/recuperacion/` (`base.py` con el `Protocol FuenteProducto`, `modelos.py`, `open_food_facts.py`, `alergenos.py`, `service.py`); las tablas de palabras de la detección, en `backend/app/core/alergenos_palabras.py`.
- **Componente aislado con una interfaz común de fuente y un adaptador por fuente.** La HU07 (Sprint 3) agregará un adaptador de scraping sin modificar el resto.
- **Open Food Facts exige que cada aplicación se identifique** con el encabezado `User-Agent` (el configurado es `TrazApp/2.0 (proyecto academico; https://github.com/lauritaggz/trazapp)`, en ASCII porque `httpx` rechaza otros caracteres en las cabeceras; se define en `Settings`). Respeta sus límites de uso y define un tiempo de espera explícito para cada consulta (`off_timeout_seconds`).
- **La consulta no registra nada.** Devuelve una propuesta de insumo; el registro ocurre solo cuando el productor confirma, usando el `POST /gestion/insumos` existente.
- **No usar UPCitemdb** ni otras fuentes comerciales: no son abiertas, su cobertura es principalmente de Estados Unidos y no entregan ingredientes ni alérgenos en el formato necesario.

### Alérgenos

- **Las etiquetas de alérgenos de Open Food Facts no son confiables.** En la validación técnica, una leche sin lactosa (código 7802910000971) no tenía etiquetado el alérgeno leche, aunque sus ingredientes dicen "leche".
- Por eso, los alérgenos se identifican **desde dos fuentes**:
  1. Las etiquetas de la fuente (`allergens_tags` → "contiene"; `traces_tags` → "trazas"), asociadas al catálogo por su código (por ejemplo, `en:milk` → `lacteos`, `en:gluten` → `gluten`, `en:soybeans` → `soja`, `en:peanuts` → `cacahuetes`, `en:nuts` → `frutos_cascara`, `en:eggs` → `huevos`, `en:fish` → `pescado`, `en:crustaceans` → `crustaceos`, `en:sulphur-dioxide-and-sulphites` → `sulfitos`, `en:sesame-seeds` → `sesamo`, `en:mustard` → `mostaza`, `en:celery` → `apio`, `en:lupin` → `altramuces`, `en:molluscs` → `moluscos`). Confirma los códigos exactos de Open Food Facts con las respuestas grabadas.
  2. **El texto de ingredientes en español**, buscando palabras asociadas a cada alérgeno (por ejemplo, para leche: leche, lactosa, suero de leche, caseína, mantequilla, crema, queso; para gluten: trigo, harina de trigo, cebada, centeno, avena, gluten, sémola). Las frases como "puede contener", "contiene trazas de" o "elaborado en líneas que procesan" indican tipo **trazas** para los alérgenos que siguen.
- Si un alérgeno aparece como "contiene" en una fuente y como "trazas" en otra, queda como **"contiene"**.
- **Todos los alérgenos detectados son sugerencias**: el productor los revisa y confirma antes del registro. Las etiquetas que no se puedan asociar al catálogo se presentan para asignación manual.
- **Integración con HT06:** las sugerencias se cargan en `AlergenosSelector` mediante `initialAlergenos`. El insumo queda revisado **solo cuando el productor guarda el formulario**; el backend nunca marca la revisión a partir de una sugerencia. Si la fuente no sugiere ningún alérgeno, el selector queda vacío y el productor debe declarar o confirmar "no contiene" (no se marca automáticamente).
- La detección por texto debe implementarse como una función pura, con su lista de palabras en un único lugar, para poder ampliarla y reutilizarla en la HU07.

### Registro y duplicados

- **Antes de proponer el registro, revisa si el productor ya tiene un insumo con ese código de barras.** Si existe y está activo, se ofrece usarlo; si está inactivo, reactivarlo. Es el mismo comportamiento del `409` de la HU04 y de `onUseExisting` en el diálogo de la elaboración.
- El productor siempre debe asociar el insumo a uno de sus ingredientes antes de confirmar (en el diálogo de la elaboración, el ingrediente ya viene fijo).
- Al confirmar, el insumo queda con `codigo_barras`, `fuente = "open_food_facts"`, `fecha_recuperacion` y la respuesta relevante de la fuente en `ficha`.

---

## 6. Puntos de integración en la interfaz

El escaneo debe estar disponible en los dos lugares donde se registra un insumo:
1. **La pantalla "Nuevo insumo"** (HU04).
2. **El diálogo "Registrar insumo nuevo" de la elaboración** (`InsumoCreateDialog`, HU05).

En ambos, el flujo es el mismo:
1. "Escanear código de barras" abre el escáner; también hay un campo para escribir el número.
2. Al reconocer o ingresar un código válido, la cámara se detiene y se consulta el backend.
3. Según el resultado:
   - **Encontrado:** el formulario se precarga y los alérgenos sugeridos se muestran para confirmar.
   - **Ya registrado por el productor:** se ofrece usar el existente (o reactivarlo).
   - **No encontrado o fuente no disponible:** se informa y se continúa con el ingreso manual, conservando el código de barras ya leído.
4. Nada se registra hasta que el productor confirma el formulario.

---

## 7. Conjunto de prueba (respuestas reales para grabar)

Estos códigos se escanearon desde envases reales durante la HT04 (todos con dígito verificador válido). Úsalos para **grabar una vez** respuestas reales de Open Food Facts y guardarlas como archivos de prueba; las pruebas automatizadas leen esos archivos y nunca consultan la red.

| Código | Resultado en Open Food Facts | Utilidad para las pruebas |
|---|---|---|
| 7802910000971 | Loncoleche sin lactosa; ingredientes con "leche", **sin el alérgeno etiquetado** | PT13-07 (detección desde el texto) |
| 8445291716841 | Galleta Triton sabor vainilla; con ingredientes y alérgenos | PT13-06 |
| 7808709504767 | Leche entera; con ingredientes, sin alérgenos etiquetados | Detección desde el texto |
| 7801505231974 | Azúcar flor; con ingredientes | Producto sin alérgenos |
| 7801505231950 | Azúcar rubia; **sin ingredientes** | Producto encontrado con datos incompletos |
| 400001143070 | Atún lomitos en aceite (UPC-A) | PT13-03 |
| 7790272001005 | Aceite de girasol; con alérgenos etiquetados | Etiquetas de la fuente |
| 7802410002239 | Polvos de hornear; sin ingredientes | Datos incompletos |
| 8413700064197 | Bicarbonato sódico | Producto importado |
| 7803600002053 | Encontrado, **sin nombre** | Datos mínimos |
| 7801505000358 | No encontrado | PT13-09 |

**Ya grabado (T13-03):** las respuestas están en `backend/tests/fixtures/off/` (12 archivos: los 11 códigos de la tabla más `0400001143070`, la forma EAN-13 del atún). Hallazgo: Open Food Facts ya resuelve el UPC-A de 12 dígitos por sí solo (las respuestas de `400001143070` y `0400001143070` son idénticas), así que el reintento del adaptador con la forma EAN-13 no se dispara con datos reales; se prueba con fixtures combinadas. Se grabaron con `backend/scripts/grabar_respuesta_off.py`, que solo consulta la red cuando alguien lo ejecuta a mano; las pruebas nunca lo hacen.

Además, cubre con respuestas construidas a mano: tiempo de espera agotado, error del servidor de la fuente, respuesta mal formada y un producto con etiquetas de alérgenos que no existen en el catálogo (PT13-08).

**Cobertura medida en la HT04** (16 insumos reales): 69 % encontrados, 56 % con ingredientes y 12 % con alérgenos etiquetados. El ingreso manual es indispensable.

---

## 8. Pruebas en un celular real (T13-07)

Sin servidor de producción, la prueba en el celular se hace desde la red local, y requiere atención:
- La cámara solo funciona en un **contexto seguro**: `localhost` en el computador, o HTTPS desde el celular. Una dirección IP local sin HTTPS no permite usar la cámara.
- Si el frontend se sirve por HTTPS y el backend por HTTP, el navegador bloquea las llamadas (contenido mixto). La forma más simple es que el servidor de desarrollo de Vite sirva por HTTPS y **reenvíe las llamadas a la API** (proxy), para que el celular solo hable con un origen.
- Safari para iOS es más estricto con los certificados autofirmados que Chrome.
- **Implementado en T13-07:** `npm run dev:https` (en `frontend/`) sirve la aplicación por HTTPS con un certificado propio (`@vitejs/plugin-basic-ssl`, versión exacta, solo con `VITE_DEV_HTTPS=1`), la expone en la red local y reenvía `/api/...` al backend local. No afecta a `npm run dev` ni al build. Los pasos y las tablas de resultados están en `docs/hu13-prueba-celular.md`; la prueba con el celular la hace la desarrolladora.

---

## 9. Fuera de alcance

- Búsqueda de insumos por nombre mediante scraping (HU07, Sprint 3). El componente de recuperación debe quedar preparado para recibir ese adaptador, sin implementarlo.
- Fuentes comerciales de pago.
- Guardar historiales de escaneo.
- Cambiar el modelo de insumos de la HU04, salvo que una tarea lo justifique y se apruebe antes.
