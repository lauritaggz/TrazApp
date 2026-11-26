# A2 · Requerimientos, alcance del MVP y escenarios de calidad

Los requerimientos funcionales corresponden a las historias de usuario del Product Backlog (informe, sección 13). La prioridad P1 del backlog equivale a **Must** y la P2 a **Should**. Los requerimientos no funcionales provienen de las métricas de la sección 7.3 y de la matriz de riesgos (sección 21.7).

## Requerimientos funcionales

| ID | Descripción | Historia | Prioridad | Objetivo | Sprint |
|---|---|---|---|---|---|
| RF-01 | El productor crea, edita y consulta sus productos elaborados, como base para asociar su trazabilidad | HU01 | Must | OE1 | 1 |
| RF-02 | El productor gestiona los ingredientes de sus productos, incluida la composición declarada de los ingredientes compuestos | HU02 | Must | OE1 | 1 |
| RF-03 | El productor define los ingredientes genéricos de cada producto, y un cambio de receta sobre una versión ya usada genera una nueva versión | HU03 | Must | OE1 | 2 |
| RF-04 | El productor registra los productos comerciales que usa como insumos, con sus ingredientes declarados y alérgenos | HU04 | Must | OE5 | 2 |
| RF-05 | El productor busca un producto comercial por nombre y obtiene su información desde fuentes públicas, con confirmación antes de registrarla | HU07 | Must | OE5 | 3 |
| RF-06 | El productor escanea con la cámara del celular el código de barras de un insumo para obtener su información | HU13 | Must | OE5 | 2 |
| RF-07 | El productor registra cada elaboración indicando el insumo comercial y el lote de cada ingrediente; al finalizarla, su información queda conservada | HU05 | Must | OE2 | 2 |
| RF-08 | El productor consulta las elaboraciones anteriores con los insumos, marcas y lotes utilizados en cada una | HU06 | Must | OE3 | 3 |
| RF-09 | El productor identifica en qué elaboraciones se usó un insumo o un lote determinado | HU08 | Must | OE3 | 3 |
| RF-10 | El productor habilita la publicación de un producto y obtiene su código QR | HU09 | Must | OE4 | 3 |
| RF-11 | El consumidor escanea el QR, selecciona la elaboración y consulta sus insumos y alérgenos declarados | HU10 | Must | OE4 | 3 |
| RF-12 | El consumidor indica si la información consultada le resultó útil | HU11 | Should | OE4 | 3 |
| RF-13 | El productor crea una cuenta e inicia sesión para acceder a su espacio privado | HU12 | Must | Transversal | 1 |
| RF-14 | El productor calcula el costo de elaborar un producto a partir de sus ingredientes, los precios de sus insumos y otros costos | HU14 | Must | Sin objetivo específico asociado (incorporada por SC-05) | 3 |

## Requerimientos no funcionales

| ID | Tipo (ISO/IEC 25010) | Descripción | Prioridad | Objetivo |
|---|---|---|---|---|
| RNF-01 | Seguridad · Integridad | La información de una elaboración finalizada no cambia cuando se modifican después sus insumos, ingredientes o formulación | Must | OG, OE3 |
| RNF-02 | Eficiencia · Comportamiento temporal | La consulta pública responde en 2 s o menos en al menos el 95 % de las consultas | Must | OE4 |
| RNF-03 | Seguridad · Confidencialidad | Un productor no puede consultar ni modificar la información de otro productor | Must | Transversal |
| RNF-04 | Seguridad · Confidencialidad | La consulta pública expone solo los campos definidos como públicos, sin lotes, vencimientos, costos ni identificadores internos | Must | OE4 |
| RNF-05 | Adecuación funcional · Corrección | Al menos el 70 % de las fichas recuperadas desde fuentes externas coincide con el envase en nombre, marca, ingredientes y alérgenos | Must | OE5 |
| RNF-06 | Eficiencia · Comportamiento temporal | La recuperación de una ficha desde fuentes externas toma 10 s o menos en al menos el 90 % de las búsquedas | Should | OE5 |

## Escenarios de calidad

| Parte | RNF-02 Eficiencia | RNF-03 Seguridad | RNF-01 Integridad |
|---|---|---|---|
| Fuente | Consumidor | Productor autenticado malintencionado | Productor |
| Estímulo | Consulta la ficha pública de una elaboración desde el QR | Cambia el identificador de un recurso en la URL o en la API para ver o modificar el de otro productor | Modifica un insumo, sus alérgenos o la formulación después de finalizar una elaboración |
| Entorno | Ambiente desplegado | Ambiente desplegado, uso normal | Ambiente desplegado, elaboración finalizada |
| Respuesta | El sistema entrega la ficha de la elaboración seleccionada | El sistema deniega el acceso sin revelar si el recurso existe | La elaboración y su ficha pública siguen mostrando la información conservada |
| Medida de respuesta | p95 ≤ 2 s | 100 % de los intentos denegados (HTTP 403 o 404) y 0 hallazgos críticos o altos en el escáner | 0 diferencias entre la información antes y después del cambio |

El resultado de cada escenario está en [`docs/calidad/`](calidad/README.md).

## Alcance del MVP

| Elemento | Decisión | Justificación |
|---|---|---|
| Gestión de productos, ingredientes, formulación y versiones (RF-01 a RF-03) | Incluido | Permite medir OE1 |
| Registro de insumos comerciales, búsqueda por nombre y escaneo de código de barras (RF-04 a RF-06) | Incluido | Permite medir OE5 y reduce la transcripción manual |
| Registro de elaboraciones con insumo y lote por ingrediente (RF-07) | Incluido | Permite medir OE2 |
| Historial y elaboraciones relacionadas (RF-08 y RF-09) | Incluido | Permite medir OE3 |
| Publicación, QR y consulta pública (RF-10 y RF-11) | Incluido | Permite medir OE4 |
| Evaluación de utilidad (RF-12) | Incluido | Retroalimentación del consumidor sobre la consulta |
| Registro y acceso del productor (RF-13) | Incluido | Necesario para separar la información de cada productor (RNF-03) |
| Calculadora de costos (RF-14) | Incluido mediante SC-05 | Solicitada durante el proyecto; no mide ningún objetivo específico |
| Reemplazo del etiquetado sanitario o verificación de cumplimiento normativo | Excluido | Fuera del problema planteado |
| Certificación de que un producto es seguro para una persona con alergias | Excluido | El sistema muestra lo que declara el productor; no certifica |
| Reconstrucción de la cadena de suministro previa al productor | Excluido | La trazabilidad llega a los insumos usados directamente |
| Proveedores y fabricantes como usuarios del sistema | Excluido | Fuera del alcance del MVP |
| Funciones de ERP (contabilidad, facturación, compras, inventario o stock) | Excluido | No son necesarias para ningún objetivo |
| Identificación de unidades individuales de producto | Excluido | La unidad mínima de trazabilidad es la elaboración |
| Aplicación móvil nativa | Excluido, versión futura | La consulta usa una interfaz web adaptable al celular |
| Integración con APIs de datos de productos, bases por suscripción o fabricantes | Excluido, versión futura | El MVP usa fuentes públicas o ingreso manual |
| Integración con organismos regulatorios o software empresarial | Excluido | Fuera del problema planteado |
| Modelo SaaS (planes, precios y condiciones de uso) | Excluido, versión futura | Trabajo futuro (informe, sección 34.10.4) |
