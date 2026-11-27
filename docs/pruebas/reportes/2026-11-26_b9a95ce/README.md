# Ejecución completa de pruebas con cobertura · 26-11-2026 · commit `b9a95ce`

Ejecución local de las suites completas sobre el commit `b9a95ce` de `main` (24-11-2026), con Python 3.12 y Node 22. El backend se ejecutó sobre SQLite en memoria, igual que el trabajo «Backend (SQLite)» del CI; las 203 pruebas omitidas requieren PostgreSQL y se ejecutan en el trabajo «Backend (PostgreSQL)».

## Resultados

| Suite | Herramienta | Pruebas | Aprobadas | Omitidas | Fallidas | Duración | Reporte |
|---|---|---|---|---|---|---|---|
| Backend | PyTest 8.3.4 + pytest-cov 7.1.0 | 2.456 | 2.253 | 203 | 0 | 17 min 39 s | [resultados-backend-sqlite.xml](resultados-backend-sqlite.xml) |
| Frontend | Vitest 4.1.11 + @vitest/coverage-v8 | 1.610 | 1.610 | 0 | 0 | 5 min 52 s | [resultados-frontend.xml](resultados-frontend.xml) |

## Cobertura de líneas

| Paquete | Líneas | Cubiertas | Cobertura |
|---|---|---|---|
| Backend · `app/services` (lógica de negocio) | 2.527 | 2.439 | 96,5 % |
| Backend · `app/repositories` | 807 | 783 | 97,0 % |
| Backend · `app/api` | 840 | 807 | 96,1 % |
| Backend · `app/models` y `app/schemas` | 1.500 | 1.493 | 99,5 % |
| **Backend · total** | **6.018** | **5.859** | **97,4 %** |
| **Frontend · total (`src/`)** | **6.023** | **5.485** | **91,1 %** |

Reportes de la herramienta: [cobertura-backend.xml](cobertura-backend.xml) (Cobertura XML) y [cobertura-frontend.json](cobertura-frontend.json) (resumen por archivo de v8).

## Qué significa

La cobertura de la lógica de negocio supera el 70 % que pide el criterio de salida con amplio margen. Los archivos con menor cobertura son `app/services/product_image_service.py` (82 %), que maneja errores de archivos de imagen, y las ramas de error de `app/services/elaboracion_service.py` (92 %). Una cobertura alta no prueba por sí sola que las pruebas detecten fallas; eso se verifica con las mutaciones registradas en cada documento de resultados.

## Cómo repetirla

```bash
cd backend && python -m pytest -q --cov=app --cov-report=term --cov-report=xml:cobertura.xml
cd frontend && npx vitest run --coverage --coverage.provider=v8 --coverage.include='src/**'
```

## Nueva ejecución con las dependencias actualizadas

Después de actualizar las dependencias con vulnerabilidades conocidas (ver [`docs/calidad/`](../../../calidad/README.md#seguridad)), las suites se ejecutaron de nuevo sobre el mismo código:

| Suite | Pruebas | Aprobadas | Omitidas | Fallidas | Reporte |
|---|---|---|---|---|---|
| Backend (FastAPI 0.134.0, Starlette 1.10.0, PyJWT 2.15.1, pytest 9.2.0) | 2.456 | 2.253 | 203 | 0 | [resultados-backend-sqlite-dependencias-actualizadas.xml](resultados-backend-sqlite-dependencias-actualizadas.xml) |
| Frontend (Vite 8.4.0, Vitest 4.1.12) | 1.610 | 1.610 | 0 | 0 | Ejecución local; además, `npm run build` termina sin errores |

Con las versiones nuevas aparecen avisos de obsolescencia (`HTTP_422_UNPROCESSABLE_ENTITY` pasa a llamarse `HTTP_422_UNPROCESSABLE_CONTENT`) y un aviso de PyJWT cuando la clave HMAC de las pruebas tiene menos de 32 bytes. Ninguno hace fallar una prueba.
