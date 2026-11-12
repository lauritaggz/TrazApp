# TrazApp — Contexto de la HU06 para el agente de código

**HU06 — Consulta del historial de elaboraciones** (Sprint 3)

*Actualizado el 01-11-2026: decisiones de T06-01 aprobadas, nueva metodología de commits y Pull Request draft, y línea base medida.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo). Léelo completo antes de trabajar en la HU06. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Se trabaja tarea por tarea.** Cada tarea tiene su propio prompt. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Detente al terminar cada tarea** y entrega un reporte con: qué hiciste, decisiones que conviene revisar, archivos creados y modificados, y resultado de las pruebas.
3. **Commits y Pull Request draft.** Con la aprobación de la desarrolladora al cierre de cada tarea, haz commit y push **solo** a la rama de la historia, que tiene un Pull Request en **draft** hacia `main`. Nunca hagas merge, push a `main`, `push --force`, ni cambies el PR a "ready for review"; no borres ramas ni modifiques la configuración de la integración continua.
4. **Esta historia no lleva migraciones** (decisión tomada en el análisis de T06-01). Si en alguna tarea crees que hace falta una, muéstrala y espera aprobación (mantenla como `.pendiente`). Ojo: la migración **018** está reservada para HU14.
5. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta cambios de contrato de la API ni de comportamiento visible para el usuario.
6. **No borres datos ni estructuras existentes.** Nunca ejecutes `docker compose down -v`.
7. **Nunca escribas contraseñas, tokens ni cadenas de conexión** en el código, las pruebas o la salida. No imprimas el `.env`.
8. **Para verificar con datos, usa cuentas de prueba.** Nunca la cuenta real de la desarrolladora.
9. **Nunca uses el puerto 5175** para tus servidores: es el de la desarrolladora. Usa otro puerto y detén tus servidores al terminar.
10. **Pruebas en local y en GitHub.** En local ejecuta solo las pruebas nuevas y las afectadas por la tarea, más las mutaciones. Las suites completas se ejecutan en GitHub Actions sobre el Pull Request draft, y una tarea se cierra solo con los tres trabajos en verde.
11. **Pruebas de mutación:** copia el archivo original antes de alterarlo, restáuralo desde la copia y confirma con `git diff` que solo quedan los cambios de la tarea.
12. **Las pruebas existentes que cambien de comportamiento** se actualizan explicando por qué en el reporte. Nunca se eliminan ni se relajan para que la suite pase.

---

## 2. Estado y entorno

- **Rama:** `feature/hu06-historial-elaboraciones`, creada desde `main` actualizado.
- **Entorno local:** Docker Compose levanta base de datos, backend y frontend. En el `.env` de la desarrolladora la API está en el puerto **8010** y PostgreSQL en **5442** (hay otro proyecto ocupando 8000 y 5432). Para tus pruebas usa puertos propios.
- **Migración vigente:** `017_alergenos_revisados_ht06`. Esta historia no debería requerir una nueva. Si concluyes que un índice es necesario para el rendimiento del listado, propónlo como migración 018 y espera aprobación.
- **Integración continua:** `.github/workflows/ci.yml` corre backend en SQLite, backend en PostgreSQL y frontend (Vitest y `npm run build`) en cada push al Pull Request draft. Las pruebas nuevas deben pasar en los tres; usa `gh pr checks --watch` para esperar el resultado.
- **Trampa del contenedor:** el backend en Docker ya trae `TEST_DATABASE_URL` en su entorno. Para correr pruebas en SQLite dentro del contenedor, usa `unset TEST_DATABASE_URL`; nunca lances dos suites a la vez sobre `trazapp_test`.
- **Línea base de pruebas (medida al iniciar T06-01, commit `a085ad6`):** backend en SQLite 1.281 aprobadas y 148 omitidas; backend en PostgreSQL 1.429 aprobadas; frontend 42 archivos y 970 aprobadas.
- **Convención de errores:** `404` recurso inexistente o de otro productor; `422` datos inválidos; `409` conflicto de estado; `detail` con un objeto `{mensaje, ...}`.

---

## 3. Historia y criterios

**Como productor, quiero consultar las elaboraciones anteriores de mis productos, para conocer qué insumos, marcas y lotes se utilizaron en cada una.**

Prioridad P1 · 5 SP · 5 h · Depende de HU05.

| ID | Criterio |
|---|---|
| CA1 | El productor puede listar todas sus elaboraciones, filtrando por producto, estado o rango de fechas. |
| CA2 | Puede buscar una elaboración por su código. |
| CA3 | El listado indica el estado de cada elaboración (borrador o finalizada). |
| CA4 | El detalle indica la versión del producto utilizada y muestra, para cada ingrediente, el insumo utilizado, su marca u origen, su lote o la indicación de que no tiene, su vencimiento si fue registrado, sus ingredientes declarados y sus alérgenos. |
| CA5 | En una elaboración finalizada, el detalle muestra la información conservada, no la vigente. |
| CA6 | La consulta no modifica la información almacenada. |
| CA7 | El productor solo puede consultar sus propias elaboraciones. |

---

## 4. Lo que ya existe (punto de partida)

**Backend**

- `GET /gestion/elaboraciones` en `backend/app/api/routes/gestion_elaboraciones.py` acepta `producto_id` y `estado`, y devuelve `list[ElaboracionResumenRead]` **sin paginación ni límite**.
- `ElaboracionRepository.list_resumenes(...)` en `backend/app/repositories/elaboracion_repository.py` filtra por productor, producto y estado, cuenta ingredientes y pendientes, y ordena por `fecha_elaboracion` y `id` descendentes.
- `ElaboracionResumenRead` (`backend/app/schemas/elaboracion.py`): id, producto, versión, código, fecha, estado, finalizada_at, total_ingredientes y pendientes.
- `GET /gestion/elaboraciones/{id}` devuelve `ElaboracionRead`. `ElaboracionRead.from_elaboracion` construye una elaboración **finalizada solo desde `informacion_conservada`** (nunca lee el insumo vigente) y un borrador desde la asignación vigente. La copia conservada incluye insumo (nombre, marca u origen, presentación, código de barras, ingredientes declarados, advertencias), alérgenos con su tipo, `alergenos_revisados_at` y lote (código y vencimiento) o `sin_lote`.

**Frontend**

- `listElaboraciones(params)` en `frontend/src/services/elaboracionService.ts` (acepta `productoId` y `estado`).
- La usan `components/products/ProductElaboracionesSection.tsx` (elaboraciones de un producto) y `pages/Dashboard.tsx`.
- **Deuda técnica registrada en `Dashboard.tsx`:** el panel descarga todas las elaboraciones solo para saber si existe al menos una (paso 3 de «Primeros pasos») y para mostrar los borradores. Se resuelve en esta historia.
- Rutas existentes: `/elaboraciones/:id` (detalle) y `/elaboraciones/:id/registro`. **No existe** la ruta del historial `/elaboraciones`.
- `Sidebar.tsx` tiene comentado el ítem «Elaboraciones» dentro de «Trazabilidad»: se muestra recién cuando exista la página.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en el análisis de la primera tarea.

### D1. Respuesta paginada del listado (decidido en T06-01)

- `GET /gestion/elaboraciones` devuelve un objeto tipado con `response_model`:
  `{ "items": [ElaboracionResumenRead...], "total": int, "limit": int, "offset": int }`.
- Parámetros nuevos: `limit` (por defecto 20, de 1 a 100) y `offset` (por defecto 0, mínimo 0). Fuera de rango responden el **422 estándar de FastAPI**, igual que `producto_id` hoy.
- Se descartó devolver el total en la cabecera `X-Total-Count`: exigiría exponerla en el `CORSMiddleware` y cambiar `apiRequest`, que solo devuelve el cuerpo JSON.
- Es un **cambio de contrato**: los dos consumidores del frontend (`ProductElaboracionesSection` y `Dashboard`) quedan incompatibles hasta T06-03 y T06-04. Las pruebas del frontend siguen pasando porque mockean el servicio, pero la aplicación en ejecución no; se indica en la descripción del Pull Request.
- Orden sin cambios: `fecha_elaboracion` desc, `id` desc. Un único método privado `_filtrar` aplica los filtros a la página y al conteo, para que `total` use siempre los mismos filtros.
- **Sin índice nuevo:** `ix_elaboraciones_productor_fecha (productor_id, fecha_elaboracion DESC)` cubre el filtro por productor, el rango de fechas y el orden.

### D2. Filtros y búsqueda

- `producto_id` y `estado` se mantienen.
- `fecha_desde` y `fecha_hasta` (fechas, ambas inclusivas, sobre `fecha_elaboracion`). Si `fecha_desde > fecha_hasta` → **422**.
- `codigo`: búsqueda **parcial y sin distinguir mayúsculas** sobre el código de elaboración (por ejemplo, `e-01` encuentra `E-014`), implementada con `func.lower(codigo).like('%texto%', escape='\\')`, con el texto recortado, en minúsculas y con `%`, `_` y `\` escapados. Si queda vacío, se ignora. Se descartó `ILIKE` porque SQLAlchemy lo traduce distinto en cada motor.
- **Limitación conocida:** `lower()` de SQLite solo pliega ASCII (PostgreSQL pliega Unicode). Para códigos como `E-014` no hay diferencia; se documenta en `docs/test/hu06-test-results.md`.
- `fecha_desde > fecha_hasta` → 422 con `detail {mensaje}`.
- Los filtros se combinan con Y lógico.
- Un `producto_id` de otro productor no da error: simplemente no devuelve resultados (el filtro por productor ya lo garantiza).

### D3. Detalle

- El detalle ya respeta CA5. La tarea T06-02 **verifica con pruebas** que cumpla CA4 y CA5 completos y agrega en la interfaz lo que falte (por ejemplo, la versión del producto o el vencimiento del lote, si no se muestran).
- **No se agregan campos nuevos a la información conservada** ni se tocan los triggers de la migración 016.
- **No agregues ni destaques cantidades** de la formulación en el detalle: la HU14 (calculadora de costos, Sprint 3) las ocultará de la interfaz.

### D4. Interfaz del historial

- Página nueva `/elaboraciones` con el ítem «Elaboraciones» habilitado en el menú (sección «Trazabilidad»).
- Filtros: producto (selector), estado (todas, borrador, finalizada) y rango de fechas; búsqueda por código. En celular, los filtros se agrupan para no ocupar la pantalla completa.
- Cada fila: código, producto, fecha, estado (con el mismo distintivo visual que ya usa la aplicación) y, en borradores, cuántos ingredientes faltan. La fila lleva al detalle (finalizada) o al registro (borrador), igual que hoy en el detalle del producto.
- Paginación simple (anterior / siguiente y «x–y de z»).
- Estados vacíos distintos para «no tienes elaboraciones» y «ninguna coincide con los filtros».
- Los filtros se reflejan en la URL (`?estado=...&producto=...`) para que el navegador «atrás» los conserve.
- Vocabulario y tamaños según la HT07 (textos de al menos 12 px, áreas táctiles de 44 px).

### D5. Panel de inicio

- «Elaboraciones en curso»: `estado=borrador` con un límite (por ejemplo, 5) y un enlace «Ver todas» al historial filtrado por borradores.
- Paso 3 de «Primeros pasos»: una consulta con `limit=1` y se usa `total`. Se elimina el comentario de deuda técnica.

### D6. Diseños de referencia (Figma)

- Los diseños de todas las interfaces nuevas del Sprint 3 están en `docs/diseno/sprint3/`.
- **Pantallas que ya existen:** se complementan con lo nuevo del diseño, manteniendo su estructura,
  vocabulario y componentes actuales (HT07). No se rediseñan por completo.
- **Pantallas que no existen:** se construyen siguiendo el diseño y se acoplan a la navegación y a los
  componentes existentes (`components/ui`, layout, menú).
- Si el diseño contradice un criterio de aceptación o una convención del proyecto, detente y pregunta.
- Antes de la primera tarea de interfaz de cada historia, lista los diseños que corresponden a esa
  historia e indica qué pantallas se complementan y cuáles son nuevas.
---

## 6. Tareas

| ID | Tarea | Capa | Horas |
|---|---|---|---|
| T06-01 | Paginación, filtros por producto, estado y rango de fechas, y búsqueda por código en `GET /gestion/elaboraciones` | Backend | 1,25 |
| T06-02 | Ajustar el detalle para mostrar la versión del producto y, en las finalizadas, la información conservada | Backend y frontend | 0,5 |
| T06-03 | Interfaz del historial con filtros, búsqueda y paginación, adaptable a móviles | Frontend | 1,75 |
| T06-04 | Panel de inicio con el endpoint paginado (borradores y «Primeros pasos») | Frontend | 0,5 |
| T06-05 | Ejecutar y documentar pruebas (mutaciones, prueba en celular y `docs/test/hu06-test-results.md`) | Ambas | 1 |

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | Criterio |
|---|---|---|---|
| PT06-01 | Listar con más registros que el tamaño de página | Primera página, `total` correcto y se puede avanzar con `offset` | CA1 |
| PT06-02 | Filtrar por producto, estado y rango de fechas, por separado y combinados | Solo las que cumplen todos los filtros; `fecha_desde > fecha_hasta` → 422 | CA1 |
| PT06-03 | Buscar por código existente, parcial, con otra capitalización e inexistente | Encuentra las que contienen el texto; inexistente → lista vacía | CA2 |
| PT06-04 | Revisar el estado en el listado | Cada fila indica borrador o finalizada | CA3 |
| PT06-05 | Detalle con un insumo sin lote y otro con vencimiento | Versión, insumo, marca, lote o «sin lote», vencimiento, ingredientes declarados y alérgenos | CA4 |
| PT06-06 | Finalizar, luego cambiar la marca y un alérgeno del insumo, y abrir el detalle | Muestra la marca y los alérgenos originales | CA5 |
| PT06-07 | Consultar listado y detalle y comparar la base antes y después | Ningún registro cambia | CA6 |
| PT06-08 | Listado y detalle de elaboraciones de otro productor | No aparecen en el listado; el detalle responde 404 | CA7 |
| PT06-09 | Panel de inicio con borradores | Muestra los borradores con el endpoint paginado | Regresión |
| PT06-10 | Historial en un celular | Filtros, búsqueda y detalle utilizables, sin desplazamiento horizontal | CA1, CA2, CA4 |

**Mutaciones mínimas** (cada una debe hacer fallar al menos una prueba):

- quitar el filtro por productor del listado;
- invertir el orden;
- volver exclusivo el límite de `fecha_hasta`;
- ignorar el filtro `estado` cuando viene junto con otro filtro;
- calcular `total` sin aplicar los filtros.

---

## 8. Fuera de alcance

- Elaboraciones relacionadas con un insumo o un lote (HU08).
- Exportar el historial (CSV o PDF).
- Ordenar por otras columnas.
- Cambios en la información conservada, en los triggers o en la finalización.
