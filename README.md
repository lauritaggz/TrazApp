# TrazApp

Plataforma web para la **gestión y comunicación de trazabilidad de alimentos elaborados**, pensada para pequeños productores.

## Qué es TrazApp

Un pequeño productor de alimentos (panadería, repostería, conservas, etc.) necesita saber, y poder demostrar, **qué ingredientes, proveedores, alérgenos y lotes componen cada producto que vende**, incluso meses después y aunque la receta o los ingredientes hayan cambiado.

Hoy esa información suele vivir en planillas, cuadernos o en la memoria de quien produce. TrazApp la centraliza en un solo lugar, la mantiene ordenada y conserva su historia.

## Problema que resuelve

Dificultad de pequeños productores para mantener **trazable, actualizada e históricamente relacionada** la información de ingredientes, composición, proveedores, alérgenos y lotes de sus productos.

## Hacia dónde apunta

La meta es que un productor pueda, sin conocimientos técnicos:

1. **Registrar su catálogo**: productos e ingredientes, con su composición y alérgenos.
2. **Versionar sin perder historia**: cambiar una receta o un ingrediente sin alterar lo ya producido.
3. **Registrar lotes** de ingredientes recibidos y de productos elaborados.
4. **Responder en segundos** a "¿qué lleva este lote y de qué lotes de ingredientes salió?".
5. **Comunicar** esa información (alérgenos, composición) de forma clara a quien la necesite: clientes, fiscalizadores o el propio equipo.

### Principio de diseño: historia inmutable

Riesgo central (**RT-01**): pérdida o alteración de relaciones históricas de trazabilidad.
Mitigación: **versionamiento con referencias explícitas**. Las versiones nunca se sobrescriben y cada lote guarda referencia a las versiones exactas que usó. Así, un lote producido en enero sigue mostrando la receta de enero aunque en junio se haya modificado.

## Estado actual

### Implementado

**Cuentas y acceso**
- Registro e inicio de sesión de productores con JWT y contraseñas con hash (bcrypt).
- Rutas privadas, perfil editable y cierre de sesión.

**Productos**
- Alta, listado, detalle, edición y eliminación de productos.
- Categorías (catálogo precargado), costo y precio, imagen del producto.
- Búsqueda, filtros y orden; vista de lista o cuadrícula.
- Versiones de producto y **formulación por versión** (líneas de ingredientes con orden).

**Ingredientes**
- Alta, listado, detalle, edición y eliminación de ingredientes.
- Composición del ingrediente.
- Alérgenos asociados desde un catálogo, con los alérgenos de declaración obligatoria en Chile.
- Versiones de ingrediente.

**Trazabilidad (prototipo RT-01 validado)**
- Registro de lotes de ingredientes y de productos.
- Consulta histórica de un lote de producto: producto y versión usados, y los lotes y versiones de ingredientes utilizados, con composición y alérgenos declarados.
- Pruebas de regresión que confirman que los lotes antiguos no cambian al crear nuevas versiones (PR-01 a PR-07).

**Interfaz**
- Dashboard con elementos que requieren atención (por ejemplo productos incompletos).
- Navegación, menú de usuario, aviso de cambios sin guardar y formularios en dos columnas con vista previa.
- Auditoría UX/UI por fases: accesibilidad, sistema de diseño documentado en [`docs/DESIGN.md`](docs/DESIGN.md), listados y estados vacíos.

### Pendiente

- Interfaz de lotes y de consulta de trazabilidad en el frontend (hoy disponible solo vía API).
- Proveedores como entidad propia.
- Salidas para comunicar la información (ficha o etiqueta de producto, exportación).
- Despliegue productivo completo (frontend en Netlify; API en VPS con proxy inverso).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| Pruebas frontend | Vitest + Testing Library |
| API | FastAPI + Pydantic |
| Persistencia | PostgreSQL + SQLAlchemy |
| Migraciones | Alembic |
| Contenedores | Docker + Docker Compose |
| Pruebas backend | PyTest |

## Arquitectura

Monolito modular en capas:

```
API / Routes → Services → Repositories → PostgreSQL
```

El frontend es una SPA independiente (se despliega en Netlify) que consume la API.

## Requisitos

- Docker Desktop / Docker Engine + Docker Compose (en Windows, WSL 2)
- Node.js 20+ para el frontend
- (Opcional) Python 3.12+ para desarrollo local del backend

## Puesta en marcha

### Backend

```bash
cp .env.example .env
docker compose up --build -d
```

No subir `.env` al repositorio. El backend ejecuta `alembic upgrade head` al iniciar.

| Servicio | URL / puerto |
|----------|--------------|
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| PostgreSQL | localhost:5432 (volumen `postgres_data`) |

Detener sin borrar datos:

```bash
docker compose down
```

### Frontend

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

Para producción en Netlify, definir `VITE_API_URL` y añadir el origen del sitio a `CORS_ORIGINS` del backend.

## Migraciones

```bash
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
```

## Pruebas

```bash
docker compose exec backend pytest -v     # backend
cd frontend && npm test                   # frontend
```

Regresión RT-01: `backend/tests/test_trazabilidad_historica.py`.
Resultados documentados en `docs/hu01-test-results.md` y `docs/hu12-test-results.md`.

## API

Documentación interactiva completa en `/docs`. Grupos principales:

| Grupo | Rutas |
|-------|-------|
| Autenticación | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout` |
| Productos | `/gestion/productos` (CRUD, imagen) |
| Formulación | `/gestion/productos/{id}/versiones/{version_id}/formulacion` |
| Ingredientes | `/gestion/ingredientes` (CRUD, composición, alérgenos) |
| Catálogos | `/gestion/categorias`, `/gestion/alergenos` |
| Trazabilidad | `/productos`, `/ingredientes` (versiones), `/lotes-ingredientes`, `/lotes-productos` |
| Consulta histórica | `GET /lotes-productos/{codigo}/trazabilidad` |
| Salud | `/health` |

### Ejemplo de consulta de trazabilidad

```json
{
  "lote_producto": "LP-001",
  "producto": { "nombre": "Galleta", "version": 1, "descripcion": "Formulación original" },
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

### Escenario de validación RT-01

Estado inicial: LP-001 → VP1 → CH-001 → VI1. Tras crear VP2, VI2, CH-002 y LP-002:

- LP-001 sigue devolviendo VP1 + CH-001 + VI1.
- LP-002 devuelve VP2 + CH-002 + VI2.

## Estructura del proyecto

```
backend/
  app/
    api/routes/     # auth, gestion_*, productos, ingredientes, lotes, health
    core/           # configuración
    db/             # SQLAlchemy base y sesión
    models/         # dominio
    schemas/        # Pydantic
    services/       # lógica de negocio
    repositories/   # acceso a datos
  alembic/versions/
  tests/
frontend/
  src/
    pages/          # Dashboard, Products, Ingredients, Login, Profile…
    components/     # ui, layout, products, ingredients, dashboard
    auth/ hooks/ lib/ ui/
docs/               # DESIGN.md y resultados de pruebas
docker-compose.yml
netlify.toml
```

## Métricas de éxito

- Reconstrucción histórica correcta: meta ≥ 95 %
- Conservación de registros históricos ante cambios: meta 100 %
- Índice de integridad de trazabilidad: meta ≥ 95 %
