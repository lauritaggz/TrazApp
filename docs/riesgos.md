# A9 · Riesgos y deuda técnica

## Matriz de riesgos al cierre

Matriz definida en la planificación (informe, sección 21.7) y actualizada al cierre de cada sprint (secciones 30.6, 33.6 y 34.6).

| ID | Riesgo | Afecta a | Prob. | Impacto | Nivel | Mitigación | Contingencia | ¿Se materializó? | Estado al cierre |
|---|---|---|---|---|---|---|---|---|---|
| RT-01 | Una implementación incorrecta de la conservación permite que cambios posteriores alteren lo registrado en elaboraciones finalizadas | OG, OE1, OE3 · RNF-01 | Media | Alto | Alto | Copia inmutable de la información al finalizar, bloqueo de modificaciones, triggers y pruebas de modificación posterior | | No | Mitigado (Sprint 2) |
| RT-02 | Una asociación incorrecta entre una elaboración y sus insumos o lotes genera información inconsistente | OE2 · RF-07 | Media | Alto | Alto | Validar que cada insumo corresponda al ingrediente, impedir finalizar con ingredientes sin insumo y restricciones de integridad | | No | Mitigado (Sprint 2) |
| RT-03 | La consulta pública muestra la información vigente de los insumos en vez de la conservada | OE4 · RF-11, RNF-01 | Media | Alto | Alto | Construir la consulta solo desde la información conservada y probar con insumos modificados después de la elaboración (PT10-08) | | No | Mitigado (Sprint 3) |
| RT-04 | Cambios en el modelo de datos generan incompatibilidades o pérdida de información | RNF-01 · todos los RF | Media | Medio | Moderado | Migraciones versionadas, respaldo antes de cada despliegue y pruebas de regresión | | No | Controlado (Sprint 2) |
| RT-05 | El ingreso incorrecto o incompleto de información produce una trazabilidad incorrecta | OE2, OE5 · RF-04, RF-07 | Media | Alto | Alto | Validaciones, campos obligatorios, confirmación antes de finalizar y recuperación automática de información | | Sí, antes de afectar datos: el sistema no distinguía un insumo sin alérgenos de uno con alérgenos sin revisar | Controlado: HT06 (SC-02) agregó la revisión obligatoria de alérgenos (Sprint 2) |
| RT-06 | La fuente externa deja de estar disponible, cambia o restringe el acceso | OE5 · RF-05, RF-06, RNF-06 | Alta | Medio | Alto | Validación técnica previa (HT04), un adaptador por fuente, más de una fuente, consultas bajo demanda y respuestas grabadas en las pruebas | Ingreso manual siempre disponible | Sí: caídas intermitentes de Open Food Facts (Sprint 2); Jumbo no permite buscar por código de barras (Sprint 3) | Controlado |
| RT-07 | La información recuperada es incorrecta o incompleta y se registra como válida | OE5, OE4 · RNF-05 | Media | Alto | Alto | Confirmación obligatoria del productor, verificación de identidad por código de barras, fuente y fecha de cada dato, y aviso en la vista pública de que no certifica la seguridad del producto | | Sí: texto de ingredientes con datos del fabricante (Sprint 2); la búsqueda por nombre devolvió otro producto en 4 de 37 casos (Sprint 3) | Controlado |
| RT-08 | El escaneo de códigos no funciona en todos los navegadores móviles | OE5 · RF-06 | | | Moderado | Detector nativo con ZBar-WASM como alternativa y prueba en celulares reales | Ingreso manual del código siempre disponible | No | Cerrado: verificado en un iPhone 15 con Safari el 03-11-2026 |
| RS-01 | Una falla de autorización o de infraestructura permite que un productor acceda a datos de otro, o que la consulta pública exponga información interna | Transversal · RNF-03, RNF-04 | Baja | Alto | Moderado | Autenticación, autorización por productor, estructura pública definida por el sistema y pruebas de aislamiento y exposición | | No | Controlado |
| RI-01 | Una falla del servidor, la base de datos o el almacenamiento provoca indisponibilidad o pérdida de información | Todos los RF | Baja | Alto | Moderado | Persistencia independiente de los contenedores y respaldos periódicos | Procedimientos de recuperación | Sí, en la infraestructura intermedia: en la prueba de carga del 26-11-2026, el proxy de Netlify cortó el 47,2 % de las consultas; el servidor no tuvo fallas | Abierto: DT-12 |
| RI-02 | Una falla del almacenamiento de archivos provoca la pérdida de imágenes de productos | RF-01 | Baja | Medio | Bajo | Almacenamiento persistente y validación de la existencia de los archivos | Mecanismos de respaldo | No monitoreado | Abierto |
| RP-01 | Las funcionalidades planificadas superan el tiempo disponible | Todos los objetivos | Alta | Alto | Alto | Priorizar P1, controlar el avance por sprint y replanificar | Orden de traslado de funcionalidades no críticas | Sí: extensión del Sprint 2 (SC-04) y, en el Sprint 3, HU14 pasó a la semana 4 y las horas superaron la capacidad en 5 h | Cerrado: el Sprint 3 cerró en la fecha planificada sin postergar historias |

## Deuda técnica

Prioridad según el requerimiento afectado: **Alta** si afecta un requerimiento Must sin evidencia verificable; **Media** si afecta la calidad o la mantenibilidad; **Baja** si es una mejora acotada.

| ID | Deuda | Afecta a | Prioridad | Plan | Estado |
|---|---|---|---|---|---|
| DT-12 | Con 50 usuarios concurrentes, el proxy de Netlify corta el 47,2 % de las consultas públicas antes de que lleguen al backend | RNF-02 · RF-11 | Alta | Que el frontend consulte la API directamente en el dominio del VPS, con CORS para `trazapp.netlify.app`, y repetir la prueba de carga por ese camino | Abierta |
| DT-04 | El flujo E2E se prueba de forma manual | RF-07, RF-10, RF-11 | Media | Automatizar el flujo completo del caso del video | Abierta |
| DT-03 | No hay escaneo dinámico de la API desplegada | RNF-03 | Media | OWASP ZAP en modo baseline contra la API desplegada | Abierta; el análisis de dependencias y el estático ya se ejecutaron ([`docs/calidad/`](calidad/README.md#seguridad)) |
| DT-07 | Algunos commits y ramas no incluyen el ID de la historia (por ejemplo, `mejoraUI-UX` y `ci/github-actions`) | Trazabilidad del repositorio | Media | Aplicar la convención de ID en todas las ramas, commits y Pull Requests nuevos | Abierta |
| DT-08 | La lectura de «puede contener» desde Jumbo depende de la estructura de su página | RF-05 · RT-06 | Media | Mantener el adaptador aislado y el conjunto de validación como prueba de regresión | Abierta |
| DT-10 | La exactitud de las fuentes se midió sobre 37 productos en vez de 50 | RNF-05 | Media | Ampliar el conjunto de validación | Abierta |
| DT-09 | Los insumos a granel no tienen detección de duplicados, y la búsqueda por nombre no se combina con Open Food Facts | RF-04, RF-05 | Baja | Detección de duplicados y búsqueda combinada | Abierta |
| DT-01 | El CI no medía la cobertura de líneas | Criterio de salida del plan de pruebas | Media | Cobertura medida (backend 97,4 %, frontend 91,1 %) y publicada por el CI en cada ejecución | Resuelta (26-11-2026) |
| DT-05 | HU02 y HU03 no tenían documento de resultados propio | RF-02, RF-03 | Media | Documentos de resultados con una nueva ejecución de sus pruebas | Resuelta (26-11-2026) |
| DT-06 | RF-14 no figuraba en los modelos y faltaba un diagrama de actividades | RF-14 · modelamiento | Media | Diagramas 14 a 16 en `docs/arquitectura/modelos/` | Resuelta (26-11-2026) |
| DT-02 | No había prueba de carga con usuarios concurrentes sobre el ambiente desplegado | RNF-02 | Alta | Prueba con k6 y 50 usuarios: el backend cumple (p95 de 109 ms, 0 % de errores) y se detectó DT-12 | Resuelta (26-11-2026) |
| DT-11 | Dependencias con vulnerabilidades conocidas (52 avisos en el backend y 5 en el frontend) | RNF-03 | Alta | Actualización de `fastapi`, `starlette`, `PyJWT`, `python-multipart`, `python-dotenv`, `pytest`, `vite` y `vitest` | Resuelta (26-11-2026) |

## Plan de mejoras

1. Integrar una base de información pública y confiable de productos, respaldada por una cadena comercial de gran tamaño o una entidad del sector. Los adaptadores de fuentes permiten incorporarla sin cambiar el resto de los módulos.
2. Pasar del ambiente de demostración a un ambiente de producción, con monitoreo y respaldos (RI-01 y RI-02).
3. Definir el modelo comercial del servicio: planes, precios y condiciones de uso.
4. Ampliar la calculadora de costos: tandas múltiples, costo por elaboración, márgenes, historial de precios y fórmulas para otros costos.
5. Ampliar la validación de las fuentes a más productos e incorporar otras fuentes además de Open Food Facts y Jumbo.
