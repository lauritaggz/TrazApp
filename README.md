# TrazApp

Sistema para la gestión y comunicación de trazabilidad de alimentos elaborados, orientado principalmente a pequeños productores.

## Problema

Dificultad de pequeños productores de alimentos elaborados para mantener trazable, actualizada e históricamente relacionada la información de ingredientes, composición, proveedores, alérgenos y lotes de sus productos.

## Estado del repositorio

- `main`: versiones integradas y estables.
- `feature/rt01-historical-traceability`: prototipo de mitigación del riesgo **RT-01** (pérdida o alteración de relaciones históricas de trazabilidad).

## Stack (Fase 1 — infraestructura)

| Capa | Tecnología |
|------|------------|
| API | FastAPI + Pydantic |
| Persistencia | PostgreSQL + SQLAlchemy |
| Migraciones | Alembic |
| Contenedores | Docker + Docker Compose |
| Pruebas | PyTest |

## Requisitos

- Docker Desktop / Docker Engine + Docker Compose
- (Opcional) Python 3.12+ para desarrollo local fuera de Docker

## Configuración

```bash
cp .env.example .env
```

Ajusta valores en `.env` si es necesario. **No** subas `.env` al repositorio.

## Ejecutar con Docker Compose

Desde la raíz del proyecto:

```bash
docker compose up --build -d
```

Servicios:

| Servicio | URL / puerto |
|----------|----------------|
| API FastAPI | http://localhost:8000 |
| Swagger / OpenAPI | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| PostgreSQL | localhost:5432 (volumen persistente `postgres_data`) |

Detener:

```bash
docker compose down
```

Conservar datos de PostgreSQL (no eliminar el volumen):

```bash
docker compose down
# Evitar: docker compose down -v
```

## Migraciones (Alembic)

Las migraciones de dominio se añadirán en fases posteriores. La configuración de Alembic ya está lista en `backend/`.

Dentro del contenedor backend:

```bash
docker compose exec backend alembic current
docker compose exec backend alembic history
docker compose exec backend alembic upgrade head
```

## Pruebas

```bash
docker compose exec backend pytest -v
```

O en local (con dependencias instaladas y `DATABASE_URL` apuntando a PostgreSQL):

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

## Estructura

```
backend/
  app/
    api/          # rutas y dependencias
    core/         # configuración
    db/           # SQLAlchemy base y sesión
    models/       # ORM (dominio en fases siguientes)
    schemas/      # Pydantic (dominio en fases siguientes)
    services/     # lógica de negocio
    repositories/ # acceso a datos
    main.py
  alembic/
  tests/
  Dockerfile
  requirements.txt
docker-compose.yml
.env.example
```
