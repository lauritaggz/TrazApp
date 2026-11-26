Camino elegido: **Camino A — UML**.

# A7 · Modelamiento y decisiones arquitectónicas

## Arquitectura

TrazApp es un **monolito modular organizado en capas** (ver [ADR-01](adr/ADR-01-arquitectura.md)):

- **Presentación:** aplicación web React + Vite, publicada en Netlify, con las interfaces del productor y del consumidor.
- **Aplicación:** controladores de la API FastAPI y autenticación con JWT.
- **Lógica de negocio:** formulaciones y versiones, insumos comerciales y recuperación de información, elaboraciones y conservación de la información, elaboraciones relacionadas y consulta pública.
- **Persistencia:** PostgreSQL, con migraciones versionadas (Alembic).

El backend y PostgreSQL se ejecutan en contenedores Docker en un VPS de Hostinger (Ubuntu 24.04 LTS), con Caddy como proxy inverso y HTTPS mediante Let’s Encrypt. Solo los servicios necesarios para HTTPS están expuestos; PostgreSQL es accesible únicamente desde el propio servidor. El procedimiento está en [`docs/despliegue.md`](../despliegue.md).

## Stack tecnológico

| Componente | Herramienta | Justificación |
|---|---|---|
| Frontend | React + Vite | Interfaces web modulares y reutilizables, con un entorno de construcción liviano |
| Backend | FastAPI (Python) | API REST con validación de datos y compatibilidad con PostgreSQL y Docker |
| Base de datos | PostgreSQL | Consistencia transaccional y relaciones explícitas para las consultas históricas; la información de fuentes externas, de estructura variable, se guarda en JSONB |
| Pruebas | PyTest · Vitest | PyTest cubre la lógica y los endpoints del backend; Vitest se integra con Vite para el frontend |
| CI | GitHub Actions | Tres suites en cada Pull Request: backend SQLite, backend PostgreSQL y frontend |
| Contenedores | Docker + Docker Compose | Ambientes reproducibles en desarrollo y en el servidor |
| Producción | VPS Hostinger + Netlify · Caddy | Backend y base de datos en el VPS; frontend en Netlify; HTTPS automático |
| Gestión | Taiga | Product Backlog, sprints, historias, tareas y Story Points |

## Decisiones (ADR)

| ADR | Decisión | Requerimientos |
|---|---|---|
| [ADR-01](adr/ADR-01-arquitectura.md) | Monolito modular en capas | Todos; RNF-03 |
| [ADR-02](adr/ADR-02-conservacion-historica.md) | Versiones de la formulación y copia inmutable de la información de los insumos al finalizar la elaboración | RF-03, RF-07, RNF-01 |
| [ADR-03](adr/ADR-03-fuentes-insumos.md) | Open Food Facts por código de barras combinado con Jumbo.cl, con confirmación del productor | RF-05, RF-06, RNF-05, RNF-06 |
| [ADR-04](adr/ADR-04-lector-codigo-barras.md) | Detector nativo BarcodeDetector con ZBar-WASM como alternativa e ingreso manual | RF-06 |

## Modelos (UML)

| Diagrama | Archivo | Requerimientos |
|---|---|---|
| Contexto | [01-contexto.png](modelos/01-contexto.png) | Todos |
| Arquitectura de alto nivel | [02-arquitectura-alto-nivel.png](modelos/02-arquitectura-alto-nivel.png) | Todos |
| Casos de uso | [03-casos-de-uso-a.png](modelos/03-casos-de-uso-a.png) · [03-casos-de-uso-b.png](modelos/03-casos-de-uso-b.png) | RF-01 a RF-13 |
| Clases: productos, formulación y elaboraciones | [04-clases-productos-formulacion-elaboraciones.png](modelos/04-clases-productos-formulacion-elaboraciones.png) | RF-01, RF-02, RF-03, RF-07, RNF-01 |
| Clases: insumos comerciales y alérgenos | [05-clases-insumos-alergenos.png](modelos/05-clases-insumos-alergenos.png) | RF-04, RF-05, RF-06 |
| Secuencia: registro de una elaboración | [06-secuencia-registro-elaboracion.png](modelos/06-secuencia-registro-elaboracion.png) | RF-07, RNF-01 |
| Secuencia: registro de un insumo por búsqueda o escaneo | [07-secuencia-registro-insumo.png](modelos/07-secuencia-registro-insumo.png) | RF-04, RF-05, RF-06 |
| Secuencia: historial y elaboraciones relacionadas | [08-secuencia-historial-relacionadas.png](modelos/08-secuencia-historial-relacionadas.png) | RF-08, RF-09 |
| Secuencia: consulta pública mediante QR | [09-secuencia-consulta-publica-qr.png](modelos/09-secuencia-consulta-publica-qr.png) | RF-11, RNF-02, RNF-04 |
| Componentes | [10-componentes.png](modelos/10-componentes.png) | Todos |
| Vista lógica | [11-vista-logica.png](modelos/11-vista-logica.png) | Todos |
| Vista física | [12-vista-fisica.png](modelos/12-vista-fisica.png) | Despliegue |
| Despliegue | [13-despliegue.png](modelos/13-despliegue.png) | Despliegue, RNF-03 |

**Pendiente:** diagrama de actividades de al menos un proceso, y la representación de RF-14 (calculadora de costos) en los diagramas de casos de uso y de clases.
