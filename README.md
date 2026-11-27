# TrazApp

[![CI](https://github.com/lauritaggz/TrazApp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lauritaggz/TrazApp/actions/workflows/ci.yml)

Plataforma web para pequeños productores de alimentos elaborados que relaciona cada elaboración con los insumos comerciales y lotes efectivamente utilizados, conserva esa información ante cambios posteriores y la comunica al consumidor mediante un código QR.

**MVP en línea:** https://trazapp.netlify.app

## Documentación del proyecto

| Artefacto | Documento |
|---|---|
| Problema, hipótesis y objetivos medibles | [`docs/objetivos.md`](docs/objetivos.md) |
| Requerimientos, alcance del MVP y escenarios de calidad | [`docs/requerimientos.md`](docs/requerimientos.md) |
| Historias con criterios de aceptación | [`docs/historias.md`](docs/historias.md) |
| Matriz de trazabilidad | [`docs/trazabilidad.md`](docs/trazabilidad.md) |
| Plan de pruebas y evidencia | [`docs/pruebas/`](docs/pruebas/README.md) · resultados por historia en [`docs/test/`](docs/test/) |
| Reportes de seguridad y eficiencia | [`docs/calidad/`](docs/calidad/README.md) |
| Arquitectura, decisiones (ADR) y modelos UML | [`docs/arquitectura/`](docs/arquitectura/README.md) |
| Riesgos y deuda técnica | [`docs/riesgos.md`](docs/riesgos.md) |
| Despliegue | [`docs/despliegue.md`](docs/despliegue.md) |
| Sistema de diseño | [`docs/DESIGN.md`](docs/DESIGN.md) |
| Cambios por versión | [`CHANGELOG.md`](CHANGELOG.md) |

## Funcionalidades del MVP

**Productor**
- Registro e inicio de sesión, con la información de cada productor aislada de la de los demás.
- Productos, ingredientes y formulación, con una nueva versión del producto cuando cambia una receta ya utilizada.
- Insumos comerciales con ingredientes declarados y alérgenos, completados por búsqueda por nombre (Jumbo.cl), escaneo del código de barras (Open Food Facts) o ingreso manual, siempre con confirmación.
- Elaboraciones con el insumo y el lote de cada ingrediente; al finalizarlas, su información queda conservada y no puede modificarse.
- Historial de elaboraciones y elaboraciones relacionadas con un insumo o un lote.
- Publicación del producto y código QR permanente.
- Calculadora de costos del producto.

**Consumidor**
- Ficha pública por QR, sin cuenta: insumos y alérgenos («contiene» y «puede contener») de la elaboración seleccionada, tal como se conservaron.
- Evaluación anónima de la utilidad de la información.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| API | FastAPI + Pydantic |
| Persistencia | PostgreSQL + SQLAlchemy |
| Migraciones | Alembic |
| Pruebas | PyTest (backend) · Vitest + Testing Library (frontend) |
| Integración continua | GitHub Actions: backend sobre SQLite, backend sobre PostgreSQL y frontend |
| Contenedores | Docker + Docker Compose |
| Producción | Frontend en Netlify · API y PostgreSQL en un VPS con Docker y Caddy (HTTPS) |

## Arquitectura

Monolito modular en capas:

```
API / Routes → Services → Repositories → PostgreSQL
```

El frontend es una SPA independiente publicada en Netlify, que reenvía `/api/*` a la API del VPS. Detalle, decisiones y diagramas en [`docs/arquitectura/`](docs/arquitectura/README.md).

## Requisitos

- Docker Desktop / Docker Engine + Docker Compose (en Windows, WSL 2)
- Node.js 20+ para el frontend
- (Opcional) Python 3.12+ para desarrollo local del backend

## Puesta en marcha

### Levantar el entorno de desarrollo

Base de datos, backend y frontend juntos, con recarga en caliente:

```bash
cp .env.example .env     # la primera vez; completa las contraseñas y claves
docker compose up --build
```

No subir `.env` al repositorio. El backend ejecuta `alembic upgrade head` al iniciar.

| Servicio | URL / puerto |
|----------|--------------|
| Frontend (Vite) | http://localhost:5175 (`FRONTEND_PORT` en `.env`) |
| API | http://localhost:8000 |
| Documentación de la API (Swagger) | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| PostgreSQL | localhost:5432 (volumen `postgres_data`) |

Si cambias `FRONTEND_PORT`, agrega el nuevo origen a `CORS_ORIGINS` (ver `.env.example`).

Ver los registros:

```bash
docker compose logs -f              # todos los servicios
docker compose logs -f frontend     # solo uno (backend, database, frontend)
```

Detener sin borrar datos:

```bash
docker compose down
```

**Nunca uses `docker compose down -v`**: borra el volumen `postgres_data` y con él la base de datos.

El servicio `frontend` solo es para desarrollo (en producción el frontend está en Netlify). Monta `./frontend` dentro del contenedor y usa sus propios `node_modules` (Linux). Si cambias `package.json` o `package-lock.json`, reconstruye y renueva ese volumen: `docker compose up --build -V frontend`.

### Frontend sin Docker

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm install
npm run dev              # o `npm run dev:https` para probar en el celular
```

Con el backend en Docker (`docker compose up -d database backend`) y el frontend fuera de Docker, todo sigue funcionando como antes.

Para producción en Netlify, definir `VITE_API_URL` y añadir el origen del sitio a `CORS_ORIGINS` del backend.

## Migraciones

```bash
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
```

## Pruebas

```bash
docker compose exec backend pytest -q                 # backend
cd frontend && npm test                               # frontend
```

Con cobertura:

```bash
docker compose exec backend pytest -q --cov=app --cov-report=term
cd frontend && npx vitest run --coverage
```

Los resultados por historia están en [`docs/test/`](docs/test/), y el plan de pruebas en [`docs/pruebas/`](docs/pruebas/README.md).

## Despliegue

El procedimiento completo (VPS, variables de entorno, Caddy y Netlify) está en [`docs/despliegue.md`](docs/despliegue.md).

## Documentación de la API

Documentación interactiva en `/docs` del ambiente de desarrollo (`http://localhost:8000/docs`).

## Versiones

| Tag | Sprint | Fecha |
|---|---|---|
| `v1.0.0-sprint1` | 1 | 12-09-2026 |
| `v2.0.0-sprint2` | 2 | 21-10-2026 |
| `v3.0.0-sprint3` | 3 | 23-11-2026 |

Detalle en [`CHANGELOG.md`](CHANGELOG.md).

## Estructura del proyecto

```
backend/
  app/
    api/routes/     # autenticación, gestión del productor y consulta pública
    core/           # configuración
    db/             # SQLAlchemy, sesión y triggers
    models/         # dominio
    schemas/        # Pydantic
    services/       # lógica de negocio
    repositories/   # acceso a datos
  alembic/versions/
  scripts/          # mediciones (por ejemplo, OE4)
  tests/
frontend/
  src/              # páginas, componentes y pruebas (Vitest)
deploy/             # configuración del servidor
docs/               # artefactos del proyecto, resultados de pruebas y diseño
docker-compose.yml
docker-compose.prod.yml
```
