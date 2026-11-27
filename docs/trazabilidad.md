# A4 · Matriz de trazabilidad

Cada fila se lee en las dos direcciones: desde el objetivo hasta la evidencia ejecutada y el Pull Request, o desde el Pull Request de vuelta al requerimiento y al objetivo. Los modelos están en [`docs/arquitectura/modelos/`](arquitectura/modelos/), los requerimientos en [`docs/requerimientos.md`](requerimientos.md) y los escenarios de cada historia en [`docs/historias.md`](historias.md).

**Tags:** `v1.0.0-sprint1` (858aaeb, 12-09-2026) · `v2.0.0-sprint2` (0ac866b, 21-10-2026) · `v3.0.0-sprint3` (d10c7b2, 23-11-2026).

## Requerimientos funcionales

| Objetivo | Requerimiento | Modelo | HU | Sprint | Casos de prueba | Nivel | Evidencia | Resultado | PR / tag |
|---|---|---|---|---|---|---|---|---|---|
| OE1 | RF-01 Gestionar productos (Must) | Casos de uso: Gestionar productos · Clases: Producto, Categoria | HU01 | 1 | Pruebas de HU01 | Unitaria e integración (PyTest, Vitest) | [hu01-test-results.md](test/hu01-test-results.md) · `backend/tests/test_gestion_productos.py` | Aprobado | PR #5 y #6 · `v1.0.0-sprint1` |
| OE1 | RF-02 Gestionar ingredientes y composición (Must) | Casos de uso: Gestionar ingredientes · Clases: Ingrediente | HU02 | 1 | Pruebas de HU02 | Unitaria e integración (PyTest, Vitest) | [hu02-test-results.md](test/hu02-test-results.md) | Aprobado: 103 de 103 (26-11-2026, `b9a95ce`); sin Pull Request (integrada directamente a main) | Commits `HU02-T07` a `HU02-T09` · `v1.0.0-sprint1` |
| OE1 | RF-03 Formulación y versiones (Must) | Casos de uso: Gestionar la formulación y las versiones · Clases: VersionProducto, ItemFormulacion | HU03 | 2 | Pruebas de HU03 · PT05-13 | Unitaria e integración (PyTest, Vitest) | [hu03-test-results.md](test/hu03-test-results.md) · [hu05-test-results.md](test/hu05-test-results.md) (PT05-13) | Aprobado: 130 de 130 ejecutadas, 1 omitida en SQLite (26-11-2026, `b9a95ce`) | PR #13 · `v2.0.0-sprint2` |
| OE5 | RF-04 Registrar insumos comerciales (Must) | Casos de uso: Gestionar insumos comerciales · Clases: insumos comerciales y alérgenos · Secuencia: registro de un insumo | HU04 | 2 | PT04-01 a PT04-14 | Unitaria e integración (PyTest, Vitest) | [hu04-test-results.md](test/hu04-test-results.md) | Aprobado | PR #14 · `v2.0.0-sprint2` |
| OE5 | RF-05 Búsqueda por nombre en fuentes públicas (Must) | Casos de uso: Buscar información de insumo · Secuencia: registro de un insumo | HU07 | 3 | Validación sobre 37 productos | Integración (respuestas grabadas) y aceptación | [validacion_hu07/resultados.md](test/validacion_hu07/resultados.md) · `backend/tests/test_*_hu07.py` | Aprobado: 75,7 % (meta ≥ 70 %) | PR #23 · `v3.0.0-sprint3` |
| OE5 | RF-06 Escaneo del código de barras (Must) | Casos de uso: Escanear código de barras · Secuencia: registro de un insumo | HU13 | 2 y 3 | PT13-01 a PT13-15 · CA12 en iOS | Unitaria, integración y prueba en celular | [hu13-test-results.md](test/hu13-test-results.md) · [hu13-prueba-celular.md](test/hu13-prueba-celular.md) | Aprobado (CA12 verificado en iPhone 15 con Safari el 03-11-2026) | PR #19 · `v2.0.0-sprint2` |
| OE2 | RF-07 Registrar elaboración con insumo y lote (Must) | Casos de uso: Registrar elaboración · Clases: productos, formulación y elaboraciones · Secuencia: registro de una elaboración | HU05 · HT06 | 2 | PT05-01 a PT05-18 · pruebas de HT06 | Unitaria, integración y recorrido | [hu05-test-results.md](test/hu05-test-results.md) · [ht06-test-results.md](test/ht06-test-results.md) | Aprobado | PR #16 y #17 · `v2.0.0-sprint2` |
| OE3 | RF-08 Historial de elaboraciones (Must) | Casos de uso: Consultar historial · Secuencia: historial y elaboraciones relacionadas | HU06 | 3 | PT06-01 a PT06-10 | Unitaria, integración y prueba en celular | [hu06-test-results.md](test/hu06-test-results.md) | Aprobado | PR #22 · `v3.0.0-sprint3` |
| OE3 | RF-09 Elaboraciones relacionadas con un insumo o lote (Must) | Casos de uso: Identificar elaboraciones relacionadas · Secuencia: historial y elaboraciones relacionadas | HU08 | 3 | PT08-01 a PT08-10 (PT08-07 mide OE3) | Unitaria, integración y prueba en celular | [hu08-test-results.md](test/hu08-test-results.md) | Aprobado: 100 % / 0 % | PR #27 · `v3.0.0-sprint3` |
| OE4 | RF-10 Publicación y código QR (Must) | Casos de uso: Habilitar publicación del producto · Clases: Producto (estado de publicación y QR) | HU09 | 3 | PT09-01 a PT09-13 | Unitaria, integración y prueba en celular | [hu09-test-results.md](test/hu09-test-results.md) | Aprobado | PR #24 · `v3.0.0-sprint3` |
| OE4 | RF-11 Consulta pública por QR (Must) | Casos de uso: Consultar información pública · Secuencia: consulta pública mediante QR | HU10 · HT05 | 3 | PT10-01 a PT10-13 | Unitaria, integración, prueba en celular y E2E manual | [hu10-test-results.md](test/hu10-test-results.md) · video del flujo: https://youtu.be/RzSH-X8-haY | Aprobado | PR #25 y #26 · `v3.0.0-sprint3` |
| OE4 | RF-12 Evaluación de utilidad (Should) | Casos de uso: Evaluar la utilidad · Consultar métricas de utilidad | HU11 | 3 | PT11-01 a PT11-07 | Unitaria, integración y prueba en celular | [hu11-test-results.md](test/hu11-test-results.md) | Aprobado | PR #29 · `v3.0.0-sprint3` |
| Transversal | RF-13 Registro y acceso (Must) | Casos de uso: Registrarse e iniciar sesión · Clases: Productor | HU12 | 1 | Pruebas de HU12 | Unitaria e integración (PyTest, Vitest) | [hu12-test-results.md](test/hu12-test-results.md) · `backend/tests/test_auth_*.py` | Aprobado | PR #2, #3 y #4 · `v1.0.0-sprint1` |
| Sin objetivo | RF-14 Calculadora de costos (Must, SC-05) | Casos de uso y clases: calculadora de costos (diagramas 15 y 16) | HU14 | 3 | PT14-01 a PT14-17 | Unitaria, integración y prueba en celular | [hu14-test-results.md](test/hu14-test-results.md) | Aprobado | PR #28 · `v3.0.0-sprint3` |

## Requerimientos no funcionales

| Objetivo | Requerimiento | Modelo | HU | Sprint | Casos de prueba | Nivel | Evidencia | Resultado | PR / tag |
|---|---|---|---|---|---|---|---|---|---|
| OG · OE3 | RNF-01 Integridad de lo conservado (Must) | Clases: elaboración y copia de la información de insumos · Secuencia: registro de una elaboración | HU05 · HU10 | 2 y 3 | PT05-12, PT05-13, PT06-06, PT10-08 | Integración y E2E manual | [hu10-test-results.md](test/hu10-test-results.md) (`test_rt03_*`) · [hu05-test-results.md](test/hu05-test-results.md) | Aprobado: 0 diferencias | PR #16 y #26 |
| OE4 | RNF-02 Consulta pública p95 ≤ 2 s (Must) | Secuencia: consulta pública mediante QR · Despliegue | HU10 | 3 | PT10-13 · prueba de carga con k6 | Rendimiento (script local sin concurrencia; k6 con 50 usuarios sobre el ambiente desplegado) | [validacion_hu10/oe4_resultados.md](test/validacion_hu10/oe4_resultados.md) | Parcial: cumple en el backend desplegado (50 usuarios, p95 de 109 ms, 0 % de errores); a través del proxy de Netlify falla el 47,2 % (DT-12) ([`docs/calidad/carga/`](calidad/carga/README.md)) | PR #26 |
| Transversal | RNF-03 Aislamiento entre productores (Must) | Componentes: autenticación y autorización por productor | HU12 y cada HU con datos del productor | 1 a 3 | Pruebas de acceso a recursos ajenos (CP-14) | Integración (PyTest) | `backend/tests/test_auth_jwt_access.py` (acceso sin token) · pruebas de aislamiento entre productores, por ejemplo `test_gestion_insumos_hu04.py` y `test_gestion_elaboraciones_hu05.py` | Aprobado: pruebas de aislamiento aprobadas; 0 vulnerabilidades conocidas y 0 hallazgos altos tras actualizar dependencias ([`docs/calidad/`](calidad/README.md#seguridad)) | PR #2 en adelante |
| OE4 | RNF-04 Solo campos públicos en la consulta (Must) | Secuencia: consulta pública mediante QR | HU10 | 3 | PT10-09 | Integración (PyTest) | [hu10-test-results.md](test/hu10-test-results.md) (`test_lista_blanca_conjunto_exacto_de_claves`) | Aprobado | PR #26 |
| OE5 | RNF-05 Exactitud de las fichas ≥ 70 % (Must) | Secuencia: registro de un insumo | HU07 | 3 | Validación sobre 37 productos | Aceptación | [validacion_hu07/resultados.md](test/validacion_hu07/resultados.md) | Aprobado: 75,7 % (28 de 37) | PR #23 |
| OE5 | RNF-06 Recuperación ≤ 10 s en el 90 % (Should) | Secuencia: registro de un insumo | HU07 | 3 | Validación sobre 37 productos | Rendimiento | [validacion_hu07/resultados.md](test/validacion_hu07/resultados.md) | Aprobado: 100 % | PR #23 |

## Historias técnicas

| Historia | Sprint | Relación | Evidencia | Resultado | PR / tag |
|---|---|---|---|---|---|
| HT01 Despliegue del Sprint 1 | 1 | Transversal | Informe, sección 30.7 | Aprobado | PR #9 · `v1.0.0-sprint1` |
| HT02 Rediseño del dashboard | 1 | Transversal | Informe, sección 30.5.7 | Aprobado | PR #8 · `v1.0.0-sprint1` |
| HT03 Adecuación del modelo | 2 | RF-03, RF-07 | CI del PR | Aprobado | PR #10 y #11 · `v2.0.0-sprint2` |
| HT04 Validación técnica de fuentes | 2 | RF-05, RF-06 (RT-06) | Informe, sección 33 | Aprobado | Sin PR (documento de contexto) |
| HT05 Diseño de la ficha pública | 3 | RF-11 | `docs/diseno/` | Aprobado | `v3.0.0-sprint3` |
| HT06 Simplificación del flujo de elaboración | 2 | RF-07 (OE2) | [ht06-test-results.md](test/ht06-test-results.md) | Aprobado | PR #17 y #18 · `v2.0.0-sprint2` |
| HT07 Ajustes de usabilidad | 2 | Transversal | [ht07-test-results.md](test/ht07-test-results.md) | Aprobado | PR #20 · `v2.0.0-sprint2` |
| HT08 Secciones «Próximamente» y rediseño | 3 | Transversal (SC-06) | Pruebas del PR #30 | Aprobado | PR #30 · `v3.0.0-sprint3` |

## Cambios transversales

Pull Requests que no corresponden a una historia. Se registran aquí para que ningún cambio del repositorio quede sin explicación.

| PR | Rama | Propósito | Relación |
|---|---|---|---|
| #1 | `feature/rt01-historical-traceability` | Prototipo de mitigación de RT-01 | RNF-01 (RT-01) |
| #7 | `fix/alembic-010` | Corrección de la migración 010 | RT-04 |
| #12 | `mejoraUI-UX` | Ajustes de interfaz (modo claro y oscuro, barra de acciones) | Transversal |
| #15 | `ci/github-actions` | Integración continua con tres suites | Plan de pruebas |
| #21 | `chore/frontend-docker` | Contenedor del frontend | Despliegue |
| #31 | `chore/despliegue-demo` | Despliegue en VPS con Docker y Caddy, y frontend en Netlify | Despliegue (RI-01) |

## Controles

| Control | Valor | Detalle |
|---|---|---|
| Must sin prueba ejecutada | 0 | |
| Must sin elemento del modelo | 0 | |
| Pruebas sin requerimiento | Por revisar | Pruebas de migraciones, salud y esquemas (`test_migracion_*`, `test_health_root.py`, `test_*_schemas.py`) son de regresión técnica |
| HU sin sprint | 0 | |
| HU «Hechas» sin aprobación de un stakeholder | 14 | Aprobaciones pendientes de registrar en Taiga |
| Riesgos sin requerimiento u objetivo afectado | 0 | Ver [`docs/riesgos.md`](riesgos.md) |
