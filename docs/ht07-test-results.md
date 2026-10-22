# HT07 — Resultados de pruebas

**Fecha:** 2026-10-21
**Rama:** `mejora/ui-ux-productor`
**Pull request:** #20 (Bloques 0 a 4 y rediseño de los detalles)
**Historia:** HT07 — Ajustes de usabilidad tras la validación del Sprint 2
**Entorno:** solo frontend (React 19, Vite 8, Vitest). No se tocó el backend ni ningún contrato de la API; las cifras de backend son las de la integración continua y no cambiaron.

---

## Origen: auditoría de UI/UX del 21-10-2026

**Método.** Auditoría de solo lectura, con Chrome (Playwright) sobre un servidor Vite propio en el puerto 5199 (`dev:https`, con proxy a la API local). Tamaños: escritorio 1280×800 y celular 390×844 (con táctil). 30 pantallas medidas por tamaño. «Pantallas» = altura de la página dividida por la altura de la ventana.

**Cuentas de prueba.** Una cuenta creada para la auditoría, con datos sembrados por la API (8 ingredientes, 9 insumos con y sin alérgenos revisados, 2 productos con formulación, un borrador de 5 ingredientes, una elaboración con alérgenos sin revisar y una finalizada), y dos cuentas vacías para los estados vacíos. Nunca se usó la cuenta real de la desarrolladora. Las capturas y mediciones quedan fuera del repositorio.

**Corrección del hallazgo (e).** La auditoría afirmó que el registro de elaboración dejaba «Productos» resaltado en el menú. Era un error: el resaltado depende de la ruta (`NavLink`) y `activePage` solo fija el título de la pestaña. Al medirlo en el Bloque 2, `aria-current` estaba vacío en el registro y en el detalle de una elaboración. No hizo falta cambiar nada; se agregó una prueba que lo exige. Del hallazgo (a) también se corrigió el diagnóstico: la barra de acciones no «tapaba» la pantalla, sino que no flotaba.

---

## Bloque 0 — Dos defectos de HU13

| Defecto | Causa | Corrección |
|---|---|---|
| Al buscar en el diálogo de la elaboración un código que pertenece a un insumo de **otro** ingrediente, aparecía «Ya tienes este insumo» con «Usar este insumo», y esa acción no asignaba nada | La prueba de T13-05 hacía clic en «Usar este insumo» y recién entonces esperaba la explicación: fijaba el comportamiento defectuoso, no la especificación | El diálogo lee el insumo existente al llegar la respuesta. Si es de otro ingrediente dice «Ese insumo está asociado a «X»» y no ofrece ningún botón; si no se puede leer, tampoco lo ofrece. Las pruebas ahora exigen la explicación sin pulsar nada |
| Después de buscar un código, el foco pasaba a `BODY` | El escáner, que tenía el foco, se desmonta al entregar el código | El foco va al bloque del mensaje del resultado, solo si quedó en `BODY` (para no quitárselo a un diálogo abierto) |

Mutaciones: 2 de 2 detectadas (una por defecto: 4 y 3 pruebas fallan).

---

## Bloques 1 a 4: qué se cambió

**Bloque 1 — La acción principal siempre al alcance.**
- La barra de acciones (`FormActions`) ahora queda fija al borde inferior. La causa era `overflow-y-auto` en `main`, que anulaba el `sticky`; se quitó.
- Barra del registro de elaboración con solo «Guardar borrador» y «Finalizar elaboración», lado a lado también en celular. «Volver al producto» pasa a un enlace del encabezado con la misma protección de cambios sin guardar, y «Eliminar borrador» a una sección final con color de error.
- Progreso bajo «Ingredientes» («Faltan 3 de 5 ingredientes») con `aria-live`, y estados de línea del vocabulario nuevo («Lista», «Falta el insumo», «Falta el lote», «Falta revisar alérgenos»).
- Si finalizar falla, la vista se desplaza a la primera línea con problema y el foco queda en ella (suave, salvo con `prefers-reduced-motion`). Al cerrar la confirmación, el foco vuelve al botón que la abrió.
- Radios de lote en fila cuando caben.

**Bloque 2 — Detalle del producto, Dashboard y menú.**
- Detalle del producto: «Nueva elaboración» y «Editar producto» en el encabezado, sin «Volver a productos», información general con imagen (o franja baja «Sin imagen»), formulación y elaboraciones antes de lo demás, costo y precio con moneda.
- Dashboard: «Nueva elaboración» como acción principal, «Nuevo insumo» y «Nuevo producto» como secundarias, «Hola, {nombre}», tarjetas enlazadas («Insumos con alérgenos sin revisar» reemplaza a «Ingredientes») y «Primeros pasos» con el paso 3 calculado con datos reales.
- Menú sin «Elaboraciones» ni «Elaboraciones relacionadas» (se reactivan con HU06 y HU08). Listado de insumos con filtro «Alérgenos sin revisar».

**Bloque 3 — Registrar un insumo.**
- «Escanear código de barras» como acción principal del formulario vacío; tras encontrar el producto, resumen «Encontrado: … · sugerimos …» y desplazamiento al formulario precargado.
- Alérgenos: una sola frase mientras la lista está vacía; casilla y botones de 44 px.
- Detalle del insumo sin la sección «Estado» y con «confirmaste estos datos al crear el insumo».
- Diálogo «Crear insumo» que aclara que el insumo se crea al instante y su asignación se guarda con el borrador.

**Bloque 4 — Textos, tamaños y consistencia.**
- Vocabulario de la sección 3 en mensajes, botones, estados vacíos y diálogos. El detalle del ingrediente ya no contradice dónde se declaran los alérgenos.
- Etiquetas con mayúscula inicial y nada por debajo de 12 px.
- Áreas táctiles de 44 px: campos y selectores (`min-h-11`), migas, enlaces de nombre y de detalle, selector Lista/Cuadrícula, categorías, ojo de la contraseña y botón de tema.
- Detalles de insumo e ingrediente sin «Volver a …». Barra de filtros de Insumos con los tres controles en una fila en escritorio. «Te damos la bienvenida a TrazApp, {nombre}», «Nombre del negocio» igual en registro y perfil, y foco inicial en «Nombre» en «Nuevo ingrediente».

**Rediseño de los detalles (extra, pedido después del Bloque 4).** Producto, insumo e ingrediente comparten un encabezado (`DetailHero`), datos en bloques (`FactTile`) y una columna lateral desde 1024 px. Lo que aún no existe (QR del producto, trazabilidad de ingredientes, información adicional, uso en elaboraciones, uso en formulaciones, insumos asociados) queda como maqueta marcada «Próximamente», sin datos ni acciones.

---

## Medido antes y después

| Medida | Antes (auditoría) | Después |
|---|---|---|
| Distancia hasta la acción principal, registro de elaboración (celular) | «Finalizar elaboración» a 3,1 pantallas | Barra fija: siempre visible, a 70 px del borde inferior |
| Distancia hasta la acción principal, nuevo insumo | «Guardar insumo» a 2,9 pantallas; «Escanear» como botón de contorno | Barra fija (86 px en celular, 70 px en escritorio); «Escanear» principal y a ancho completo (308×44) |
| Distancia hasta la acción principal, nuevo producto | «Guardar producto» a 2,65 pantallas | Barra fija, igual que arriba |
| Distancia hasta la acción principal, detalle del producto | «Registrar elaboración» a 2,3 pantallas (escritorio) y 2,47 (celular); formulación a 1,7 | «Nueva elaboración» a 0,1 (escritorio) y ≈0,3 (celular); formulación a ≈0,6 en escritorio |
| Altura de la barra de acciones | 238 px (28 % de la ventana en celular) y al final de la página | 70 px en escritorio (8,8 %) y 86 px en celular (10,2 %), fija al borde. En el registro de elaboración, 70 px en celular (botón «Finalizar», 152×44) |
| Elementos tocables bajo 44 px (contenido de 14 pantallas, sin menú ni encabezado) | 96 en escritorio y 91 en celular | 0 en ambos tamaños |
| Textos menores de 12 px | 2 de 10 px («Activo», «Rotulación obligatoria») y varios de 11 px | 0 en `src/` (lo exige una prueba) |
| Usos de `uppercase` | 21 en 15 archivos; 120 textos en mayúsculas en pantalla (celular) y 110 (escritorio) | 0 (lo exige una prueba) |

**Cómo se midió lo de los tocables.** Con el mismo script y las mismas condiciones antes y después: servidor de Vite propio (puerto distinto del 5175), cuenta de prueba de la auditoría y solo el contenido de `main` (sin menú ni encabezado), contando los elementos visibles con alto menor de 44 px (las casillas se miden por su fila). El «antes» es el commit `16c8cfe` (merge de HU13 en `main`), servido desde un `git worktree` temporal fuera del repositorio, que se eliminó al terminar; el «después» es la rama `mejora/ui-ux-productor`. Las 14 pantallas, en escritorio (1280×800) y celular (390×844): Dashboard, listas de insumos, ingredientes y productos, detalle de insumo, de ingrediente y de producto, nuevo insumo, nuevo ingrediente, nuevo producto, editar producto, perfil, registro de elaboración y detalle de una elaboración finalizada.

| Pantalla | Antes (escritorio / celular) | Después |
|---|---|---|
| Dashboard | 4 / 4 | 0 / 0 |
| Insumos (lista) | 13 / 11 | 0 / 0 |
| Ingredientes (lista) | 10 / 9 | 0 / 0 |
| Productos (lista) | 7 / 5 | 0 / 0 |
| Detalle de insumo | 5 / 5 | 0 / 0 |
| Detalle de ingrediente | 1 / 1 | 0 / 0 |
| Detalle de producto | 1 / 1 | 0 / 0 |
| Nuevo insumo | 8 / 8 | 0 / 0 |
| Nuevo ingrediente | 3 / 3 | 0 / 0 |
| Nuevo producto | 14 / 14 | 0 / 0 |
| Editar producto | 15 / 15 | 0 / 0 |
| Perfil | 3 / 3 | 0 / 0 |
| Registro de elaboración | 9 / 9 | 0 / 0 |
| Detalle de elaboración | 3 / 3 | 0 / 0 |
| **Total** | **96 / 91** | **0 / 0** |

En celular, de los 91: 40 campos de texto (42 px), 37 enlaces (migas y nombres de 20 px o menos), 8 selectores (42 px) y 6 botones. Las distancias en pantallas de los Bloques 1 a 3 se midieron en el celular, salvo donde se indica escritorio.

---

## Prueba intermitente resuelta en HT07

En HT07 se resolvió **una** prueba intermitente.

| Prueba | Causa | Corrección |
|---|---|---|
| `hu01.products` > «carga categorías disponibles y permite seleccionar varias al crear» (falló sin carga en la máquina) | Una carrera de la prueba, no un defecto de la aplicación. La pantalla pide las categorías en un `useEffect`, que corre después de pintar el título; la prueba comprobaba `listCategories` justo al ver el título, antes de que el efecto se ejecutara. Reproducida: sin carga, 2 fallos en 16 corridas del archivo, ambos en la misma línea | La misma aserción, pero después de `await findByLabelText("Pastelería")`, que solo existe cuando `listCategories` ya respondió. No se relajó ninguna aserción ni se subió ningún timeout. Demostración: el archivo 30 veces y 3 suites completas seguidas, 0 fallos |

**Antecedentes (no son de HT07).** Eran intermitencias anteriores; se citan para ubicar esta:

| Origen | Prueba | Dónde está documentada |
|---|---|---|
| T13-08 (HU13) | Formularios de producto que tecleaban (`hu01.products`, «Nuevo producto»): bajo carga superaban el límite de 15 s | `docs/hu13-test-results.md` |
| HT06-08 | Recorrido del escenario B | `docs/ht06-test-results.md`, sección «La prueba intermitente de los recorridos (escenario B)» |

---

## Pruebas

| Corrida | Archivos | Pruebas |
|---|---|---|
| Antes de HT07: integración continua sobre `main` tras el merge de HU13 (PR #19, commit `16c8cfe`) | 40 | 909 |
| Bloque 1 (corrida local) | 40 | 927 |
| Bloque 2 (corrida local) | 40 | 944 |
| Bloque 3 (corrida local) | 40 | 955 |
| Bloque 4 (corrida local) | 41 | 966 |
| Después de HT07: integración continua del PR #20, con el rediseño de los detalles | 42 | **970** |

**Diferencia:** +61 pruebas de frontend respecto de antes de HT07 (de ellas, 11 del Bloque 4 y 4 del rediseño). En todos los cortes `tsc -b` estuvo limpio y no hubo fallos.

**Backend, sin cambios en HT07** (integración continua): SQLite 1281 aprobadas y 148 omitidas; PostgreSQL 1429. Las omitidas en SQLite son las que exigen PostgreSQL.

**Recorridos sin cambios** (las pruebas de HT06 pasan sin tocarlas): escenario B = 6 interacciones, B′ = 7 y A = 38 clics y 30 campos.

**Mutaciones por bloque** (siempre con copia y restauración, confirmando con `git diff`; todas detectadas):

| Bloque | Mutaciones | Ejemplos |
|---|---|---|
| 0 | 2 | No comprobar de qué ingrediente es el duplicado; no llevar el foco al resultado |
| 1 | 4 | `main` vuelve a tener `overflow-y-auto`; no dejar el foco en la línea con problema; línea con alérgenos sin revisar dice «Lista»; no volver el foco a «Finalizar» |
| 2 | 4 | La tarjeta cuenta todos los insumos; «Nueva elaboración» habilitado sin formulación; el filtro no filtra; el paso 3 no se marca |
| 3 | 4 | «Escanear» nunca es el principal; el resumen no desplaza la vista; vuelven los dos grupos vacíos de alérgenos; la casilla pierde la fila de 44 px |
| 4 | 4 | Quitar `min-h-11` de los campos; quitar `controlsColumns={3}`; quitar `min-h-11` de las migas; volver a «Bienvenido» |
| Rediseño | 0 | Solo pruebas de los componentes nuevos y comprobación del código fuente |

**Textos cambiados en masa.** En los Bloques 3 y 4 unas 80 pruebas cambiaron por renombres hechos con reemplazos de texto. Se revisó el `git diff` de todos los archivos de prueba: solo cambiaron textos visibles (mensajes, etiquetas, botones), salvo los cambios intencionales de comportamiento, cada uno con su razón en un comentario (foco del diálogo, ausencia de «Volver a insumos», regiones «Estado» y un paso del estado vacío de ingredientes).

---

## Deuda técnica

1. **Endpoint de elaboraciones sin límite.** `GET /gestion/elaboraciones` solo acepta `producto_id` y `estado`, sin límite ni paginación. El Dashboard pide todas las elaboraciones en una sola llamada para saber si existe alguna (paso 3 de «Primeros pasos») y filtra los borradores en el cliente. Hay un comentario en `Dashboard.tsx`. Se resuelve con la paginación de HU06: pedir los borradores como antes y la existencia con `limit=1`.
2. **ESLint sin configurar.** `npx eslint src` no corre: con ESLint 10.13 solo muestra el mensaje de migración de configuración. El proyecto usa `oxlint` (`npm run lint`), que conserva avisos `set-state-in-effect` anteriores a HT07 en `useElaboracionRegistro` y `ElaboracionRegistro`.
3. **Textos descriptivos que conservan «Registra».** Se cambiaron los nombres de acciones (botones, títulos, mensajes), pero quedan el encabezado del Dashboard («Registra tus elaboraciones, insumos y alérgenos…») y el panel de marca del Login («Registra tus productos e ingredientes»), por ser verbos de uso general y no nombres de botón. Cambiarlos exige ajustar sus pruebas.
4. **Rediseño de los detalles sin mutaciones propias.** Sus pruebas son más básicas que las de los bloques; la sección de alérgenos del insumo (`InsumoAllergensSection`) conserva su diseño anterior y en escritorio quedan algo sueltos «Pasar a Puede contener» y «Quitar».
5. **Maquetas «Próximamente».** QR, trazabilidad de ingredientes, información adicional, uso en elaboraciones, uso en formulaciones e insumos asociados no tienen datos ni backend; son trabajo futuro.
