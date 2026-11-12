# TrazApp — Contexto del Sprint 2 para el agente de código

Este documento reúne la información técnica y de gestión del Sprint 2. Léelo completo antes de trabajar en cualquier tarea y úsalo como referencia durante todo el sprint. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**; si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

1. **Se trabaja tarea por tarea.** Para cada tarea recibirás un prompt específico con más detalles. No comiences una tarea sin su prompt, y no avances a la siguiente aunque la conozcas por este documento.
2. **Detente al terminar cada tarea** y entrega un reporte: qué hiciste, decisiones que tomaste y que conviene revisar, archivos creados y modificados, y resultado de las pruebas.
3. **No hagas commit, push ni merge.** La desarrolladora revisa cada tarea y hace los commits ella misma.
4. **No integres nada a `main`.** La integración se hace solo mediante Pull Request, después de la revisión.
5. **Antes de crear o modificar una migración, muéstrala y espera aprobación.** No ejecutes migraciones sin visto bueno.
6. **Si una tarea requiere decidir algo que no está definido aquí**, propón alternativas y espera la decisión. No resuelvas por tu cuenta decisiones de modelo de datos o de comportamiento visible para el usuario.
7. **No borres datos ni estructuras existentes** salvo que el prompt lo pida explícitamente.
8. **Nunca escribas contraseñas, tokens ni cadenas de conexión dentro del código o de las pruebas.** Se leen desde variables de entorno.
9. **Nunca agregues al repositorio** respaldos de base de datos (`*.sql`) ni certificados o claves (`*.pem`). Están en `.gitignore`.

---

## 2. Proyecto

**TrazApp** es un sistema de gestión y comunicación de trazabilidad alimentaria para pequeños productores de alimentos elaborados. Permite registrar qué insumos comerciales y lotes se utilizaron realmente en cada elaboración, conservar esa información ante cambios posteriores y comunicarla al consumidor mediante una ficha pública accesible por QR.

### Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| Base de datos | PostgreSQL 16 |
| Frontend | React 19, Vite, TypeScript, Tailwind 4 |
| Pruebas | PyTest (backend), Vitest + Testing Library (frontend) |
| Infraestructura | Docker Compose; frontend en Netlify; backend y base de datos en un VPS con Caddy como proxy inverso |

### Convenciones del backend

- Capas: `routes → services → repositories → models`, con esquemas Pydantic en `schemas/` y dependencias de autenticación en `api/dependencies.py`.
- Los módulos autenticados usan el prefijo `/gestion/*` y la dependencia `get_current_productor`.
- Toda consulta se filtra por el productor autenticado. Un recurso de otro productor responde **404**, no 403.
- Las rutas sin prefijo `/gestion` pertenecen al prototipo RT-01 (legado). **No las uses ni las extiendas.**

### Convenciones del frontend

- Servicios de API por módulo en `src/services/` (por ejemplo, `ingredientService.ts`, `formulationService.ts`).
- Tipos en `src/types/`, utilidades en `src/lib/`.
- Patrones reutilizables existentes:
  - `IngredientForm` (con la opción `embedded` para usarse dentro de un diálogo).
  - El hook `useIngredientCreateForm` (validación, envío y manejo de errores del alta de ingredientes).
  - `IngredientAllergensSection` (asociación con el catálogo de alérgenos, agrupado en obligatorios y otros).
  - `IngredientCreateDialog` (diálogo que se abre como panel inferior en celular y centrado desde pantallas medianas).
  - Componentes de `components/ui`: `Button`, `Input`, `Alert`, `ConfirmDialog`.
- Diseño adaptable a móviles en todas las pantallas: campos y botones a ancho completo en celular y en fila desde el ancho `sm`.
- Textos de interfaz en español de Chile. Números con formato chileno (coma decimal). Fechas en formato de 24 horas y zona `America/Santiago`.
- No hay configuración de ESLint todavía; se agregará en el Sprint 3.

### Pruebas

- Backend: por defecto sobre SQLite en memoria. Las pruebas que requieren PostgreSQL (migraciones, bloqueos de fila) se omiten si no está definida `TEST_DATABASE_URL`.
- `TEST_DATABASE_URL` debe apuntar a la base aislada **`trazapp_test`**. Las pruebas de migración se niegan a correr si la base no es PostgreSQL o su nombre no termina en `_test`.
- Ejecuta la suite completa del backend en SQLite **y** en PostgreSQL al cerrar cada tarea de backend, y la suite del frontend más `npm run build` al cerrar cada tarea de frontend.
- Nombres de archivos de prueba: `test_<tema>_hu0X.py` en el backend y `hu0X.<tema>.test.tsx` en el frontend.
- Una prueba nueva debe demostrar que detecta la falla que protege (por ejemplo, comprobar que falla si se quita la protección).

### Migraciones

- Versionadas y reversibles. El downgrade no debe borrar datos; si no puede revertir sin perder información, debe fallar con un mensaje claro.
- **El identificador de revisión tiene un máximo de 32 caracteres** (límite de `alembic_version.version_num`).
- Revisión actual: `012_formulacion_versionada_hu03`. Las siguientes se numeran desde 013.
- **Atención:** el contenedor del backend ejecuta `alembic upgrade head` al iniciar. Cualquier migración nueva en el código se aplica sola si se reinicia el backend.
- Las migraciones se prueban primero sobre `trazapp_test` y después sobre la base de desarrollo `trazapp`.

### Ramas

- Una rama por historia, creada desde `main` actualizado: `feature/hu04-insumos`, `feature/hu05-elaboracion`, `feature/hu13-codigo-barras`.
- Correcciones posteriores: `fix/<historia>-<tema>`.
- El prototipo de escaneo está en `spike/ht04-validacion-tecnica`. No se integra a `main`.

---

## 3. Modelo conceptual (glosario)

| Término | Definición | Ejemplo |
|---|---|---|
| Producto | Alimento elaborado que el productor comercializa | Queque de vainilla |
| Ingrediente | Componente **genérico** de la receta, sin marca | Leche |
| Formulación | Lista de ingredientes genéricos de un producto | Harina + Azúcar + Leche |
| Versión del producto | Formulación registrada. Se crea una nueva cuando cambia la receta de un producto ya utilizado en una elaboración; **no** cuando cambia la marca de un insumo | Versión 1, Versión 2 |
| Insumo comercial | Producto comercial efectivamente comprado, con marca u origen e información declarada | Leche Colun Semidescremada 1 L |
| Lote de insumo | Lote específico del insumo utilizado | Lote X123, vence 15/10 |
| Elaboración | Cada producción de una versión del producto | Elaboración E-014 del 29/09 |
| Información conservada | Copia inmutable de la información de los insumos utilizados, guardada al finalizar la elaboración | En E-014 se usó Leche Colun con sus alérgenos |

**Reglas clave del modelo:**
- "Leche Colun sin lactosa" **no es un ingrediente**: es un insumo comercial asociado al ingrediente "Leche".
- La elaboración no gestiona inventario ni cantidades producidas.
- Los alérgenos de un ingrediente genérico son solo una **referencia**. Los alérgenos de cada elaboración provienen de los insumos comerciales utilizados.

### Catálogo de alérgenos

Tabla `alergenos` con `id`, `codigo`, `nombre` y `obligatorio_chile`. Endpoint `GET /gestion/alergenos` (obligatorios primero, luego por nombre).

- **Obligatorios** según la Resolución Exenta N.º 427 del Minsal (9): gluten, crustáceos, huevo, pescado, maní, soya, leche, nueces, sulfitos.
- **No obligatorios** (5): apio, mostaza, sésamo, altramuces, moluscos.
- Los nombres usan la terminología chilena (Maní, Soya, Leche, Nueces, Huevo). **Los valores de `codigo` e `id` no se modifican nunca**: el frontend y las asociaciones dependen de ellos.
- En la interfaz, los obligatorios llevan la etiqueta "Rotulación obligatoria".

---

## 4. Sprint 2

**Período:** 14 de septiembre al 10 de octubre de 2026.
**Incremento:** 2 — Trazabilidad por elaboración.
**Versión esperada:** v2.0.0-sprint2.

**Meta:** permitir que el productor registre qué insumos comerciales y lotes utilizó realmente en cada elaboración, con registro asistido de insumos mediante código de barras, conservando esa información ante cambios posteriores.

| Objetivo | Historias |
|---|---|
| Adecuar el modelo de la Iteración 1 sin pérdida de información | HT03 |
| Definir la formulación de cada producto y registrar sus versiones ante cambios de receta | HU03 |
| Registrar insumos comerciales, con recuperación de su información mediante código de barras | HU04, HU13, HT04 |
| Registrar elaboraciones y conservar de forma inmutable la información utilizada | HU05 |

### Estado

| ID | Historia | SP | Estado |
|---|---|---|---|
| HT03 | Adecuación del modelo existente | 3 | Terminada |
| HT04 | Validación técnica de fuentes de información | 2 | Terminada |
| HU03 | Gestión de formulación y versiones del producto | 8 | Terminada |
| HU04 | Gestión de insumos comerciales | 5 | Pendiente |
| HU05 | Registro de elaboración | 8 | Pendiente |
| HU13 | Búsqueda de insumos mediante código de barras | 8 | Pendiente |

**Orden:** HU04 → HU05 → HU13. La HU05 va antes de la HU13 porque es el núcleo del proyecto.

### Definición de Terminado

Una historia está terminada cuando cumple todos sus criterios, su plan de pruebas se ejecutó sin fallas, las pruebas de regresión no presentan errores, fue integrada a `main` mediante Pull Request, está desplegada en producción con prueba de humo superada y su estado está actualizado en Taiga.

---

## 5. Lo ya implementado (referencia)

### HT03 — Adecuación del modelo existente

- `ingredientes.tipo` es opcional; la interfaz no muestra tipo ni composición. Se bloquea quitar el tipo `compuesto` si el ingrediente tiene componentes.
- El frontend **no envía la clave `tipo`** al crear ni al actualizar ingredientes.
- Migración `011_alergenos_obligatorio_chile`: columna `obligatorio_chile` y nombres en terminología chilena.
- Endpoint `GET /gestion/alergenos`. Se eliminó la copia local del catálogo en el frontend.
- Las tablas `ingredientes_composicion` y las del prototipo RT-01 se conservan como legado, sin uso por los módulos nuevos.

### HU03 — Formulación y versiones del producto

- Migración `012_formulacion_versionada_hu03`: `versiones_producto.usada_en_elaboracion` y cantidad y unidad opcionales pero juntas.
- `PUT /gestion/productos/{id}/formulacion`: reemplaza la formulación completa y responde el resultado (`version_creada`, `modificada_en_lugar`, `nueva_version`, `sin_cambios`) con la versión.
- `GET /gestion/productos/{id}/formulacion`: `{"existe": bool, "version": ...}`.
- `GET /gestion/productos/{id}/versiones`: historial, de la más reciente a la más antigua.
- `GET /gestion/productos/{id}/versiones/{version_id}/formulacion`: detalle de una versión (solo lectura).
- Cada línea indica `ingrediente_desactivado`.
- Una sola versión vigente por producto, garantizada en el servicio con `SELECT … FOR UPDATE`.
- Reordenar los ingredientes no crea una nueva versión.

**Métodos preparados para HU05** (en `ProductoFormulacionService`):
- `obtener_version_vigente(productor, producto_id)`: devuelve la versión vigente o `None` si el producto no tiene formulación.
- `marcar_version_usada(version_id)`: marca la versión como utilizada. **No confirma la transacción**: debe llamarse en la misma transacción que crea la elaboración.

---

## 6. HU04 — Gestión de insumos comerciales

**Prioridad:** P1 · **Story Points:** 5 · **Estimación:** 5,5 h · **Rama:** `feature/hu04-insumos`

### Historia de usuario

Como productor, quiero registrar los productos comerciales que utilizo como insumos, con sus ingredientes declarados y alérgenos, para identificar qué producto real se utilizó en cada elaboración sin depender de transcribir su información.

### Descripción

Esta historia define la ficha del insumo comercial y su registro manual. La misma ficha puede completarse automáticamente mediante el escaneo del código de barras (HU13) o la búsqueda en fuentes públicas (HU07), quedando siempre sujeta a la confirmación del productor.

### Criterios de aceptación

| ID | Criterio |
|---|---|
| CA01 | El sistema debe permitir registrar un insumo indicando nombre, marca, fabricante u origen e ingrediente asociado (por ejemplo, "Chocolate Ambrosoli 500 g" → "Chocolate", o "Huevos de campo, feria local" → "Huevo"). |
| CA02 | El sistema debe permitir registrar opcionalmente presentación, código de barras, ingredientes declarados y advertencias. |
| CA03 | El código de barras debe ser único entre los insumos de un mismo productor. |
| CA04 | Los alérgenos declarados deben seleccionarse desde el catálogo de alérgenos del sistema. |
| CA05 | Cada alérgeno declarado debe registrarse indicando si el insumo lo contiene o si puede contenerlo (trazas). |
| CA06 | Un mismo ingrediente podrá tener varios insumos asociados. |
| CA07 | El sistema debe permitir marcar un insumo como habitual para su ingrediente; solo podrá existir un insumo habitual por ingrediente. |
| CA08 | El sistema debe permitir listar, consultar y modificar los insumos registrados. |
| CA09 | Modificar un insumo no debe alterar las elaboraciones ya registradas. |
| CA10 | El sistema debe permitir desactivar un insumo; un insumo desactivado no estará disponible para nuevas elaboraciones. |
| CA11 | Cada insumo pertenecerá exclusivamente al productor que lo registró. |
| CA12 | La ficha del insumo debe almacenarse con una estructura compatible con la recuperación automática de información (fuente y fecha de recuperación). |
| CA13 | El formulario de registro debe seguir el patrón adaptable a dispositivos móviles de los formularios existentes. |

### Tareas

| ID | Tarea | Estimación |
|---|---|---|
| T04-01 | Implementar el modelo del insumo comercial y su migración, incluyendo la ficha semiestructurada, la fuente y la fecha de recuperación | 1 h |
| T04-02 | Implementar la asociación entre insumo y alérgeno con su tipo de declaración (contiene o trazas) | 0,5 h |
| T04-03 | Desarrollar los endpoints de gestión de insumos con sus validaciones: unicidad del código de barras, ingrediente del productor, insumo habitual y desactivación | 1,25 h |
| T04-04 | Desarrollar los endpoints de alérgenos del insumo, reutilizando el patrón de HU02 | 0,5 h |
| T04-05 | Desarrollar la interfaz de listado, detalle y formulario de insumos, adaptable a dispositivos móviles | 1,5 h |
| T04-06 | Ejecutar y documentar pruebas | 0,75 h |

### Plan de pruebas

| ID | Caso de prueba | Resultado esperado |
|---|---|---|
| PT04-01 | Registrar un insumo con los datos obligatorios | El insumo se registra asociado a su ingrediente. |
| PT04-02 | Registrar un insumo con datos obligatorios incompletos | El sistema informa los campos requeridos. |
| PT04-03 | Registrar un insumo con origen en vez de marca (por ejemplo, feria local) | El insumo se registra correctamente. |
| PT04-04 | Registrar un insumo con código de barras repetido para el mismo productor | El sistema rechaza la operación. |
| PT04-05 | Registrar el mismo código de barras en insumos de productores distintos | Ambos insumos se registran correctamente. |
| PT04-06 | Asociar alérgenos indicando que el insumo los contiene y que puede contenerlos | Los alérgenos quedan registrados con su tipo de declaración. |
| PT04-07 | Asociar varios insumos a un mismo ingrediente | Todos quedan asociados sin duplicar el ingrediente. |
| PT04-08 | Marcar un insumo como habitual cuando ya existe otro habitual para el mismo ingrediente | Solo el último queda marcado como habitual. |
| PT04-09 | Modificar la información de un insumo | Los cambios se guardan y se muestran correctamente. |
| PT04-10 | Desactivar un insumo | El insumo queda inactivo y no se ofrece para nuevas elaboraciones. |
| PT04-11 | Acceder o modificar un insumo de otro productor | El sistema rechaza el acceso. |
| PT04-12 | Asociar un insumo a un ingrediente de otro productor | El sistema rechaza la operación. |
| PT04-13 | Registrar un insumo desde un dispositivo móvil | El formulario se visualiza y opera correctamente. |
| PT04-14 | Validar estados de carga, errores y ausencia de insumos | La interfaz muestra estados y mensajes adecuados. |

CA09 se verifica en HU05 (PT05-12), porque las elaboraciones todavía no existen.

### Orientaciones de diseño

- **Ingredientes declarados y advertencias en columnas propias** (texto), no solo dentro del JSONB: son los datos que el productor ve y edita, los que HU05 copia y los que verá el consumidor. El JSONB de la ficha se reserva para los datos crudos que entregue una fuente externa.
- **Unicidad del código de barras por productor solo cuando no es nulo**, y **un solo insumo habitual por ingrediente**: idealmente garantizadas en la base de datos (índices únicos parciales en PostgreSQL), además de la validación del servicio.
- Las asociaciones con alérgenos siguen el patrón de `ingredientes_alergenos`, con una columna adicional para el tipo de declaración.
- La interfaz reutiliza los patrones de HU02 (`IngredientForm`, `IngredientAllergensSection`). Los alérgenos del insumo deben mostrar el tipo de declaración.
- Los alérgenos de un insumo son los que verá el consumidor; en la interfaz deben distinguirse de los alérgenos de referencia del ingrediente.

**Valor entregado:** permitir al productor registrar los productos comerciales que realmente utiliza, con sus ingredientes declarados y alérgenos diferenciados entre los que contiene y los que puede contener, estableciendo la ficha que después se completará automáticamente mediante el escaneo o la búsqueda de productos.

---

## 7. HU05 — Registro de elaboración

**Prioridad:** P1 · **Story Points:** 8 · **Estimación:** 9 h · **Rama:** `feature/hu05-elaboracion`

### Historia de usuario

Como productor, quiero registrar cada elaboración indicando el insumo comercial y el lote utilizado para cada ingrediente, para conservar qué se utilizó realmente en ella.

### Criterios de aceptación

| ID | Criterio |
|---|---|
| CA01 | El sistema debe permitir registrar una elaboración indicando producto, fecha y código de elaboración. |
| CA02 | El sistema debe sugerir un código de elaboración, que el productor podrá modificar. |
| CA03 | El código de elaboración debe ser único dentro del mismo producto. |
| CA04 | Al registrar la elaboración, el sistema debe cargar los ingredientes de la formulación vigente y asociar la elaboración a esa versión del producto. |
| CA05 | Para cada ingrediente, el sistema debe preseleccionar el insumo habitual, que el productor podrá cambiar por otro insumo asociado. |
| CA06 | Para cada insumo, el productor debe ingresar su lote, salvo que indique explícitamente que el insumo no tiene lote; la fecha de vencimiento será opcional. |
| CA07 | El sistema debe permitir reutilizar un lote previamente registrado del mismo insumo. |
| CA08 | Una elaboración no podrá finalizarse si algún ingrediente no tiene insumo asignado. |
| CA09 | Mientras esté en borrador, la elaboración podrá modificarse o eliminarse. |
| CA10 | El productor debe finalizar la elaboración mediante una acción explícita, con una confirmación previa que advierta que la información no podrá modificarse. |
| CA11 | Al finalizar, el sistema debe conservar una copia de la información de cada insumo utilizado: nombre, marca u origen, ingredientes declarados, alérgenos y advertencias. |
| CA12 | Una elaboración finalizada no podrá modificarse ni eliminarse, y su información conservada no podrá alterarse mediante ninguna operación del sistema. |
| CA13 | Modificar o desactivar posteriormente un insumo, ingrediente o formulación no debe alterar las elaboraciones finalizadas. |
| CA14 | Desde el registro de una elaboración, el sistema debe permitir registrar un nuevo insumo para un ingrediente sin salir del flujo, y este debe quedar asignado a la elaboración. |
| CA15 | El sistema debe permitir consultar el detalle de una elaboración registrada. |
| CA16 | Cada elaboración pertenecerá exclusivamente al productor que la registró. |

### Tareas

| ID | Tarea | Estimación |
|---|---|---|
| T05-01 | Implementar los modelos de elaboración, uso de insumo y lote de insumo, con su migración | 1 h |
| T05-02 | Implementar la creación del borrador: carga de la formulación vigente, asociación a la versión, preselección del insumo habitual y código sugerido | 1,25 h |
| T05-03 | Desarrollar la asignación de insumo y lote por ingrediente: lote nuevo, lote reutilizado o insumo sin lote | 1 h |
| T05-04 | Implementar la finalización: validación, copia inmutable de la información de los insumos y cambio de estado en una misma transacción | 1,25 h |
| T05-05 | Implementar el bloqueo de modificación y eliminación de elaboraciones finalizadas | 0,5 h |
| T05-06 | Desarrollar la interfaz de registro de la elaboración y la confirmación de finalización | 1,5 h |
| T05-07 | Desarrollar la interfaz de detalle de la elaboración | 0,5 h |
| T05-08 | Permitir registrar un insumo desde la elaboración, reutilizando el formulario de HU04 en una ventana | 1 h |
| T05-09 | Ejecutar y documentar pruebas | 1 h |

### Plan de pruebas

| ID | Caso de prueba | Resultado esperado |
|---|---|---|
| PT05-01 | Crear una elaboración de un producto con formulación | Se crea un borrador asociado a la versión vigente, con los ingredientes de la formulación y un código sugerido. |
| PT05-02 | Crear una elaboración de un producto sin formulación | El sistema impide el registro. |
| PT05-03 | Registrar un código de elaboración repetido para el mismo producto | El sistema rechaza la operación. |
| PT05-04 | Crear una elaboración de un ingrediente con insumo habitual | El insumo habitual queda preseleccionado y puede cambiarse. |
| PT05-05 | Asignar un insumo con lote nuevo | El lote queda registrado y asociado al uso del insumo. |
| PT05-06 | Asignar un insumo reutilizando un lote existente | Se reutiliza el lote sin duplicarlo. |
| PT05-07 | Asignar un insumo indicando que no tiene lote | El uso del insumo queda registrado sin lote. |
| PT05-08 | Modificar y eliminar una elaboración en borrador | Los cambios se aplican correctamente. |
| PT05-09 | Finalizar una elaboración con ingredientes sin insumo asignado | El sistema impide la finalización e indica los ingredientes pendientes. |
| PT05-10 | Finalizar una elaboración completa | Se solicita confirmación, se conserva la copia de la información de los insumos y el estado cambia a finalizada. |
| PT05-11 | Intentar modificar o eliminar una elaboración finalizada | El sistema rechaza la operación. |
| PT05-12 | Modificar un insumo utilizado en una elaboración finalizada | La elaboración conserva la información original del insumo. |
| PT05-13 | Modificar la formulación de un producto con elaboraciones | Se genera una nueva versión; las elaboraciones anteriores conservan la versión previa. |
| PT05-14 | Cambiar el insumo utilizado para un ingrediente en una nueva elaboración | La formulación mantiene su versión. |
| PT05-15 | Consultar el detalle de una elaboración finalizada | Se muestra la información conservada, no la vigente. |
| PT05-16 | Acceder a una elaboración de otro productor | El sistema rechaza el acceso. |
| PT05-17 | Validar estados de carga, errores y confirmación de finalización | La interfaz muestra estados y mensajes adecuados. |
| PT05-18 | Registrar un insumo nuevo desde una elaboración en borrador | El insumo queda registrado, asociado a su ingrediente y asignado a la elaboración, sin salir del registro. |

### Orientaciones de diseño

- **La versión se marca como utilizada al crear la elaboración** (en cualquier estado), llamando a `marcar_version_usada` **en la misma transacción** que crea la elaboración. Así, si la receta se modifica mientras existe un borrador, se crea una versión nueva y el borrador queda asociado a la versión con la que coincide.
- **Un producto sin formulación no puede registrar elaboraciones**: se verifica con `obtener_version_vigente`, que devuelve `None`.
- **La finalización es la implementación directa de la mitigación del riesgo RT-01** (el riesgo técnico principal del proyecto): validación, copia inmutable de la información de cada insumo y cambio de estado deben ocurrir **en una sola transacción**. Si algo falla, no puede quedar una elaboración finalizada sin su información conservada.
- La información conservada se guarda en un campo semiestructurado (JSONB) en cada uso de insumo, e incluye los alérgenos **con su tipo de declaración** (contiene o trazas).
- La consulta de una elaboración finalizada siempre muestra la información conservada, nunca la vigente del insumo.
- Un uso de insumo referencia directamente al insumo comercial; el lote es opcional (indicador `sin_lote`). Así, un insumo sin lote sigue siendo identificable.
- El código de elaboración debe coincidir con lo que el productor imprime en el envase, porque es lo que usará el consumidor para seleccionar su elaboración.
- **No registrar cantidades producidas**: acercaría el sistema a un inventario, que está fuera del alcance.
- El registro de un insumo desde la elaboración reutiliza el formulario de HU04 en un diálogo, con el mismo patrón de `IngredientCreateDialog`, y conserva los cambios no guardados de la elaboración.

### Pendientes heredados de HU03

Estos casos de HU03 quedaron verificados solo hasta la frontera con HU05 y se cierran aquí:

| Caso de HU03 | Se cierra con |
|---|---|
| PT03-09 — Modificar una formulación utilizada | PT05-13 |
| PT03-12 — Cambiar el insumo comercial | PT05-14 |
| PT03-13 — Elaborar un producto sin formulación | PT05-02 |

La prueba `test_cambiar_insumo_comercial_no_cambia_la_version` (en `test_formulacion_vigente_hu03.py`) simula el caso con modelos del prototipo RT-01. **Debe reemplazarse** por una prueba con insumos comerciales y elaboraciones reales.

**Valor entregado:** permitir al productor registrar qué insumos comerciales y lotes utilizó realmente en cada elaboración, conservando esa información de forma inmutable aunque los insumos, ingredientes o formulaciones cambien después, lo que constituye la base de la trazabilidad y de la consulta pública.

---

## 8. HU13 — Búsqueda de insumos mediante código de barras

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

### Decisiones técnicas (resultado de HT04)

- **Lector de códigos:** se usa el detector nativo `BarcodeDetector` cuando el navegador lo ofrece (Chrome para Android) y **ZBar-WASM** (`@undecaf/zbar-wasm`) como alternativa (Safari para iOS). `html5-qrcode` se descartó: su decodificador en JavaScript no lee códigos EAN en Safari. Dynamsoft se descartó por requerir licencia de pago.
- **El prototipo** está en la rama `spike/ht04-validacion-tecnica`: se reutiliza la parte de cámara y lectura, no su arquitectura.
- **La lectura del código ocurre en el frontend; la consulta a las fuentes ocurre en el backend**, mediante el componente de recuperación de información. El frontend nunca consulta Open Food Facts directamente.
- **Open Food Facts** pide que cada aplicación se identifique en sus consultas mediante el encabezado `User-Agent` (por ejemplo, `TrazApp/0.x (proyecto académico)`). El backend debe enviarlo.
- **Las etiquetas de alérgenos de Open Food Facts no son confiables.** En la validación, una leche sin lactosa (código 7802910000971) no tenía etiquetado el alérgeno leche, aunque sus ingredientes dicen "leche". Los alérgenos deben detectarse también desde el texto de ingredientes y siempre confirmarlos el productor.
- **Cobertura medida:** de 16 insumos escaneados desde envases reales, 11 encontrados (69 %), 9 con ingredientes (56 %) y 2 con alérgenos etiquetados (12 %). El ingreso manual es indispensable.
- **No usar UPCitemdb** ni otras fuentes comerciales.
- El componente de recuperación se diseña con una interfaz común de fuente y un adaptador por fuente: la HU07 (Sprint 3) agregará un adaptador de scraping sin modificar el resto.

**Valor entregado:** permitir al productor registrar sus insumos comerciales escaneando el código de barras del envase, sin transcribir su información, y detectar los alérgenos incluso cuando la fuente pública no los tiene etiquetados, reduciendo la carga de registro y mejorando la calidad de la información que llega al consumidor.

---

## 9. Riesgos del sprint

| Riesgo | Cómo afecta el desarrollo | Mitigación esperada |
|---|---|---|
| RT-01 — Conservación de información | La información de una elaboración finalizada podría alterarse | Copia inmutable y cambio de estado en una sola transacción; pruebas que demuestren que la información no cambia |
| RT-04 — Cambios en el modelo de datos | Las migraciones modifican datos existentes | Migraciones reversibles, probadas sobre `trazapp_test` antes de aplicarlas |
| RT-06 — Disponibilidad de la fuente externa | Open Food Facts no contiene todos los productos o puede no responder | Ingreso manual siempre disponible; manejo explícito de errores y tiempos de espera |
| RT-07 — Información recuperada incorrecta | La fuente no etiqueta todos los alérgenos | Detección desde el texto de ingredientes y confirmación obligatoria del productor |

---

## 10. Fuera de alcance

- Inventario, stock y cantidades producidas.
- Mostrar lotes de insumos al consumidor (son información interna).
- Consulta pública, publicación y QR (HU09 y HU10, Sprint 3).
- Búsqueda de insumos por nombre mediante scraping (HU07, Sprint 3).
- Las rutas y tablas del prototipo RT-01 (legado; no se usan ni se extienden).
