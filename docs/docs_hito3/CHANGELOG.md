# Changelog

Cambios por versión, con su historia y Pull Request. Cada versión corresponde al tag de cierre de un sprint.

## v3.0.0-sprint3 — 23-11-2026

Objetivo del Sprint 3: que el consumidor consulte por QR los insumos y alérgenos de la elaboración que compró, y que el productor consulte su historial, identifique las elaboraciones relacionadas con un insumo o lote y registre insumos buscando por nombre.

- HT05 Diseño de la ficha pública del consumidor (diseño en `docs/diseno/`)
- HU06 Consulta del historial de elaboraciones (PR #22)
- HU07 Recuperación de información de insumos desde Jumbo.cl, combinada con Open Food Facts (PR #23)
- HU09 Habilitar publicación del producto y código QR (PR #24)
- HU10 Consulta pública mediante QR (PR #25 y #26)
- HU08 Identificación de elaboraciones relacionadas con un insumo o lote (PR #27)
- HU14 Calculadora de costos del producto, incorporada por SC-05 (PR #28)
- HU11 Evaluación de utilidad de la información (PR #29)
- HT08 Secciones «Próximamente», navegación y rediseño de interfaces, incorporada por SC-06 (PR #30)
- HU13 CA12: escaneo verificado en Safari para iOS (03-11-2026)
- Contenedor del frontend (PR #21)

### Después del tag

- Despliegue en VPS con Docker y Caddy, y frontend en Netlify (PR #31)

## v2.0.0-sprint2 — 21-10-2026

- HT03 Adecuación del modelo existente (PR #10 y #11)
- HT04 Validación técnica de fuentes de información (documento de contexto, sin integración)
- HU03 Gestión de formulación y versiones del producto (PR #13)
- HU04 Gestión de insumos comerciales (PR #14)
- HU05 Registro de elaboración (PR #16)
- HT06 Simplificación del flujo de elaboración y revisión de alérgenos (PR #17 y #18)
- HU13 Búsqueda de insumos mediante código de barras (PR #19)
- HT07 Ajustes de usabilidad tras la validación del Sprint 2 (PR #20)
- Ajustes de interfaz: modo claro y oscuro, barra de acciones (PR #12)
- Integración continua con GitHub Actions (PR #15)

## v1.0.0-sprint1 — 12-09-2026

- Prototipo de mitigación de RT-01 (PR #1)
- HU12 Registro y acceso del productor (PR #2, #3 y #4)
- HU01 Gestión de productos (PR #5 y #6)
- HU02 Gestión de ingredientes y composición (integrada directamente a main)
- HT02 Rediseño del dashboard principal (PR #8)
- HT01 Despliegue de la versión del Sprint 1 (PR #9)
- Corrección de la migración 010 (PR #7)
