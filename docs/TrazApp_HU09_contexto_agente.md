# TrazApp — Contexto de la HU09 para el agente de código

**HU09 — Habilitar publicación del producto** (Sprint 3)

*Creado el 06-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU06_contexto_agente.md` (metodología de Pull Request draft) y a `TrazApp_HU07_contexto_agente.md` (reglas de trabajo vigentes). Léelo completo antes de trabajar en la HU09. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Tarea por tarea.** Cada tarea tiene su propio prompt. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Modo ahorro por defecto** (salvo que el prompt diga lo contrario):
   - No uses el navegador ni levantes servidores; al final entrega una lista corta de qué debe revisar la desarrolladora visualmente.
   - **No hagas commit ni push ni esperes el CI.** Deja los cambios sin commit y entrega el mensaje de commit listo para copiar, terminado en la línea `Co-Authored-By` que ya usan los commits de HU06 y HU07. La desarrolladora hace commit, push y revisa el CI.
   - Fase 1 (análisis sin código y espera) solo cuando el prompt la pida. **T09-01 y T09-05 la llevan** (ver sección 5).
   - Pruebas locales: solo las nuevas y las afectadas. Mutaciones solo en lógica nueva (máximo 4 por tarea, salvo que el prompt pida más).
   - `docs/hu09-test-results.md` se completa en la tarea de cierre (T09-06); en cada tarea anota horas y desvíos en el reporte.
3. **Formato del reporte** (y nada más):
   1. Desvíos respecto de lo pedido (o "ninguno").
   2. Decisiones que necesitas (o "ninguna").
   3. Pruebas: nuevas / adaptadas (indica si alguna aserción cambió y por qué) / resultado local.
   4. Mutaciones: tabla mutación → pruebas que fallan.
   5. Horas reales.
   6. Qué revisar visualmente (si aplica).
   7. Mensaje de commit.
4. **Rama y PR:** trabajas solo en la rama de la historia, que tiene un Pull Request en **draft** hacia `main`. Nunca hagas merge, push a `main`, `push --force`, ni cambies el PR a "ready for review"; no borres ramas ni modifiques la configuración de la integración continua.
5. **Migraciones:** muéstrala y espera aprobación (mantenla como `.pendiente`). La siguiente es la **018**; las migraciones se numeran por orden de merge, así que HU14 pasará a la 019.
6. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta cambios de contrato de la API ni de comportamiento visible para el usuario.
7. **No borres datos ni estructuras existentes.** Nunca ejecutes `docker compose down -v`.
8. **Nunca escribas contraseñas, tokens ni cadenas de conexión** en el código, las pruebas o la salida. No imprimas el `.env`. No uses el correo de la desarrolladora en código, cabeceras ni documentos.
9. **Cuentas de prueba** para verificar con datos; nunca la cuenta real de la desarrolladora.
10. **Nunca uses el puerto 5175** (es el de la desarrolladora).
11. **Mutaciones:** copia el archivo original, restáuralo desde la copia y confirma con `git diff` que solo quedan los cambios de la tarea.
12. **Las pruebas existentes que cambien** se actualizan explicando por qué. Nunca se eliminan ni se relajan para que la suite pase.
13. **Inmutabilidad de las elaboraciones finalizadas:** es el mecanismo central del proyecto (RT-01/RT-03). No relajes, desactives ni reescribas los triggers de PostgreSQL sin una decisión aprobada (ver D3).

---

## 2. Estado y entorno

- **Rama:** `feature/hu09-publicacion-producto`, creada desde `main` actualizado **después del merge de HU07**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442** (`.env` de la desarrolladora).
- **Migración vigente:** `017_alergenos_revisados_ht06`. HU09 usa la **018**.
- **Integración continua:** backend en SQLite, backend en PostgreSQL y frontend en cada push al PR draft. Línea base: la del último CI verde de `main` tras el merge de HU07.
- **Trampa del contenedor:** el backend en Docker trae `TEST_DATABASE_URL`; para pruebas en SQLite usa `unset TEST_DATABASE_URL`. Nunca dos suites a la vez sobre `trazapp_test`.
- **Convención de errores:** `404` inexistente o de otro productor; `422` datos inválidos; `409` conflicto de estado; `detail` con `{mensaje, ...}`.
- **Triggers:** los triggers de inmutabilidad existen solo en PostgreSQL. Cualquier prueba sobre ellos debe correr en la suite de PostgreSQL; en SQLite se marca como omitida, igual que las existentes.

---

## 3. Historia y criterios

**Como productor, quiero habilitar la publicación de un producto y obtener su código QR, para que el consumidor pueda consultar la información de sus elaboraciones.**

Prioridad P1 · 5 SP · 6 h · Depende de HU01, HU03, HU05 y HU06. Bloquea a HU10 y HU08.

| ID | Criterio |
|---|---|
| CA1 | El productor puede habilitar y deshabilitar la publicación de un producto. |
| CA2 | Puede consultar el estado de publicación de sus productos. |
| CA3 | La publicación solo puede habilitarse si el producto tiene formulación y al menos una elaboración finalizada. |
| CA4 | Al habilitar la publicación, el productor puede descargar el código QR del producto en un formato apto para impresión (PNG de alta resolución o SVG). |
| CA5 | El código QR es único y permanente para cada producto. |
| CA6 | El productor puede ocultar una elaboración finalizada específica de la consulta pública, y volver a mostrarla. |
| CA7 | Ocultar una elaboración no modifica su información conservada ni su disponibilidad para el productor. |
| CA8 | Si el consumidor consulta una elaboración oculta, el sistema indica que su información no se encuentra disponible, sin exponer datos de la elaboración. |
| CA9 | Si el producto no está publicado, el código QR muestra un mensaje indicando que la información no se encuentra disponible, sin exponer datos del producto. |
| CA10 | La estructura de la información pública es definida por TrazApp y no puede ser modificada por el productor. |

**Nota sobre CA8 y CA9:** la vista pública es de HU10. En HU09 se dejan listos los datos y las reglas (estado de publicación, identificador público, elaboración oculta). La verificación final de PT09-09 y PT09-10 se hace cuando exista la vista de HU10; antes, sobre la respuesta de la API (ver D6).

---

## 4. Lo que ya existe (punto de partida)

Verifica cada punto en el código antes de apoyarte en él; esta lista es un resumen, no la fuente de verdad.

- **Producto (HU01):** CRUD con aislamiento por productor y eliminación lógica; costo de producción y precio de venta manuales y opcionales; categorías.
- **Formulación versionada (HU03):** `Producto → VersionProducto`; modificar una formulación ya usada en una elaboración genera una nueva versión.
- **Elaboración (HU05):** estados borrador → finalizada. La finalización ocurre en una transacción única; los triggers de PostgreSQL impiden modificar una elaboración finalizada y sus `UsoInsumo` (`informacion_conservada`).
- **Historial (HU06):** endpoint de elaboraciones paginado, con filtros por producto, estado y rango de fechas, y búsqueda por código; interfaz del historial y detalle con la información conservada.
- **Regresión obligatoria:** las pruebas de HU01, HU03, HU05, HU06 y RT-01 (`test_trazabilidad_historica.py`), además de las de HU07 en `src/insumos/`.

**Diseño**

- Referencia visual: `docs/diseno/DISEÑOS SPRINT 3/`. No uses `docs/diseno/sprint3/` salvo para comparar versiones.
- Sistema de diseño real de la app: `docs/DESIGN.md` (tokens y componentes de `frontend/src`), no el CSS del prototipo de Figma Make.
- Pantallas relevantes:
  - `Publications.tsx`: publicar el producto, "lotes visibles" y el ID público / QR (HU09, y parte de HU10).
  - `ConsumerProduct.tsx`: ficha pública; en el prototipo se abre desde Publicaciones o por `#/p/{id}` (HU10; en HU09 solo como referencia de la URL).
  - Producto · detalle (`Dashboard.tsx` y páginas hijas).
  - `Elaborations.tsx`: historial (HU06).
- **Vocabulario:** el prototipo usa "lote" donde el modelo vigente usa **elaboración** (SC-01). En la interfaz se usa siempre "elaboración". "Lote" se reserva para los lotes de insumos.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en la Fase 1 de la tarea indicada.

### D1. Estado de publicación e identificador público (propuesta, T09-01)

- En `productos`:
  - `publicado` (booleano, no nulo, por defecto `false`);
  - `id_publico` (texto, único, nulo hasta la primera publicación);
  - opcionalmente `publicado_en` (fecha de la última habilitación).
- `id_publico` es **aleatorio y opaco**, por ejemplo un token de `secrets.token_urlsafe` o un UUID4. No es el `id` interno ni el código del producto, porque un valor secuencial permite enumerar productos.
- Se genera **en la primera habilitación** y **nunca se regenera**: deshabilitar y volver a habilitar conserva el mismo valor (CA5, PT09-05).
- Alternativa a evaluar: generarlo para todos los productos en la migración, con un backfill. Indica cuál prefieres y por qué.
- `publicado` e `id_publico` **no** se aceptan en `POST`/`PATCH` de producto (CA10). Revisa cómo se comportan hoy los esquemas ante campos extra (rechazo con 422 o descarte silencioso) y propón el comportamiento para estos campos.

### D2. URL del QR (propuesta, T09-03)

- El QR codifica una URL pública del frontend con la forma `{URL_PUBLICA_APP}/p/{id_publico}`. Confirma la forma de las rutas del frontend; el prototipo usa `#/p/{id}`, pero la app real puede no usar rutas con hash.
- `URL_PUBLICA_APP` es una **variable de entorno**, nunca un valor escrito en el código. Agrégala a `.env.example` sin valores reales.
- **Limitación a dejar documentada:** la permanencia del QR depende de que el dominio no cambie. Un QR generado en desarrollo apunta al entorno local y no sirve para imprimir.
- Para PT09-04, el celular solo abrirá la consulta si alcanza ese host (IP de la red local o ambiente desplegado), y la vista no existirá hasta HU10. En HU09 basta verificar que el QR **decodifica a la URL esperada**.

### D3. Elaboración oculta e inmutabilidad (Fase 1 obligatoria, T09-01)

Ocultar una elaboración **finalizada** es una escritura sobre un registro que los triggers protegen. Antes de escribir código, inspecciona los triggers y propón una de estas opciones:

- **Opción A:** columna `oculta` (booleano, por defecto `false`) en `elaboraciones`, y ajuste del trigger para permitir **solo** el cambio de esa columna en una finalizada. Implica tocar el mecanismo de inmutabilidad: el ajuste debe ser mínimo y debe haber pruebas de que cualquier otra columna sigue bloqueada.
- **Opción B:** tabla aparte `elaboraciones_ocultas` (`elaboracion_id` como PK y FK, más la fecha), sin tocar los triggers. Ocultar inserta y mostrar elimina.

Indica cuál recomiendas, con su impacto en las consultas de HU06, HU08 y HU10. En ambos casos:

- solo se ocultan elaboraciones **finalizadas**; un borrador responde 409;
- `informacion_conservada` y los `UsoInsumo` no cambian (CA7, PT09-08).

### D4. Endpoints (propuesta, T09-02 y T09-04)

| Método y ruta | Efecto | Respuestas |
|---|---|---|
| `POST /gestion/productos/{id}/publicacion` | Habilita la publicación (sin cuerpo) | 200 con el estado; 409 si faltan requisitos; 404 si es de otro productor o no existe |
| `DELETE /gestion/productos/{id}/publicacion` | Deshabilita la publicación | 200 con el estado; 404 |
| `GET /gestion/productos/{id}/qr?formato=png\|svg` | Descarga el QR | 200 con `image/png` o `image/svg+xml` y `Content-Disposition` con el código del producto; 409 si no está publicado; 422 si el formato es inválido; 404 |
| `POST /gestion/elaboraciones/{id}/ocultar` | Oculta una elaboración finalizada | 200; 409 si es borrador; 404 |
| `POST /gestion/elaboraciones/{id}/mostrar` | Vuelve a mostrarla | 200; 404 |

Criterios a confirmar:

- **Idempotencia:** habilitar un producto ya publicado o ocultar una elaboración ya oculta responde 200 sin cambios, no 409. Confirma o propone otra opción.
- **Mensaje de 409 por requisitos:** incluye en `detail` la lista de requisitos faltantes (`sin_formulacion`, `sin_elaboracion_finalizada`) para que la interfaz muestre todos a la vez.
- **"Tiene formulación":** define si significa una versión vigente con al menos un ingrediente. Revisa si una elaboración finalizada implica ya una formulación. Si es así, PT09-02 se mantiene igual: el caso "sin formulación" también es "sin elaboraciones" y el mensaje debe nombrar ambos requisitos.
- **Producto eliminado lógicamente:** no se puede publicar (409). Si se elimina uno publicado, propón si se despublica automáticamente o si HU10 lo trata como no disponible.
- **Ocultar todas las elaboraciones:** si el producto está publicado y se ocultan todas, ¿se permite? Propón la opción. La alternativa más simple es permitirlo, avisar en la interfaz y que HU10 muestre "no disponible".
- **Estado en las respuestas:** las respuestas de producto (listado y detalle) incluyen `publicado` e `id_publico`; las de elaboración (listado y detalle de HU06) incluyen `oculta`. Todo es aditivo.

### D5. Generación del QR (propuesta, T09-03)

- Se genera en el backend, para que los archivos sean consistentes y la generación se pueda probar.
- Biblioteca: propone entre `segno` (Python puro, PNG y SVG sin Pillow) y `qrcode` (requiere Pillow para PNG), con su peso en dependencias.
- Parámetros para impresión:
  - corrección de errores **M** o **Q**;
  - zona de silencio de 4 módulos;
  - PNG de al menos **1000 px** de lado;
  - SVG con `viewBox` y sin tamaño fijo en píxeles.
- Las pruebas verifican el tipo de contenido, que la imagen sea válida y que **el contenido codificado sea la URL esperada** (por ejemplo, comparando la matriz generada con la de la URL esperada). No agregues dependencias del sistema como `zbar` solo para decodificar en las pruebas sin consultarlo.
- El QR **no** se guarda en la base de datos ni en disco; se genera bajo demanda.

### D6. Consulta pública antes de HU10 (decisión pendiente)

La nota del plan de pruebas dice que PT09-09 y PT09-10 se verifican "sobre la respuesta de la API" antes de HU10, pero ninguna tarea de HU09 crea un endpoint público, porque eso es T10-01. Propón una de estas opciones:

- **(a)** Crear en HU09 un endpoint público mínimo que solo resuelva la disponibilidad, sin datos de la elaboración. HU10 lo extendería después.
- **(b)** Dejar PT09-09 y PT09-10 como "pendientes de HU10" en `docs/hu09-test-results.md` y probar en HU09 solo las reglas de dominio (servicio) que usará el endpoint.

En cualquier caso, la regla de no exponer datos se aplica así:

- un producto no publicado y un `id_publico` inexistente producen **la misma respuesta**;
- una elaboración oculta no expone ningún dato propio.

### D7. Interfaz (Fase 1 obligatoria, T09-05)

- **Ubicación:** el plan dice "en el detalle del producto"; el diseño tiene una sección propia del menú, **Publicaciones** (`Publications.tsx`). Compara ambos y propón: solo en el detalle, solo en Publicaciones, o Publicaciones como vista general con acceso desde el detalle. Indica qué parte del diseño de Publicaciones corresponde a HU10 y queda fuera.
- **Ocultar y mostrar elaboraciones:** propón dónde va la acción (detalle del producto, Publicaciones o detalle de la elaboración del historial de HU06) y cómo se indica una elaboración oculta en el historial. CA7 exige que siga visible para el productor; se propone una etiqueta "Oculta al público".
- Si se habilita la publicación sin cumplir los requisitos, se muestran los faltantes con un enlace a la acción correspondiente (crear formulación, registrar o finalizar una elaboración).
- **Descarga del QR:** botones "Descargar PNG" y "Descargar SVG"; vista previa del QR en pantalla; el ID público visible y copiable.
- **Listado de productos:** el estado de publicación es visible (PT09-01).
- **Deshabilitar:** pide confirmación y explica que el QR impreso seguirá funcionando, pero mostrará "información no disponible".
- **Accesibilidad:** vocabulario y tamaños según HT07 (textos de al menos 12 px, áreas táctiles de 44 px). Las descargas deben funcionar en celular (PT09-13).
- **Fuera de HU09:** la previsualización de la ficha pública (T10-05, HU10).

### Decisiones confirmadas en T09-05 (09-11-2026): diferencias aprobadas con el diseño (`Publications.tsx`)

**Cambio de plan:** se reemplaza la opción (a) («solo en el detalle del producto») por la opción (c): **Publicaciones tal como está en el diseño**, con vista general y detalle por producto. Lo hecho en la primera entrega (lógica de habilitar y deshabilitar, requisitos faltantes, estados) se reutiliza en un hook compartido (`usePublicacionProducto`).

Entrega en cuatro partes, cada una con su revisión visual: B) backend de conteos, grupo «Herramientas» del menú, vista general `/publicaciones` y bloque compacto en el detalle del producto; C) detalle `/publicaciones/{productoId}` con el estado y las elaboraciones finalizadas (ocultar y mostrar); D) panel del QR y descargas.

1. **Backend (aditivo):** `ProductoGestionRead` suma `elaboraciones_finalizadas` y `elaboraciones_visibles` (finalizadas no ocultas), calculados en una sola consulta agrupada para todo el listado. `tiene_formulacion` ya existía.
2. **Menú:** grupo «Herramientas» con «Publicaciones». No se agrega «Calculadora de costos» (HU14).
3. **Vista general `/publicaciones`:** métricas (publicados de total, listos para publicar = formulación y al menos una finalizada, elaboraciones visibles = suma), aviso del QR único y lista de productos con insignia, Formulación/Elaboración (✓ o enlace a la acción), «N elaboraciones finalizadas», interruptor y «Gestionar». El interruptor se desactiva cuando los conteos indican que el producto no cumple; el 409 se sigue manejando por si los datos cambiaron.
4. **Detalle `/publicaciones/{productoId}`:** «Volver a Publicaciones», título con insignia, «Estado de publicación» con interruptor, «Elaboraciones finalizadas» (historial de HU06 filtrado por producto y estado finalizada, con «Cargar más») con interruptor Visible/Oculta por fila, aviso «La ficha pública no se puede personalizar» y panel «Código QR permanente». Ocultar SIEMPRE pide confirmación («El consumidor no verá esta elaboración. Si es la única visible del producto, la consulta pública mostrará «información no disponible».»); mostrar no la pide.
5. **Detalle del producto:** un bloque compacto con la insignia y el enlace «Gestionar publicación»; no duplica controles.
6. **Ocultar no va en `ElaboracionDetail`.** La etiqueta «Oculta al público» se muestra en el historial, en la sección de elaboraciones del producto y en el encabezado del detalle de la elaboración (informativa); en las finalizadas, el encabezado del detalle tiene un enlace «Gestionar visibilidad» a `/publicaciones/{productoId}`.
7. **Requisitos faltantes (409):** se listan todos. `sin_formulacion` lleva a la sección de formulación del producto; `sin_elaboracion_finalizada` lleva al historial filtrado por el producto.
8. **QR y descarga:** la vista previa usa el PNG (blob + `createObjectURL` en `<img>`, liberado al desmontar). «Descargar PNG» y «Descargar SVG» usan `<a download>` con el blob y el nombre de `Content-Disposition`; sin `window.open`, sin pestañas nuevas y sin detectar iOS por user agent. En pantallas pequeñas, una nota fija: «Si la descarga no comienza, mantén presionada la imagen del QR y elige «Guardar imagen».»
9. **Diferencias con el diseño:** el enlace es `/p/{id_publico}` (no `#/p/`: la app usa `BrowserRouter`); el ID público es el token generado (no un código legible); hay descarga PNG además de SVG; no hay «Vista previa pública» ni «Comprobar ficha pública» ni «Abrir como consumidor» (HU10); no se muestran «unidades» porque el modelo de elaboración no tiene ese dato.
10. **Elaboración «Predeterminada» (criterio para HU10):** el historial de HU06 ordena por **`fecha_elaboracion` descendente y, a igual fecha, por `id` descendente** (no por `finalizada_at`). La elaboración mostrada por defecto en la consulta pública es la primera **visible** (finalizada y no oculta) en ese mismo orden.
11. **Nombre del archivo del QR:** la interfaz usa el de `Content-Disposition` si el navegador puede leerlo; si no, arma el mismo nombre (`qr-{código saneado}.{ext}`, con el id de respaldo). Desde otro origen (Netlify → API) el navegador solo expone ese encabezado si la API lo declara en `expose_headers` de CORS, que hoy no está configurado: queda pendiente decidir si se agrega (cambio de una línea en `app/main.py`).
12. **Fuera de T09-05:** el archivo `docs/hu09-prueba-celular.md` es de T09-06.

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T09-01 | Estado de publicación del producto, identificador público permanente y estado oculto de la elaboración, con su migración (018) | 0,75 |
| T09-02 | Endpoints para habilitar y deshabilitar la publicación, validando formulación y al menos una elaboración finalizada | 0,75 |
| T09-03 | Generación del código QR del producto en PNG de alta resolución y SVG | 1 |
| T09-04 | Endpoints para ocultar y volver a mostrar una elaboración finalizada | 0,5 |
| T09-05 | Interfaz de publicación, descarga del QR y acción de ocultar elaboraciones | 1,75 |
| T09-06 | Ejecutar y documentar pruebas, incluidas mutaciones y prueba en celular (`docs/hu09-test-results.md`) | 1,25 |

**Evidencia esperada:** `docs/hu09-test-results.md`, los QR generados (un PNG y un SVG de un producto de prueba) y la ejecución de la integración continua.

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT09-01 | Habilitar la publicación de un producto con formulación y una elaboración finalizada | Queda publicado y su estado se muestra en el listado de productos | 1, 2 |
| PT09-02 | Habilitar un producto sin formulación | Se rechaza con un mensaje claro | 3 |
| PT09-03 | Habilitar un producto con formulación pero solo con borradores | Se rechaza con un mensaje claro | 3 |
| PT09-04 | Descargar el QR en PNG y en SVG y leerlo con la cámara de un celular | Ambos abren la consulta pública del producto (en HU09: decodifican a la URL esperada; ver D2) | 4 |
| PT09-05 | Deshabilitar y volver a habilitar la publicación | El QR y su enlace son los mismos | 1, 5 |
| PT09-06 | Comparar los QR de dos productos | Son distintos | 5 |
| PT09-07 | Ocultar una elaboración y volver a mostrarla | Cambia su visibilidad pública en ambos sentidos | 6 |
| PT09-08 | Ocultar una elaboración y revisarla como productor | Su información conservada no cambia y sigue en el historial | 7 |
| PT09-09 | Consultar públicamente una elaboración oculta | Indica que no está disponible, sin datos de la elaboración (ver D6) | 8 |
| PT09-10 | Escanear el QR de un producto no publicado | Indica que no está disponible, sin datos del producto (ver D6) | 9 |
| PT09-11 | Intentar enviar campos de presentación pública en la API | La API no los acepta | 10 |
| PT09-12 | Publicar, ocultar o descargar el QR de un producto de otro productor | Responde 404 | Aislamiento |
| PT09-13 | Publicar y descargar el QR desde un celular | La acción y la descarga funcionan | 1, 4 |

**Casos adicionales sugeridos:**

- ocultar un borrador responde 409;
- intentar modificar otra columna de una elaboración finalizada sigue fallando después de la migración (solo PostgreSQL; obligatorio si se elige la opción A de D3);
- `formato` inválido en la descarga del QR responde 422;
- descargar el QR de un producto no publicado responde 409.

**Mutaciones mínimas** (cada una debe hacer fallar al menos una prueba):

- contar borradores como elaboraciones finalizadas al validar la publicación;
- regenerar `id_publico` al volver a habilitar;
- permitir ocultar un borrador;
- codificar en el QR el `id` interno en lugar de `id_publico`;
- omitir el filtro por productor en publicar, ocultar o descargar;
- (opción A de D3) que el trigger permita modificar una columna distinta de `oculta` en una finalizada.

---

## 8. Fuera de alcance

- La vista pública del consumidor, la selección de la elaboración, los alérgenos agrupados y la previsualización de la ficha (HU10, T10-05).
- La evaluación de utilidad (HU11).
- La identificación de elaboraciones relacionadas y su estado de publicación u ocultamiento en esa vista (HU08).
- Personalizar la información pública (CA10): campos visibles, textos, colores o logo en el QR.
- Guardar el QR como archivo, hacer QR por elaboración o acortar URLs.
- El despliegue del ambiente público. La URL de producción se configura por variable de entorno cuando exista.
