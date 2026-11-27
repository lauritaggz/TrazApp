# HU03 — Gestión de formulación y versiones del producto: resultados de pruebas

**Fecha de ejecución:** 26-11-2026 · **Commit:** `b9a95ce` (rama `main`) · **Ambiente:** local, Python 3.12, backend sobre SQLite en memoria; frontend con Vitest 4.1.11.

HU03 se integró en el Sprint 2 mediante el Pull Request #13, antes de incorporar la integración continua; en ese PR la suite registró 288 pruebas de backend y 218 de frontend aprobadas. Este documento registra una nueva ejecución de sus pruebas sobre el código actual. Los reportes completos están en [`docs/pruebas/reportes/2026-11-26_b9a95ce/`](../pruebas/reportes/2026-11-26_b9a95ce/).

## Resultado por archivo

| Archivo | Pruebas | Aprobadas | Omitidas | Fallidas |
|---|---|---|---|---|
| `backend/tests/test_formulacion_vigente_hu03.py` | 19 | 18 | 1 | 0 |
| `backend/tests/test_gestion_formulacion_hu03.py` | 25 | 25 | 0 | 0 |
| `backend/tests/test_consulta_formulacion_hu03.py` | 12 | 12 | 0 | 0 |
| `backend/tests/test_marcar_version_usada_hu03.py` | 4 | 4 | 0 | 0 |
| `backend/tests/test_formulacion_version_producto_t02_08.py` | 18 | 18 | 0 | 0 |
| `backend/tests/test_producto_formulacion_t02_09.py` | 12 | 12 | 0 | 0 |
| `frontend/src/products/hu03.formulation.test.tsx` | 22 | 22 | 0 | 0 |
| `frontend/src/products/hu03.formulation-history.test.tsx` | 9 | 9 | 0 | 0 |
| `frontend/src/products/hu03.formulation-create-ingredient.test.tsx` | 10 | 10 | 0 | 0 |
| **Total** | **131** | **130** | **1** | **0** |

La prueba omitida, `test_bloqueo_del_producto_serializa_guardados_simultaneos`, usa `SELECT … FOR UPDATE`, que solo existe en PostgreSQL; se ejecuta en el trabajo «Backend (PostgreSQL)» del CI.

## Criterios de aceptación y pruebas que los verifican

| Criterio | Pruebas |
|---|---|
| Agregar ingredientes registrados a la formulación | `test_crea_v1`, `test_crea_v1_vigente_si_el_producto_no_tiene_version` |
| Cantidad y unidad opcionales, siempre juntas | `test_formulacion_valida_con_cantidad_y_unidad`, `test_rechaza_cantidad_sin_unidad`, `test_rechaza_unidad_sin_cantidad` |
| Los ingredientes pertenecen al productor autenticado (caso negativo) | `test_ingrediente_de_otro_productor`, `test_rechaza_ingrediente_de_otro_productor_o_inexistente` |
| Un ingrediente no se repite (caso negativo) | `test_ingrediente_repetido`, `test_rechaza_ingrediente_repetido`, `test_duplicado_ingrediente_misma_version` |
| Un ingrediente desactivado no puede agregarse | `test_ingrediente_inactivo`, `test_ingrediente_desactivado_en_la_vigente` |
| Sin uso, la formulación se modifica sin nueva versión | `test_modifica_en_el_lugar`, `test_modifica_en_el_lugar_si_la_vigente_no_esta_usada` |
| Con uso, modificarla crea una nueva versión vigente | `test_crea_nueva_version_si_la_vigente_esta_usada` (servicio y API) |
| Nunca hay dos versiones vigentes | `test_nunca_quedan_dos_versiones_vigentes`, `test_conflicto_de_numero_de_version_revierte_todo` |
| Las versiones anteriores no se modifican ni eliminan | `test_version_anterior_no_se_puede_modificar_ni_eliminar`, `test_version_anterior_se_consulta_intacta`, `test_snapshot_conserva_datos_originales` |
| Consultar la formulación vigente y las anteriores | `test_producto_con_una_version`, `test_producto_con_varias_versiones` |
| Un producto sin formulación no puede elaborarse | `test_producto_sin_formulacion_no_tiene_version_para_elaborar` |
| Reordenar o reenviar lo mismo no es un cambio de receta | `test_reordenar_no_es_cambio_de_receta`, `test_contenido_identico_no_hace_nada`, `test_reenviar_las_mismas_cantidades_no_crea_version` |
| Solo con sesión iniciada y sobre productos propios | `test_rechaza_sin_token`, `test_rechaza_token_invalido`, `test_producto_ajeno` |

## Qué significa

La regla central de OE1 se cumple: una formulación ya utilizada nunca se modifica, sino que genera una nueva versión, y las versiones anteriores se conservan intactas. Los cambios que no alteran la receta (reordenar o reenviar el mismo contenido) no crean versiones innecesarias.
