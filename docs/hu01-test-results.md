# HU01 — Resultados de pruebas (T01-09)

**Fecha:** 2026-08-26  
**Rama:** `feature/hu01-products`  
**HEAD:** `271dd4b` (`feat(ux): mejorar dashboard y flujo de gestión de productos`)  
**Entorno:** Docker Compose (frontend + backend + PostgreSQL)  
**Plan de referencia:** `docs/Plan de pruebas HU01.pdf` (PT01-01 … PT01-32)  
**Total de casos:** 32

---

## Resumen de ejecución automatizada

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Frontend | `npm test -- --run` | **46/46** aprobadas |
| Backend | `docker compose exec backend pytest -q` | **83/83** aprobadas |
| RT-01 | `pytest tests/test_trazabilidad_historica.py` | **7/7** (PR-01 … PR-07) aprobadas |
| Build | `npm run build` | Aprobado |
| Docker Compose | `docker compose ps` | frontend Up, backend Up, database Up (healthy) |
| Health | `GET /health` | `{"status":"ok","database":"ok"}` |
| Alembic | `alembic current` | `005_add_created_at_productos (head)` |
| Diff | `git diff --check` | Limpio |

---

## Resumen frontend

- Suite Vitest: autenticación HU12, listado/búsqueda/filtros/orden, creación, detalle, edición, errores 409/404/red, estados loading/vacío.
- Build Vite/TypeScript sin errores.
- Feedback UI: “Producto creado correctamente.” / “Producto actualizado correctamente.”

## Resumen backend

- Schemas HU01 (`ProductoGestionCreate` / `Update` / `Read`).
- API autenticada `POST/GET/PATCH /gestion/productos`.
- Aislamiento por productor, duplicados 409, legacy `productor_id IS NULL`, sin `VersionProducto` en create/edit.

## RT-01

PR-01 … PR-07 **PASSED** — relaciones históricas intactas.

## Docker

| Servicio | Estado |
|----------|--------|
| trazapp-frontend | Up |
| trazapp-backend | Up |
| trazapp-database | Up (healthy) |

## Build

`npm run build` finalizó correctamente (`tsc -b && vite build`).

---

## Resultados PT01-01 … PT01-32

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|----|------|------|-------------------|-----------|-------------------|--------|
| PT01-01 | Registrar un producto con todos los campos válidos | Automatizada | Se crea correctamente y queda asociado al productor autenticado. | `test_productor_autenticado_crea_producto_valido`, `test_producto_queda_asociado_al_productor_autenticado` | Producto creado con `productor_id` del JWT | **Aprobado** |
| PT01-02 | Registrar producto sin código interno | Automatizada | Solicitud rechazada. | Schema `ProductoGestionCreate` (campo requerido); spot-check ValidationError; FE `validateProductForm` | Rechazo en schema/FE | **Aprobado** |
| PT01-03 | Registrar producto sin nombre | Automatizada | Solicitud rechazada. | `test_nombre_vacio_o_solo_espacios_es_rechazado`; FE validación nombre | Rechazo ValidationError / mensaje FE | **Aprobado** |
| PT01-04 | Registrar producto sin descripción | Automatizada | Solicitud rechazada. | `test_descripcion_vacia_es_rechazada`; FE validación descripción | Rechazo ValidationError / mensaje FE | **Aprobado** |
| PT01-05 | Registrar producto sin contenido neto | Automatizada | Solicitud rechazada. | Schema requerido + spot-check ValidationError; FE validación | Rechazo schema/FE | **Aprobado** |
| PT01-06 | Registrar contenido neto igual o menor que cero | Automatizada | Solicitud rechazada. | `test_contenido_neto_cero_es_rechazado`, `test_contenido_neto_negativo_es_rechazado`; FE | Rechazo > 0 | **Aprobado** |
| PT01-07 | Registrar una unidad no permitida | Automatizada | Solicitud rechazada. | `test_unidad_medida_invalida_es_rechazada`; select FE limitado | Solo g/kg/ml/L/unidad | **Aprobado** |
| PT01-08 | Registrar código interno repetido para el mismo productor | Automatizada | Operación rechazada. | `test_mismo_productor_no_puede_repetir_codigo_interno` (HTTP 409) | 409 Conflict | **Aprobado** |
| PT01-09 | Registrar el mismo código interno con productores diferentes | Automatizada + Técnica | Ambos productos pueden existir. | `test_dos_productores_pueden_usar_mismo_codigo_interno`; DB: GAL-001 en dos cuentas | Ambos registros coexisten | **Aprobado** |
| PT01-10 | Registrar dos productos con el mismo nombre y códigos diferentes | Automatizada + Técnica | Ambos productos pueden existir. | Sin unique en `nombre`; spot-check schema con mismo nombre / códigos distintos | Permitido | **Aprobado** |
| PT01-11 | Listar productos | Automatizada | Solo productos del productor autenticado. | `test_productor_lista_unicamente_sus_propios_productos`; FE `listProducts` | Listado aislado | **Aprobado** |
| PT01-12 | Consultar un producto propio | Automatizada | Se obtiene correctamente su información. | `test_productor_consulta_producto_propio`; FE detalle | GET 200 con datos | **Aprobado** |
| PT01-13 | Consultar un producto perteneciente a otro productor | Automatizada + E2E | El producto no queda accesible. | `test_producto_de_otro_productor_devuelve_404`; FE “Producto no disponible.” | 404 / UI no disponible | **Aprobado** |
| PT01-14 | Editar los datos generales de un producto | Automatizada | Los datos se actualizan manteniendo el mismo `id`. | `test_patch_parcial_conserva_omitidos_y_mantiene_id_productor`; FE PATCH parcial | Mismo `id`, datos actualizados | **Aprobado** |
| PT01-15 | Cambiar el código por uno ya utilizado por el mismo productor | Automatizada | Operación rechazada. | `test_patch_codigo_duplicado_mismo_productor_409`; FE mensaje 409 | 409 | **Aprobado** |
| PT01-16 | Intentar editar producto perteneciente a otro productor | Automatizada | Operación rechazada. | `test_producto_de_otro_productor_devuelve_404` (PATCH 404) | 404 | **Aprobado** |
| PT01-17 | Crear un producto | Automatizada + Técnica | No se genera automáticamente una `VersionProducto`. | `test_creacion_y_edicion_no_generan_version_producto`; consulta DB `versions = 0` | Sin versiones nuevas | **Aprobado** |
| PT01-18 | Editar datos generales | Automatizada + Técnica | No se genera una nueva `VersionProducto`. | Mismo test + DB post-edición | Sin versiones nuevas | **Aprobado** |
| PT01-19 | Productor sin productos accede a Productos | Automatizada | Estado vacío y acción para registrar el primer producto. | FE `muestra estado vacío…`; Dashboard CTA “Registrar primer producto” | Empty state + CTA | **Aprobado** |
| PT01-20 | Registrar producto desde la interfaz | Automatizada + E2E | Formulario se valida, producto se crea y se entrega confirmación. | FE creación + “Producto creado correctamente.” | Alta UI → listado | **Aprobado** |
| PT01-21 | Código interno duplicado | Automatizada + E2E | Mensaje comprensible asociado al código. | FE 409 → “Ya existe un producto con este código interno.” | Error bajo código | **Aprobado** |
| PT01-22 | Contenido neto inválido | Automatizada | Validación antes o después del envío. | FE rechazo 0 / negativo / >3 decimales; schemas BE | Validación UX + BE | **Aprobado** |
| PT01-23 | Guardar mientras existe una solicitud en curso | Automatizada | Botón en carga y evita envíos duplicados. | FE “Guardando…” disabled; create/edit | Un solo POST/PATCH | **Aprobado** |
| PT01-24 | Consultar listado con productos existentes | Automatizada + Manual | Código, nombre, contenido y presentación legibles. | FE listado/tabla/cards; contador real | Listado legible | **Aprobado** |
| PT01-25 | Abrir producto desde el listado | Automatizada + E2E | Navega a su vista de detalle. | FE navegación listado → detalle | `/productos/{id}` | **Aprobado** |
| PT01-26 | Editar producto desde la interfaz | Automatizada + E2E | Los cambios aparecen correctamente después de guardar. | FE PATCH → detalle + listado actualizados | Datos reflejados sin F5 | **Aprobado** |
| PT01-27 | Visualizar en resolución móvil | Manual / E2E | Se adapta sin depender de tabla horizontal incómoda. | CSS `hidden md:block` / `md:hidden`; validación previa 390/768/1440 (cards móvil, tabla desktop, sin overflow) | Layout responsive OK | **Aprobado** |
| PT01-28 | Error de comunicación con backend | Automatizada | Informa el problema sin perder el estado de forma incorrecta. | FE error listado + reintentar; creación/edición conservan formulario | Mensajes claros, datos preservados | **Aprobado** |
| PT01-29 | Ejecutar pruebas HU12 | Automatizada | Registro, login, sesión y perfil continúan funcionando. | `hu12.auth.test.tsx` dentro de suite FE 46/46 | HU12 OK | **Aprobado** |
| PT01-30 | Ejecutar pruebas RT-01 | Automatizada | Relaciones históricas continúan funcionando. | `tests/test_trazabilidad_historica.py` 7/7 | PR-01…PR-07 PASSED | **Aprobado** |
| PT01-31 | Levantar entorno completo con Docker Compose | Técnica | Frontend, backend y PostgreSQL operativos. | `docker compose ps` + `GET /health` | Tres servicios Up/healthy | **Aprobado** |
| PT01-32 | Ejecutar build del frontend | Técnica | Build termina sin errores. | `npm run build` | Build OK | **Aprobado** |

---

## Conteo por estado

| Estado | Cantidad |
|--------|----------|
| Aprobado | 32 |
| Fallido | 0 |
| Pendiente | 0 |

## Conteo por tipo (clasificación principal)

| Tipo | Casos |
|------|-------|
| Automatizada (sola o combinada) | PT01-01 … PT01-26, PT01-28 … PT01-30 |
| Manual / E2E (aportan valor UI) | PT01-19…26, PT01-27, PT01-28 (UX) |
| Técnica | PT01-09, PT01-10, PT01-17, PT01-18, PT01-31, PT01-32 |

---

## Defectos encontrados

Ningún defecto funcional nuevo durante esta ejecución de T01-09.  
No se requirieron correcciones de código.

**Nota:** el navegador automatizado no estuvo disponible en esta sesión para re-ejecutar capturas responsive; PT01-27 se da por aprobado con evidencia de código (breakpoints) y validación E2E previa en el mismo entorno Docker (390 / 768 / 1440 px).

---

## Conclusión final

HU01 — Gestión de productos cumple el plan **PT01-01 a PT01-32**.  
La funcionalidad está demostrable end-to-end (React ↔ FastAPI ↔ PostgreSQL), con regresión HU12 y RT-01 en verde, build limpio y entorno Docker saludable.  

**Historia lista para merge a `main`.**
