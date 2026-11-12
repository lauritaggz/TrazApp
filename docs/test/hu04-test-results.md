# HU04 — Resultados de pruebas (T04-06)

**Fecha:** 2026-10-05
**Rama:** `feature/hu04-insumos`
**HEAD al ejecutar:** `13bd1b1` (más los cambios de T04-06 sin confirmar)
**Plan de referencia:** PT04-01 … PT04-14 (Contexto del Sprint 2, sección 6)
**Entorno:** backend con Python 3.13 sobre SQLite en memoria y sobre PostgreSQL 16 (contenedor `trazapp-database`, base aislada `trazapp_test`); frontend con Vitest y Vite (Node local). Migraciones aplicadas en `trazapp`: `013_insumos_comerciales` y `014_insumos_alergenos`.

---

## Resumen de ejecución

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Backend, SQLite | `python -m pytest -q` (sin `TEST_DATABASE_URL`) | 526 aprobadas, 45 omitidas, 0 fallos (3 min 50 s) |
| Backend, PostgreSQL | `python -m pytest -q` (con `TEST_DATABASE_URL` → `trazapp_test`) | 571 aprobadas, 0 omitidas, 0 fallos (8 min 36 s) |
| Frontend | `npx vitest run` | 18 archivos, 324 pruebas aprobadas, 0 fallos |
| Build | `npm run build` | correcto (`tsc -b` + `vite build`) |
| Type check | `npx tsc -b` | sin errores |

Las pruebas omitidas en SQLite son las que exigen PostgreSQL (migraciones, claves foráneas, bloqueos de fila); se ejecutan en la corrida de PostgreSQL, donde no hay ninguna omitida.

Pruebas propias de HU04: backend 275 (en PostgreSQL), frontend 106 (70 de pantallas + 33 de utilidades + 3 de dependencias).

---

## Archivos de prueba (leyenda de la tabla)

| Clave | Archivo | Qué cubre |
|-------|---------|-----------|
| **B1** | `backend/tests/test_gestion_insumos_hu04.py` | API `/gestion/insumos` (T04-03) |
| **B2** | `backend/tests/test_gestion_insumo_alergenos_hu04.py` | API de alérgenos del insumo (T04-04) |
| **B3** | `backend/tests/test_insumo_model_hu04.py` | Modelo `InsumoComercial` (T04-01) |
| **B4** | `backend/tests/test_insumo_alergenos_model_hu04.py` | Modelo `InsumoAlergeno` (T04-02) |
| **B5** | `backend/tests/test_persistencia_insumos_hu04.py` | Persistencia leída desde una sesión independiente (T04-04) |
| **B6** | `backend/tests/test_codigo_barras_hu04.py` | Normalización y dígito verificador del código de barras |
| **B7** | `backend/tests/test_migracion_013_insumos.py` | Migración 013 (solo PostgreSQL) |
| **B8** | `backend/tests/test_migracion_014_insumos_alergenos.py` | Migración 014 (solo PostgreSQL) |
| **F1** | `frontend/src/insumos/hu04.insumos.test.tsx` | Pantallas de insumos (T04-05 y T04-06) |
| **F2** | `frontend/src/lib/insumoUtilidades.test.ts` | Validación, utilidades y `apiClient` |

---

## Trazabilidad PT04-01 … PT04-14

Los nombres entre comillas invertidas son los de las pruebas (`def test_…` en el backend; el título del `it(...)` en el frontend). «—» indica que el caso no tiene componente en esa capa y por qué.

### PT04-01 — Registrar un insumo con los datos obligatorios
**Esperado:** el insumo se registra asociado a su ingrediente.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_crea_un_insumo_con_los_datos_obligatorios`, `test_el_insumo_queda_asociado_al_productor_autenticado` · B3: `test_registra_insumo_con_los_datos_obligatorios`, `test_valores_por_defecto_de_fuente_habitual_y_activo` · B5: `test_crear_un_insumo_persiste` · B7: `test_los_valores_por_defecto_se_aplican_en_la_base` |
| Frontend | F1: `crea el insumo con la carga normalizada y avisa con un enlace para declarar alérgenos` · F2: `arma la carga de creación con textos recortados, código normalizado y vacíos nulos` |

**Estado:** cubierto (automatizado).

### PT04-02 — Registrar un insumo con datos obligatorios incompletos
**Esperado:** el sistema informa los campos requeridos.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_rechaza_cuando_falta_un_dato_obligatorio`, `test_rechaza_nombre_y_marca_vacios`, `test_los_obligatorios_no_admiten_null_al_modificar` · B3: `test_los_campos_obligatorios_no_admiten_nulo` |
| Frontend | F1: `valida los campos obligatorios y no envía` · F2: `exige nombre, marca u origen e ingrediente` |

**Estado:** cubierto (automatizado).

### PT04-03 — Registrar un insumo con origen en vez de marca (por ejemplo, feria local)
**Esperado:** el insumo se registra correctamente.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_crea_un_insumo_con_origen_en_vez_de_marca` |
| Frontend | F1: `PT04-03: registra un insumo con origen en vez de marca, por ejemplo «Feria local», sin código de barras` *(agregada en T04-06)*, `muestra todos los campos, el selector de ingredientes activos y los textos de ayuda` (texto de ayuda con «Feria local») |

**Estado:** cubierto (automatizado).

### PT04-04 — Registrar un insumo con código de barras repetido para el mismo productor
**Esperado:** el sistema rechaza la operación.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_codigo_repetido_de_un_insumo_activo_responde_409_con_el_id_existente`, `test_codigo_repetido_de_un_insumo_inactivo_responde_409_distinguiendo_el_caso`, `test_el_codigo_repetido_se_detecta_aunque_cambie_el_formato_de_entrada`, `test_modificar_a_un_codigo_de_otro_insumo_responde_409`, `test_conservar_o_reenviar_el_propio_codigo_no_es_un_conflicto`, `test_la_base_respalda_la_unicidad_si_dos_peticiones_compiten`, `test_rechaza_un_digito_verificador_invalido`, `test_rechaza_largos_y_caracteres_no_permitidos`, `test_normaliza_el_codigo_de_barras` · B3: `test_codigo_de_barras_repetido_para_el_mismo_productor_se_rechaza`, `test_sin_los_indices_los_duplicados_pasan` · B6: `test_el_digito_verificador_se_calcula_con_gs1`, `test_rechaza_un_digito_verificador_incorrecto`, `test_rechaza_largos_distintos_de_8_12_o_13` · B7: `test_indice_de_codigo_de_barras_rechaza_repetidos_del_mismo_productor` |
| Frontend | F1 (grupo «Código de barras repetido (409)»): `si el existente está activo muestra el mensaje con un enlace a ese insumo`, `si el existente está inactivo muestra el mensaje con un botón Reactivar`, `Reactivar reactiva el insumo existente y lleva a su detalle`, `si Reactivar falla lo informa y se queda en el formulario`, `al cambiar el código de barras desaparece el aviso del duplicado`, `un 409 de otro tipo se muestra como mensaje general` · F1: `informa el dígito verificador inválido en el campo y no envía` · F2: `409 con detail objeto: usa detail.mensaje y conserva el detalle`, `409 con detail texto sigue funcionando como antes`, `422 de código de barras muestra el mensaje específico del backend, sin el prefijo técnico` |

**Estado:** cubierto (automatizado).

### PT04-05 — Registrar el mismo código de barras en insumos de productores distintos
**Esperado:** ambos insumos se registran correctamente.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_el_mismo_codigo_en_productores_distintos_es_valido`, `test_varios_insumos_sin_codigo_de_barras_son_validos` · B3: `test_mismo_codigo_de_barras_en_productores_distintos_se_permite`, `test_varios_insumos_sin_codigo_de_barras_se_permiten` · B7: `test_indice_de_codigo_de_barras_permite_otro_productor_y_nulos` |
| Frontend | — La unicidad por productor es una regla del servidor; la interfaz solo envía el código y muestra la respuesta. |

**Estado:** cubierto (automatizado, backend).

### PT04-06 — Asociar alérgenos indicando que el insumo los contiene y que puede contenerlos
**Esperado:** los alérgenos quedan registrados con su tipo de declaración.

| Capa | Pruebas |
|------|---------|
| Backend | B2: `test_asocia_un_alergeno_del_catalogo_con_cada_tipo`, `test_el_detalle_del_insumo_refleja_los_alergenos_asociados`, `test_cambia_el_tipo_de_un_alergeno_asociado_y_el_detalle_lo_refleja`, `test_un_tipo_distinto_de_contiene_o_trazas_responde_422`, `test_asociar_un_alergeno_ya_asociado_responde_422_aunque_cambie_el_tipo`, `test_quita_un_alergeno_y_el_detalle_lo_refleja`, `test_el_listado_sigue_el_mismo_orden_que_la_respuesta_del_insumo` · B4: `test_asocia_un_alergeno_que_el_insumo_contiene`, `test_asocia_un_alergeno_que_el_insumo_puede_contener_como_trazas`, `test_un_insumo_declara_varios_alergenos_con_tipos_distintos`, `test_rechaza_un_tipo_no_permitido` · B5: `test_asociar_un_alergeno_persiste`, `test_cambiar_el_tipo_de_un_alergeno_persiste`, `test_quitar_un_alergeno_persiste` · B8: `test_acepta_los_dos_tipos_permitidos`, `test_el_check_rechaza_un_tipo_no_permitido` |
| Frontend | F1 (grupo «Alérgenos declarados del insumo»): `muestra el texto de ayuda y los alérgenos en dos grupos, con la etiqueta de rotulación obligatoria`, `agrega un alérgeno del catálogo agrupado en obligatorios y otros, eligiendo el tipo`, `por defecto declara el alérgeno como «Contiene»`, `cambia el tipo de un alérgeno ya declarado`, `de «Puede contener» pasa a «Contiene»`, `quita un alérgeno tras confirmar`, `cancelar el quitado no elimina nada` |

**Estado:** cubierto (automatizado).

### PT04-07 — Asociar varios insumos a un mismo ingrediente
**Esperado:** todos quedan asociados sin duplicar el ingrediente.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_varios_insumos_pueden_asociarse_al_mismo_ingrediente` · B3: `test_varios_no_habituales_para_el_mismo_ingrediente_se_permiten` · B7: `test_indice_de_habitual_permite_no_habituales_y_otro_ingrediente` |
| Frontend | F1: `PT04-07: varios insumos de un mismo ingrediente se listan y el filtro por ingrediente los muestra todos`, `PT04-07: se puede registrar un segundo insumo para un ingrediente que ya tiene uno` *(ambas agregadas en T04-06)* · F2: `arma las opciones del filtro de ingrediente sin repetidos y por nombre` |

**Estado:** cubierto (automatizado).

### PT04-08 — Marcar un insumo como habitual cuando ya existe otro habitual para el mismo ingrediente
**Esperado:** solo el último queda marcado como habitual.

| Capa | Pruebas |
|------|---------|
| Backend | B1 (regla 1, marcar uno desmarca al anterior): `test_regla_1_marcar_un_habitual_desmarca_al_anterior_del_mismo_ingrediente`, `test_regla_1_crear_como_habitual_tambien_desmarca_al_anterior`, `test_regla_1_cada_ingrediente_tiene_su_propio_habitual`, `test_regla_1_marcar_de_nuevo_al_que_ya_es_habitual_no_cambia_nada` · B1 (regla 2, inactivo no puede ser habitual): `test_regla_2_un_insumo_desactivado_no_puede_marcarse_como_habitual`, `test_regla_2_desactivar_y_marcar_habitual_en_la_misma_peticion_se_rechaza`, `test_regla_2_reactivar_y_marcar_habitual_en_la_misma_peticion_si_se_permite` · B1 (regla 3, desactivar quita la marca): `test_regla_3_al_desactivar_un_habitual_pierde_la_marca`, `test_regla_3_al_reactivar_no_recupera_la_marca` · B1 (regla 4, cambiar de ingrediente): `test_regla_4_cambiar_el_ingrediente_de_un_habitual_le_quita_la_marca`, `test_regla_4_si_la_misma_modificacion_pide_habitual_lo_es_del_nuevo_ingrediente`, `test_regla_4_un_no_habitual_que_cambia_de_ingrediente_sigue_sin_serlo` · B1 (atomicidad): `test_las_reglas_del_habitual_son_atomicas_si_algo_falla_al_guardar`, `test_un_error_de_validacion_no_desmarca_al_habitual_anterior`, `test_el_indice_parcial_respalda_el_habitual_unico_si_dos_peticiones_compiten` · B3: `test_dos_insumos_habituales_para_el_mismo_ingrediente_se_rechazan`, `test_cada_ingrediente_puede_tener_su_propio_habitual` · B5: `test_marcar_un_habitual_persiste_el_cambio_de_las_dos_filas` · B7: `test_indice_de_habitual_rechaza_un_segundo_habitual_por_ingrediente` |
| Frontend | F1: `PT04-08: marcar un insumo como habitual al editarlo envía solo habitual: true`, `PT04-08: al quitar la marca de habitual se envía habitual: false`, `PT04-08: el detalle refleja que otro insumo pasó a ser el habitual` *(agregadas en T04-06)* · F1: `muestra la información, el estado y la fuente` · F2: `al editar envía solo lo que cambió` |

**Estado:** cubierto (automatizado). La sustitución del habitual anterior es una regla del servidor; la interfaz envía la intención y muestra el resultado.

### PT04-09 — Modificar la información de un insumo
**Esperado:** los cambios se guardan y se muestran correctamente.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_actualiza_parcialmente_un_insumo`, `test_los_campos_opcionales_se_pueden_limpiar_con_null`, `test_un_cuerpo_vacio_devuelve_el_insumo_sin_cambios`, `test_modificar_un_insumo_cambia_su_ingrediente`, `test_un_insumo_inactivo_se_puede_editar`, `test_rechaza_campos_no_permitidos_o_invalidos_al_modificar` · B5: `test_modificar_un_insumo_persiste` |
| Frontend | F1: `carga los valores guardados y envía solo lo que cambió`, `sin cambios no envía nada y vuelve al detalle`, `conserva como opción el ingrediente actual aunque ya no esté activo`, `un código repetido de un insumo inactivo permite reactivarlo desde la edición` · F2: `al editar, borrar un campo opcional lo envía como null`, `un código con otro formato de espacios no cuenta como cambio` |

**Estado:** cubierto (automatizado). La no alteración de elaboraciones ya registradas (CA09) queda pendiente de HU05, ver más abajo.

### PT04-10 — Desactivar un insumo
**Esperado:** el insumo queda inactivo y no se ofrece para nuevas elaboraciones.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_desactivar_responde_204_y_el_insumo_deja_el_listado_de_activos`, `test_desactivar_es_idempotente`, `test_se_puede_desactivar_con_patch_y_reactivar_con_patch`, `test_el_listado_por_defecto_muestra_solo_activos_y_activo_false_los_inactivos`, `test_consulta_el_detalle_de_un_insumo_propio_aunque_este_inactivo` · B2: `test_desactivar_y_reactivar_el_insumo_conserva_sus_alergenos`, `test_los_alergenos_de_un_insumo_inactivo_se_gestionan_igual` · B5: `test_desactivar_un_insumo_persiste_y_le_quita_la_marca_de_habitual`, `test_reactivar_un_insumo_persiste` |
| Frontend | F1: `desactivar pide confirmación y deja el insumo inactivo con opción de reactivar`, `cancelar la desactivación no hace nada`, `si desactivar falla lo informa y el insumo sigue activo`, `un insumo inactivo se puede reactivar`, `si reactivar falla lo informa`, `muestra solo activos por defecto y pide al servidor los inactivos al cambiar el estado`, `sin insumos inactivos lo explica` |

**Estado:** cubierto en HU04 para el estado del insumo y su ausencia del listado de activos (el contrato que usará la elaboración). **Pendiente de HU05:** comprobar que el selector de insumos de una nueva elaboración no ofrece los inactivos (PT05-04 / PT05-14).

### PT04-11 — Acceder o modificar un insumo de otro productor
**Esperado:** el sistema rechaza el acceso.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_un_insumo_ajeno_o_inexistente_responde_404`, `test_lista_unicamente_los_insumos_del_productor`, `test_filtrar_por_un_ingrediente_ajeno_o_inexistente_devuelve_lista_vacia`, `test_las_rutas_requieren_autenticacion` · B2: `test_listar_un_insumo_ajeno_o_inexistente_responde_404`, `test_asociar_a_un_insumo_inexistente_o_ajeno_responde_404`, `test_cambiar_el_tipo_en_un_insumo_ajeno_o_inexistente_responde_404`, `test_quitar_en_un_insumo_ajeno_o_inexistente_responde_404`, `test_un_productor_no_ve_ni_modifica_los_alergenos_de_otro`, `test_las_rutas_requieren_autenticacion` |
| Frontend | F1: `un insumo inexistente o ajeno muestra el aviso de no disponible`, `un insumo inexistente muestra el aviso de no disponible` |

**Estado:** cubierto (automatizado).

### PT04-12 — Asociar un insumo a un ingrediente de otro productor
**Esperado:** el sistema rechaza la operación.

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_ingrediente_de_otro_productor_responde_422`, `test_ingrediente_inexistente_responde_422`, `test_ingrediente_inactivo_responde_422`, `test_cambiar_a_un_ingrediente_no_valido_responde_422_y_no_cambia_nada` |
| Frontend | F1: `muestra «Ingrediente no válido» en el selector de ingrediente`, `muestra todos los campos, el selector de ingredientes activos y los textos de ayuda` (el selector solo ofrece ingredientes propios y activos) |

**Estado:** cubierto (automatizado).

### PT04-13 — Registrar un insumo desde un dispositivo móvil
**Esperado:** el formulario se visualiza y opera correctamente.

| Capa | Pruebas |
|------|---------|
| Backend | — |
| Frontend (verificación estructural) | F1 (grupo «PT04-13: adaptación a dispositivos móviles (verificación estructural)», agregado en T04-06): `el formulario usa campos y botones a ancho completo en celular y en fila desde sm`, `el listado muestra tarjetas en celular y tabla desde md`, `los filtros se pliegan detrás de un botón en celular`, `el detalle apila las acciones a ancho completo en celular`, `la sección de alérgenos pasa de una a dos columnas desde sm`, `el formulario embebido (diálogo de HU05) conserva los botones a ancho completo` · F1: `ofrece tabla en escritorio y tarjetas en celular, con enlaces reales al detalle` |
| Manual | **Verificación manual en un celular real: PENDIENTE** (ver «Pendientes») |

**Estado:** cubierto solo **estructuralmente**. Las pruebas comprueban que la interfaz declare el comportamiento adaptable (clases `w-full`, `sm:w-auto`, `md:hidden`, `sm:grid-cols-2`, botón «Filtros»), porque jsdom no calcula estilos ni tamaños de pantalla. **No reemplazan** la prueba en un dispositivo real.

### PT04-14 — Validar estados de carga, errores y ausencia de insumos
**Esperado:** la interfaz muestra estados y mensajes adecuados.

| Capa | Pruebas |
|------|---------|
| Backend | — Los estados son de la interfaz; los mensajes de error de la API están cubiertos en PT04-02, PT04-04, PT04-11 y PT04-12. |
| Frontend | F1 (listado): `muestra el estado de carga`, `muestra el error y permite reintentar`, `sin insumos, explica qué hacer y lleva al formulario`, `sin insumos inactivos lo explica`, `busca por nombre, marca u origen o código de barras y permite limpiar` (estado «No encontramos insumos») · F1 (formulario): `sin ingredientes activos ofrece crear uno`, `si falla la carga de ingredientes permite reintentar`, `un error inesperado muestra un mensaje general`, `muestra el error del backend en el campo que corresponde`, `avisa antes de salir con cambios sin guardar` · F1 (detalle y alérgenos): `un insumo inexistente o ajeno muestra el aviso de no disponible`, `muestra el error si falla la carga y permite reintentar`, `si falla el catálogo no ofrece agregar y permite reintentar`, `pide elegir un alérgeno antes de agregar`, `muestra el mensaje del backend si no se pudo agregar` |

**Estado:** cubierto (automatizado).

---

## Criterios de aceptación

| CA | Criterio (resumen) | Cubierto por | Estado |
|----|--------------------|--------------|--------|
| CA01 | Registrar con nombre, marca u origen e ingrediente | PT04-01, PT04-03 | Cubierto |
| CA02 | Opcionales: presentación, código de barras, ingredientes declarados, advertencias | PT04-01; B1 `test_crea_un_insumo_con_todos_los_datos_opcionales_y_de_fuente`; B3 `test_persiste_los_campos_opcionales_y_la_ficha_de_la_fuente` | Cubierto |
| CA03 | Código de barras único por productor | PT04-04, PT04-05 | Cubierto |
| CA04 | Alérgenos desde el catálogo | PT04-06; B2 `test_un_alergeno_inexistente_en_el_catalogo_responde_422` | Cubierto |
| CA05 | Alérgeno con tipo contiene o trazas | PT04-06 | Cubierto |
| CA06 | Varios insumos por ingrediente | PT04-07 | Cubierto |
| CA07 | Un solo habitual por ingrediente | PT04-08 | Cubierto |
| CA08 | Listar, consultar y modificar | PT04-09; PT04-14 | Cubierto |
| CA09 | Modificar un insumo no altera elaboraciones registradas | **Pendiente de HU05 (PT05-12)**: las elaboraciones aún no existen | **Pendiente** |
| CA10 | Desactivar; no disponible para nuevas elaboraciones | PT04-10 (estado y listado); la oferta en elaboraciones se comprueba en HU05 | Cubierto en HU04; parte pendiente de HU05 |
| CA11 | El insumo pertenece solo a su productor | PT04-11, PT04-12 | Cubierto |
| CA12 | Ficha con fuente y fecha de recuperación | B1 `test_crea_un_insumo_con_todos_los_datos_opcionales_y_de_fuente`; B3 `test_persiste_los_campos_opcionales_y_la_ficha_de_la_fuente`; F1 `muestra la información, el estado y la fuente`, `el hook admite precarga y campos de una fuente externa para HU13` | Cubierto |
| CA13 | Formulario adaptable a móviles | PT04-13 | Estructural cubierto; **manual pendiente** |

---

## Pruebas de persistencia (agregadas en T04-04)

Archivo `backend/tests/test_persistencia_insumos_hu04.py`. El resto de las pruebas de API comparte **una sola sesión de base de datos** entre la petición y las comprobaciones, por lo que una confirmación (`commit`) faltante pasaría inadvertida: el cambio seguiría visible en esa sesión. Estas pruebas reproducen la producción:

- cada petición recibe su **propia sesión**, que se cierra al terminar (un cambio sin confirmar se pierde);
- el resultado se lee con **otra sesión, sobre otra conexión**, que solo ve lo confirmado;
- SQLite usa una base temporal en archivo (la base en memoria comparte una única conexión); PostgreSQL usa la base de pruebas con conexiones separadas.

| Prueba | Qué verifica desde la sesión independiente |
|--------|-------------------------------------------|
| `test_el_lector_independiente_no_ve_lo_que_no_se_confirmo` | Control del montaje: lo que solo se hizo `flush` no es visible |
| `test_crear_un_insumo_persiste` | Datos, ingrediente, productor, estado y fuente |
| `test_modificar_un_insumo_persiste` | Campos modificados, borrado de la presentación y código nuevo |
| `test_desactivar_un_insumo_persiste_y_le_quita_la_marca_de_habitual` | `activo = false` y `habitual = false` |
| `test_reactivar_un_insumo_persiste` | `activo = true`, sin recuperar el habitual |
| `test_marcar_un_habitual_persiste_el_cambio_de_las_dos_filas` | El anterior se desmarca y el nuevo se marca |
| `test_asociar_un_alergeno_persiste` | Fila en `insumos_alergenos` con tipo `contiene` |
| `test_cambiar_el_tipo_de_un_alergeno_persiste` | Tipo `trazas` |
| `test_quitar_un_alergeno_persiste` | La fila ya no existe |
| `test_las_operaciones_de_alergenos_renuevan_updated_at_tambien_al_leer_con_otra_sesion` | `updated_at` renovado y confirmado |

Complemento en B2: `test_asociar_un_alergeno_renueva_updated_at_del_insumo`, `test_cambiar_el_tipo_renueva_updated_at_del_insumo`, `test_quitar_un_alergeno_renueva_updated_at_del_insumo` y `test_lo_que_no_cambia_nada_no_renueva_updated_at`.

**Comprobación de que detectan la falta de confirmación:** al reemplazar cada `commit` por un `flush` en el servicio (crear, modificar, desactivar, asociar, cambiar tipo y quitar alérgeno), falla la prueba de persistencia de esa operación (T04-04, mutaciones A1 a A6). Con la misma falta de confirmación en desactivar, las 7 pruebas de la sesión compartida de T04-03 siguen pasando: esa es la brecha que cierran estas pruebas.

---

## Pruebas de migración (solo PostgreSQL)

| Migración | Archivo | Pruebas | Cubre |
|-----------|---------|---------|-------|
| `013_insumos_comerciales` | B7 | 15 | Tabla y columnas, claves foráneas, 2 índices simples y 2 parciales, datos previos intactos, comportamiento de los índices, valores por defecto, downgrade y reversibilidad |
| `014_insumos_alergenos` | B8 | 15 | Tabla y columnas, clave compuesta, claves foráneas (`CASCADE` y `RESTRICT`), `CHECK` del tipo, datos previos intactos, unicidad y tipos, downgrade y reversibilidad |

Ambas se niegan a correr si la base no es PostgreSQL o su nombre no termina en `_test`. Las migraciones se aplicaron en `trazapp` (`alembic current` → `014_insumos_alergenos (head)`).

---

## Calidad de las pruebas: mutaciones

En cada tarea se rompió a propósito una regla a la vez, copiando antes el archivo original y restaurándolo después desde esa copia, para comprobar que alguna prueba falla:

| Tarea | Mutaciones | Detectadas |
|-------|-----------|------------|
| T04-01 / T04-02 | índices y restricciones de los modelos (3 + 3) | 6 de 6 |
| T04-03 | reglas del servicio y del validador | 7 de 7 |
| T04-04 | alérgenos del insumo | 8 de 8 |
| T04-04 (ajustes) | commit por operación, `updated_at` | 6 de 6 y 4 de 4 (+ contraste con sesión compartida) |
| T04-05 | frontend: `409`, duplicado, reactivación, tipo, estado, confirmación, menú, `embedded`, dígito verificador | 9 de 9 |
| T04-06 | frontend: clases responsive, habitual al editar, filtro de ingrediente, marca u origen | 7 de 7 (una mutación mal planteada se rehízo) |

---

## Pendientes

1. **PT04-13 — verificación manual en un celular real: PENDIENTE.** Probar en Chrome para Android y Safari para iOS (con la interfaz servida por HTTPS o en la red local):
   - abrir `/insumos/nuevo` y comprobar que los campos y botones ocupan el ancho y se pueden tocar sin zoom;
   - registrar un insumo completo (nombre, marca u origen, ingrediente, código de barras) y verlo en el listado;
   - en el listado, confirmar las tarjetas, el botón «Filtros» y los filtros por ingrediente y estado;
   - en el detalle, declarar un alérgeno como «Contiene» y otro como «Puede contener», cambiar uno de tipo y quitarlo;
   - desactivar y reactivar el insumo.
2. **CA09 — pendiente de HU05 (PT05-12):** modificar un insumo ya utilizado en una elaboración finalizada no debe alterarla. No se puede verificar hasta que existan las elaboraciones.
3. **CA10, parte de elaboraciones — pendiente de HU05:** que el insumo desactivado no se ofrezca al registrar una elaboración.

---

## Observaciones

- Las pruebas de PT04-13 son estructurales; la apariencia real depende de la prueba manual del punto 1.
- El `409` de código de barras repetido llega con `detail` como objeto (`mensaje`, `insumo_id`, `activo`); `apiClient.ts` lo interpreta sin afectar a los demás errores (pruebas en F2).
- El único dato fuera del alcance de HU04 que se ejercita es el catálogo de alérgenos (HT03), que las pruebas de API crean en cada caso.
