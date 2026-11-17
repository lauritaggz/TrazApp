# TrazApp — Contexto de la HU14 para el agente de código

**HU14 — Calculadora de costos del producto** (Sprint 3)

*Creado el 16-11-2026.*

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md` (stack, convenciones, glosario y modelo), a `TrazApp_HU07_contexto_agente.md` (adaptadores de Jumbo y Open Food Facts), a `TrazApp_HU10_contexto_agente.md` (reglas de trabajo vigentes) y a `TrazApp_HU08_contexto_agente.md` (formato de errores corregido). Léelo completo antes de trabajar en la HU14. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**. Si algo no está claro, pregunta antes de suponer.

---

## 1. Reglas de trabajo (obligatorias)

Las reglas de la sección 1 de `TrazApp_HU10_contexto_agente.md` aplican completas: tarea por tarea, modo ahorro, pruebas locales solo nuevas y afectadas (la regresión la ejecuta el CI), formato del reporte, rama y PR draft, migraciones como `.pendiente`, dependencias nuevas con reconstrucción de la imagen, no borrar datos, sin secretos, cuentas de prueba, puerto 5175 prohibido, mutaciones restauradas con `git diff` o `cmp`, pruebas existentes que cambian se explican y nunca se relajan, e inmutabilidad de las elaboraciones finalizadas.

Además, para HU14:

1. **La calculadora es una estimación.** Nunca modifica elaboraciones, usos, información conservada ni versiones de la formulación (CA11).
2. **Dinero con `Decimal`.** Nunca `float` para precios, cantidades ni totales, ni en el backend ni en las pruebas.
3. **Red externa:** las pruebas nunca consultan Jumbo ni Open Food Facts reales; usan respuestas grabadas (como en HU07). Se respetan las condiciones de uso de Jumbo registradas en HU07 (rutas permitidas, atribución, una consulta por acción del productor).

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

- **Rama:** `feature/hu14-calculadora-costos`, creada desde `main` actualizado **después del merge de HU08**.
- **Entorno local:** Docker Compose. API en **8010**, PostgreSQL en **5442**. Corre las pruebas en el contenedor (`unset TEST_DATABASE_URL` para SQLite; nunca dos suites a la vez sobre `trazapp_test`).
- **Migración vigente:** `018_publicacion_producto_hu09`. HU14 usa la **019** (el Sprint Planning decía 018, pero se numeran por orden de merge y la 018 la tomó HU09). Revisa las pruebas que fijan la cabeza de Alembic o comparan con igualdad exacta el estado tras `upgrade head`.
- **Convención de errores** (corregida en HU08): `404` con `detail` de texto (la interfaz decide por el código de estado); `409` y `422` con `{mensaje, …}` cuando llevan datos.
- **Documento de resultados:** `docs/test/hu14-test-results.md` y evidencia en `docs/test/validacion_hu14/`.

---

## 3. Historia y criterios

**Como productor, quiero calcular el costo de elaborar un producto a partir de sus ingredientes, los precios de mis insumos y otros costos que yo defina, para conocer cuánto me cuesta producir cada tanda y cada unidad.**

Prioridad P1 · 8 SP · 8,5 h · Depende de HU03, HU04, HU05 y HU07 · Origen: **SC-05** (validado con los profesores evaluadores).

| ID | Criterio |
|---|---|
| CA1 | La calculadora tiene una página propia con selector de producto y puede abrirse desde el detalle de un producto. |
| CA2 | Las líneas corresponden a los ingredientes de la formulación vigente del producto. |
| CA3 | Cada línea preselecciona el insumo de la última elaboración finalizada del producto o, si no hay, el insumo habitual; un selector permite elegir otro insumo del mismo ingrediente, sin guardar la elección. |
| CA4 | El productor registra en la calculadora la cantidad y unidad de cada ingrediente usadas en una tanda; se guardan en el producto y no generan versiones. |
| CA5 | El precio y el contenido del insumo se obtienen desde Jumbo u Open Food Facts, con fuente y fecha, y se editan en el insumo; el cambio se refleja en todos los productos que lo usan. |
| CA6 | Las unidades se convierten solo dentro de la misma magnitud (g y kg, ml y L, unidades). |
| CA7 | El productor puede agregar otros costos por tanda, con nombre y monto. |
| CA8 | El productor puede registrar el rendimiento: cuántos productos salen de una tanda. |
| CA9 | Se muestra el costo por tanda y, si hay rendimiento, el costo por unidad; si falta un dato, se indica cuál y en qué línea, sin mostrar un total incompleto. |
| CA10 | Con el cálculo completo y rendimiento, el detalle del producto muestra el costo de producción calculado con la etiqueta "calculado", sin borrar el valor manual de HU01. |
| CA11 | Es una estimación con precios vigentes: no modifica elaboraciones ni versiones e indica la fecha del precio más antiguo. |
| CA12 | Cada productor accede solo a sus propios productos. |

**Cambio asociado:** los campos de cantidad de la formulación se ocultan en la interfaz (formulación y detalle de la elaboración), sin eliminar datos.

**Fuera de alcance (trabajo futuro):** tandas múltiples, costo por elaboración, márgenes, historial de precios y fórmulas para otros costos.

---

## 4. Lo que ya existe (punto de partida)

Verifica cada punto en el código antes de apoyarte en él.

- **Producto (HU01):** costo de producción y precio de venta **manuales** y opcionales. Confirma si el costo manual es por unidad o por tanda: CA10 lo compara con el costo calculado.
- **Formulación versionada (HU03):** `Producto → VersionProducto`, con líneas por ingrediente que hoy tienen cantidad y unidad.
- **Insumos (HU04/HU07/HU13):** `insumos_comerciales`, asociados a un ingrediente; concepto de **insumo habitual** (verifica cómo está modelado). La `ficha` guarda los datos crudos de la recuperación; en HU07 se dejó abierta la posibilidad de que el precio de Jumbo quedara en `ficha` sin usarse: **verifica si existe**.
- **Adaptadores (HU07):** `FuenteProducto`, `FuenteBusquedaNombre`, `JumboFuente`, `OpenFoodFactsFuente`, `FuenteCombinada`, con presupuesto de 10 s y fixtures.
- **Elaboraciones (HU05/HU08):** el insumo usado en una finalizada se identifica por las columnas de `usos_insumo` (equivalentes a la copia conservada, decisión D1 de HU08).
- **Diseño:** `docs/diseno/DISEÑOS SPRINT 3/CostCalculator.tsx`. Sistema de diseño real: `docs/DESIGN.md`.

---

## 5. Decisiones de diseño

Las marcadas como **propuesta** se confirman en la Fase 1 de T14-02, que define el modelo y el contrato completo del backend (T14-02 a T14-05).

### D1. Modelo de datos (migración 019, propuesta)

- `insumos_comerciales`: precio de referencia (`Numeric`), contenido (cantidad `Numeric` y unidad), fuente del precio (`jumbo`, `open_food_facts`, `manual`) y fecha del precio. Todos nulos por defecto: los insumos existentes quedan "sin precio" hasta que se obtenga o se edite.
- `productos`: rendimiento (entero > 0, nulo por defecto).
- Tabla de cantidades por producto e ingrediente: cantidad (`Numeric` > 0) y unidad, **única por par**. No depende de la versión: si un ingrediente sale de la formulación vigente, su fila se conserva pero no se usa.
- Tabla de otros costos: producto, nombre, monto (`Numeric` ≥ 0), orden.
- CHECK en la base para positivos y unidades válidas. Downgrade sin pérdida de datos de otras tablas (como la 018: si hay datos que no se pueden reconstruir, propón si se niega).

### D2. Unidades y conversión (CA6)

- Unidades: `g`, `kg` (masa); `ml`, `L` (volumen); `un` (unidades).
- Solo se convierte dentro de la misma magnitud. Magnitudes distintas → la línea indica "unidades incompatibles" (PT14-09).
- Cálculo con `Decimal`. El redondeo a pesos se hace solo al mostrar; propón la regla (por ejemplo, `ROUND_HALF_UP` a 0 decimales) y aplícala igual en el backend y el frontend.
- Ejemplos obligatorios (PT14-08): 250 g con insumo de 1 kg a $1.000 → $250; 200 ml con 1 L a $1.100 → $220; 3 un con 12 un a $3.000 → $750.

### D3. Precio y contenido (CA5, T14-03, propuesta)

- Jumbo: precio y contenido neto desde los datos estructurados. Open Food Facts: solo contenido (campo de cantidad); no tiene precio.
- Parser de contenido que normaliza textos como "1 kg", "500 g", "1 L", "12 un". **Decide** qué hacer con presentaciones múltiples ("6 x 200 ml", "Pack 3 x 1 L"): normalizarlas o dejarlas sin contenido para edición manual. Lo que el parser no entienda queda nulo, nunca adivinado.
- Edición en el insumo: el productor edita precio y contenido; la fuente pasa a "manual" con la fecha del cambio (PT14-07).
- **Insumos ya registrados:** los criterios no dicen cómo obtienen precio los insumos registrados antes de HU14. Propón una opción: solo edición manual, o una acción "Actualizar precio desde Jumbo" en el insumo (una consulta por acción del productor).

### D4. Preselección del insumo (CA3, propuesta)

- Orden: insumo de la **última elaboración finalizada** del producto para ese ingrediente → **insumo habitual** del ingrediente → "sin insumo".
- Define "última" (el mismo orden de HU06: `fecha_elaboracion` desc, `id` desc).
- **Decide** qué pasa si el insumo preseleccionado está inactivo (eliminado lógicamente).
- La elección con el selector viaja en el GET (insumo alternativo opcional por línea) y **no se guarda** (PT14-04).

### D5. Cálculo y faltantes (CA9)

- Costo de una línea = cantidad de la tanda convertida a la unidad del contenido ÷ contenido del insumo × precio.
- Faltantes por línea: sin cantidad, sin insumo, insumo sin precio, insumo sin contenido, unidades incompatibles. Cada línea indica **qué** falta.
- Con cualquier faltante, **no se muestra** total por tanda ni por unidad (ni parcial).
- Total por tanda = suma de líneas + otros costos. Por unidad = total ÷ rendimiento (solo si hay rendimiento).
- Fecha del precio más antiguo entre los insumos usados (CA11).

### D6. Costo calculado en el detalle del producto (CA10)

- Solo con el cálculo completo y rendimiento. Etiqueta "calculado". El valor manual de HU01 **no se modifica en la base** y vuelve a mostrarse si el cálculo deja de estar completo (PT14-13).
- Confirma en la Fase 1 si se calcula al pedir el detalle (reutilizando el servicio) y su costo en consultas.

### D7. Cambio asociado: ocultar cantidades de la formulación

- Se ocultan en la interfaz del editor de formulación y del detalle de la elaboración, **sin eliminar datos** (PT14-16).
- **Riesgo a verificar:** si la API de la formulación exige cantidad y unidad al crear o versionar, ocultar los campos rompería el guardado. Propón cómo resolverlo (por ejemplo, hacerlos opcionales en el esquema de entrada, sin migración que borre datos).
- La ficha pública (HU10) ya no muestra cantidades; verifica que no cambie.

### D8. Interfaz (T14-06)

- Página propia en el menú (grupo "Herramientas", junto a Publicaciones) y acceso desde el detalle del producto con el producto preseleccionado (PT14-01).
- Fiel a `CostCalculator.tsx`, móvil primero, sin desplazamiento horizontal, textos de al menos 12 px y áreas táctiles de 44 px (PT14-17).
- Faltantes con texto, no solo color.

---

## 6. Tareas

| ID | Tarea | Horas |
|---|---|---|
| T14-01 | Diseñar en Figma la calculadora para escritorio y móvil: selector de producto, tabla de líneas con selector de insumo, otros costos, rendimiento, resultado y estados de datos faltantes | 0,5 |
| T14-02 | Migración (019) y modelos SQLAlchemy: precio de referencia, contenido (cantidad y unidad), fuente y fecha del precio en insumos_comerciales; rendimiento en productos; tablas de cantidades por producto e ingrediente (única por par) y de otros costos (nombre, monto, orden), con restricciones CHECK y downgrade sin pérdida de datos | 1,25 |
| T14-03 | Extender los adaptadores de FuenteProducto para obtener precio y contenido (Jumbo: precio y contenido neto de los datos estructurados; Open Food Facts: campo de cantidad), con un parser que normalice el contenido a cantidad y unidad; esquemas Pydantic y endpoint de edición del insumo que registra fuente "manual" y fecha | 0,75 |
| T14-04 | Servicio de cálculo: líneas desde la versión vigente de la formulación, insumo preseleccionado, conversión por magnitud con Decimal, detección de faltantes por línea y totales por tanda y por unidad | 1,5 |
| T14-05 | Endpoints /gestion/productos/{id}/costos: GET con insumo alternativo opcional por línea y PUT de cantidades, rendimiento y otros costos, con validaciones (422) y aislamiento por productor (404) | 0,75 |
| T14-06 | Página de la calculadora en React: selector de producto, tabla editable de líneas, otros costos y rendimiento, resultado y faltantes; servicio y tipos; acceso desde el detalle del producto | 2 |
| T14-07 | Costo de producción calculado en el detalle del producto con su etiqueta, conservando el valor manual; ocultar cantidad y unidad en el editor de formulación y en el detalle de la elaboración | 0,75 |
| T14-08 | Ejecutar y documentar pruebas (conversión, faltantes, preselección, aislamiento), con mutaciones, prueba en celular y docs/test/hu14-test-results.md | 1 |

**T14-01:** el diseño `CostCalculator.tsx` ya existe en `DISEÑOS SPRINT 3`. La desarrolladora confirma si cubre móvil y los estados de faltantes; el agente no hace esta tarea.

**Evidencia esperada:** `docs/test/hu14-test-results.md`, diseño de Figma, ejecución de la integración continua del Pull Request y capturas de la calculadora en el celular.

---

## 7. Plan de pruebas

| ID | Caso | Resultado esperado | CA |
|---|---|---|---|
| PT14-01 | Abrir la calculadora desde el menú y desde el detalle de un producto | Desde el detalle, el producto viene seleccionado | 1 |
| PT14-02 | Agregar un ingrediente a la formulación (nueva versión) y abrir la calculadora | Aparece la línea nueva; no aparecen ingredientes de versiones anteriores | 2 |
| PT14-03 | Producto con elaboración finalizada que usó un insumo no habitual; producto sin elaboraciones; ingrediente sin habitual | Preselecciona el insumo usado; luego el habitual; luego indica "sin insumo" | 3 |
| PT14-04 | Cambiar el insumo con el selector y recargar la página | Recalcula con el insumo elegido; al recargar vuelve a la preselección | 3 |
| PT14-05 | Guardar cantidades de una tanda; enviar cantidad 0 o negativa | Se guardan sin crear una versión nueva; 0 o negativa → 422 | 4 |
| PT14-06 | Insumo encontrado en Jumbo; insumo solo en Open Food Facts | Precio y contenido precargados con fuente y fecha; el contenido se toma de Open Food Facts cuando Jumbo no lo tiene | 5 |
| PT14-07 | Editar el precio de un insumo usado en dos productos | Ambos cálculos cambian; la fuente queda como "manual" con su fecha | 5 |
| PT14-08 | 250 g con insumo de 1 kg a $1.000; 200 ml con 1 L a $1.100; 3 un con 12 un a $3.000 | $250, $220 y $750 | 6 |
| PT14-09 | Receta en ml con insumo en kg | La línea indica unidades incompatibles y no se muestra el total | 6, 9 |
| PT14-10 | Agregar, editar y eliminar otros costos; monto negativo | El total los incluye; monto negativo → 422 | 7 |
| PT14-11 | Rendimiento 8 y sin rendimiento; rendimiento 0 | Costo por unidad = total ÷ 8; sin rendimiento solo el costo por tanda; 0 → 422 | 8, 9 |
| PT14-12 | Línea sin cantidad, insumo sin precio, ingrediente sin insumo | Indica el faltante en cada línea y no muestra total | 9 |
| PT14-13 | Cálculo completo con rendimiento; luego borrar un precio | El detalle muestra el costo "calculado"; el valor manual sigue intacto en la base; al faltar un dato vuelve a mostrarse el manual | 10 |
| PT14-14 | Editar precios y cantidades con elaboraciones finalizadas | No cambia la información conservada ni las versiones; se muestra la fecha del precio más antiguo | 11 |
| PT14-15 | GET y PUT de costos de un producto de otro productor | 404 | 12 |
| PT14-16 | Revisar la formulación y el detalle de una elaboración | No muestran cantidades; los datos siguen en la base | Cambio asociado |
| PT14-17 | Usar la calculadora en un celular | Usable sin desplazamiento horizontal y con áreas táctiles de 44 px | 1, 9 |

**Mutaciones sugeridas:**

- convertir entre magnitudes distintas (por ejemplo, ml ↔ g 1:1);
- mostrar un total parcial cuando falta un dato;
- usar `float` en lugar de `Decimal` (debe fallar una prueba de precisión);
- preseleccionar el habitual aunque exista una elaboración finalizada con otro insumo;
- guardar la elección del selector de insumo;
- crear una versión nueva al guardar cantidades;
- sobrescribir el costo manual de HU01 con el calculado;
- omitir el filtro por productor.

---

## 8. Fuera de alcance

- Tandas múltiples, costo por elaboración, márgenes, historial de precios y fórmulas para otros costos (trabajo futuro, según los criterios).
- Actualización automática o periódica de precios.
- Otros supermercados.
- Cambiar el modelo de la formulación más allá de ocultar cantidades en la interfaz.
