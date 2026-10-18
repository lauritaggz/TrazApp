# TrazApp — Contexto de la HT06 para el agente de código

**HT06 — Simplificación del flujo de elaboración y revisión de alérgenos**

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md`. Léelo completo antes de trabajar en la HT06. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

La HT06 se desarrolla **antes que la HU13**: la HU13 crea insumos con alérgenos sugeridos por una fuente externa y necesita lo que aquí se construye.

---

## 1. Reglas de trabajo (obligatorias, sin cambios)

1. **Se trabaja tarea por tarea.** Cada tarea tiene su propio prompt. No comiences una tarea sin su prompt ni avances a la siguiente.
2. **Detente al terminar cada tarea** y entrega un reporte con:
   - qué hiciste;
   - las decisiones que conviene revisar;
   - los archivos creados y modificados;
   - el resultado de las pruebas.
3. **No hagas commit, push ni merge.** La desarrolladora revisa cada tarea y hace los commits.
4. **Antes de crear o modificar una migración, muéstrala y espera aprobación.**
   - Mantenla como `.pendiente` hasta que se apruebe.
   - Si una prueba de migración necesita una guarda temporal, márcala como `TEMPORAL` y elimínala al activar la migración.
5. **Si una decisión no está definida aquí**, propón alternativas y espera. No resuelvas por tu cuenta decisiones de modelo de datos ni de comportamiento visible para el usuario.
6. **No borres datos ni estructuras existentes**, salvo que el prompt lo pida.
7. **Nunca escribas contraseñas, tokens ni cadenas de conexión** en el código ni en las pruebas.
8. **Nunca agregues al repositorio** respaldos (`*.sql`) ni certificados o claves (`*.pem`).
9. **Pruebas de mutación:**
   - antes de modificar un archivo para comprobar que una prueba detecta una falla, copia el original;
   - después, restáuralo desde esa copia;
   - al terminar, confirma con `git diff` que solo quedan los cambios de la tarea.
10. **Las pruebas existentes que cambien de comportamiento** se actualizan explicando por qué en el reporte. Nunca se eliminan para que la suite pase.

---

## 2. Estado y entorno

- **Solo entorno local.** Se trabaja con Docker Compose (PostgreSQL y backend) y con `npm run dev` para el frontend. No hay servidor de producción, así que la Definición de Terminado se verifica en local y en la integración continua.
- **Integración continua:** `.github/workflows/ci.yml` corre tres trabajos y las pruebas nuevas deben pasar en los tres:
  - backend en SQLite;
  - backend en PostgreSQL;
  - frontend (Vitest y `npm run build`).
- **Revisión de la base:** `016_elaboracion_inmutable_hu05`. La siguiente migración es la **017**, con un identificador de máximo 32 caracteres.
- **Línea base de pruebas** (merge de HU05):
  - backend en SQLite: 770 aprobadas y 133 omitidas;
  - backend en PostgreSQL: 903 aprobadas;
  - frontend: 452 aprobadas.
- **Convención de errores** (la misma de siempre):
  - `404`: el recurso de la URL no existe o no es del productor;
  - `422`: datos inválidos en el cuerpo;
  - `409`: conflicto de estado;
  - `detail` lleva un objeto con `mensaje` y datos útiles.

---

## 3. Problema y evidencia

Hubo una auditoría de solo lectura del frontend y del backend. Encontró dos problemas.

### 3.1 Integridad: los alérgenos no tienen estado de revisión

- **El modelo no distingue los dos casos.** Que un insumo no tenga alérgenos se representa solo con la ausencia de filas en `insumos_alergenos`. No hay forma de distinguir "revisado, sin alérgenos" de "nunca declarado".
- **No se pueden declarar al crear.** `InsumoCreate` tiene `extra="forbid"` y no acepta alérgenos. Se declaran después, una llamada por alérgeno, desde `/insumos/:id`.
- **Desde la elaboración no se pueden declarar.** El insumo se registra con `InsumoCreateDialog`, pero ese diálogo no tiene alérgenos.
- **La finalización no valida alérgenos.** `_problemas_de_finalizacion` solo revisa el ingrediente, el insumo y el lote.
- **Consecuencia:** una elaboración puede quedar finalizada, y por lo tanto inmutable, con `"alergenos": []` para un insumo que nadie revisó. Además, la interfaz muestra "Sin alérgenos declarados" en los dos casos.

### 3.2 Usabilidad: el flujo frecuente no aprovecha lo ya registrado

| Escenario | Hoy |
|---|---|
| A. Producto nuevo con 5 ingredientes, hasta finalizar la primera elaboración | 34 clics, 30 campos obligatorios |
| B. Segunda elaboración del mismo producto con los mismos insumos | 21 interacciones (16 si los insumos son habituales) |

El escenario B es el que se repite. Sus problemas:

- **No hay entrada directa.** Para registrar una elaboración hay que pasar por Productos → producto.
- **No se aprovecha la elaboración anterior.** Solo se preselecciona el insumo habitual, y únicamente si al crearlo se marcó esa opción.
- **Al terminar no hay continuidad.** Después de finalizar no hay "registrar otra".
- **Los borradores se pierden de vista.** No hay ningún lugar donde ver los que están en curso.
- **Crear un producto devuelve al listado.** `ProductNew.tsx:176` redirige ahí en vez de al detalle del producto.

---

## 4. Decisiones de diseño

Las decisiones marcadas como **propuesta** se confirman en el análisis de diseño. Las demás están tomadas.

### D1. Estado de revisión de alérgenos (propuesta)

- **Columna nueva** `alergenos_revisados_at` (fecha y hora con zona horaria, nula) en `insumos_comerciales`.
  - **NULL** significa "no revisado".
  - **Con valor** significa que el productor declaró o confirmó los alérgenos en ese momento.
- **Se prefiere una fecha a un booleano**, porque deja evidencia de cuándo se revisó.
- **Datos existentes, en la migración 017:**
  - un insumo con al menos una fila en `insumos_alergenos` se marca como revisado (con `updated_at` o la hora de la migración, a definir en el análisis);
  - un insumo sin filas queda NULL, porque no se puede saber si alguien lo revisó.
- **La exponen** los schemas de lectura del insumo: `alergenos_revisados: bool` y `alergenos_revisados_at`.

### D2. Declaración de alérgenos al crear y en bloque (propuesta)

- **`POST /gestion/insumos` acepta un campo opcional `alergenos: [{alergeno_id, tipo}]`.**
  - **Si viene**, aunque sea vacío, el insumo se crea con esos alérgenos y queda revisado, todo en la misma transacción.
  - **Si no viene**, el insumo queda sin revisar. Así se mantiene la compatibilidad con los clientes y pruebas actuales.
- **Endpoint nuevo `PUT /gestion/insumos/{id}/alergenos`**, que reemplaza la lista completa y marca el insumo como revisado.
  - La lista vacía significa "revisado, sin alérgenos".
  - Es la forma de confirmar un insumo existente sin salir del flujo.
- **Los endpoints individuales actuales** (asociar, cambiar tipo, quitar) también marcan el insumo como revisado.
- **Validaciones** (422):
  - alérgeno inexistente;
  - `tipo` inválido;
  - el mismo alérgeno repetido en la lista.

### D3. La finalización exige alérgenos revisados

- **Nuevo tipo de problema** en `_problemas_de_finalizacion`: `alergenos_sin_revisar`, con `ingrediente_id`, `ingrediente_nombre` e `insumo_id`.
  - Mismo formato `409 {mensaje, problemas:[...]}`.
  - Se revisa con el insumo ya bloqueado, como los demás problemas.
- **`informacion_conservada` de cada uso guarda también `"alergenos_revisados_at"`.**
  - Las elaboraciones finalizadas antes de este cambio (solo hay datos locales de prueba) no tienen esa clave.
  - La interfaz las muestra como "sin información de revisión" y no las trata como "sin alérgenos".
- **Los triggers de la 016 no cambian.**

### D4. Prellenado del borrador con la última elaboración (propuesta: en el backend)

Al crear un borrador (`create_borrador`), cada línea se resuelve así:

1. **Insumo.** Si existe una elaboración **finalizada** anterior del mismo producto, toma el insumo que esa elaboración usó para ese ingrediente.
   - La más reciente se ordena por `fecha_elaboracion` y luego por `finalizada_at`, ambos descendentes.
   - Se usa solo si ese insumo sigue activo y sigue asociado al mismo ingrediente.
   - Si no se cumple, se usa el habitual como hoy, y si tampoco hay, la línea queda vacía.
2. **Lote:** **no se asigna nunca de forma automática.**
   - El detalle del borrador devuelve por línea un `lote_sugerido` (id, código, vencimiento): el lote de la elaboración anterior, si pertenece al insumo prellenado.
   - El productor lo acepta con una acción explícita.
   - El motivo: si el sistema asignara solo el lote anterior y el productor no lo cambiara, se registraría un lote falso. Ese error de trazabilidad es peor que un clic de más.

Se prefiere hacerlo en el backend y no en el frontend por tres razones:

- ocurre en la misma transacción que crea el borrador;
- reutiliza la lógica del habitual;
- evita que `PUT /usos` rechace toda la asignación cuando uno de los insumos ya está inactivo.

### D5. Navegación

- **Crear un producto** lleva al detalle del producto, no al listado.
- **Dashboard:**
  - acción "Nueva elaboración", que abre el diálogo de creación con un selector de producto (solo productos con formulación);
  - sección "Elaboraciones en curso", que lista los borradores con su enlace al registro.
  - Hay que verificar si `GET /gestion/elaboraciones` permite listar sin `producto_id`. Si no lo permite, el análisis propone el cambio mínimo.
- **Detalle de una elaboración finalizada:** botón "Registrar otra elaboración", con el producto ya seleccionado.
- **El menú "Elaboraciones" sigue como "Pronto".** El listado global corresponde a HU06.

---

## 5. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA01 | Al registrar un insumo (en `/insumos/nuevo` o desde la elaboración), el productor puede declarar sus alérgenos (contiene o trazas) en el mismo formulario. |
| CA02 | Si el insumo no tiene alérgenos, el productor debe confirmarlo explícitamente ("Este insumo no contiene alérgenos"). El formulario no lo da por hecho. |
| CA03 | El sistema distingue un insumo "sin alérgenos (revisado)" de uno "sin revisar", y lo muestra así en el listado y en el detalle del insumo. |
| CA04 | Una elaboración no puede finalizarse si alguno de sus insumos no tiene los alérgenos revisados. El sistema indica qué línea lo impide. |
| CA05 | Desde el registro de elaboración, el productor puede revisar y confirmar los alérgenos de un insumo sin salir de la pantalla. |
| CA06 | Al crear una elaboración de un producto que ya tiene una elaboración finalizada, cada línea trae el insumo usado la vez anterior, si sigue disponible. |
| CA07 | El lote de la elaboración anterior se sugiere, pero solo se asigna con una acción explícita del productor, por línea o para todas a la vez. |
| CA08 | El productor puede iniciar una elaboración desde el Dashboard y ver ahí sus elaboraciones en curso. |
| CA09 | Al crear un producto, el sistema lleva a su detalle para continuar con la formulación. |
| CA10 | Al finalizar una elaboración, el productor puede registrar otra del mismo producto con una sola acción. |
| CA11 | El escenario B (segunda elaboración con los mismos insumos y lotes) toma **7 interacciones o menos** desde el Dashboard. |

---

## 6. Tareas

| ID | Tarea | Capa | Horas |
|---|---|---|---|
| HT06-01 | Modelo y migración 017: `alergenos_revisados_at` y datos existentes | Backend | 3 |
| HT06-02 | Alta de insumo con alérgenos y declaración en bloque (`PUT …/alergenos`); los endpoints individuales marcan revisión | Backend | 4 |
| HT06-03 | Finalización exige alérgenos revisados y conserva `alergenos_revisados_at` | Backend | 3 |
| HT06-04 | Prellenado del borrador con la última elaboración y `lote_sugerido` | Backend | 4 |
| HT06-05 | Selector de alérgenos en `InsumoForm` (creación y modo embebido), confirmación "no contiene" y estado de revisión en listado y detalle | Frontend | 5 |
| HT06-06 | Registro de elaboración: resolver alérgenos sin revisar en un diálogo, aceptar lotes sugeridos (por línea y "usar los mismos lotes") | Frontend | 5 |
| HT06-07 | Navegación: producto nuevo → detalle; Dashboard con "Nueva elaboración" y "Elaboraciones en curso"; "Registrar otra elaboración" | Frontend | 4 |
| HT06-08 | Medición del escenario A y del B antes y después, y documento `docs/ht06-test-results.md` | Ambas | 2 |
| | **Total** | | **30** |

---

## 7. Pruebas mínimas

**Backend (SQLite y PostgreSQL):**

- **Migración 017:**
  - upgrade y downgrade;
  - datos existentes: con alérgenos → revisado, sin alérgenos → NULL;
  - los datos se conservan.
- **Alta con alérgenos:**
  - se crea todo o nada (un alérgeno inválido no deja el insumo creado);
  - con lista vacía, queda revisado;
  - sin el campo, queda sin revisar.
- **`PUT …/alergenos`:**
  - reemplaza la lista y marca revisado;
  - responde 404 si el insumo es de otro productor;
  - responde 422 si hay duplicados o el tipo es inválido.
- **Finalización:**
  - se bloquea con `alergenos_sin_revisar` mientras haya insumos sin revisar;
  - se permite cuando todos están revisados;
  - `informacion_conservada` incluye `alergenos_revisados_at`.
- **Prellenado:**
  - usa el insumo de la última finalizada;
  - usa el habitual si el anterior está inactivo o cambió de ingrediente;
  - no considera borradores;
  - nunca asigna el lote;
  - `lote_sugerido` es correcto;
  - no mira elaboraciones de otro producto ni de otro productor.
- **Mutaciones:**
  - quitar la validación de revisión en la finalización;
  - asignar el lote automáticamente;
  - ignorar el estado `activo` del insumo anterior.

**Frontend (Vitest):**

- El formulario de insumo no permite guardar sin declarar alérgenos o confirmar "no contiene".
- El diálogo de la elaboración envía los alérgenos en el mismo `POST`.
- El registro muestra el problema `alergenos_sin_revisar` y permite resolverlo sin salir de la pantalla.
- "Usar los mismos lotes" asigna solo los lotes sugeridos.
- Navegación: después de crear un producto, la app va al detalle; el Dashboard muestra los borradores; al finalizar se ofrece "Registrar otra elaboración".

---

## 8. Fuera de alcance

- Asistente que encadene producto, formulación, insumos y elaboración (escenario A). Ocurre una vez por producto y su costo no se justifica ahora.
- Corregir la formulación desde un borrador sin eliminarlo. Queda como deuda para el Sprint 3, porque afecta al versionado.
- Generar automáticamente el código interno de ingredientes y productos.
- Listado global de elaboraciones con búsqueda y paginación, que corresponde a HU06.
- Endpoint para clonar elaboraciones.

---

## 9. Impacto en la HU13

Cuando la HU13 cree un insumo a partir de Open Food Facts:

- **Usa el `POST` con `alergenos`.** Los alérgenos sugeridos por la fuente se cargan en el selector del formulario como propuesta.
- **El insumo queda revisado solo cuando el productor guarda el formulario**, es decir, cuando confirma esa propuesta.
- **Una sugerencia automática nunca marca la revisión por sí sola.**

El documento de contexto de la HU13 se actualizará con esto antes de comenzarla.
