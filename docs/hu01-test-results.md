# HU01 — Resultados de pruebas (T01-16)

**Fecha:** 2026-08-28
**Versión / rama:** `feature/hu01-product-refinement`
**HEAD:** `009f749`
**Entorno:** Docker Compose (frontend + backend + PostgreSQL)
**Plan de referencia:** `docs/Plan de pruebas HU01.pdf` (PT01-01 … PT01-32) + extensiones T01-10 … T01-15
**Total de casos:** 46 (32 originales + 14 extensiones por refinamiento HU01)

---

## Resumen de ejecución automatizada

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Frontend HU01 + utilidades | `npm test -- --run` | **66/66** aprobadas (`hu01.products` 45, `hu12.auth` 15, `productImageUtils` 3, `productListUtils` 3) |
| Backend | `docker compose exec backend pytest -q` | **117/117** aprobadas |
| RT-01 | `pytest tests/test_trazabilidad_historica.py` | **7/7** (PR-01 … PR-07) aprobadas |
| Build | `npm run build` | Aprobado |
| Docker Compose | `docker compose ps` | frontend Up, backend Up, database Up (healthy) |
| Health | `GET http://localhost:8000/health` | `{"status":"ok","app":"TrazApp","environment":"development","database":"ok"}` |
| Alembic | `alembic current` | `007_seed_categorias_producto (head)` |
| Diff | `git diff --check` | Limpio |

---

## Resumen frontend

- Suite Vitest: autenticación HU12, listado/búsqueda/filtros/orden, creación, detalle, edición, categorías, costo/precio, imagen, eliminación lógica, errores 409/404/red, estados loading/vacío.
- Build Vite/TypeScript sin errores.
- Feedback UI: “Producto creado correctamente.” / “Producto actualizado correctamente.” / “Producto eliminado correctamente.”
- Formulario y detalle organizados en secciones (información general, clasificación, comercial, imagen, acciones).

## Resumen backend

- Schemas extendidos (`categoria_ids`, `costo_produccion`, `precio_venta`, `imagen_url`).
- API autenticada `POST/GET/PATCH/DELETE /gestion/productos`, `POST …/imagen`, `GET /gestion/categorias`.
- Eliminación lógica (`activo = false`); inactivos excluidos de listado y operaciones normales.
- Imágenes en `/uploads/products` (volumen Docker `product_uploads`).
- Aislamiento por productor, duplicados 409, sin `VersionProducto` en create/edit/imagen/delete.

## RT-01

PR-01 … PR-07 **PASSED** — relaciones históricas intactas tras cambios HU01.

## Docker

| Servicio | Estado |
|----------|--------|
| trazapp-frontend | Up (`:5173`) |
| trazapp-backend | Up (`:8000`) |
| trazapp-database | Up (healthy) |
| Volumen `product_uploads` | Montado en `/uploads` |

## Build

`npm run build` finalizó correctamente (`tsc -b && vite build`).

---

## Verificación manual de flujos principales (T01-16)

| Flujo | Método | Resultado |
|-------|--------|-----------|
| Crear producto completo (datos + categorías + costo/precio + imagen) | E2E automatizado + revisión UI | **Aprobado** — secciones del formulario, creación → upload imagen |
| Listar y consultar | Automatizado + layout | **Aprobado** — miniatura/código/categorías ordenados; sin costo/precio en listado |
| Editar datos generales | Automatizado | **Aprobado** |
| Imagen: subir, reemplazar, validar | Automatizado BE/FE | **Aprobado** |
| Categorías múltiples / quitar todas | Automatizado BE/FE | **Aprobado** |
| Costo/precio opcionales, edición y limpieza | Automatizado BE/FE | **Aprobado** — “No informado” en detalle |
| Eliminar con confirmación | Automatizado FE + BE | **Aprobado** — conserva histórico, desaparece del catálogo |
| Responsive básico (tabla desktop / cards móvil) | Revisión CSS + tests previos | **Aprobado** — `hidden md:block` / `md:hidden`, formulario en grid responsive |

---

## Resultados PT01-01 … PT01-32 (plan original)

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|----|------|------|-------------------|-----------|-------------------|--------|
| PT01-01 | Registrar un producto con todos los campos válidos | Automatizada | Se crea correctamente y queda asociado al productor autenticado. | `test_productor_autenticado_crea_producto_valido` | Producto creado con `productor_id` del JWT | **Aprobado** |
| PT01-02 | Registrar producto sin código interno | Automatizada | Solicitud rechazada. | Schema + FE `validateProductForm` | Rechazo schema/FE | **Aprobado** |
| PT01-03 | Registrar producto sin nombre | Automatizada | Solicitud rechazada. | `test_nombre_vacio…`; FE | Rechazo ValidationError / mensaje FE | **Aprobado** |
| PT01-04 | Registrar producto sin descripción | Automatizada | Solicitud rechazada. | `test_descripcion_vacia…`; FE | Rechazo | **Aprobado** |
| PT01-05 | Registrar producto sin contenido neto | Automatizada | Solicitud rechazada. | Schema + FE | Rechazo | **Aprobado** |
| PT01-06 | Registrar contenido neto ≤ 0 | Automatizada | Solicitud rechazada. | `test_contenido_neto_cero…`, `…negativo…`; FE | Rechazo > 0 | **Aprobado** |
| PT01-07 | Registrar una unidad no permitida | Automatizada | Solicitud rechazada. | `test_unidad_medida_invalida…`; select FE | Solo g/kg/ml/L/unidad | **Aprobado** |
| PT01-08 | Código interno repetido (mismo productor) | Automatizada | Operación rechazada. | `test_mismo_productor_no_puede_repetir_codigo_interno` | 409 | **Aprobado** |
| PT01-09 | Mismo código, productores distintos | Automatizada + Técnica | Ambos productos pueden existir. | `test_dos_productores_pueden_usar_mismo_codigo_interno` | Coexisten | **Aprobado** |
| PT01-10 | Mismo nombre, códigos distintos | Automatizada + Técnica | Ambos productos pueden existir. | Schema sin unique en `nombre` | Permitido | **Aprobado** |
| PT01-11 | Listar productos | Automatizada | Solo productos del productor autenticado. | `test_productor_lista_unicamente_sus_propios_productos`; FE | Listado aislado | **Aprobado** |
| PT01-12 | Consultar producto propio | Automatizada | Información correcta. | `test_productor_consulta_producto_propio`; FE detalle | GET 200 | **Aprobado** |
| PT01-13 | Consultar producto de otro productor | Automatizada + E2E | No accesible. | `test_producto_de_otro_productor_devuelve_404`; FE | 404 / UI | **Aprobado** |
| PT01-14 | Editar datos generales | Automatizada | Actualiza manteniendo `id`. | `test_patch_parcial…`; FE PATCH | Mismo `id` | **Aprobado** |
| PT01-15 | Código duplicado en edición | Automatizada | Operación rechazada. | `test_patch_codigo_duplicado…`; FE 409 | 409 | **Aprobado** |
| PT01-16 | Editar producto ajeno | Automatizada | Operación rechazada. | PATCH 404 | 404 | **Aprobado** |
| PT01-17 | Crear sin VersionProducto | Automatizada + Técnica | No genera versión. | `test_creacion_y_edicion_no_generan_version_producto` | `versions = 0` | **Aprobado** |
| PT01-18 | Editar sin VersionProducto | Automatizada + Técnica | No genera versión. | Mismo test + DB | Sin versiones nuevas | **Aprobado** |
| PT01-19 | Estado vacío sin productos | Automatizada | Empty state + CTA. | FE `muestra estado vacío…` | CTA visible | **Aprobado** |
| PT01-20 | Registrar desde interfaz | Automatizada + E2E | Validación + confirmación. | FE creación | Alta → listado | **Aprobado** |
| PT01-21 | Código duplicado en UI | Automatizada + E2E | Mensaje bajo código. | FE 409 | Mensaje claro | **Aprobado** |
| PT01-22 | Contenido neto inválido | Automatizada | Validación FE/BE. | FE + schemas | Rechazo | **Aprobado** |
| PT01-23 | Evitar doble envío | Automatizada | Botón “Guardando…” disabled. | FE create/edit | Un solo POST/PATCH | **Aprobado** |
| PT01-24 | Listado legible | Automatizada + Manual | Código, nombre, contenido, presentación. | FE tabla/cards | Legible + miniatura | **Aprobado** |
| PT01-25 | Abrir desde listado | Automatizada + E2E | Navega a detalle. | FE navegación | `/productos/{id}` | **Aprobado** |
| PT01-26 | Editar desde interfaz | Automatizada + E2E | Cambios reflejados. | FE PATCH → detalle/listado | Sin F5 | **Aprobado** |
| PT01-27 | Resolución móvil | Manual / E2E | Cards móvil, tabla desktop. | CSS breakpoints | Layout responsive | **Aprobado** |
| PT01-28 | Error de comunicación | Automatizada | Mensaje + conserva formulario. | FE error/reintentar | Datos preservados | **Aprobado** |
| PT01-29 | Regresión HU12 | Automatizada | Auth intacta. | `hu12.auth.test.tsx` 15/15 | HU12 OK | **Aprobado** |
| PT01-30 | Regresión RT-01 | Automatizada | Histórico intacto. | `test_trazabilidad_historica.py` 7/7 | PR-01…07 OK | **Aprobado** |
| PT01-31 | Docker Compose operativo | Técnica | Tres servicios Up. | `docker compose ps` + health | Healthy | **Aprobado** |
| PT01-32 | Build frontend | Técnica | Sin errores. | `npm run build` | Build OK | **Aprobado** |

---

## Extensiones PT01-33 … PT01-46 (T01-10 … T01-15)

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|----|------|------|-------------------|-----------|-------------------|--------|
| PT01-33 | Listar categorías autenticado | Automatizada | Catálogo ordenado. | `test_listar_categorias_*`; FE `listCategories` | 6 categorías seed | **Aprobado** |
| PT01-34 | Asignar múltiples categorías al crear | Automatizada | `categoria_ids` persistidos. | `test_producto_con_costo_precio_imagen_y_categorias`; FE creación | N categorías en respuesta | **Aprobado** |
| PT01-35 | Editar y quitar categorías | Automatizada | PATCH actualiza o vacía lista. | `test_patch_actualiza_categorias`, `test_patch_quitar_todas_las_categorias`; FE edición | `categoria_ids: []` OK | **Aprobado** |
| PT01-36 | Costo/precio opcionales al crear | Automatizada | `null` si no se informan. | `test_producto_sin_categorias_devuelve_lista_vacia`; FE | Campos opcionales | **Aprobado** |
| PT01-37 | Editar y limpiar costo/precio | Automatizada | PATCH con `null`. | `test_patch_permite_null_en_costo_precio_e_imagen`; FE | Valores null en DB | **Aprobado** |
| PT01-38 | Costo/precio negativos rechazados | Automatizada | Validación FE. | FE `rechaza costo y precio negativos` | Sin llamada API | **Aprobado** |
| PT01-39 | Subir imagen válida | Automatizada | `imagen_url` + archivo en disco. | `test_subir_imagen_valida…`; FE crear con imagen | Upload post-creación | **Aprobado** |
| PT01-40 | Reemplazar imagen | Automatizada | Nueva URL; borra archivo anterior. | `test_reemplazar_imagen…`; FE edición imagen | Reemplazo OK | **Aprobado** |
| PT01-41 | Imagen formato/tamaño inválido | Automatizada | 422 BE / mensaje FE. | `test_formato_invalido…`, `test_imagen_mayor_a_5mb…`; `productImageUtils.test` | Rechazo claro | **Aprobado** |
| PT01-42 | Imagen producto ajeno/inexistente | Automatizada | 404. | `test_producto_inexistente…`, `test_producto_de_otro_productor…` (imagen) | 404 | **Aprobado** |
| PT01-43 | Imagen no genera VersionProducto | Automatizada + Técnica | Sin versión nueva. | `test_subir_imagen_no_genera_version_producto` | `versions = 0` | **Aprobado** |
| PT01-44 | Eliminar producto propio (lógico) | Automatizada | `activo = false`, 204. | `test_eliminar_producto_propio_marca_inactivo` | Sin DELETE físico | **Aprobado** |
| PT01-45 | Eliminar ajeno/inexistente | Automatizada | 404. | `test_eliminar_producto_inexistente…`, `test_eliminar_producto_de_otro_productor…` | 404 | **Aprobado** |
| PT01-46 | Inactivo fuera de operaciones normales | Automatizada + Técnica | No en listado ni GET; histórico conservado. | `test_eliminar_desaparece_del_listado…`, `test_eliminar_mantiene_version_producto_existente`, `test_eliminar_no_afecta_otros_productos` | DB conserva fila y versiones | **Aprobado** |

---

## Conteo por estado

| Estado | Cantidad |
|--------|----------|
| Aprobado | 46 |
| Fallido | 0 |
| Pendiente | 0 |

## Conteo por tipo (clasificación principal)

| Tipo | Casos |
|------|-------|
| Automatizada (sola o combinada) | PT01-01 … PT01-26, PT01-28 … PT01-30, PT01-33 … PT01-46 |
| Manual / E2E (aportan valor UI) | PT01-19 … PT01-27, flujos T01-16 |
| Técnica | PT01-09, PT01-10, PT01-17, PT01-18, PT01-31, PT01-32, PT01-43, PT01-46 |

---

## Defectos encontrados

1. **Test flaky en eliminación (corregido en T01-16):** `confirmar eliminación vuelve al listado con mensaje de éxito` usaba `getByText` síncrono para el mensaje de éxito; se cambió a `findByText` para esperar el efecto de navegación. Archivo: `frontend/src/products/hu01.products.test.tsx`.

No se detectaron defectos funcionales abiertos en HU01 tras la corrección.

**Nota:** verificación responsive en navegador real no re-ejecutada en esta sesión; se valida por breakpoints CSS (`md:hidden` / `hidden md:block`) y regresión E2E automatizada.

---

## Conclusión final

HU01 — Gestión de productos **cumple el plan ampliado PT01-01 a PT01-46**, incluyendo categorías, costo/precio, imagen principal, eliminación lógica y refinamiento UX (T01-15).

La funcionalidad está demostrable end-to-end (React ↔ FastAPI ↔ PostgreSQL ↔ volumen de uploads), con regresión HU12 y RT-01 en verde, **117** tests backend, **66** tests frontend, build limpio y entorno Docker saludable en migración `007`.

**Historia HU01 lista para merge a `main`.**
