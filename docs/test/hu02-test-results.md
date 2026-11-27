# HU02 — Gestión de ingredientes y composición: resultados de pruebas

**Fecha de ejecución:** 26-11-2026 · **Commit:** `b9a95ce` (rama `main`) · **Ambiente:** local, Python 3.12, backend sobre SQLite en memoria; frontend con Vitest 4.1.11.

HU02 se desarrolló en el Sprint 1 y se integró directamente a `main`, sin Pull Request (commits `HU02-T07` a `HU02-T09`). Este documento registra una nueva ejecución de sus pruebas sobre el código actual. Los reportes completos están en [`docs/pruebas/reportes/2026-11-26_b9a95ce/`](../pruebas/reportes/2026-11-26_b9a95ce/).

## Resultado por archivo

| Archivo | Pruebas | Aprobadas | Omitidas | Fallidas |
|---|---|---|---|---|
| `backend/tests/test_gestion_ingredientes.py` | 27 | 27 | 0 | 0 |
| `backend/tests/test_ingrediente_alergenos_hu02.py` | 10 | 10 | 0 | 0 |
| `backend/tests/test_ingrediente_composicion_hu02.py` | 15 | 15 | 0 | 0 |
| `backend/tests/test_ingrediente_model_hu02.py` | 6 | 6 | 0 | 0 |
| `backend/tests/test_ingrediente_tipo_hu02.py` | 13 | 13 | 0 | 0 |
| `frontend/src/ingredients/hu02.ingredients.test.tsx` | 15 | 15 | 0 | 0 |
| `frontend/src/dashboard/hu02.dashboard.test.tsx` | 17 | 17 | 0 | 0 |
| **Total** | **103** | **103** | **0** | **0** |

## Criterios de aceptación y pruebas que los verifican

| Criterio | Pruebas |
|---|---|
| Registrar ingredientes simples y compuestos | `test_crear_ingrediente_simple_correctamente`, `test_crear_ingrediente_compuesto_correctamente` |
| Listar y ver el detalle | `test_productor_lista_unicamente_sus_propios_ingredientes`, `test_productor_consulta_detalle_de_su_ingrediente` |
| Modificar un ingrediente | `test_actualizacion_parcial_de_ingrediente`, `test_actualizar_de_simple_a_compuesto` |
| Un compuesto contiene otros componentes declarados | `test_crear_composicion_valida`, `test_consultar_composicion`, `test_modificar_composicion` |
| Componentes inválidos se rechazan (caso negativo) | `test_autorreferencia_devuelve_error`, `test_ciclo_composicion_directo_devuelve_error`, `test_ciclo_composicion_indirecto_devuelve_error`, `test_componente_duplicado_rechazado`, `test_componente_inactivo_rechazado` |
| Alérgenos asociados al ingrediente | `test_agregar_alergeno_valido`, `test_rechazar_asociacion_duplicada`, `test_rechazar_alergeno_inexistente` |
| Desactivar un ingrediente que ya no se usa | `test_desactivar_ingrediente_propio_marca_inactivo`, `test_desactivar_desaparece_del_listado_y_get_devuelve_404` |
| Un desactivado no queda disponible para nuevas asociaciones | `test_componente_inactivo_rechazado`, `test_ingrediente_inactivo_devuelve_error` |
| La desactivación no elimina información histórica | `test_desactivar_mantiene_version_ingrediente_existente`, `test_rt01_sigue_funcionando_con_composicion_hu02` |
| Aislamiento entre productores (caso negativo) | `test_acceso_a_ingrediente_ajeno_devuelve_404`, `test_patch_ingrediente_ajeno_devuelve_404`, `test_aislamiento_entre_productores`, `test_aislamiento_por_productor_en_composicion` |
| Solo con sesión iniciada | `test_sin_autenticacion_devuelve_401`, `test_rutas_gestion_requieren_autenticacion` |

## Qué significa

Las reglas de HU02 se cumplen sobre el código actual, incluidas las validaciones de composición (ciclos, autorreferencia y componentes inactivos) y el aislamiento entre productores. La compatibilidad con el prototipo de RT-01 se mantiene: las pruebas `test_rt01_*` siguen aprobadas.
