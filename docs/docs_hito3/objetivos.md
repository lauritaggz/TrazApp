# A1 · Problema, hipótesis y objetivos medibles

## Problema

Los pequeños productores de alimentos elaborados usan insumos comerciales cuya información (ingredientes declarados, alérgenos, advertencias, marca y lote) cambia en el tiempo y se origina fuera del productor. Cuando esa información se reemplaza por la nueva, se pierde qué se usó realmente en cada elaboración.

| Elemento | Descripción |
|---|---|
| Actores | Productor (registra productos, formulaciones, insumos y elaboraciones); consumidor (consulta la información del producto que compró); fabricantes y proveedores de insumos (originan la información, pero no usan el sistema). |
| Causas | Información de ingredientes compleja y compuesta; cambios en los insumos comerciales (composición, alérgenos, marca); necesidad de conservar el historial por elaboración; información distribuida entre actores; carga de transcribir manualmente la información de cada insumo. |
| Causa raíz | La falta de conservación de vínculos históricos consistentes entre ingredientes, composición, proveedores, versiones y lotes dificulta determinar qué información corresponde a cada producto elaborado a lo largo del tiempo. |
| Consecuencias | Las elaboraciones anteriores quedan con información que no corresponde a lo que se usó; la formulación se mantiene en términos genéricos; el consumidor no puede consultar los insumos y alérgenos de la elaboración que compró. |

Fuente: informe del proyecto, secciones 5 y 6 (Ishikawa, Árbol de Problemas y 5 Porqués).

## Hipótesis

Si cada elaboración conserva una copia de la información de los insumos, lotes y versión de la formulación utilizados al momento de finalizarla, y la información de los insumos se precarga desde fuentes públicas con confirmación del productor, entonces los cambios posteriores en insumos o formulaciones no alteran lo registrado en elaboraciones anteriores, y el consumidor puede consultar mediante un QR la información que corresponde a la elaboración que compró.

La hipótesis técnica que la sostiene se validó con el prototipo de mitigación de RT-01 (informe, sección 23.4): si las elaboraciones mantienen referencias explícitas a las versiones y materias primas utilizadas originalmente, la creación posterior de nuevas versiones no modifica su trazabilidad histórica.

## Objetivo general

Desarrollar un sistema para pequeños productores de alimentos elaborados que relacione cada elaboración con los insumos efectivamente utilizados, con la finalidad de conservar su historial ante cambios y comunicar al consumidor la información trazable correspondiente.

## Objetivos específicos

- **OE1.** Implementar un módulo de gestión de productos que permita al productor definir su formulación y conserve como versión la receta utilizada en cada elaboración ante cambios posteriores.
- **OE2.** Implementar un módulo de registro de elaboraciones que asocie a cada ingrediente de la formulación el insumo comercial y el lote utilizados.
- **OE3.** Implementar un módulo de historial de trazabilidad que conserve la información de cada elaboración ante cambios posteriores y permita identificar las elaboraciones relacionadas con un insumo o lote.
- **OE4.** Implementar un módulo de consulta pública que permita al consumidor acceder, mediante el código QR del producto, a los insumos y alérgenos de la elaboración seleccionada.
- **OE5.** Implementar un módulo de registro de insumos comerciales que recupere su información desde fuentes públicas para completar su ficha, con confirmación del productor antes de su registro.

## Indicadores, metas y resultados

| Objetivo | Métrica | Línea base | Meta | Cómo se midió | Resultado | Evidencia |
|---|---|---|---|---|---|---|
| OG | Diferencias entre la información registrada en una elaboración y la consultada por el productor y por el consumidor después de modificar uno de sus insumos, en un caso completo | | 0 diferencias | Caso completo de extremo a extremo: producto, formulación, insumos, elaboración, modificación del insumo y consulta por QR | 0 diferencias | Video del flujo: https://youtu.be/RzSH-X8-haY · [hu10-test-results.md](test/hu10-test-results.md) |
| OE1 | Cambios de formulación sobre una versión ya usada que generan una nueva versión | | 100 % | PT05-13 y pruebas de HU03 sobre versiones usadas | 100 % | [hu05-test-results.md](test/hu05-test-results.md) (PT05-13) · `backend/tests/test_marcar_version_usada_hu03.py` |
| OE1 | Versiones usadas en elaboraciones que se modifican tras un cambio de formulación | | 0 casos | PT05-13 | 0 casos | [hu05-test-results.md](test/hu05-test-results.md) (PT05-13) |
| OE2 | Elaboraciones registradas con insumo y lote asignados a cada ingrediente | | 100 % | Pruebas de finalización de HU05: no se puede finalizar si falta un insumo o un lote | 100 % | [hu05-test-results.md](test/hu05-test-results.md) |
| OE2 | Interacciones para registrar una segunda elaboración del mismo producto | 21 interacciones antes de HT06 (prueba de recorrido, Sprint 2) | ≤ 6 interacciones | Pruebas automatizadas de recorrido que cuentan las interacciones y fallan si el flujo se alarga | 6 interacciones | [ht06-test-results.md](test/ht06-test-results.md) |
| OE3 | Elaboraciones cuya información de insumos y lotes se reconstruye sin cambios tras modificar un insumo o una formulación | | 100 % | PT05-12, PT05-13 y PT06-06 | 100 % | [hu05-test-results.md](test/hu05-test-results.md) · [hu06-test-results.md](test/hu06-test-results.md) |
| OE3 | Elaboraciones relacionadas con un insumo o lote identificadas respecto del conjunto esperado | | 100 % | PT08-07: seis elaboraciones con relaciones conocidas | 100 % (4 de 4 y 1 de 1) | [hu08-test-results.md](test/hu08-test-results.md) |
| OE3 | Elaboraciones no relacionadas identificadas incorrectamente | | 0 % | PT08-07 | 0 % | [hu08-test-results.md](test/hu08-test-results.md) |
| OE4 | Consultas válidas que presentan la elaboración seleccionada sin exponer información interna | | 100 % | PT10-09: lista blanca de claves y búsqueda de valores internos en la respuesta | 100 % | [hu10-test-results.md](test/hu10-test-results.md) |
| OE4 | Tiempo de respuesta de la consulta pública | | ≤ 2 s en al menos el 95 % de las consultas | PT10-13: 100 consultas en 4 variantes con `backend/scripts/medir_oe4_hu10.py`, ambiente local, sin concurrencia | p95 de 24,9 ms | [validacion_hu10/oe4_resultados.md](test/validacion_hu10/oe4_resultados.md) |
| OE5 | Insumos del conjunto de validación (37 productos) cuya ficha recuperada coincide con el envase en nombre, marca, ingredientes y alérgenos | | ≥ 70 % | Comparación de cada ficha recuperada contra el envase | 75,7 % (28 de 37) | [validacion_hu07/resultados.md](test/validacion_hu07/resultados.md) |
| OE5 | Tiempo de recuperación de una ficha | | ≤ 10 s en al menos el 90 % de las búsquedas | Medición sobre las 37 búsquedas del conjunto de validación | 100 % bajo 10 s | [validacion_hu07/resultados.md](test/validacion_hu07/resultados.md) |

### Análisis de los resultados

- **OG, OE1, OE2 y OE3** cumplen su meta. La conservación de la información se verificó con pruebas automatizadas y con el caso completo, en el que la elaboración E-002 conserva 400 g aunque el insumo pasó a 397 g.
- **OE4** cumple su meta con amplio margen, pero la medición se hizo en el ambiente local, sin red móvil ni usuarios concurrentes. El comportamiento con carga queda pendiente (ver `docs/calidad/`).
- **OE3**: la identificación de elaboraciones relacionadas se verificó sobre un escenario construido por las pruebas, no sobre datos reales de un productor.
- **OE5** supera la meta del 70 %. La muestra se redujo de 50 a 37 productos, porque solo se incluyeron los que tienen un envase que se pudo verificar directamente. En 4 de los 37 casos, la búsqueda por nombre devolvió otro producto; por eso el resultado siempre pasa por la confirmación del productor.

## Validación por stakeholder

| Indicador | Validado por | Rol | Fecha | Registro |
|---|---|---|---|---|
| OG | | | | |
| OE1 | | | | |
| OE2 | | | | |
| OE3 | | | | |
| OE4 | | | | |
| OE5 | | | | |
