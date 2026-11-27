# A5 · Plan de pruebas y evidencia de ejecución

## Plan de pruebas

El plan se definió en la planificación del proyecto (informe, sección 21.3), antes del Sprint 1, y se aplicó en cada sprint. Su objetivo es verificar que las funcionalidades cumplan los requerimientos y mantengan las relaciones de trazabilidad.

### Alcance y herramientas por nivel

| Nivel | Qué se prueba | Herramienta | Ambiente |
|---|---|---|---|
| Unitaria | Reglas de conservación de información, validaciones y reglas de trazabilidad; componentes y lógica de la interfaz | PyTest (backend) · Vitest (frontend) | Local y GitHub Actions |
| Integración | API, lógica de negocio y persistencia, sobre SQLite y PostgreSQL | PyTest | Local y GitHub Actions |
| Recorrido | Flujos completos de la interfaz, con conteo de interacciones | Vitest | Local y GitHub Actions |
| Sistema (E2E) | Flujo completo del productor y del consumidor | Prueba manual registrada en video | Ambiente de demostración |
| Prueba en celular | Historias con interfaz, en un dispositivo real | Prueba manual (Android e iOS) | Ambiente local accesible desde el celular |
| Aceptación | Criterios de aceptación de cada historia | Casos del plan (PTxx-yy) | Local |
| Regresión | Que un cambio no dañe funcionalidades anteriores | Suite completa en cada Pull Request | GitHub Actions |
| Mutación | Que cada prueba falle cuando se rompe el comportamiento que verifica | Mutaciones manuales registradas en el documento de resultados | Local |

Las pruebas de las fuentes externas usan respuestas grabadas, por lo que no dependen de la disponibilidad de Open Food Facts ni de Jumbo.

### Criterios de entrada

- La historia y sus tareas están registradas en Taiga, con sus criterios de aceptación, antes de iniciar el sprint.
- Cada tarea define sus pruebas desde el criterio de aceptación al iniciarse, no desde el comportamiento implementado (acción A5 de la retrospectiva del Sprint 2).

### Criterios de salida

Una versión se considera estable cuando:

- los casos asociados al sprint están aprobados;
- no hay errores críticos que impidan completar los flujos principales;
- las pruebas de regresión no muestran fallas sobre funcionalidades ya validadas;
- las tres suites de GitHub Actions (backend SQLite, backend PostgreSQL y frontend) están en verde en el Pull Request.

## Cumplimiento del plan

### Criterios de aceptación por sprint

| Sprint | Planificados | Cumplidos | No cumplidos en el sprint |
|---|---|---|---|
| 2 | 74 | 73 | CA12 de HU13 (escaneo en Safari para iOS): se verificó en el Sprint 3, el 03-11-2026, en un iPhone 15 |
| 3 | 94 | 94 | — |

### Casos del plan por historia

| Historia | Sprint | Casos | Ejecutados | Documento de resultados |
|---|---|---|---|---|
| HU12 | 1 | Pruebas de HU12 | 30/30 backend · 10/10 frontend | [hu12-test-results.md](../test/hu12-test-results.md) |
| HU01 | 1 | Pruebas de HU01 | 117/117 backend · 66/66 frontend | [hu01-test-results.md](../test/hu01-test-results.md) |
| HU02 | 1 | Pruebas de HU02 | 107/107 backend · 12/12 frontend (Sprint 1); 103/103 en la nueva ejecución del 26-11-2026 | [hu02-test-results.md](../test/hu02-test-results.md) |
| HU04 | 2 | PT04-01 a PT04-14 | 14 | [hu04-test-results.md](../test/hu04-test-results.md) |
| HU05 | 2 | PT05-01 a PT05-18 | 18 | [hu05-test-results.md](../test/hu05-test-results.md) |
| HU13 | 2 y 3 | PT13-01 a PT13-15 | 15 | [hu13-test-results.md](../test/hu13-test-results.md) · [hu13-prueba-celular.md](../test/hu13-prueba-celular.md) |
| HU06 | 3 | PT06-01 a PT06-10 | 10 | [hu06-test-results.md](../test/hu06-test-results.md) |
| HU07 | 3 | Validación sobre 37 productos | 37 | [validacion_hu07/resultados.md](../test/validacion_hu07/resultados.md) |
| HU09 | 3 | PT09-01 a PT09-13 | 13 | [hu09-test-results.md](../test/hu09-test-results.md) |
| HU10 | 3 | PT10-01 a PT10-13 | 13 | [hu10-test-results.md](../test/hu10-test-results.md) |
| HU08 | 3 | PT08-01 a PT08-10 | 10 | [hu08-test-results.md](../test/hu08-test-results.md) |
| HU14 | 3 | PT14-01 a PT14-17 | 17 | [hu14-test-results.md](../test/hu14-test-results.md) |
| HU11 | 3 | PT11-01 a PT11-07 | 7 | [hu11-test-results.md](../test/hu11-test-results.md) |

HU03 se desarrolló antes de incorporar la integración continua; en el Pull Request #13 la suite registró 288 pruebas de backend y 218 de frontend aprobadas, y sus pruebas se ejecutaron de nuevo el 26-11-2026 ([hu03-test-results.md](../test/hu03-test-results.md): 130 aprobadas y 1 omitida en SQLite).

## Resumen por nivel al cierre

| Nivel | Indicador | Evidencia |
|---|---|---|
| Unitaria e integración | Suites de backend (SQLite y PostgreSQL) y frontend en verde en cada Pull Request del Sprint 3 | Ejecuciones de GitHub Actions enlazadas en cada documento de resultados |
| Cobertura de líneas | Backend: 97,4 % en total y 96,5 % en `app/services` (lógica de negocio). Frontend: 91,1 % | [Reporte del 26-11-2026](reportes/2026-11-26_b9a95ce/README.md) · desde este cambio, el CI publica el reporte de cobertura en cada ejecución |
| Recorrido | La segunda elaboración se registra en 6 interacciones; la prueba falla si el flujo se alarga | [ht06-test-results.md](../test/ht06-test-results.md) |
| Sistema (E2E) | Un flujo completo del productor y del consumidor, manual | Video del 23-11-2026: https://youtu.be/RzSH-X8-haY |
| Aceptación | 94 de 94 criterios del Sprint 3 | Documentos de resultados de cada historia |
| Mutación | Cada documento de resultados registra las mutaciones detectadas por la suite | Por ejemplo: HU05 128 de 128, HU13 78 de 78 |

## Casos negativos

| Requerimiento | Caso negativo | Evidencia |
|---|---|---|
| RF-03 | Modificar la formulación de una versión ya usada no la altera: se crea una nueva versión | PT05-13 |
| RF-07 | No se puede finalizar una elaboración con un ingrediente sin insumo o sin lote | [hu05-test-results.md](../test/hu05-test-results.md) |
| RF-11 · RNF-04 | La consulta pública no devuelve lotes, vencimientos, costos ni identificadores internos | PT10-09 |
| RF-11 · RNF-01 | Modificar los insumos después de finalizar no cambia la ficha pública | PT10-08 |
| RF-13 · RNF-03 | Acceder a la información de otro productor es denegado | CP-14 · pruebas de aislamiento de cada historia |
| RF-05 | La búsqueda por nombre que devuelve otro producto se descarta al verificar el código de barras | [validacion_hu07/](../test/validacion_hu07/) |

## Registro de defectos

Severidad: **Alta** si puede llevar información incorrecta al consumidor o perder datos registrados; **Media** si impide o entorpece una tarea del productor; **Baja** si es de presentación o accesibilidad, sin pérdida de información.

| ID | Defecto | Severidad | Detección | Corrección | Verificación |
|---|---|---|---|---|---|
| D-01 | Al registrar un insumo cuyo ingrediente no existía, había que salir de la página y se perdían los datos recuperados | Media | Prueba en celular de HU13 (20-10-2026) | T13-09 | Verificado en el celular el 21-10-2026 |
| D-02 | El texto de ingredientes recuperado incluía el nombre y la dirección del fabricante | Media | Prueba en celular de HU13 | T13-10 | Prueba automatizada y verificación en el celular |
| D-03 | En la elaboración, un código de barras de un insumo asociado a otro ingrediente ofrecía «Usar este insumo», pero la acción no asignaba nada | Media | Auditoría de HT07 | El diálogo explica a qué ingrediente está asociado y no ofrece la acción | La mutación del defecto es detectada por 4 pruebas |
| D-04 | Después de buscar un código de barras, se perdía el foco de la pantalla | Baja | Auditoría de HT07 | El foco pasa al mensaje del resultado | La mutación del defecto es detectada por 3 pruebas |
| D-05 | Las etiquetas de alérgenos con prefijo de idioma (por ejemplo, «es:Maní») no se reconocían | Alta | Medición de HU07 | Traducción de las etiquetas al alérgeno del catálogo | Nueva corrida: 0 términos sin reconocer |
| D-06 | La ficha pública usaba mayúsculas forzadas, prohibidas por los criterios de usabilidad de HT07 | Baja | Integración continua de HU10 | Se retiraron en cinco componentes | Prueba de HT07 aprobada y CI en verde |
| D-07 | En el historial, la fila de filtros se desbordaba y un ícono tapaba la etiqueta en el celular | Baja | Prueba en celular de HU06 | T06-06 | Prueba en celular aprobada |

No quedan defectos abiertos.

## Informe de resultados

| Tipo | Qué se probó | Resultado | Qué significa |
|---|---|---|---|
| Unitaria e integración | Reglas de conservación, versiones, asignación de insumos y lotes, publicación, consulta pública y aislamiento entre productores, sobre SQLite y PostgreSQL | Backend: 2.253 aprobadas, 203 omitidas en SQLite (se ejecutan en PostgreSQL), 0 fallidas. Frontend: 1.610 aprobadas, 0 fallidas. Cobertura de la lógica de negocio: 96,5 % | La lógica central cumple lo especificado. Lo que queda sin cubrir se concentra en `product_image_service.py` (82 %) y en ramas de error de `elaboracion_service.py` (92 %). |
| Recorrido | Flujos de la interfaz con conteo de interacciones | 6 interacciones para la segunda elaboración (antes, 21) | La simplificación de HT06 se mantiene: una regresión que alargue el flujo hace fallar la prueba. |
| Aceptación | Criterios de aceptación de las historias del Sprint 3 | 94 de 94 | Cada historia hace lo que su criterio especifica. El criterio de iOS pendiente del Sprint 2 se cerró en el Sprint 3. |
| Sistema (E2E) | Flujo completo: insumo, elaboración, publicación, consulta por QR, modificación del insumo y consulta de relacionadas | 0 diferencias entre lo registrado y lo consultado | La hipótesis del proyecto se cumple en un caso completo. La prueba es manual y no se repite automáticamente. |
| Rendimiento | 100 consultas públicas secuenciales en local (PT10-13) | p95 de 24,9 ms, meta ≤ 2 s | Cumple con margen en local. No se midió con concurrencia ni en el ambiente desplegado. |
| Exactitud de fuentes | 37 productos comparados con su envase | 75,7 % (28 de 37), meta ≥ 70 % | Cumple. En 4 casos la búsqueda devolvió otro producto, por lo que la confirmación del productor es obligatoria. |
