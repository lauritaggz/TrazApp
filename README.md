# TrazApp

Sistema para la gestión y comunicación de trazabilidad de alimentos elaborados, orientado principalmente a pequeños productores.

## Problema

Dificultad de pequeños productores de alimentos elaborados para mantener trazable, actualizada e históricamente relacionada la información de ingredientes, composición, proveedores, alérgenos y lotes de sus productos.

## Objetivo del prototipo (RT-01)

Validar técnicamente que TrazApp puede **conservar relaciones históricas de trazabilidad** aunque existan cambios posteriores en productos o ingredientes.

**Riesgo RT-01:** pérdida o alteración de relaciones históricas de trazabilidad.

**Estrategia de mitigación:** versionamiento con referencias históricas explícitas. Las versiones no se sobrescriben; los lotes conservan referencias a las versiones utilizadas originalmente.

## Estado del repositorio

| Rama | Propósito |
|------|-----------|
| `main` | Versiones integradas y estables |
| `feature/rt01-historical-traceability` | Prototipo RT-01 (desarrollo activo) |

## Stack

| Capa | Tecnología |
|------|------------|
| API | FastAPI + Pydantic |
| Persistencia | PostgreSQL + SQLAlchemy |
| Migraciones | Alembic |
| Contenedores | Docker + Docker Compose |
| Pruebas | PyTest |

## Arquitectura

Monolito modular en capas:

```
API / Routes → Services → Repositories → PostgreSQL
```

## Requisitos

- Docker Desktop / Docker Engine + Docker Compose
- WSL 2 (requerido por Docker Desktop en Windows)
- (Opcional) Python 3.12+ para desarrollo local

## Configuración

```bash
cp .env.example .env
```

No subir `.env` al repositorio.

## Ejecutar con Docker Compose

```bash
docker compose up --build -d
```

| Servicio | URL / puerto |
|----------|----------------|
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| PostgreSQL | localhost:5432 (volumen `postgres_data`) |

El backend ejecuta `alembic upgrade head` al iniciar.

Detener sin eliminar datos:

```bash
docker compose down
```

## Migraciones

```bash
docker compose exec backend alembic current
docker compose exec backend alembic history
docker compose exec backend alembic upgrade head
```

## Pruebas

Con Docker:

```bash
docker compose exec backend pytest -v
```

Local (desde `backend/`):

```bash
pip install -r requirements.txt
pytest -v
```

Pruebas de regresión RT-01: `test_trazabilidad_historica.py` (PR-01 a PR-07).

## Endpoints implementados

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/productos` | Crear producto |
| POST | `/productos/{id}/versiones` | Crear versión de producto |
| GET | `/productos/{id}/versiones` | Listar versiones de producto |
| POST | `/ingredientes` | Crear ingrediente |
| POST | `/ingredientes/{id}/versiones` | Crear versión de ingrediente |
| GET | `/ingredientes/{id}/versiones` | Listar versiones de ingrediente |
| POST | `/lotes-ingredientes` | Registrar lote de ingrediente |
| POST | `/lotes-productos` | Registrar lote de producto |
| GET | `/lotes-productos/{codigo}/trazabilidad` | Consulta histórica |

### Ejemplo de trazabilidad

```json
{
  "lote_producto": "LP-001",
  "producto": {
    "nombre": "Galleta",
    "version": 1,
    "descripcion": "Formulación original"
  },
  "ingredientes_utilizados": [
    {
      "ingrediente": "Chocolate",
      "lote": "CH-001",
      "version": 1,
      "composicion_declarada": "Cacao, azúcar, leche",
      "alergenos_declarados": "Leche"
    }
  ]
}
```

## Escenario de validación RT-01

**Estado inicial:** LP-001 → VP1 → CH-001 → VI1

**Después del cambio:** se crean VP2, VI2, CH-002, LP-002

**Resultado esperado:**

- LP-001 sigue devolviendo VP1 + CH-001 + VI1
- LP-002 devuelve VP2 + CH-002 + VI2

## Estructura del proyecto

```
backend/
  app/
    api/routes/     # productos, ingredientes, lotes, health
    core/           # configuración
    db/             # SQLAlchemy base y sesión
    models/         # entidades de dominio
    schemas/        # Pydantic
    services/       # lógica de negocio
    repositories/   # acceso a datos
  alembic/versions/
  tests/
docker-compose.yml
.env.example
```

## Métricas de éxito (proyecto)

- Reconstrucción histórica correcta: meta ≥ 95 %
- Conservación de registros históricos ante cambios: meta 100 %
- Índice de integridad de trazabilidad: meta ≥ 95 %
