# HU05 — Resultados de pruebas (T05-09)

**Fecha:** 2026-10-07
**Rama:** `feature/hu05-elaboracion`
**HEAD al ejecutar:** `4e0671f`
**Plan de referencia:** PT05-01 … PT05-18 (Contexto del Sprint 2, sección 7)
**Entorno:** backend con Python 3.13 sobre SQLite en memoria y sobre PostgreSQL 16 (contenedor `trazapp-database`, base aislada `trazapp_test`); frontend con Vitest y Vite (Node local). Migraciones aplicadas en `trazapp`: `015_elaboraciones_hu05` y `016_elaboracion_inmutable_hu05`.

---

## Resumen de ejecución

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Backend, SQLite | `python -m pytest -q` (sin `TEST_DATABASE_URL`) | 770 aprobadas, 133 omitidas, 0 fallos (6 min 55 s) |
| Backend, PostgreSQL | `python -m pytest -q` (con `TEST_DATABASE_URL` → `trazapp_test`) | 903 aprobadas, 0 omitidas, 0 fallos (17 min 24 s) |
| Frontend | `npx vitest run` | 20 archivos, 452 pruebas aprobadas, 0 fallos |
| Build | `npm run build` | correcto (`tsc -b` + `vite build`) |
| Type check | `npx tsc -b` | sin errores |

Las pruebas omitidas en SQLite son las que exigen PostgreSQL (migraciones, triggers, claves foráneas, bloqueos de fila y conexiones simultáneas); se ejecutan en la corrida de PostgreSQL, donde no hay ninguna omitida. Los triggers solo existen en PostgreSQL: en SQLite la inmutabilidad la garantiza el servicio y la base de pruebas de PostgreSQL verifica los triggers.

Pruebas propias de HU05: backend 333 (en PostgreSQL; 14 archivos), frontend 122 (109 de pantallas en `hu05.elaboraciones.test.tsx` y 13 de la consolidación de alérgenos y el formato de fecha).

---

## Archivos de prueba (leyenda de la tabla)

| Clave | Archivo | Qué cubre |
|-------|---------|-----------|
| **B1** | `backend/tests/test_gestion_elaboraciones_hu05.py` | API del borrador: crear, código sugerido, detalle y listado (T05-02) |
| **B2** | `backend/tests/test_elaboracion_formulacion_hu05.py` | Elaboraciones y versiones de la formulación (T05-02) |
| **B3** | `backend/tests/test_gestion_usos_elaboracion_hu05.py` | Asignación de insumos y lotes, y lotes de un insumo (T05-03) |
| **B4** | `backend/tests/test_finalizacion_elaboracion_hu05.py` | Finalización, información conservada y detalle (T05-04) |
| **B5** | `backend/tests/test_gestion_elaboraciones_edicion_hu05.py` | Modificar y eliminar borradores; finalizadas inmutables (T05-05) |
| **B6** | `backend/tests/test_elaboracion_model_hu05.py` | Modelos `Elaboracion`, `LoteInsumo` y `UsoInsumo` (T05-01) |
| **B7** | `backend/tests/test_persistencia_elaboraciones_hu05.py` | Persistencia y concurrencia de la creación (T05-02) |
| **B8** | `backend/tests/test_persistencia_usos_elaboracion_hu05.py` | Persistencia y concurrencia de la asignación (T05-03) |
| **B9** | `backend/tests/test_persistencia_finalizacion_hu05.py` | Persistencia, atomicidad y concurrencia de la finalización (T05-04) |
| **B10** | `backend/tests/test_persistencia_edicion_elaboracion_hu05.py` | Persistencia de editar y eliminar; el trigger rechaza y el servicio responde 409 (T05-05) |
| **B11** | `backend/tests/test_triggers_elaboracion_hu05.py` | Triggers de inmutabilidad en SQL directo (solo PostgreSQL, T05-05) |
| **B12** | `backend/tests/test_migracion_015_elaboraciones.py` | Migración 015 (solo PostgreSQL) |
| **B13** | `backend/tests/test_migracion_016_elaboracion_inmutable.py` | Migración 016, incluido el rol sin superusuario (solo PostgreSQL) |
| **B14** | `backend/tests/test_formulacion_vigente_hu03.py` | Formulación vigente (HU03) |
| **B15** | `backend/tests/test_gestion_insumos_hu04.py` y `backend/tests/test_persistencia_insumos_hu04.py` | Alta de insumos de HU04, que reutiliza el diálogo de T05-08 |
| **F1** | `frontend/src/elaboraciones/hu05.elaboraciones.test.tsx` | Interfaz: producto, diálogo de creación, registro, finalización, insumo nuevo y detalle |
| **F2** | `frontend/src/lib/alergenosResumen.test.ts` | Consolidación de alérgenos y formato de la fecha de conservación |

`backend/tests/escenario_hu05.py` es un módulo de apoyo (helpers y utilidades de concurrencia), no contiene pruebas.

---

## Trazabilidad PT05-01 … PT05-18

Los nombres entre comillas invertidas son los de las pruebas (`def test_…` en el backend; el título del `it(...)` en el frontend). «—» indica que el caso no tiene componente en esa capa y por qué.

### PT05-01 — Crear una elaboración de un producto con formulación
**Esperado:** se crea un borrador asociado a la versión vigente, con los ingredientes de la formulación y un código sugerido.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pt05_01_crea_un_borrador_asociado_a_la_version_vigente`, `test_la_version_queda_marcada_como_usada_al_crear_la_elaboracion`, `test_se_crea_un_uso_por_cada_ingrediente_de_la_version`, `test_el_detalle_muestra_la_cantidad_y_unidad_de_la_formulacion`, `test_sin_codigo_se_asigna_el_sugerido` · B6: `test_registra_una_elaboracion_en_borrador_con_los_datos_obligatorios` · B7: `test_crear_un_borrador_persiste_la_elaboracion_sus_usos_y_la_marca_de_la_version`, `test_si_la_creacion_falla_a_mitad_no_persiste_nada` |
| Frontend | F1: `al confirmar crea el borrador con el código y la fecha y abre la pantalla de registro`, `muestra el producto, la versión, el código precargado y la fecha`, `lista las elaboraciones más recientes con código, fecha y estado, y enlaza cada una` |

**Estado:** cubierto (automatizado).

### PT05-02 — Crear una elaboración de un producto sin formulación
**Esperado:** el sistema impide el registro.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pt05_02_un_producto_sin_formulacion_no_admite_elaboraciones` · B14: `test_producto_sin_formulacion_no_tiene_version_para_elaborar` |
| Frontend | F1: `sin formulación no ofrece el botón y lo explica`, `muestra «Registrar elaboración» solo si el producto tiene formulación`, `un producto sin formulación se informa dentro del diálogo` |

**Estado:** cubierto (automatizado). Cierra PT03-13.

### PT05-03 — Registrar un código de elaboración repetido para el mismo producto
**Esperado:** el sistema rechaza la operación.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pt05_03_un_codigo_repetido_en_el_mismo_producto_se_rechaza`, `test_pt05_03_el_codigo_repetido_se_detecta_sin_distinguir_mayusculas`, `test_el_mismo_codigo_en_otro_producto_se_permite`, `test_un_codigo_vacio_o_demasiado_largo_responde_422` · B5: `test_el_codigo_de_otra_elaboracion_del_producto_responde_409_con_sugerido` · B6: `test_codigo_repetido_en_el_mismo_producto_se_rechaza`, `test_el_codigo_repetido_se_detecta_sin_distinguir_mayusculas` · B7: `test_un_codigo_repetido_no_deja_filas_a_medias`, `test_la_base_respalda_la_unicidad_del_codigo_si_la_comprobacion_previa_no_la_ve`, `test_dos_creaciones_simultaneas_con_el_mismo_codigo_solo_una_gana`, `test_dos_creaciones_simultaneas_sin_codigo_reciben_codigos_distintos` · B12: `test_el_codigo_de_elaboracion_es_unico_por_producto_sin_distinguir_mayusculas` |
| Frontend | F1: `un código repetido se muestra dentro del diálogo con su sugerido y se puede corregir`, `un código repetido se marca en el campo con el código sugerido`, `no crea con el código vacío ni con una fecha futura` |

**Estado:** cubierto (automatizado).

### PT05-04 — Crear una elaboración de un ingrediente con insumo habitual
**Esperado:** el insumo habitual queda preseleccionado y puede cambiarse.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pt05_04_el_insumo_habitual_activo_queda_preseleccionado`, `test_un_ingrediente_sin_insumos_activos_queda_pendiente`, `test_sin_habitual_no_se_preselecciona_aunque_haya_un_solo_insumo`, `test_un_habitual_desactivado_no_se_preselecciona`, `test_el_habitual_de_otro_productor_no_se_preselecciona` · B3: `test_cambiar_el_insumo_de_un_ingrediente_sin_indicar_lote_deja_el_lote_pendiente` |
| Frontend | F1: `una línea por ingrediente, con el insumo habitual preseleccionado`, `cambiar el insumo reinicia el lote de la línea`, `el selector muestra la presentación junto al nombre, para distinguir formatos` |

**Estado:** cubierto (automatizado).

### PT05-05 — Asignar un insumo con lote nuevo
**Esperado:** el lote queda registrado y asociado al uso del insumo.

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_pt05_05_asignar_un_insumo_con_lote_nuevo_registra_el_lote_asociado_al_uso`, `test_el_vencimiento_del_lote_es_opcional_y_el_codigo_se_guarda_recortado`, `test_el_mismo_codigo_de_lote_se_permite_en_otro_insumo`, `test_un_lote_nuevo_con_un_codigo_existente_responde_409_para_ofrecer_usar_el_lote` · B6: `test_registra_un_lote_con_su_vencimiento_opcional`, `test_codigo_de_lote_repetido_para_el_mismo_insumo_se_rechaza_sin_distinguir_mayusculas` · B8: `test_asignar_con_lote_nuevo_persiste_el_lote_y_el_uso`, `test_dos_asignaciones_simultaneas_del_mismo_lote_nuevo_solo_una_lo_crea` |
| Frontend | F1: `lote nuevo: pide código y vencimiento opcional y guarda la asignación completa`, `un lote nuevo sin código no se envía y se marca en su línea` |

**Estado:** cubierto (automatizado).

### PT05-06 — Asignar un insumo reutilizando un lote existente
**Esperado:** se reutiliza el lote sin duplicarlo.

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_pt05_06_reutilizar_un_lote_existente_no_lo_duplica`, `test_se_puede_reenviar_el_mismo_lote_ya_asignado`, `test_el_listado_de_lotes_de_un_insumo`, `test_el_listado_de_lotes_solo_incluye_los_del_insumo`, `test_un_lote_de_otro_insumo_responde_422` · B8: `test_reutilizar_un_lote_persiste_la_referencia_sin_duplicarlo` |
| Frontend | F1: `lote existente: ofrece los lotes del insumo y guarda el elegido`, `lote existente sin lotes registrados lo explica`, `«Usar este lote»: el lote nuevo ya existe, así que la línea pasa a ese lote existente` |

**Estado:** cubierto (automatizado).

### PT05-07 — Asignar un insumo indicando que no tiene lote
**Esperado:** el uso del insumo queda registrado sin lote.

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_pt05_07_un_insumo_sin_lote_queda_registrado_sin_lote_y_sigue_identificable`, `test_pasar_de_un_lote_a_sin_lote_y_de_vuelta_actualiza_ambos_campos` · B6: `test_un_insumo_sin_lote_sigue_siendo_identificable`, `test_sin_lote_excluye_un_lote` · B8: `test_asignar_sin_lote_persiste_el_indicador_y_el_insumo` · B12: `test_sin_lote_excluye_un_lote_y_un_lote_exige_insumo` |
| Frontend | F1: `sin lote: guarda el indicador y la línea queda completa` |

**Estado:** cubierto (automatizado).

### PT05-08 — Modificar y eliminar una elaboración en borrador
**Esperado:** los cambios se aplican correctamente.

| Capa | Pruebas |
|------|---------|
| Backend | B5: `test_pt05_08_modificar_el_codigo_y_la_fecha_de_un_borrador`, `test_se_puede_modificar_solo_una_parte`, `test_una_modificacion_con_un_campo_invalido_no_aplica_el_otro`, `test_pt05_08_eliminar_un_borrador_borra_la_elaboracion_y_sus_usos`, `test_eliminar_un_borrador_conserva_los_lotes_la_version_y_el_resto`, `test_eliminar_un_borrador_no_afecta_a_las_otras_elaboraciones`, `test_el_codigo_de_un_borrador_eliminado_se_puede_volver_a_usar` · B3: `test_la_asignacion_reemplaza_la_anterior_por_completo`, `test_el_avance_parcial_deja_pendiente_lo_que_falta` · B10: `test_modificar_un_borrador_persiste_el_codigo_y_la_fecha`, `test_una_modificacion_rechazada_no_persiste_nada`, `test_eliminar_un_borrador_persiste_la_baja_de_la_elaboracion_y_de_sus_usos` · B11: `test_un_borrador_se_puede_modificar_y_sus_usos_cambiar`, `test_un_borrador_se_puede_eliminar_con_sus_usos` |
| Frontend | F1: `guarda el encabezado (solo lo que cambió) y después la asignación`, `tras guardar ya no hay cambios sin guardar`, `pide confirmación y no elimina si se cancela`, `al confirmar elimina y vuelve al producto con un aviso` |

**Estado:** cubierto (automatizado).

### PT05-09 — Finalizar una elaboración con ingredientes sin insumo asignado
**Esperado:** el sistema impide la finalización e indica los ingredientes pendientes.

| Capa | Pruebas |
|------|---------|
| Backend | B4: `test_pt05_09_una_elaboracion_sin_asignar_indica_los_ingredientes_pendientes`, `test_pt05_09_falta_el_insumo`, `test_pt05_09_falta_el_lote_o_la_indicacion_de_sin_lote`, `test_pt05_09_el_insumo_asignado_se_desactivo`, `test_pt05_09_el_ingrediente_se_desactivo`, `test_pt05_09_los_problemas_se_informan_todos_y_en_el_orden_de_la_formulacion`, `test_un_ingrediente_desactivado_y_sin_insumo_informa_ambos_problemas`, `test_corregir_los_problemas_permite_finalizar` · B9: `test_no_se_finaliza_nada_si_la_validacion_falla` · B10: `test_si_el_servicio_dejara_finalizar_sin_copias_el_trigger_lo_rechaza_con_409` · B11: `test_pasar_a_finalizada_sin_copias_falla_y_la_elaboracion_sigue_en_borrador`, `test_pasar_a_finalizada_con_un_uso_sin_insumo_falla` |
| Frontend | F1: `con líneas pendientes marca cada una con su motivo, sin pedir confirmación`, `el 409 con problemas del servidor marca cada línea afectada con su motivo`, `los cuatro motivos de problema se distinguen por línea` |

**Estado:** cubierto (automatizado). Los cuatro tipos de problema son `insumo`, `lote`, `insumo_desactivado` e `ingrediente_desactivado`.

### PT05-10 — Finalizar una elaboración completa
**Esperado:** se solicita confirmación, se conserva la copia de la información de los insumos y el estado cambia a finalizada.

| Capa | Pruebas |
|------|---------|
| Backend | B4: `test_pt05_10_finaliza_una_elaboracion_completa_y_cambia_el_estado`, `test_la_informacion_conservada_tiene_la_estructura_aprobada`, `test_la_copia_no_incluye_la_ficha_cruda_de_la_fuente`, `test_un_insumo_sin_lote_conserva_el_indicador_y_sigue_identificable`, `test_los_alergenos_se_conservan_con_su_tipo_y_en_el_orden_de_ordenar_declarados`, `test_finalizar_no_altera_el_insumo_el_lote_ni_la_version`, `test_finalizar_dos_veces_responde_409_y_no_cambia_la_copia`, `test_el_listado_muestra_la_elaboracion_finalizada` · B9: `test_finalizar_persiste_el_estado_la_fecha_y_el_json_completo_de_cada_uso`, `test_una_falla_a_mitad_de_la_copia_deja_el_borrador_intacto`, `test_el_estado_se_cambia_despues_de_escribir_las_copias` · B11: `test_pasar_a_finalizada_con_todo_completo_funciona`, `test_las_copias_y_el_estado_en_una_misma_transaccion_funcionan_y_al_reves_no` |
| Frontend | F1: `PT05-17: pide confirmación con el texto de advertencia antes de finalizar`, `cancelar la confirmación no finaliza`, `al confirmar finaliza y navega al detalle de la elaboración`, `si hay cambios sin guardar, los guarda antes de finalizar`, `si el guardado previo falla, no pide confirmación ni finaliza` |

**Estado:** cubierto (automatizado).

### PT05-11 — Intentar modificar o eliminar una elaboración finalizada
**Esperado:** el sistema rechaza la operación.

| Capa | Pruebas |
|------|---------|
| Backend (servicio) | B5: `test_pt05_11_modificar_una_finalizada_responde_409_y_no_cambia_nada`, `test_pt05_11_eliminar_una_finalizada_responde_409_y_conserva_todo`, `test_una_modificacion_invalida_sobre_una_finalizada_responde_409_antes_que_validar`, `test_pt05_11_las_demas_escrituras_sobre_una_finalizada_tambien_responden_409`, `test_modificar_o_eliminar_la_finalizada_no_toca_a_las_demas` · B3: `test_una_elaboracion_finalizada_no_admite_cambios` · B10: `test_modificar_o_eliminar_una_finalizada_deja_la_base_exactamente_igual` |
| Backend (base de datos) | B10: `test_si_el_servicio_dejara_pasar_una_modificacion_el_trigger_la_rechaza_con_409`, `test_si_el_servicio_dejara_pasar_una_eliminacion_el_trigger_la_rechaza_con_409`, `test_si_el_servicio_dejara_pasar_un_cambio_de_asignacion_el_trigger_lo_rechaza_con_409`, `test_si_el_servicio_dejara_finalizar_de_nuevo_el_trigger_lo_rechaza_con_409` · B11: `test_un_update_sobre_una_elaboracion_finalizada_falla`, `test_un_delete_sobre_una_elaboracion_finalizada_falla_y_conserva_sus_usos`, `test_un_delete_masivo_que_incluye_una_finalizada_falla_completo`, `test_un_update_sobre_los_usos_de_una_finalizada_falla`, `test_un_insert_de_un_uso_en_una_finalizada_falla`, `test_un_delete_de_un_uso_de_una_finalizada_falla`, `test_un_uso_no_se_puede_mover_a_o_desde_una_finalizada`, `test_un_insert_con_estado_finalizada_falla` · B13: `test_las_reglas_se_cumplen_con_el_esquema_de_la_migracion` |
| Frontend | F1: `una elaboración finalizada no tiene pantalla de registro: abre su detalle`, `no ofrece acciones de edición` |

**Estado:** cubierto (automatizado), con protección en el servicio y en la base de datos.

### PT05-12 — Modificar un insumo utilizado en una elaboración finalizada
**Esperado:** la elaboración conserva la información original del insumo.

| Capa | Pruebas |
|------|---------|
| Backend | B4: `test_pt05_12_modificar_el_insumo_no_altera_la_elaboracion_finalizada`, `test_ca13_cambiar_los_alergenos_del_insumo_no_altera_lo_conservado`, `test_ca13_desactivar_el_insumo_o_el_ingrediente_no_altera_lo_conservado`, `test_el_detalle_no_lee_el_lote_vigente`, `test_los_cambios_posteriores_si_se_ven_en_el_insumo_y_en_una_elaboracion_nueva`, `test_una_finalizada_sin_informacion_conservada_no_se_lee_desde_el_insumo_vigente` · B9: `test_el_json_y_el_detalle_no_cambian_aunque_cambie_todo_lo_demas`, `test_una_edicion_del_insumo_espera_a_que_termine_la_finalizacion`, `test_un_cambio_de_alergenos_espera_a_que_termine_la_finalizacion` |
| Frontend | F1: `no consulta el insumo vigente: todo viene de lo que entrega la elaboración` |

**Estado:** cubierto (automatizado). Cierra el pendiente CA09 de HU04.

### PT05-13 — Modificar la formulación de un producto con elaboraciones
**Esperado:** se genera una nueva versión; las elaboraciones anteriores conservan la versión previa.

| Capa | Pruebas |
|------|---------|
| Backend | B2: `test_pt05_13_modificar_la_formulacion_con_elaboraciones_genera_una_version_nueva`, `test_sin_elaboraciones_la_misma_modificacion_se_hace_en_el_lugar`, `test_un_borrador_tambien_conserva_su_version_cuando_cambia_la_receta`, `test_una_elaboracion_nueva_usa_la_version_vigente_y_la_anterior_no_cambia`, `test_el_listado_muestra_la_version_de_cada_elaboracion`, `test_un_producto_con_otra_formulacion_no_mezcla_las_versiones` · B4: `test_ca13_modificar_la_formulacion_no_altera_la_elaboracion_finalizada` · B7: `test_crear_una_elaboracion_mientras_se_edita_la_formulacion_no_modifica_la_version_usada` |
| Frontend | — La interfaz no modifica la formulación desde la elaboración; solo muestra la versión con la que se hizo (`muestra el producto, la versión, el código precargado y la fecha`). |

**Estado:** cubierto (automatizado, backend). Cierra PT03-09.

### PT05-14 — Cambiar el insumo utilizado para un ingrediente en una nueva elaboración
**Esperado:** la formulación mantiene su versión.

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_pt05_14_cambiar_el_insumo_de_un_ingrediente_no_cambia_la_version_de_la_formulacion`, `test_cambiar_el_insumo_de_un_ingrediente_sin_indicar_lote_deja_el_lote_pendiente` · B8: `test_reemplazar_la_asignacion_persiste_el_cambio_de_insumo_y_de_lote` |
| Frontend | F1: `cambiar el insumo reinicia el lote de la línea` |

**Estado:** cubierto (automatizado). Cierra PT03-12.

### PT05-15 — Consultar el detalle de una elaboración finalizada
**Esperado:** se muestra la información conservada, no la vigente.

| Capa | Pruebas |
|------|---------|
| Backend | B4: `test_pt05_15_el_detalle_de_una_finalizada_muestra_la_informacion_conservada`, `test_el_detalle_de_un_borrador_avisa_si_su_insumo_o_su_ingrediente_estan_desactivados` (contraste: el borrador sí muestra lo vigente), `test_el_detalle_de_un_borrador_muestra_los_alergenos_vigentes_del_insumo` |
| Frontend | F1: `PT05-15: el encabezado muestra producto, código, fecha, estado y versión`, `indica cuándo se conservó la información, en formato chileno y hora de Santiago`, `PT05-15: por cada ingrediente muestra el insumo, la marca u origen, la presentación y el código de barras`, `omite la presentación y el código de barras cuando no existen`, `muestra los ingredientes declarados y las advertencias cuando existen`, `muestra el código y el vencimiento del lote, o «Sin lote»`, `agrupa los alérgenos de cada insumo en «Contiene» y «Puede contener»`, `marca con «Rotulación obligatoria» solo los alérgenos obligatorios`, `el resumen de alérgenos va al principio, antes de los ingredientes`, `el resumen reúne los alérgenos de todos los insumos, sin duplicados`, `si un alérgeno es «contiene» en un insumo y «trazas» en otro, va solo en «Contiene»`, `el resumen marca la rotulación obligatoria y no marca los demás`, `sin alérgenos declarados, lo indica en el resumen y en cada insumo`, `un borrador abierto en esta ruta redirige a la pantalla de registro` · F2: `«contiene» en un insumo y «trazas» en otro va solo en «Contiene», en cualquier orden`, `no duplica un alérgeno que declaran varios insumos con el mismo tipo`, `ordena cada grupo con los de rotulación obligatoria primero y luego por nombre`, `usa el formato chileno y la zona de Santiago (invierno, UTC-4)` |

**Estado:** cubierto (automatizado).

### PT05-16 — Acceder a una elaboración de otro productor
**Esperado:** el sistema rechaza el acceso.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pt05_16_un_productor_no_accede_a_elaboraciones_de_otro`, `test_un_producto_o_una_elaboracion_inexistente_responde_404`, `test_las_rutas_requieren_autenticacion` · B3: `test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada`, `test_los_lotes_de_un_insumo_ajeno_o_inexistente_responden_404`, `test_un_insumo_de_otro_productor_responde_422` · B4: `test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada` · B5: `test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada` · B8: `test_una_elaboracion_ajena_no_cambia_nada_en_la_base` |
| Frontend | F1: `una elaboración inexistente o ajena muestra el aviso de no disponible` (registro y detalle) |

**Estado:** cubierto (automatizado). Una elaboración ajena responde 404, no 403.

### PT05-17 — Validar estados de carga, errores y confirmación de finalización
**Esperado:** la interfaz muestra estados y mensajes adecuados.

| Capa | Pruebas |
|------|---------|
| Backend | — Los estados son de la interfaz; los mensajes de la API están cubiertos en PT05-02, PT05-03, PT05-09 y PT05-11. |
| Frontend | F1 (producto): `muestra el estado de carga y el error con reintento` · F1 (registro): `muestra el estado de carga`, `si fallan los insumos, lo informa y permite reintentar`, `un error inesperado al guardar muestra un mensaje general`, `un error 422 con ingrediente_id se muestra en su línea`, `si falla la eliminación, lo informa y se queda en la pantalla`, `PT05-17: pide confirmación con el texto de advertencia antes de finalizar`, `si la finalización falla de forma inesperada, lo informa y no navega` · F1 (detalle): `muestra el estado de carga`, `un fallo de carga se informa con reintento y no se confunde con «no disponible»` · F1 (diálogo): `un error inesperado se informa dentro del diálogo y se puede reintentar` |

**Estado:** cubierto (automatizado).

### PT05-18 — Registrar un insumo nuevo desde una elaboración en borrador
**Esperado:** el insumo queda registrado, asociado a su ingrediente y asignado a la elaboración, sin salir del registro.

| Capa | Pruebas |
|------|---------|
| Backend | B15: `test_crea_un_insumo_con_los_datos_obligatorios`, `test_crear_un_insumo_persiste` (el diálogo usa el endpoint de HU04 `POST /gestion/insumos`; la asignación a la elaboración es la de PT05-05 y PT05-07, con `PUT /usos`) |
| Frontend | F1: `PT05-18: el insumo creado queda registrado, en las opciones y asignado a la línea, sin salir del registro`, `el insumo asignado se persiste en la elaboración al guardar el borrador`, `abre el formulario de insumos con el ingrediente de la línea preseleccionado y bloqueado`, `el insumo nuevo solo aparece en las opciones de su línea`, `abrir y cancelar conserva los cambios sin guardar de la elaboración`, `crear el insumo conserva los cambios sin guardar de la elaboración`, `código repetido de un insumo activo: ofrece «Usar este insumo» en vez del enlace al detalle`, `«Usar este insumo» con el mismo ingrediente lo asigna a la línea y cierra el diálogo`, `«Usar este insumo» de otro ingrediente muestra «Ese insumo está asociado a «X»» y no lo asigna`, `código repetido de un insumo desactivado: «Reactivar» lo reactiva y lo asigna a la línea`, `no reactiva un insumo desactivado que es de otro ingrediente`, `cancelar no crea nada ni cambia la línea; Escape también cierra`, `con un código repetido de un insumo activo sigue ofreciendo el enlace «Ver insumo existente»` |

**Estado:** cubierto (automatizado).

---

## Criterios de aceptación

| CA | Criterio (resumen) | Cubierto por | Estado |
|----|--------------------|--------------|--------|
| CA01 | Registrar con producto, fecha y código | PT05-01 | Cubierto |
| CA02 | Código sugerido, modificable | B1: `test_sugerir_codigo_toma_el_mayor_numero_mas_uno`, `test_el_endpoint_sugiere_el_siguiente_codigo_del_producto`, `test_el_codigo_sugerido_es_por_producto` · F1: `abre con el código sugerido (editable) y la fecha de hoy sin fechas futuras`, `el código y la fecha se pueden cambiar antes de crear` | Cubierto |
| CA03 | Código único por producto | PT05-03 | Cubierto |
| CA04 | Carga la formulación vigente y asocia la versión | PT05-01, PT05-13 | Cubierto |
| CA05 | Insumo habitual preseleccionado y cambiable | PT05-04 | Cubierto |
| CA06 | Lote obligatorio salvo «sin lote»; vencimiento opcional | PT05-05, PT05-07; B3: `test_un_lote_sin_insumo_responde_422`; B4: `test_pt05_09_falta_el_lote_o_la_indicacion_de_sin_lote` | Cubierto |
| CA07 | Reutilizar un lote del mismo insumo | PT05-06 | Cubierto |
| CA08 | No finalizar con ingredientes sin insumo | PT05-09 | Cubierto |
| CA09 | Borrador modificable y eliminable | PT05-08 | Cubierto |
| CA10 | Finalización explícita con confirmación | PT05-10, PT05-17 | Cubierto |
| CA11 | Copia de nombre, marca u origen, ingredientes declarados, alérgenos y advertencias | PT05-10 | Cubierto (la copia incluye además presentación, código de barras y lote) |
| CA12 | Finalizada inmutable, también su información conservada | PT05-11, PT05-12 | Cubierto, con protección en el servicio y en la base de datos |
| CA13 | Cambios posteriores no alteran lo finalizado | PT05-12, PT05-13 | Cubierto |
| CA14 | Registrar un insumo sin salir del flujo | PT05-18 | Cubierto |
| CA15 | Consultar el detalle | PT05-15 | Cubierto |
| CA16 | Pertenece al productor | PT05-16 | Cubierto |

---

## Pendientes heredados

### De HU03

| Caso de HU03 | Se cierra con | Pruebas que lo cierran | Estado |
|--------------|---------------|------------------------|--------|
| PT03-09 — Modificar una formulación utilizada | PT05-13 | B2: `test_pt05_13_modificar_la_formulacion_con_elaboraciones_genera_una_version_nueva`, `test_un_borrador_tambien_conserva_su_version_cuando_cambia_la_receta`, `test_una_elaboracion_nueva_usa_la_version_vigente_y_la_anterior_no_cambia` · B7: `test_crear_una_elaboracion_mientras_se_edita_la_formulacion_no_modifica_la_version_usada` · B4: `test_ca13_modificar_la_formulacion_no_altera_la_elaboracion_finalizada` | Cerrado |
| PT03-12 — Cambiar el insumo comercial | PT05-14 | B3: `test_pt05_14_cambiar_el_insumo_de_un_ingrediente_no_cambia_la_version_de_la_formulacion` (reemplazó a `test_cambiar_insumo_comercial_no_cambia_la_version`, que usaba modelos del prototipo RT-01) · B8: `test_reemplazar_la_asignacion_persiste_el_cambio_de_insumo_y_de_lote` | Cerrado |
| PT03-13 — Elaborar un producto sin formulación | PT05-02 | B1: `test_pt05_02_un_producto_sin_formulacion_no_admite_elaboraciones` · B14: `test_producto_sin_formulacion_no_tiene_version_para_elaborar` | Cerrado |

### De HU04

| Criterio de HU04 | Se cierra con | Pruebas que lo cierran | Estado |
|------------------|---------------|------------------------|--------|
| CA09 — Modificar un insumo no altera las elaboraciones registradas | PT05-12 | B4: `test_pt05_12_modificar_el_insumo_no_altera_la_elaboracion_finalizada`, `test_ca13_cambiar_los_alergenos_del_insumo_no_altera_lo_conservado`, `test_ca13_desactivar_el_insumo_o_el_ingrediente_no_altera_lo_conservado` · B9: `test_el_json_y_el_detalle_no_cambian_aunque_cambie_todo_lo_demas` | Cerrado |
| CA10 — El insumo desactivado no se ofrece para nuevas elaboraciones | PT05-04, PT05-05 | B1: `test_un_habitual_desactivado_no_se_preselecciona` · B3: `test_un_insumo_desactivado_responde_422`, `test_un_insumo_que_se_desactivo_despues_de_asignarlo_ya_no_se_acepta` | Cerrado |

---

## Evidencia de la mitigación del riesgo RT-01

El riesgo RT-01 es que una elaboración finalizada quede sin la información de los insumos que se usaron, o que esa información cambie después. La mitigación tiene tres capas independientes: cada una detiene el problema aunque falle la anterior.

### Capa 1 — Servicio
La finalización y toda escritura sobre una elaboración bloquean su fila (`FOR UPDATE`) y comprueban el estado antes de validar nada; una finalizada responde 409. El detalle de una finalizada se arma solo desde `informacion_conservada` y nunca lee el insumo, sus alérgenos ni el lote vigentes.

| Qué se verifica | Pruebas |
|-----------------|---------|
| Una finalizada no se modifica ni se elimina, y el estado se comprueba antes que el cuerpo | B5: `test_pt05_11_modificar_una_finalizada_responde_409_y_no_cambia_nada`, `test_pt05_11_eliminar_una_finalizada_responde_409_y_conserva_todo`, `test_una_modificacion_invalida_sobre_una_finalizada_responde_409_antes_que_validar`, `test_pt05_11_las_demas_escrituras_sobre_una_finalizada_tambien_responden_409` |
| Lo conservado no depende del insumo, sus alérgenos, el lote, el ingrediente ni la formulación vigentes | B4: `test_pt05_12_modificar_el_insumo_no_altera_la_elaboracion_finalizada`, `test_ca13_cambiar_los_alergenos_del_insumo_no_altera_lo_conservado`, `test_ca13_desactivar_el_insumo_o_el_ingrediente_no_altera_lo_conservado`, `test_ca13_modificar_la_formulacion_no_altera_la_elaboracion_finalizada`, `test_el_detalle_no_lee_el_lote_vigente`, `test_una_finalizada_sin_informacion_conservada_no_se_lee_desde_el_insumo_vigente` · F1: `no consulta el insumo vigente: todo viene de lo que entrega la elaboración` |

### Capa 2 — Transacción única
Validación, copia de cada insumo (con sus alérgenos y su lote) y cambio de estado ocurren en una sola transacción, con un único commit. Las copias se escriben antes de cambiar el estado, y los insumos usados quedan bloqueados (`FOR SHARE`) hasta que termina, de modo que la copia es el estado que tenían al finalizar.

| Qué se verifica | Pruebas |
|-----------------|---------|
| **Persistencia leída desde una sesión independiente** (cada petición con su sesión, lectura con otra conexión: detecta un commit faltante) | B9: `test_finalizar_persiste_el_estado_la_fecha_y_el_json_completo_de_cada_uso`, `test_el_json_y_el_detalle_no_cambian_aunque_cambie_todo_lo_demas` · B7: `test_crear_un_borrador_persiste_la_elaboracion_sus_usos_y_la_marca_de_la_version` · B8: `test_asignar_con_lote_nuevo_persiste_el_lote_y_el_uso`, `test_reutilizar_un_lote_persiste_la_referencia_sin_duplicarlo`, `test_asignar_sin_lote_persiste_el_indicador_y_el_insumo` · B10: `test_modificar_un_borrador_persiste_el_codigo_y_la_fecha`, `test_eliminar_un_borrador_persiste_la_baja_de_la_elaboracion_y_de_sus_usos` |
| **Atomicidad ante una falla a mitad de la finalización** (falla forzada al copiar el segundo uso: ningún uso conserva copia y el estado sigue en borrador) | B9: `test_una_falla_a_mitad_de_la_copia_deja_el_borrador_intacto`, `test_no_se_finaliza_nada_si_la_validacion_falla` · B7: `test_si_la_creacion_falla_a_mitad_no_persiste_nada` · B8: `test_si_algo_falla_a_mitad_no_persiste_nada`, `test_un_fallo_de_validacion_no_deja_cambios_a_medias`, `test_un_lote_repetido_no_deja_cambios_a_medias` |
| **Orden de escritura** (todas las copias existen cuando se cambia el estado) | B9: `test_el_estado_se_cambia_despues_de_escribir_las_copias` |
| **Concurrencia (PostgreSQL)**: la edición del insumo, un cambio de alérgenos o un cambio de la asignación hechos durante la finalización esperan a que termine | B9: `test_una_edicion_del_insumo_espera_a_que_termine_la_finalizacion`, `test_un_cambio_de_alergenos_espera_a_que_termine_la_finalizacion`, `test_un_cambio_de_la_asignacion_durante_la_finalizacion_espera_y_se_rechaza` · B7: `test_dos_creaciones_simultaneas_sin_codigo_reciben_codigos_distintos`, `test_dos_creaciones_simultaneas_con_el_mismo_codigo_solo_una_gana`, `test_crear_una_elaboracion_mientras_se_edita_la_formulacion_no_modifica_la_version_usada` · B8: `test_dos_asignaciones_simultaneas_del_mismo_lote_nuevo_solo_una_lo_crea`, `test_dos_asignaciones_simultaneas_a_la_misma_elaboracion_se_aplican_una_despues_de_otra` |

### Capa 3 — Triggers en la base de datos (migración 016)
Cuatro triggers de PostgreSQL protegen aunque se evite el servicio (un error, un script o SQL manual): una elaboración nace como borrador; una finalizada no se modifica ni se elimina; no se puede finalizar sin fecha, sin usos o con un uso sin insumo o sin copia; y los usos de una finalizada no se insertan, modifican ni eliminan. El SQL vive en `app/db/triggers_elaboracion.py`, usado por la migración y por un evento `after_create` solo para PostgreSQL.

| Qué se verifica | Pruebas |
|-----------------|---------|
| **SQL directo contra los triggers** (sin pasar por el servicio ni el ORM) | B11: `test_create_all_instala_las_funciones_y_los_triggers`, `test_un_insert_con_estado_finalizada_falla`, `test_un_update_sobre_una_elaboracion_finalizada_falla`, `test_un_delete_sobre_una_elaboracion_finalizada_falla_y_conserva_sus_usos`, `test_un_delete_masivo_que_incluye_una_finalizada_falla_completo`, `test_un_update_sobre_los_usos_de_una_finalizada_falla`, `test_un_insert_de_un_uso_en_una_finalizada_falla`, `test_un_delete_de_un_uso_de_una_finalizada_falla`, `test_pasar_a_finalizada_sin_copias_falla_y_la_elaboracion_sigue_en_borrador`, `test_pasar_a_finalizada_con_una_sola_copia_de_dos_falla`, `test_una_copia_json_null_cuenta_como_ausente`, `test_pasar_a_finalizada_con_un_uso_sin_insumo_falla`, `test_pasar_a_finalizada_sin_ningun_uso_falla`, `test_pasar_a_finalizada_sin_finalizada_at_falla_con_el_mensaje_del_trigger`, `test_un_borrador_se_puede_eliminar_con_sus_usos`, `test_un_borrador_se_puede_modificar_y_sus_usos_cambiar`, `test_lo_que_se_deshabilita_a_proposito_permite_corregir_una_finalizada` |
| **El servicio traduce el error de la base a 409** (el servicio omite a propósito su comprobación y solo el trigger rechaza) | B10: `test_si_el_servicio_dejara_pasar_una_modificacion_el_trigger_la_rechaza_con_409`, `test_si_el_servicio_dejara_pasar_una_eliminacion_el_trigger_la_rechaza_con_409`, `test_si_el_servicio_dejara_pasar_un_cambio_de_asignacion_el_trigger_lo_rechaza_con_409`, `test_si_el_servicio_dejara_finalizar_de_nuevo_el_trigger_lo_rechaza_con_409`, `test_si_el_servicio_dejara_finalizar_sin_copias_el_trigger_lo_rechaza_con_409` |
| **Migración 016** (instala y revierte triggers y funciones sin tocar datos, y protege lo que ya estaba finalizado) | B13: `test_upgrade_016_crea_las_funciones_y_los_triggers`, `test_los_triggers_tienen_el_momento_y_la_condicion_aprobados`, `test_upgrade_016_no_altera_los_datos_y_protege_lo_que_ya_estaba_finalizado`, `test_las_reglas_se_cumplen_con_el_esquema_de_la_migracion`, `test_downgrade_016_elimina_solo_los_triggers_y_las_funciones_y_conserva_los_datos`, `test_downgrade_016_y_nuevo_upgrade_son_reversibles` |
| **Migración con un usuario sin privilegios de superusuario** (crea un rol `NOSUPERUSER` y una base propia, con contraseña generada en la prueba, aplica todas las migraciones hasta la 016, comprueba los triggers y revierte) | B13: `test_la_migracion_se_aplica_con_un_rol_sin_privilegios_de_superusuario` |
| **Restricciones de integridad de la 015 que respaldan el modelo** (claves foráneas compuestas versión–producto y lote–insumo, unicidad sin distinguir mayúsculas, un uso por ingrediente) | B12: `test_upgrade_015_crea_las_claves_foraneas`, `test_una_elaboracion_no_puede_usar_la_version_de_otro_producto`, `test_un_uso_no_puede_apuntar_al_lote_de_otro_insumo`, `test_sin_lote_excluye_un_lote_y_un_lote_exige_insumo`, `test_el_codigo_de_elaboracion_es_unico_por_producto_sin_distinguir_mayusculas`, `test_downgrade_015_se_niega_si_hay_elaboraciones_y_no_pierde_datos` |

**Límites conocidos.** Los triggers no están en SQLite: allí la inmutabilidad depende solo del servicio, y por eso la suite de PostgreSQL es indispensable. Los triggers no cubren `TRUNCATE`, y quien sea dueño de la tabla puede deshabilitarlos a propósito con `ALTER TABLE … DISABLE TRIGGER` (lo documenta `test_lo_que_se_deshabilita_a_proposito_permite_corregir_una_finalizada`).

---

## Mutaciones verificadas durante HU05

En cada tarea se rompió a propósito una regla a la vez, copiando antes el archivo original y restaurándolo después desde esa copia, para comprobar que alguna prueba falla. Todos los archivos quedaron idénticos a sus copias.

| Tarea | Qué se rompió | Mutaciones detectadas |
|-------|---------------|-----------------------|
| T05-01 — Modelos y migración 015 | Índices únicos sin `lower()`, checks de estado y de lote, claves foráneas compuestas, cascada de usos y la guarda del downgrade | 15 de 15 (7 en la migración y 8 en el modelo) |
| T05-02 — Creación del borrador | Sin el bloqueo del producto (también sin el `FOR UPDATE`), sin `marcar_version_usada`, commit→flush, sin habitual, sin validar ingredientes desactivados ni fecha futura, código sensible a mayúsculas, sin crear usos, sugerido que no suma uno y detalle sin filtrar por productor | 11 de 11; más 2 en el ajuste (detalle y listado de un producto desactivado) |
| T05-03 — Insumos y lotes | Insumo de otro ingrediente, lote de otro insumo, insumo desactivado, lote sensible a mayúsculas, commit→flush, finalizada aceptada, ingredientes faltantes, repetidos o ajenos, `sin_lote` perdido, insumo y lotes de otro productor, sin bloqueo de la elaboración y el error de base sin traducir a 409 | 16 de 16 |
| T05-04 — Finalización | Commit→flush, estado antes de las copias, detalle desde el insumo vigente, sin bloqueo de los insumos, sin bloqueo de la elaboración, sin validar problemas, doble finalización, ingrediente o insumo desactivado, alérgenos sin ordenar, ficha cruda copiada, lote no copiado y detalle con nombre vivo | 13 de 13 |
| T05-05 — Bloqueo y triggers | Servicio: PATCH o DELETE sin comprobar estado, commit→flush, propio código como repetido, fecha futura y error de trigger sin traducir. Triggers: eliminar cada uno de los tres, y variantes sin proteger DELETE o INSERT, sin revisar que haya usos y aceptando copias JSON `null` | 16 de 16; más 1 del trigger BEFORE INSERT (9 pruebas fallan al quitarlo) |
| T05-06 — Registro y finalización (interfaz) | Sin protección de cambios sin guardar, «Usar este lote» que no cambia a lote existente, problemas sin marcar por línea, finalizar sin guardar ni confirmar, fecha futura permitida, habitual sin preseleccionar, eliminar sin confirmar, botón sin formulación, avisos de insumo desactivado y de ingrediente sin insumos, y 422 por línea | 14 de 14 |
| T05-06 (ajuste) — Diálogo de creación | Cancelar o abrir que crean el borrador, el botón que crea sin diálogo, crear sin validar, la sugerencia tardía que pisa lo escrito, Escape que no cierra, errores del `POST` ignorados o sin sugerido, y diálogo sin adaptación a celular | 9 de 9 |
| T05-07 — Detalle | Resumen con un alérgeno duplicado, alérgeno «Contiene» que queda en «Puede contener» (dos variantes), sin orden por rotulación obligatoria, «Sin lote» oculto, detalle que consulta el insumo vigente, borrador sin redirección, sin etiqueta de rotulación, hora 24:00, zona horaria distinta, fallo de carga confundido con «no disponible», presentación mostrada sin existir y resumen sin texto cuando no hay alérgenos | 13 de 13 |
| T05-08 — Insumo desde la línea | Perder los cambios sin guardar al crear, asignar un insumo de otro ingrediente, reactivar uno de otro ingrediente, ingrediente sin bloquear (dos variantes), insumo no asignado, sin «Usar este insumo», opción sin destacar, guardar de inmediato, ingrediente sin preseleccionar, habitual que no desmarca al anterior, formulario de HU04 alterado y opción oculta | 13 de 13 |
| Ajuste de presentación | Presentación oculta en la tabla, oculta en la tarjeta, ignorada en la búsqueda, oculta en el selector de la elaboración y guion cuando no existe | 5 de 5 |

Se descartaron las mutaciones que resultaron equivalentes (el mismo comportamiento por otra guarda): dos en T05-02 y T05-05, y una en T05-03.

---

## Verificaciones manuales pendientes en un celular real

Las pruebas de adaptación a móviles son estructurales (clases responsive), porque jsdom no calcula estilos ni tamaños de pantalla. **No reemplazan** la prueba en un dispositivo real, que queda **pendiente**. Probar en Chrome para Android y en Safari para iOS, sobre la interfaz servida por HTTPS o por la red local:

1. **Producto:** el botón «Registrar elaboración» solo aparece con formulación; la lista de elaboraciones recientes se lee y cada enlace es tocable.
2. **Diálogo «Registrar elaboración»:** se abre como panel inferior, el teclado no tapa los campos, el selector de fecha nativo funciona y no permite fechas futuras; cancelar no crea nada.
3. **Pantalla de registro:**
   - Los campos y botones ocupan el ancho completo y se pueden tocar sin zoom.
   - Cada línea (insumo, lote nuevo con vencimiento, lote existente y sin lote) se completa con una mano.
   - La barra de acciones se mantiene visible al desplazarse.
4. **Registrar un insumo nuevo desde una línea:** el diálogo se desplaza completo, el ingrediente aparece bloqueado y, con un código de barras repetido, «Usar este insumo» y «Reactivar» son tocables.
5. **Cambios sin guardar:** al recargar la pestaña con cambios, el navegador lo advierte; al volver al producto, aparece el diálogo «Salir sin guardar».
6. **Finalización:** el diálogo de confirmación muestra el texto completo sin cortarse y, al confirmar, se abre el detalle.
7. **Detalle de una finalizada:** el resumen de alérgenos y cada insumo se leen en una columna, sin desbordar el ancho; los grupos «Contiene» y «Puede contener» y la etiqueta «Rotulación obligatoria» se distinguen.
8. **Listado de insumos:** la presentación aparece junto al nombre en las tarjetas y el selector de insumos de la elaboración la muestra.

---

## Observaciones

- Una elaboración finalizada se lee siempre desde su información conservada; la interfaz no consulta el insumo vigente. Un borrador sí muestra lo vigente y avisa si su insumo o su ingrediente se desactivaron.
- La información conservada incluye, además de lo que pide CA11, la presentación, el código de barras y el lote (código y vencimiento), y no incluye la ficha cruda de la fuente.
- El detalle de las elaboraciones de un producto desactivado sigue siendo consultable; solo se bloquea crear nuevas.
- Eliminar un borrador no revierte la marca de «versión usada» de la formulación, y conserva los lotes ya registrados para reutilizarlos.
- El historial completo de elaboraciones, con filtros, corresponde a una historia posterior (HU06); aquí el producto muestra solo las más recientes.
