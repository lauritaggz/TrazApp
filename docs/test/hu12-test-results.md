# HU12 — Resultados de pruebas (T12-07)

**Fecha:** 2026-08-24  
**Rama:** `feature/hu12-auth`  
**Entorno:** Docker Compose (frontend + backend + PostgreSQL)

## Resumen automatizado

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Backend | `docker compose exec backend pytest -v` | **30/30** aprobadas |
| Frontend | `npm test` (Vitest) | **10/10** aprobadas |
| Build | `npm run build` | Aprobado |
| Regresión RT-01 | PR-01 … PR-07 (en suite backend) | Aprobadas |
| Compose | `docker compose ps` | frontend, backend, database **Up** |

## Casos PT12

| ID | Caso | Tipo | Resultado |
|----|------|------|-----------|
| PT12-01 | Registro válido | Integración | Aprobado |
| PT12-02 | Correo duplicado | Integración | Aprobado (HTTP 409) |
| PT12-03 | Seguridad de contraseña | Backend/DB | Aprobado (`$2b$12$…`, sin texto plano) |
| PT12-04 | Login válido | Integración | Aprobado |
| PT12-05 | Login inválido | Integración | Aprobado (“Credenciales inválidas”) |
| PT12-06 | Acceso privado autenticado | Integración | Aprobado (`/dashboard`, `/auth/me`) |
| PT12-07 | Acceso privado sin autenticación | Sistema | Aprobado (redirige a `/login`) |
| PT12-08 | Cierre de sesión | Sistema | Aprobado |
| PT12-09 | Flujo completo | Sistema | Aprobado |

## Evidencias recomendadas (informe de título)

Conservar (sin secretos ni JWT completos):

1. Salida de `pytest -v` (30 passed).
2. Salida de `npm test` (10 passed).
3. `docker compose ps` con los tres servicios activos.
4. Captura de registro exitoso.
5. Captura de login y mensaje de credenciales inválidas.
6. Captura de Dashboard con nombre del productor autenticado.
7. Captura post-logout / intento de `/dashboard` → `/login`.

## Criterios de aceptación HU12

- [x] Registro con nombre, correo y contraseña
- [x] Correo único
- [x] Contraseña hasheada (bcrypt), no en texto plano
- [x] Login con credenciales válidas
- [x] Área privada solo con autenticación
- [x] Cierre de sesión
- [x] Credenciales inválidas rechazadas
