# TrazApp — Contexto de la HU10 para el agente de código

**HU10 — Consulta pública mediante QR** (Sprint 3)

*Creado el 09-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU06_contexto_agente.md` (metodología de Pull Request draft), a `TrazApp_HU09_contexto_agente.md` (publicación, identificador público y elaboraciones ocultas) y a `docs/hu09-test-results.md` (sección de pendientes para HU10). Léelo completo antes de trabajar en la HU10. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Tarea por tarea.** Cada tarea tiene su propio prompt. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Modo ahorro por defecto** (salvo que el prompt diga lo contrario):
   - No uses el navegador ni levantes servidores; al final entrega una lista corta de qué debe revisar la desarrolladora visualmente.
   - **No hagas commit ni push ni esperes el CI.** Deja los cambios sin commit y entrega el mensaje de commit listo para copiar, terminado en la línea `Co-Authored-By` que ya usan los commits de HU09. La desarrolladora hace commit, push y revisa el CI.
   - Fase 1 (análisis sin código y espera) solo cuando el prompt la pida.
   - `docs/hu10-test-results.md` se completa en la tarea de cierre (T10-06); en cada tarea anota horas y desvíos en el reporte.
3. **Pruebas: local vs. CI.**
   - Localmente, dentro del contenedor Docker, corres **solo** las pruebas nuevas de la tarea y las directamente afectadas por sus cambios.
   - La regresión completa (SQLite, PostgreSQL y frontend) la ejecuta el CI cuando la desarrolladora hace push. No la corras localmente salvo que el prompt lo pida.
   - En el reporte indica qué corriste local y qué queda para el CI, con **números exactos por archivo**.
   - Mutaciones solo en lógica nueva (máximo 4 por tarea, salvo que el prompt pida más).
4. **Formato del reporte** (y nada más):
   1. Desvíos respecto de lo pedido (o "ninguno").
   2. Decisiones que necesitas (o "ninguna").
   3. Pruebas: nuevas / adaptadas (indica si alguna aserción cambió y por qué) / resultado local por archivo.
   4. Mutaciones: tabla mutación → pruebas que fallan.
   5. Horas reales.
   6. Qué revisar visualmente (si aplica).
   7. Mensaje de commit.
5. **Rama y PR:** trabajas solo en la rama de la historia, que tiene un Pull Request en **draft** hacia `main`. Nunca hagas merge, push a `main`, `push --force`, ni cambies el PR a "ready for review"; no borres ramas ni modifiques la configuración de la integración continua.
6. **Migraciones:** si una tarea necesita una, muéstrala y espera aprobación (mantenla como `.pendiente`). La siguiente libre es la **019**. Las pruebas que fijan la cabeza de Alembic o comparan con igualdad exacta el estado tras `upgrade head` se rompen con cada migración nueva: revísalas antes de entregar.
7. **Dependencias nuevas:** si agregas una dependencia (Python o npm), indícalo en el reporte y avisa que hay que **reconstruir la imagen** (`docker compose up -d --build`). Nunca la instales solo en el contenedor en ejecución: eso oculta el problema hasta que el contenedor se recrea (ocurrió con `segno` en HU09).
8. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta cambios de contrato de la API ni de comportamiento visible para el usuario.
9. **No borres datos ni estructuras existentes.** Nunca ejecutes `docker compose down -v`.
10. **Nunca escribas contraseñas, tokens ni cadenas de conexión** en el código, las pruebas o la salida. No imprimas el `.env`. No uses el correo de la desarrolladora en código, cabeceras ni documentos.
11. **Cuentas de prueba** para verificar con datos; nunca la cuenta real de la desarrolladora.
12. **Nunca uses el puerto 5175** (es el de la desarrolladora).
13. **Mutaciones:** copia el archivo original, restáuralo desde la copia y confirma con `git diff` (o `cmp` para archivos nuevos) que solo quedan los cambios de la tarea.
14. **Las pruebas existentes que cambien** se actualizan explicando por qué. Nunca se eliminan ni se relajan para que la suite pase.
15. **Inmutabilidad de las elaboraciones finalizadas** (RT-01) y **tabla `elaboraciones_ocultas`** (HU09): no se modifican los triggers ni se escribe sobre elaboraciones finalizadas.
16. **Endpoint público sin autenticación:** todo lo que devuelve es visible para cualquier persona en internet. Cada campo de la respuesta pública se agrega **explícitamente** (lista blanca); nunca se serializa un modelo o un esquema interno completo.

---

## 2. Estado y entorno

- **Rama:** `feature/hu10-consulta-publica`, creada desde `main` actualizado **después del merge de HU09**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442** (`.env` de la desarrolladora).
- **Migración vigente:** `018_publicacion_producto_hu09`. Se espera que HU10 **no** necesite migración; si la necesita, se propone.
- **Integración continua:** backend en SQLite, backend en PostgreSQL y frontend en cada push al PR draft. Línea base: el último CI verde de `main` tras el merge de HU09.
- **Trampa del contenedor:** el backend en Docker trae `TEST_DATABASE_URL`; para pruebas en SQLite usa `unset TEST_DATABASE_URL`. Nunca dos suites a la vez sobre `trazapp_test`. El venv de Windows no tiene datos de zona horaria: corre las pruebas en el contenedor.
- **Convención de errores:** `404` inexistente o de otro productor; `422` datos inválidos; `409` conflicto de estado; `detail` con `{mensaje, ...}`.
- **URL pública:** `URL_PUBLICA_APP` (HU09). La URL del QR es `{URL_PUBLICA_APP}/p/{id_publico}`, y el frontend usa `BrowserRouter`.
- **Prueba en celular (T10-06):** el celular no puede abrir `localhost`. La desarrolladora configurará temporalmente la IP de su PC en la red local para el frontend (`URL_PUBLICA_APP`) **y** para la URL de la API que usa el frontend; Vite debe escuchar en la red. Esto lo hace la desarrolladora; el agente solo indica qué variables intervienen.

---

## 3. Historia y criterios

**Como consumidor, quiero escanear el código QR de un producto y seleccionar la elaboración correspondiente, para conocer los insumos utilizados y sus alérgenos declarados.**

Prioridad P1 · 8 SP · 8 h · Depende de HU06, HU09 y del diseño de HT05. Bloquea a HU11.

| ID | Criterio |
|---|---|
| CA1 | El consumidor puede acceder sin registrarse. |
| CA2 | La vista muestra el producto y, por defecto, su elaboración finalizada y visible más reciente. |
| CA3 | El consumidor puede seleccionar otra elaboración mediante el código o la fecha impresos en el envase. |
| CA4 | Para cada ingrediente se muestra el insumo utilizado, su marca u origen, sus ingredientes declarados y sus advertencias. |
| CA5 | Los alérgenos del conjunto de insumos utilizados se presentan en dos grupos: los que la elaboración contiene y los que puede contener (trazas). |
| CA6 | Si la elaboración corresponde a una versión del producto distinta de la vigente, la vista lo indica mediante una nota, **sin mostrar la numeración interna de versiones**. |
| CA7 | La información presentada corresponde a la conservada en la elaboración, no a la vigente. |
| CA8 | La vista no muestra información interna de gestión, como lotes de insumos. |
| CA9 | La vista indica que la información no reemplaza el rotulado obligatorio ni certifica que el producto sea seguro para una persona determinada. |
| CA10 | El productor puede previsualizar la ficha pública de un producto antes de habilitar su publicación. |
| CA11 | La vista se adapta a dispositivos móviles. |

Además, la vista hereda de HU09 dos reglas que no figuran en esta lista: un producto no publicado muestra "información no disponible" sin datos del producto (CA9 de HU09), y una elaboración oculta muestra "información no disponible" sin datos de la elaboración (CA8 de HU09).

**Flujo esperado** (según las tareas del Sprint Planning y HT05):

1. El consumidor escanea el QR y abre `/p/{id_publico}` sin cuenta.
2. Si el producto no está disponible (no publicado, eliminado o inexistente), ve un mensaje de "información no disponible" sin datos del producto.
3. Si está disponible, ve el producto y, por defecto, la **elaboración visible más reciente** (mismo criterio que la etiqueta "Predeterminada" de HU09).
4. Puede seleccionar otra elaboración por el **código o la fecha** impresos en el envase.
5. La ficha muestra los insumos utilizados y los alérgenos agrupados en **"Contiene"** y **"Puede contener"**, construidos solo desde la **información conservada**; indica si la elaboración corresponde a una versión anterior de la receta, e incluye el aviso de que la información no reemplaza el rotulado obligatorio ni certifica que el producto sea seguro para una persona determinada.
6. Si la elaboración pedida está oculta o no se encuentra, se informa sin exponer sus datos.

**Criterios de HT05 que la vista debe respetar** (diseño de la ficha pública):

- Prioriza dispositivos móviles.
- Incluye el producto, la selección de la elaboración por código o fecha, los insumos utilizados y los alérgenos agrupados en "contiene" y "puede contener".
- Incluye el aviso al consumidor.
- Incluye los estados de elaboración no disponible, producto no publicado y código de elaboración no encontrado.
- **No muestra información interna de gestión, como lotes de insumos.**

---

## 4. Lo que ya existe (punto de partida)

Verifica cada punto en el código antes de apoyarte en él; esta lista es un resumen, no la fuente de verdad.

**De HU09**

- `productos.publicado`, `productos.id_publico` (token aleatorio, único, permanente) y `productos.publicado_en`.
- Tabla `elaboraciones_ocultas` (PK = FK a la elaboración) y trigger solo PostgreSQL que rechaza ocultar una no finalizada.
- **Funciones de visibilidad del servicio (T09-04):** "¿el producto está disponible públicamente?" (publicado y no eliminado) y "¿la elaboración es visible públicamente?" (producto disponible, finalizada y no oculta). **HU10 las reutiliza; no las reescribas.**
- `construir_url_publica(id_publico)` en `app/core/publicacion.py`.
- Criterio de "Predeterminada": registrado en las decisiones de T09-05 del contexto de HU09 (campo de ordenamiento del historial). La elaboración por defecto de la consulta pública usa **exactamente** ese criterio.
- Publicaciones (`/publicaciones` y `/publicaciones/:productoId`) sin los botones "Vista previa pública" y "Comprobar ficha pública", que se agregan en T10-05.

**De HU04/HU05/HT06/HU07**

- `UsoInsumo.informacion_conservada`: copia inmutable del insumo al finalizar la elaboración. **La consulta pública se construye solo desde aquí** (RT-03).
- Alérgenos por insumo distinguiendo "contiene" y trazas ("puede contener"); "Libre de…" es solo informativo y nunca quita un alérgeno.
- `Elaboracion` (código, fecha, estado, versión del producto, usos) y `VersionProducto` (formulación versionada).

**Diseño**

- Referencia visual: `docs/diseno/DISEÑOS SPRINT 3/ConsumerProduct.tsx` (ficha pública; en el prototipo se abre por `#/p/{id}`, pero la app usa `/p/{id}`). No uses `docs/diseno/sprint3/`.
- Sistema de diseño real: `docs/DESIGN.md` (tokens y componentes de `frontend/src`), no el CSS del prototipo.
- **HT05** (diseño de la ficha pública) está cubierta por `ConsumerProduct.tsx`. La desarrolladora revisó el diseño en un celular (HT05-04, 09-11-2026) y funciona bien.
- Vocabulario: el prototipo usa "lote" donde el modelo usa **elaboración**. "Lote" se reserva para los lotes de insumos, que **no** se muestran al consumidor.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en la Fase 1 de T10-01, que define el contrato completo de la API pública (T10-01 a T10-03), aunque T10-01 solo implemente su parte.

### D1. Forma de la API pública (propuesta)

Prefijo sin autenticación, separado de `/gestion` (por ejemplo `/publico`). Dos alternativas:

- **(a)** `GET /publico/productos/{id_publico}` devuelve el producto y la elaboración por defecto; `GET /publico/productos/{id_publico}/elaboraciones?codigo=…|fecha=…` resuelve otra.
- **(b)** Un solo endpoint con parámetros opcionales `codigo` o `fecha`.

**Decisión confirmada por la desarrolladora (09-11-2026):** la API publica la **lista de elaboraciones visibles** (código y fecha) y el consumidor las ve todas para elegir la suya; también puede buscar por código o fecha. Se prioriza la transparencia hacia el consumidor. El control del productor sobre qué se expone es **ocultar elaboraciones** (HU09). Las ocultas nunca aparecen en la lista. Para el informe: la lista revela la frecuencia de producción; se acepta conscientemente y se mitiga con el ocultamiento.

### D2. Respuestas uniformes (obligatorio; confirmado por la desarrolladora el 09-11-2026, igual que los pendientes de HU09)

- Producto **no publicado**, **eliminado** e `id_publico` **inexistente** producen **exactamente la misma respuesta** (mismo código y mismo cuerpo), para no revelar qué productos existen.
- Elaboración **oculta**: indica "información no disponible" sin ningún dato de la elaboración (CA8 de HU09).
- **A resolver:** HT05 diseña estados distintos para "elaboración no disponible" y "código no encontrado", y PT10-04 pide "indica que no se encontró" para un código inexistente. Si una elaboración oculta responde "no disponible" y una inexistente "no se encontró", quien pruebe códigos puede saber que una elaboración oculta existe. Propón si se distinguen (fiel al diseño y a PT10-04) o si se unifican en un mensaje que cubra ambos casos (por ejemplo, "No encontramos información disponible para esa elaboración"), con su justificación.

### D3. Origen de cada dato (propuesta)

- **Composición, insumos y alérgenos:** solo desde `informacion_conservada` de los usos de la elaboración. Nunca desde el insumo vigente (RT-03).
- **Identidad del producto** (nombre, contenido neto, presentación, imagen): no está conservada por elaboración. Propón si se usa la vigente (y se acepta que un cambio de nombre se refleje en elaboraciones antiguas) u otra alternativa.
- **Versión anterior:** si la `VersionProducto` de la elaboración no es la vigente, la respuesta lo indica (T10-03), sin exponer el contenido de la versión vigente.
- **Lista blanca de campos:** propón la lista exacta de campos públicos. Quedan **excluidos**, como mínimo: lotes de insumos y sus códigos y vencimientos, costos y precios, ids internos (producto, elaboración, uso, insumo, productor), correo y datos de cuenta del productor, fuentes de recuperación (Jumbo/OFF), `campos_editados`, fechas de auditoría y cualquier campo de gestión. Indica si el nombre comercial del productor se muestra o no.

### D4. Alérgenos agrupados (T10-03)

- Unión de los alérgenos de todos los insumos conservados de la elaboración.
- Si un alérgeno aparece como "contiene" en un insumo y como "puede contener" en otro, queda en **"Contiene"**.
- "Libre de…" no se usa para quitar alérgenos.
- Se mantiene también el detalle por insumo.

### D5. Elaboración por defecto y selección (T10-02)

- Por defecto, la elaboración **visible** más reciente según el criterio de "Predeterminada" de HU09.
- Selección por **código** (coincidencia exacta tras normalizar mayúsculas y espacios; propón la normalización) o por **fecha** (propón qué pasa si hay varias elaboraciones visibles el mismo día).
- Si el producto está publicado pero no tiene elaboraciones visibles, se muestra el estado "no disponible" del producto con sus datos de identidad o sin ellos: propón cuál.

### D6. Rendimiento (OE4)

- Meta: **≤ 2 s en el 95 %** de las consultas públicas. Se mide en T10-06.
- La consulta no debe hacer una consulta por insumo (sin N+1). `id_publico` ya tiene índice único.

### D7. Cabeceras y exposición (propuesta)

- **Caché:** si la respuesta se cachea, despublicar u ocultar no se refleja de inmediato. Propón `Cache-Control` (por ejemplo `no-store` o un `max-age` corto).
- **Indexación:** propón si la vista pública lleva `noindex` para que los buscadores no indexen las fichas.
- **Sin token:** el cliente de la vista pública no envía el token del productor aunque haya una sesión abierta en el mismo navegador.

### D8. Vista pública (T10-04)

- Ruta `/p/:idPublico` **fuera** del guard de autenticación, sin el menú del productor.
- Fiel a `ConsumerProduct.tsx` y a los criterios de HT05, adaptada a móviles, con textos de al menos 12 px y áreas táctiles de 44 px (HT07).
- Estados: cargando, producto no disponible, elaboración no disponible/no encontrada (según D2), error de red con "Reintentar".

### D9. Previsualización (T10-05)

- El productor previsualiza la ficha **antes de publicar**, así que necesita un endpoint **autenticado** en `/gestion` que use **la misma función** que arma la respuesta pública (una sola fuente de verdad) y que funcione aunque el producto no esté publicado.
- Se agregan en Publicaciones los botones "Vista previa pública" y "Comprobar ficha pública" que quedaron fuera de HU09.

### D10. Relación con HU11

HU11 asociará cada evaluación "al contexto de la consulta". La respuesta pública debe incluir un identificador de la elaboración consultada que sirva para eso **sin exponer el id interno** (por ejemplo, el código de la elaboración). Propón cuál.

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T10-01 | Endpoint público sin autenticación, construido solo a partir de la información conservada y sin datos internos de gestión | 1,75 |
| T10-02 | Selección de la elaboración por código o fecha, la elaboración más reciente por defecto y los estados no disponibles | 1,25 |
| T10-03 | Alérgenos agrupados en "contiene" y "puede contener", e indicación de versión anterior | 1 |
| T10-04 | Vista pública según el diseño de HT05, adaptable a móviles y con el aviso al consumidor | 1,75 |
| T10-05 | Previsualización de la ficha pública por el productor antes de publicar | 0,5 |
| T10-06 | Ejecutar y documentar pruebas: insumo modificado después de la elaboración (RT-03), tiempo de respuesta (OE4) y prueba en celular | 1,75 |

**Evidencia esperada:** `docs/hu10-test-results.md`, la medición de OE4, las capturas de la prueba en celular y la ejecución de la integración continua.

---

## 7. Plan de pruebas

**Plan oficial**

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT10-01 | Abrir la consulta pública sin sesión iniciada | Se muestra la ficha sin pedir cuenta | 1 |
| PT10-02 | Producto con tres elaboraciones finalizadas, la más reciente oculta | Muestra por defecto la más reciente visible | 2 |
| PT10-03 | Seleccionar por código y por fecha | Muestra la elaboración elegida | 3 |
| PT10-04 | Ingresar un código de elaboración inexistente | Indica que no se encontró, sin error | 3 |
| PT10-05 | Revisar un ingrediente de la ficha | Muestra insumo, marca u origen, ingredientes declarados y advertencias | 4 |
| PT10-06 | Elaboración con un insumo que contiene leche y otro con trazas de soya y leche | "Contiene: leche" y "Puede contener: soya"; leche no se repite en trazas | 5 |
| PT10-07 | Consultar una elaboración de una versión anterior del producto | Aparece la nota de versión distinta, sin número de versión | 6 |
| PT10-08 | Finalizar una elaboración, cambiar después la marca y los alérgenos del insumo, y consultar | Muestra la información original (RT-03) | 7 |
| PT10-09 | Revisar la respuesta de la API pública | No contiene lotes, vencimientos ni identificadores internos | 8 |
| PT10-10 | Revisar el aviso | El aviso al consumidor está visible | 9 |
| PT10-11 | Previsualizar un producto aún no publicado como productor | Se ve la ficha; el enlace público sigue no disponible | 10 |
| PT10-12 | Escanear el QR impreso con un celular y recorrer la ficha | Se usa sin desplazamiento horizontal y con texto legible | 11 |
| PT10-13 | Medir 100 consultas de prueba | Al menos el 95 % responde en 2 s o menos (OE4) | Métrica |

**Escenarios adicionales** (no están en el plan oficial, pero deben quedar cubiertos):

| Escenario | Resultado esperado |
|---|---|
| Producto no publicado, eliminado e `id_publico` inexistente | Misma respuesta en los tres casos, sin datos del producto (CA9 de HU09) |
| Elaboración oculta pedida por código o fecha | "No disponible", sin datos de la elaboración (CA8 de HU09); nunca aparece en la lista |
| Lista de elaboraciones | Solo finalizadas y visibles; nunca borradores ni ocultas |
| Lista blanca (complementa PT10-09) | La respuesta pública contiene solo los campos aprobados: aserción sobre el conjunto exacto de claves, incluidos los anidados |
| Sin token y con token de productor | La respuesta pública es la misma |
| Previsualización de un producto de otro productor | 404 |
| Pendientes de HU09 | Completar PT09-04 (el QR abre la consulta), PT09-09 y PT09-10 con la vista real |

**Sobre PT10-13 (OE4):** una medición en el entorno local mide el tiempo del servidor y la base de datos, no el de la red móvil real. Documenta el entorno, el método (cliente, número de consultas, datos usados, calentamiento) y esta limitación junto al resultado.

**Mutaciones sugeridas:**

- construir la respuesta desde el insumo vigente en lugar de `informacion_conservada`;
- incluir elaboraciones ocultas en la selección o como elaboración por defecto;
- dejar en "Puede contener" un alérgeno que otro insumo declara como "Contiene";
- responder distinto a un producto no publicado y a uno inexistente;
- agregar un campo interno a la respuesta pública (la prueba de lista blanca debe fallar).

---

## 8. Fuera de alcance

- La evaluación de utilidad (HU11) y la identificación de elaboraciones relacionadas (HU08).
- Cuentas o registro de consumidores.
- Personalizar la ficha pública (CA10 de HU09).
- Estadísticas de consultas, analítica o SEO.
- Límite de solicitudes (rate limiting) y protección anti-bots; si lo consideras necesario, anótalo como riesgo.
- Traducciones a otros idiomas.
- El despliegue del ambiente público.

---

## 9. Decisiones aprobadas en T10-01 (10-11-2026)

### 9.1 Contrato de la API pública

`GET /publico/productos/{id_publico}` (sin autenticación; un solo endpoint, forma (b) de D1). Lista blanca (cada campo se declara en `app/schemas/consulta_publica.py`):

```
producto:      id_publico, nombre, contenido_neto, unidad_medida, presentacion, imagen_url,
               categorias[] (nombres), elaborado_por (solo nombre_negocio; null si no tiene)
elaboraciones: [{codigo, fecha}]          visibles, orden «Predeterminada»
elaboracion:   {codigo, fecha, insumos[]}  la predeterminada; null si no hay visibles
  insumos[]:   ingrediente, nombre, marca_origen, ingredientes_declarados, advertencias,
               alergenos[]: {codigo, nombre, tipo: "contiene" | "puede_contener"}
```

- Origen: composición, insumos y alérgenos, solo de `informacion_conservada` (RT-03). Identidad del producto: la vigente (un cambio de nombre se refleja en elaboraciones antiguas; se documenta como limitación).
- Identificador para HU11 (D10): el par `producto.id_publico` + `elaboracion.codigo` (el código es inmutable tras finalizar). No se expone ningún id interno.
- Cabeceras (D7): `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow` en la API, también en los 404. La vista (T10-04) añade `<meta name="robots" content="noindex">`.
- Consultas por solicitud: máximo 4 (producto, categorías, elaboraciones, copias). T10-03 lo sube a 5 de forma explícita (comprobación de versión vigente). Un producto no disponible hace 1.
- Fail-closed: si a una copia le falta `ingrediente`, `insumo` o `alergenos` (o un tipo de alérgeno desconocido), la API responde 500 con `{"detail": {"mensaje": …}}` y registra solo el id del uso y la clave faltante.
- Reparto: T10-02 agrega `codigo`/`fecha`, `estado_elaboracion` (`ok`, `no_disponible`, `varias`, `sin_elaboraciones`) y `coincidencias`; T10-03, `alergenos` agrupados y `version_anterior`.

### 9.2 Respuesta uniforme (D2)

Producto no publicado, eliminado, inexistente o con `id_publico` mal formado: `404` con `{"detail": {"mensaje": "Información no disponible"}}`, mismo cuerpo y mismas cabeceras. El parámetro de ruta no lleva `pattern` ni `max_length` (daría un 422 distinto).

### 9.3 Diferencia aprobada con HT05 (cumple PT10-04)

HT05 diseña dos estados distintos: «elaboración no disponible/oculta» y «código no encontrado». **Se fusionan en uno**, con el mensaje «No encontramos información disponible para esa elaboración». Motivo: si se distinguieran, quien pruebe códigos sabría que una elaboración oculta existe. Esto cumple PT10-04 («indica que no se encontró, sin error») y CA8 de HU09. Se implementa en T10-02 como `200` con `elaboracion: null` y `estado_elaboracion: "no_disponible"` (el producto sigue publicado, no es un 404).

### 9.4 Notas para T10-04 (vista)

- La etiqueta de búsqueda dice «fecha de elaboración» (nunca vencimiento).
- «Marca u origen» es **una sola etiqueta**: el modelo tiene un único campo `marca_origen`; no se distingue «Marca» de «Origen» como en el prototipo.
- No hay «Consumir preferentemente»: es el vencimiento del lote, dato interno que no se muestra.
- Sin elaboraciones visibles: se muestra la identidad del producto y el estado «sin elaboraciones»; **no** se muestran «Ingredientes declarados» de la fórmula vigente (contradice D3).
- La lista de elaboraciones puede crecer sin tope con la frecuencia de producción (riesgo anotado para T10-06).

### 9.5 Selección por código o fecha (T10-02)

`GET /publico/productos/{id_publico}?codigo=…` o `?fecha=AAAA-MM-DD` (nunca ambos). La respuesta agrega `estado_elaboracion` (siempre) y `coincidencias` (siempre presente; vacía salvo con `"varias"`):

| `estado_elaboracion` | Cuándo | `elaboracion` | `coincidencias` |
|---|---|---|---|
| `ok` | Sin parámetros (la predeterminada), código con coincidencia, o fecha con una sola visible | la elaboración | `[]` |
| `no_disponible` | Código inexistente, de una oculta, de un borrador o de otro producto; fecha sin visibles | `null` | `[]` |
| `varias` | Fecha con más de una visible | `null` | `[{codigo, fecha}]` en orden «Predeterminada» |
| `sin_elaboraciones` | El producto no tiene elaboraciones visibles (con o sin parámetros) | `null` | `[]` |

- Parámetros inválidos (ambos a la vez, fecha que no sea `AAAA-MM-DD` o inexistente): `422` con `{"detail": {"mensaje": …}}`, validado **antes** de buscar el producto (mismo 422 para un `id_publico` existente y uno inexistente). Un producto no disponible responde el 404 uniforme aunque los parámetros sean válidos.
- Código: `strip()` + `casefold()` en ambos lados, sin colapsar espacios internos, comparado solo contra las elaboraciones visibles ya cargadas. `fecha_elaboracion` es `Date`: la fecha se compara directamente.
- La lista `elaboraciones` no depende de la selección. Máximo 4 consultas (igual que T10-01).
- Para T10-04: el mensaje único «No encontramos información disponible para esa elaboración» corresponde a `no_disponible`; con `varias`, la vista pide elegir por código entre `coincidencias`.
