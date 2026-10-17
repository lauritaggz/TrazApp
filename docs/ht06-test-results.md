# HT06 — Resultados de pruebas (HT06-08)

**Fecha:** 2026-10-17
**Rama:** `feature/ht06-flujo-elaboracion`
**HEAD al ejecutar:** `cbc5ceb` (HT06-01 a HT06-07 comprometidas) más los cambios de HT06-08, todavía sin commit
**Historia:** HT06 — Simplificación del flujo de elaboración y revisión de alérgenos
**Criterios de referencia:** CA01 … CA11 (Contexto de la HT06, sección 5)
**Entorno:** backend con Python 3.12 (contenedor) sobre SQLite en memoria y sobre PostgreSQL 16 (contenedor `trazapp-database`, base aislada `trazapp_test`); frontend con Vitest y Vite (Node local). Migración aplicada en `trazapp`: `017_alergenos_revisados_ht06` (`alembic current`). La base `trazapp_test` la recrean las propias pruebas en cada corrida.

---

## Resumen del problema

Una auditoría de solo lectura del frontend y del backend, hecha al terminar HU05, encontró dos problemas.

**1. Integridad: los alérgenos no tenían estado de revisión.** Que un insumo no tuviera alérgenos se representaba solo con la ausencia de filas en `insumos_alergenos`, así que no se distinguía "revisado, sin alérgenos" de "nunca declarado". El alta de insumo no aceptaba alérgenos, el diálogo para registrar un insumo desde la elaboración tampoco, y la finalización no los validaba. Consecuencia: una elaboración podía quedar finalizada, y por lo tanto inmutable, con `"alergenos": []` para un insumo que nadie revisó, y la interfaz mostraba "Sin alérgenos declarados" en los dos casos.

**2. Usabilidad: el flujo frecuente no aprovechaba lo ya registrado.** La segunda elaboración del mismo producto, con los mismos insumos y lotes, tomaba 21 interacciones (16 si los insumos eran habituales). No había entrada directa desde el Dashboard, no se aprovechaba la elaboración anterior, no había "registrar otra" al terminar, los borradores no tenían un lugar visible y crear un producto devolvía al listado.

---

## Resumen de ejecución

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Backend, SQLite | `python -m pytest -q` (sin `TEST_DATABASE_URL`) | 896 aprobadas, 147 omitidas, 0 fallos (12 min 46 s) |
| Backend, PostgreSQL | `python -m pytest -q` (con `TEST_DATABASE_URL` → `trazapp_test`) | 1043 aprobadas, 0 omitidas, 0 fallos (23 min 53 s) |
| Frontend | `npx vitest run` | 23 archivos, 553 pruebas aprobadas, 0 fallos |
| Frontend, estabilidad | 5 corridas completas seguidas, con las dos suites de backend corriendo a la vez | 5 de 5 sin fallos (553 aprobadas cada una) |
| Build | `npm run build` | correcto (`tsc -b` + `vite build`) |
| Type check | `npx tsc -b` | sin errores |

**Línea base (merge de HU05):** SQLite 770 aprobadas y 133 omitidas, PostgreSQL 903, frontend 452. **Diferencia:** +126 / +14 omitidas en SQLite, +140 en PostgreSQL, +101 en el frontend.

Las pruebas omitidas en SQLite son las que exigen PostgreSQL (migraciones, triggers, bloqueos de fila y conexiones simultáneas); se ejecutan en la corrida de PostgreSQL, donde no hay ninguna omitida. Los tiempos de HT06-08 son más largos que los de tareas anteriores porque las suites corrieron a la vez con las cinco corridas del frontend.

Pruebas propias de la HT06 (con los casos parametrizados): backend 140 (en PostgreSQL; 8 archivos), frontend 101 (en 6 archivos).

---

## Qué se implementó

| Tarea | Qué hace |
|-------|----------|
| **HT06-01** — Modelo y migración 017 | Columna `alergenos_revisados_at` (timestamptz, nula) en `insumos_comerciales`. En la migración, un insumo con al menos una fila en `insumos_alergenos` queda revisado con la hora de la migración; uno sin filas queda en NULL. El downgrade se niega, con un mensaje claro, si algún insumo está revisado y no tiene filas (esa información se perdería). El schema de lectura expone `alergenos_revisados` y `alergenos_revisados_at`. |
| **HT06-02** — Alta con alérgenos y declaración en bloque | `POST /gestion/insumos` acepta `alergenos` (presente, incluso `[]`: crea todo en una transacción y deja el insumo revisado; ausente o `null`: sin revisar). Nuevo `PUT /gestion/insumos/{id}/alergenos` que reemplaza la lista completa con `FOR UPDATE`, igual que PATCH admite un insumo inactivo. Los endpoints individuales también marcan la revisión. 422 por alérgeno inexistente, repetido o tipo inválido, sin dejar nada a medias. |
| **HT06-03** — La finalización exige alérgenos revisados | Nuevo problema `alergenos_sin_revisar` (misma estructura que los demás: `falta`), solo si la línea tiene un insumo activo, evaluado con los insumos bloqueados. La copia (`informacion_conservada`) conserva `alergenos_revisados_at`; el detalle lo expone por línea. |
| **HT06-04** — Prellenado y lote sugerido | `create_borrador` parte del insumo de la última elaboración finalizada del producto (si sigue activo y del mismo ingrediente), si no del habitual. **Nunca asigna un lote.** El detalle de un borrador trae `lote_sugerido` (no vencido) y `alergenos_revisados` por línea. La copia sube a esquema 2. |
| **HT06-05** — Selector de alérgenos | Componente controlado `AlergenosSelector` en el formulario de creación de insumo y en el diálogo de la elaboración; no se guarda sin declarar o confirmar «Este insumo no contiene alérgenos». La sección de alérgenos del detalle muestra el estado y ofrece «Confirmar que no contiene alérgenos». El listado marca «Alérgenos sin revisar». |
| **HT06-06** — Registro de elaboración | Por línea, la marca «Alérgenos sin revisar» y el botón «Revisar alérgenos» (diálogo que guarda con el PUT sin perder lo no guardado); el 409 `alergenos_sin_revisar` resalta la línea. Botón «Usar lote …» por línea y «Usar los mismos lotes» en el encabezado, por el mismo estado y el mismo guardado de «lote existente». El detalle de una finalizada distingue «No contiene alérgenos (revisado el …)» de «Sin información de revisión de alérgenos». |
| **HT06-07** — Accesos directos | Crear un producto lleva a su detalle. Dashboard: «Nueva elaboración» (selector solo con productos con formulación, gracias a `tiene_formulacion` en el listado de productos) y «Elaboraciones en curso» (hasta 5 borradores). El detalle de una finalizada ofrece «Registrar otra elaboración» con el producto fijado. |
| **HT06-08** — Medición y documentación | Recorridos de los escenarios A y B con un contador explícito; este documento; y la corrección de una prueba intermitente (ver más abajo). |

---

## Archivos de prueba (leyenda de las tablas)

| Clave | Archivo | Qué cubre |
|-------|---------|-----------|
| **B1** | `backend/tests/test_migracion_017_alergenos_revisados.py` | Migración 017: upgrade, datos existentes, downgrade y su negativa, reversibilidad (PostgreSQL) |
| **B2** | `backend/tests/test_insumo_revision_alergenos_ht06.py` | Columna y campos de lectura del insumo |
| **B3** | `backend/tests/test_alergenos_en_bloque_ht06.py` | Alta con alérgenos, `PUT`, endpoints individuales e invariante «con filas ⇒ revisado» |
| **B4** | `backend/tests/test_persistencia_alergenos_ht06.py` | Persistencia desde otra sesión, atomicidad y bloqueo `FOR UPDATE` del `PUT` |
| **B5** | `backend/tests/test_finalizacion_alergenos_ht06.py` | El problema `alergenos_sin_revisar`, la copia, el esquema 2 y la lectura de copias antiguas |
| **B6** | `backend/tests/test_persistencia_finalizacion_alergenos_ht06.py` | La copia guardada en la base y la revisión concurrente durante la finalización |
| **B7** | `backend/tests/test_prellenado_borrador_ht06.py` | Prellenado, desempate de «la última», `lote_sugerido` y `alergenos_revisados` |
| **B8** | `backend/tests/test_producto_tiene_formulacion_ht06.py` | `tiene_formulacion` en las respuestas del producto |
| **F1** | `frontend/src/insumos/ht06.alergenos.test.tsx` | `AlergenosSelector`, formulario de creación, diálogo de la elaboración, sección del detalle y marca del listado |
| **F2** | `frontend/src/elaboraciones/hu05.elaboraciones.test.tsx` | Bloques «(HT06-06)»: revisión por línea, 409, lote sugerido, «Usar los mismos lotes» y detalle de la finalizada |
| **F3** | `frontend/src/dashboard/ht06.accesos.test.tsx` | Dashboard («Nueva elaboración», «Elaboraciones en curso») y «Registrar otra elaboración» |
| **F4** | `frontend/src/recorridos/ht06.recorridos.test.tsx` | Medición de los escenarios A y B |
| **F5** | `frontend/src/products/hu01.products.test.tsx` | Producto nuevo → detalle (pruebas «HT06-07») |
| **F6** | `frontend/src/auth/hu12.auth.test.tsx` | Regresión de la prueba intermitente del Perfil |

Para los nombres de prueba, el prefijo de grupo en F1, F2 y F3 es el de su bloque `describe`.

---

## Trazabilidad CA01 … CA11

### CA01 — Declarar los alérgenos en el mismo formulario al registrar un insumo
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_el_alta_con_alergenos_crea_el_insumo_con_sus_filas_y_lo_deja_revisado`, `test_el_alta_es_todo_o_nada_ante_una_lista_invalida` · B4: `test_el_alta_con_alergenos_se_confirma_con_el_insumo_las_filas_y_la_fecha`, `test_un_fallo_al_confirmar_el_alta_no_deja_ni_el_insumo_ni_las_filas` |
| Frontend | F1 «Formulario de creación de insumo: alérgenos (HT06)»: `incluye el selector de alérgenos`, `envía la lista de alérgenos declarados en el mismo POST` · F1 «Diálogo «Registrar insumo nuevo» de la elaboración: alérgenos (HT06)»: `envía los alérgenos declarados en el mismo POST que crea el insumo` |

### CA02 — Confirmar explícitamente «Este insumo no contiene alérgenos»
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_el_alta_con_lista_vacia_queda_revisada_sin_alergenos`, `test_el_alta_sin_el_campo_queda_sin_revisar`, `test_el_put_con_lista_vacia_sobre_un_insumo_sin_revisar_lo_marca_revisado` |
| Frontend | F1 «AlergenosSelector: los tres estados»: `«no contiene alérgenos»: la casilla marcada deja el valor válido sin lista` · «AlergenosSelector: comportamiento»: `al agregar un alérgeno la casilla marcada se desmarca sola y queda deshabilitada` · «Formulario de creación…»: `no guarda sin declarar los alérgenos ni confirmar que no contiene: muestra el mensaje y enfoca la casilla`, `con «Este insumo no contiene alérgenos» envía una lista vacía` · «Diálogo…»: `no registra el insumo sin declarar los alérgenos ni confirmar que no contiene` |

### CA03 — Distinguir «sin alérgenos (revisado)» de «sin revisar» en el listado y el detalle
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_upgrade_marca_revisado_solo_el_insumo_con_alergenos_y_no_toca_nada_mas` · B2: `test_revisado_sin_alergenos_se_distingue_de_sin_revisar`, `test_el_detalle_y_el_listado_exponen_el_estado_de_revision` |
| Frontend | F1 «Sección de alérgenos del detalle: estado y confirmación (HT06)»: `sin revisar y sin alérgenos: lo indica y ofrece «Confirmar que no contiene alérgenos»`, `revisado y sin alérgenos: muestra «Revisado: no contiene alérgenos» y no ofrece confirmar`, `el botón llama al PUT con una lista vacía y el estado pasa a «Revisado: no contiene alérgenos»`, `quitar el último alérgeno deja el insumo «Revisado: no contiene alérgenos», no «sin revisar»` · «Listado de insumos: marca «Alérgenos sin revisar» (HT06)»: `marca los insumos con los alérgenos sin revisar`, `no marca como problema a los revisados, ni con alérgenos ni sin alérgenos`, `la marca aparece también en la tarjeta del celular, solo para el insumo sin revisar` |

### CA04 — No finalizar con insumos sin revisar, indicando la línea
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B5: `test_no_finaliza_con_un_insumo_sin_revisar_y_el_409_indica_la_linea`, `test_el_problema_tiene_la_misma_estructura_que_los_demas`, `test_finaliza_cuando_todos_los_insumos_estan_revisados_incluido_revisado_sin_alergenos`, `test_no_se_reporta_alergenos_sin_revisar_si_el_insumo_esta_desactivado`, `test_no_se_reporta_alergenos_sin_revisar_si_la_linea_no_tiene_insumo`, `test_varios_problemas_se_devuelven_todos_juntos_y_en_el_orden_de_la_formulacion` · B6: `test_un_bloqueo_por_alergenos_sin_revisar_no_deja_copias_ni_cambia_el_estado`, `test_la_revision_se_evalua_con_el_insumo_bloqueado_y_una_revision_concurrente_espera` |
| Frontend | F2 «Registro: el 409 «alergenos_sin_revisar» (HT06-06)»: `resalta la línea y ofrece el botón «Revisar alérgenos» aunque la pantalla creyera que estaba revisado` · F2 (HT06-03): `el motivo «alergenos_sin_revisar» (HT06-03) se muestra en la línea del insumo afectado`, `un motivo que esta versión no conoce no rompe la pantalla y se muestra con un texto genérico` |

### CA05 — Revisar y confirmar los alérgenos desde el registro, sin salir de la pantalla
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_el_put_reemplaza_la_lista_completa_y_deja_el_insumo_revisado`, `test_el_put_es_idempotente_y_solo_renueva_la_fecha`, `test_el_put_sobre_un_insumo_inactivo_se_permite_igual_que_el_patch` · B4: `test_el_put_espera_a_quien_retiene_el_insumo_con_for_share_como_la_finalizacion`, `test_dos_put_simultaneos_dejan_una_de_las_dos_listas_completa` |
| Frontend | F2 «Registro: alérgenos sin revisar por línea (HT06-06)»: `la marca sigue al insumo seleccionado: al cambiarlo se actualiza, en los dos sentidos`, `guardar llama al PUT, quita la marca, cierra el diálogo y no navega`, `conserva las asignaciones y los cambios que aún no se guardaron`, `revisar un insumo actualiza todas las líneas que lo usan`, `si el PUT falla lo informa dentro del diálogo y la marca sigue` · «Registro: el 409 …»: `al revisar el insumo desde esa línea desaparece el problema y el aviso general` |

### CA06 — Prellenar el borrador con el insumo usado la vez anterior
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B7: `test_el_borrador_parte_del_insumo_de_la_ultima_finalizada`, `test_ignora_los_borradores`, `test_ignora_las_finalizadas_de_otros_productos`, `test_ignora_las_finalizadas_de_otros_productores`, `test_la_ultima_se_decide_primero_por_fecha_de_elaboracion`, `test_con_la_misma_fecha_gana_la_finalizada_mas_reciente`, `test_con_la_misma_fecha_y_la_misma_finalizacion_gana_el_id_mayor`, `test_un_insumo_anterior_desactivado_cae_al_habitual`, `test_un_insumo_anterior_desactivado_sin_habitual_deja_la_linea_vacia`, `test_un_insumo_que_cambio_de_ingrediente_cae_al_habitual_o_queda_vacio`, `test_un_ingrediente_nuevo_en_la_version_vigente_cae_al_habitual`, `test_el_primer_borrador_de_un_producto_sin_finalizadas_se_comporta_como_antes` |

### CA07 — Sugerir el lote anterior; solo se asigna con una acción explícita, por línea o para todas
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B7: `test_nunca_asigna_un_lote_ni_sin_lote`, `test_sugiere_el_lote_de_la_ultima_finalizada_si_sigue_siendo_valido`, `test_no_sugiere_nada_si_el_uso_anterior_fue_sin_lote`, `test_no_sugiere_el_lote_si_el_insumo_de_la_linea_cambio`, `test_un_lote_vencido_no_se_sugiere` (incluye el borde: vence el mismo día, sí se sugiere), `test_el_vencimiento_se_compara_con_la_fecha_actual_del_borrador`, `test_no_hay_sugerencia_cuando_la_linea_ya_tiene_lote_o_sin_lote`, `test_en_una_finalizada_el_lote_sugerido_es_null` |
| Frontend | F2 «Registro: lote sugerido por línea (HT06-06)»: `ofrece «Usar lote {código} (vence …)» con la fecha, y sin «vence» si el lote no vence`, `al usarlo elige «Lote existente» con ese lote y se guarda por el mismo PUT de siempre`, `se oculta si la línea ya tiene «Sin lote»`, `se oculta si la línea ya tiene un lote, nuevo o existente`, `se oculta al cambiar el insumo, y vuelve si se elige otra vez el que trajo el servidor` · «Registro: «Usar los mismos lotes» (HT06-06)»: `asigna la sugerencia a todas las líneas elegibles y lo anuncia`, `solo toca las elegibles: una línea sin sugerencia queda igual y se cuenta en el anuncio`, `no pisa «Sin lote»: la línea que ya lo eligió queda como está`, `no pisa un lote nuevo ya escrito: la línea que lo eligió queda como está`, `se guarda por el camino existente: PUT /usos con «lote existente»` |

### CA08 — Iniciar una elaboración desde el Dashboard y ver las que están en curso
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B8: `test_con_formulacion_el_detalle_y_el_listado_lo_indican`, `test_el_listado_distingue_los_productos_con_y_sin_formulacion`, `test_las_lineas_de_una_version_que_ya_no_es_vigente_no_cuentan` |
| Frontend | F3 «Dashboard: acción «Nueva elaboración» (HT06-07)»: `está habilitada cuando algún producto tiene formulación, sin explicación`, `sin ningún producto con formulación está deshabilitada, explica por qué y enlaza a Productos`, `abre el diálogo con un selector que solo ofrece los productos con formulación`, `crear el borrador navega al registro de la elaboración, igual que desde el producto` · «Dashboard: sección «Elaboraciones en curso» (HT06-07)»: `pide solo los borradores, sin filtrar por producto`, `muestra cada borrador con el producto, el código, la fecha y un enlace a su registro`, `sin borradores la sección no se muestra`, `muestra como máximo 5, los más recientes primero (por fecha y, a igual fecha, el último registrado)` |

### CA09 — Crear un producto lleva a su detalle
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Frontend | F5: `HT06-07: crear un producto lleva a su detalle /productos/:id y no al listado`, `HT06-07: «Continuar al producto» sin imagen abre el detalle con el aviso de creación, por el mismo camino`, `permite presentación opcional y envía payload limpio`, `permite reintentar o continuar si falla la subida de imagen tras crear` · F4: `mide el recorrido completo…` (el producto nuevo abre su detalle sin un clic extra) |

### CA10 — «Registrar otra elaboración» al terminar una
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Frontend | F3 «Detalle de una elaboración finalizada: «Registrar otra elaboración» (HT06-07)»: `ofrece el botón junto a «Volver al producto»`, `abre el diálogo con el producto ya fijado: sin selector y con el nombre del producto`, `al crear navega al registro de la nueva elaboración`, `cancelar cierra el diálogo y no crea nada`, `si el producto ya no se puede elaborar, el error se ve dentro del diálogo` |

### CA11 — El escenario B toma 7 interacciones o menos desde el Dashboard
**Estado:** cubierto (automatizado, medido). **Resultado: 6 interacciones** (7 si un ingrediente no tenía lote la vez anterior).

| Capa | Pruebas |
|------|---------|
| Frontend | F4: `con los mismos insumos y lotes toma 6 interacciones desde el Dashboard hasta el detalle de la finalizada (meta CA11: 7 o menos)`, `si en la anterior un ingrediente no tenía lote, solo suma el «Sin lote» de esa línea: 7 interacciones` |

---

## Medición de los escenarios A y B

### Cómo se mide

Cada recorrido es una prueba de Vitest con `user-event` sobre las pantallas reales y una API simulada con estado propio (se comporta como el backend en lo que los recorridos usan: formulación, insumos, lotes, borrador prellenado desde la última finalizada, lote sugerido y finalización). La unidad de medida son las pantallas, no el servidor.

**Regla de conteo:** 1 interacción por cada clic, selección o campo escrito. Un campo escrito completo cuenta 1, sin importar cuántas teclas. Navegar entre páginas con un enlace cuenta como clic. Esperar a que algo aparezca no cuenta.

Para comparar con la línea base de la auditoría (que separa «clics» y «campos obligatorios») cada paso se clasifica como:
- **clic:** un botón, un enlace, una casilla o un radio;
- **campo:** un valor que el usuario escribe o elige en un selector (texto, fecha, número, unidad, producto).

Un contador explícito acumula los pasos. Cada prueba afirma el **desglose por etapa** y el total, de modo que falla si el flujo se alarga o cambia. Para ejecutarlo: `npx vitest run src/recorridos`.

### Resultado

| Escenario | Antes de HT06 | Después de HT06 |
|-----------|---------------|-----------------|
| **B.** Segunda elaboración del mismo producto, con los mismos insumos (ya revisados) y los mismos lotes, desde el Dashboard hasta el detalle de la finalizada | 21 interacciones (16 con insumos habituales) | **6 interacciones** (5 clics + 1 campo). Meta CA11: 7 o menos → **cumplida** |
| **B′.** Igual, pero un ingrediente no tenía lote la vez anterior | — | **7 interacciones** (cumple la meta, sin margen) |
| **A.** Producto nuevo con 5 ingredientes que no existen, hasta finalizar su primera elaboración | 34 clics y 30 campos obligatorios (64) | **38 clics y 30 campos (68)** |

El valor «antes» es el documentado en la auditoría. No se re-mide porque el flujo anterior ya no existe en el código.

**El escenario A sube, y es un costo buscado.** Pasa de 34 a 38 clics (+4); los campos se mantienen en 30. Cada insumo nuevo exige ahora declarar sus alérgenos o confirmar «Este insumo no contiene alérgenos»: son 5 clics más, uno por cada uno de los 5 insumos. Se compensa en parte con 1 clic menos, porque crear el producto ya abre su detalle (antes devolvía al listado y había que abrirlo). Eso suma 34 + 5 − 1 = 38, consistente con lo medido, aunque la ruta de la línea base no se pueda repetir para comprobarlo. Es el precio de la integridad que la historia buscaba: ya no puede finalizarse una elaboración con alérgenos sin revisar. El escenario A ocurre una vez por producto; el B es el que se repite.

### Desglose del escenario B (6 interacciones)

| # | Etapa | Interacción | Tipo |
|---|-------|-------------|------|
| 1 | Dashboard → crear el borrador | «Nueva elaboración» | clic |
| 2 | Dashboard → crear el borrador | Producto: Queque de vainilla | campo |
| 3 | Dashboard → crear el borrador | «Crear borrador» (el código y la fecha ya vienen sugeridos) | clic |
| 4 | Registro: lotes | «Usar los mismos lotes» (los dos insumos ya vienen elegidos) | clic |
| 5 | Finalizar | «Finalizar elaboración» (guarda el borrador por sí sola) | clic |
| 6 | Finalizar | Confirmar «Finalizar» | clic |

Con un ingrediente sin lote la vez anterior (B′) se agrega «Sin lote» de esa línea en la etapa «Registro: lotes», y el total es 7.

### Desglose del escenario A (38 clics y 30 campos)

| Etapa | Clics | Campos | Qué incluye |
|-------|------:|-------:|-------------|
| Producto nuevo | 2 | 5 | «+ Nuevo producto» y «Guardar producto»; código interno, nombre, descripción, contenido neto y unidad |
| Formulación (5 ingredientes nuevos) | 12 | 10 | «Definir formulación»; por cada ingrediente «Crear ingrediente nuevo» y «Crear ingrediente» (10 clics) con su código y nombre (10 campos); «Guardar formulación» |
| Crear el borrador | 2 | 0 | «Registrar elaboración» y «Crear borrador» (código y fecha sugeridos) |
| Insumos y lotes (5 líneas) | 20 | 15 | Por cada línea: «Registrar insumo nuevo», **«Este insumo no contiene alérgenos»**, «Registrar insumo» y «Lote nuevo» (4 clics) con nombre del insumo, marca y código del lote (3 campos) |
| Finalizar | 2 | 0 | «Finalizar elaboración» y confirmar «Finalizar» |
| **Total** | **38** | **30** | **68 interacciones** |

---

## Pruebas existentes que cambiaron de comportamiento

Ninguna se eliminó ni se relajó una aserción: se actualizaron porque el comportamiento cambió a propósito. Los puntos de ajuste comunes (fixtures) están marcados.

| Tarea | Prueba o punto de ajuste | Por qué cambia |
|-------|--------------------------|----------------|
| HT06-02 | `test_las_operaciones_de_alergenos_no_alteran_el_resto_del_insumo` (`test_gestion_insumo_alergenos_hu04.py`) | Declarar alérgenos ahora registra la revisión: la prueba afirma el paso de «sin revisar» a «revisado» y compara el resto exacto. |
| HT06-03 | `crear_insumo` en `tests/escenario_hu05.py` (**un solo punto**) | Los insumos nacen «revisados, sin alérgenos» por defecto; con `revisado=False` se crean sin revisar. Resolvió 28 de las 32 pruebas de HU05 que fallaron. |
| HT06-03 | `test_la_informacion_conservada_tiene_la_estructura_aprobada`, `test_pt05_15_el_detalle_de_una_finalizada_muestra_la_informacion_conservada`, `test_finalizar_persiste_el_estado_la_fecha_y_el_json_completo_de_cada_uso`, `test_pt05_04_el_insumo_habitual_activo_queda_preseleccionado` | Exigen la clave nueva `alergenos_revisados_at` y que su valor sea igual a la fecha del insumo. La comparación del resto del objeto sigue siendo exacta. |
| HT06-04 | `test_la_informacion_conservada_tiene_la_estructura_aprobada` y `test_finalizar_persiste_el_estado_la_fecha_y_el_json_completo_de_cada_uso` (de nuevo), y `test_una_finalizada_sin_la_clave_se_lee_con_null_y_no_es_un_error` | Exigen `esquema: 2` en las copias nuevas; la copia antigua de prueba pasa a esquema 1. |
| HT06-05 | `hu04.insumos.test.tsx`: `fillValidForm`, `sin insumos, explica qué hacer y lleva al formulario`, `crea el insumo con la carga normalizada, con sus alérgenos, y avisa sin pedir declararlos después`, `PT04-03: registra un insumo con origen en vez de marca…`, `el hook admite precarga y campos de una fuente externa para HU13` | El formulario no guarda sin declarar los alérgenos; el POST lleva `alergenos`; el aviso ya no manda a declararlos después; el hook recibe `initialAlergenos`. |
| HT06-05 | `hu05.elaboraciones.test.tsx`: mocks de `listAlergenosCatalog` y `replaceInsumoAlergenos`, el helper `llenar`, `si el insumo nuevo es habitual, deja de serlo el anterior en las opciones` y `la pantalla «Nuevo insumo» mantiene el selector libre…` | El diálogo y la pantalla «Nuevo insumo» cargan el catálogo y exigen declarar los alérgenos. |
| HT06-06 | `sin alérgenos declarados, lo indica en el resumen y en cada insumo` (ahora «revisados y sin alérgenos declarados…») | «Revisado, sin alérgenos» se muestra con su fecha en vez de «Sin alérgenos declarados.». |
| HT06-07 | `permite presentación opcional y envía payload limpio`, `evita doble envío mientras guarda` (creación), `permite reintentar o continuar si falla la subida de imagen tras crear` (`hu01.products.test.tsx`) | Tras crear un producto la aplicación va a su detalle, no al listado. |
| HT06-07 | Fixtures de `Product` en 7 archivos de prueba (`tiene_formulacion: false`); mock de `listElaboraciones` en `hu02.dashboard.test.tsx` | Campo nuevo requerido; el Dashboard pide los borradores. |
| HT06-07 | Pruebas de HU05 que buscaban los botones «Revisar alérgenos» y «Usar lote …» | Ahora tienen un `aria-label` con el nombre del ingrediente. El texto visible no cambió. |

---

## Decisiones de diseño

### Las cinco de la historia

- **D1 — Estado de revisión:** columna `alergenos_revisados_at` (fecha, no booleano: deja evidencia de cuándo). Los insumos existentes con alérgenos quedan revisados con **la hora de la migración**, y no con `updated_at`, porque esa columna cambia con cualquier edición y afirmaría una fecha de revisión que nadie hizo. Sin filas queda sin revisar.
- **D2 — Declaración:** `POST` con `alergenos` opcional y `PUT` en bloque; los endpoints individuales también marcan la revisión. Borrar el último alérgeno deja «revisado, sin alérgenos». La fecha usa la hora de la base (`func.now()`), la misma que `updated_at`.
- **D3 — Finalización:** nuevo problema `alergenos_sin_revisar` con la estructura de siempre, y `informacion_conservada` guarda la fecha de revisión. Las finalizadas anteriores no la tienen y se leen sin error.
- **D4 — Prellenado:** en el backend, en la misma transacción que crea el borrador. Parte de la última elaboración **finalizada** del producto (orden: `fecha_elaboracion`, `finalizada_at`, `id`, descendentes), con las columnas FK y no el JSON de la copia.
- **D5 — Navegación:** producto nuevo → detalle; Dashboard con «Nueva elaboración» y «Elaboraciones en curso»; «Registrar otra elaboración» en el detalle de una finalizada.

### Las que se ajustaron en el camino

| Decisión | Detalle |
|----------|---------|
| **Esquema 2 de la copia** | `informacion_conservada` pasa de `esquema` 1 a 2 en las finalizaciones nuevas, porque suma `alergenos_revisados_at`. Ningún trigger ni check depende del valor 1. Las copias con esquema 1 se leen igual, con la fecha en `null`. |
| **`alergenos_revisados` con `null`** | En una finalizada vale `true` si la copia tiene la fecha y **`null`** si no hay información (esquema 1), para que un `false` no se lea como «sin revisar» en una copia antigua. En un borrador es un booleano del insumo actual. El tipo es `bool \| None`. |
| **PATCH de mismo tipo** | Un `PATCH` que repite el tipo de un alérgeno no renueva la fecha de un insumo ya revisado (nada cambia, igual que con `updated_at`). Sí marca revisado un insumo que tenía filas pero no estaba revisado. |
| **`null` equivale a campo ausente** | `"alergenos": null` en el alta se trata como si el campo no viniera: el insumo queda sin revisar. |
| **El lote nunca se asigna** | El prellenado jamás asigna un lote ni «Sin lote». El detalle de un borrador solo lo **sugiere** (`lote_sugerido`), y se asigna con una acción explícita. No se sugiere un lote vencido (vencer el mismo día de la elaboración no cuenta como vencido) ni de otro insumo. |
| **Valor inicial no es revisión** | Un valor inicial del selector de alérgenos (por ejemplo, sugeridos por una fuente en HU13) no cuenta como revisado: la revisión ocurre al guardar el formulario. |
| **Formato de fecha DD-MM-AAAA** | Los textos nuevos usan guiones, como el resto de la interfaz, y no barras. La fecha de revisión se calcula en la hora de Santiago. |
| **Botones con `aria-label`** | «Revisar alérgenos» y «Usar lote …» llevan el nombre del ingrediente en su nombre accesible, igual que «Registrar insumo nuevo». |
| **`tiene_formulacion`** | Se agregó al listado de productos porque «Productos por completar» no lo calcula. Es verdadero si la versión **vigente** tiene al menos una línea; se resuelve con una sola consulta. |

---

## Mutaciones verificadas durante HT06

En cada tarea se rompió a propósito una regla a la vez, copiando antes el archivo original y restaurándolo después desde esa copia, para comprobar que alguna prueba falla. Todos los archivos quedaron idénticos a sus copias (comprobado con un hash del árbol).

| Tarea | Qué se rompió | Detectadas |
|-------|---------------|-----------|
| HT06-01 — Migración 017 y modelo | Marcar todos los insumos como revisados, usar `updated_at` como fecha, downgrade que nunca se niega, downgrade que se niega ante cualquier insumo revisado, valor por defecto en la columna y schema que siempre dice revisado | 6 de 6 |
| HT06-02 — Alta y `PUT` | El `POST` ignora `alergenos`, el `PUT` no fija la fecha, cada endpoint individual sin marcar (3), reemplazo parcial ante un error, 422 antes que 404, alta que marca sin el campo, repetidos sin validar, `PATCH` de mismo tipo sin marcar, reloj de la aplicación en vez de la base y `PUT` sin `FOR UPDATE` | 12 de 12 |
| HT06-03 — Finalización | Backend: quitar la validación, reportar con insumo desactivado, no copiar la fecha, fecha sin `Z`, reportar sin insumo, orden dentro de la línea, detalle sin la fecha y copia sin clave como error. Frontend: quitar el texto nuevo y quitar el texto de respaldo | 10 de 10 (8 + 2) |
| HT06-04 — Prellenado | Considerar borradores, no filtrar por activo, asignar el lote, sugerir un lote vencido, ignorar el desempate (completo y solo por id), invertir el borde del vencimiento, sugerir un lote de otro insumo, sugerir con lote ya elegido, no comprobar el ingrediente actual, `alergenos_revisados` siempre `true`, no limitar al producto e ignorar la última finalizada | 13 de 13 |
| HT06-05 — Selector y formularios | El formulario guarda sin declarar, el `POST` no envía `alergenos`, la casilla no se desmarca, el botón aparece con alérgenos, el listado marca a los revisados sin alérgenos, la casilla se marca con alérgenos, el botón confirma con una lista no vacía, el diálogo sin selector y el selector sin mensaje | 9 de 9 |
| HT06-06 — Registro y detalle | La marca usa el valor del servidor, «Usar los mismos lotes» pisa un lote, la sugerencia sigue tras cambiar el insumo, el detalle muestra «sin alérgenos» con `null`, el resumen afirma «no hay alérgenos» sin información, revisar no actualiza la lista, sin anuncio, el 409 sin botón y sin limpiar el problema | 9 de 9 |
| HT06-07 — Accesos directos | Crear un producto vuelve al listado, el selector incluye productos sin formulación, la sección aparece sin borradores, «Registrar otra» no fija el producto, sin límite de 5, sin orden, botón habilitado sin formulación y sin navegar al registro | 8 de 8 |
| HT06-08 — Medición y estabilidad | Que desaparezca el atajo «Usar los mismos lotes» (el recorrido B falla), que crear un producto vuelva al listado (el recorrido A falla) y volver a poner el bug del Perfil (la prueba de regresión falla) | 3 de 3 |
| **Total de la historia** | | **70 de 70** |

---

## La prueba intermitente del Perfil

**Prueba:** `Perfil HU12 > permite modificar nombre y nombre del negocio y guardar`. Falló dos veces de forma aislada durante HT06-06 y HT06-07, solo con la máquina cargada, y pasaba al repetirla sola.

**Cómo se encontró la causa.** Se reprodujo con 8 procesos saturando la CPU: falló 1 vez en 12 corridas, y el mensaje fue concluyente:

```
nombre: "Ana PerezAna Maria Perez"   (esperado: "Ana Maria Perez")
```

El `user.clear()` se había perdido y el texto nuevo se concatenó al valor original.

**Causa.** No era el test ni un temporizador: era una carrera real en `Profile.tsx`. El formulario ya arranca con los valores del productor (`useState`), pero además un `useEffect` sobre `[productor]` los volvía a copiar al montar la página. Ese efecto queda pendiente justo después del primer renderizado; si la primera edición del usuario ocurre antes de que corra, el efecto devuelve el valor original por encima de lo ya borrado. Con carga, la ventana se ensancha.

**Solución.** El efecto ya no copia al montar: solo copia cuando el productor **cambia después** (por ejemplo, tras guardar). Se guarda cuál fue el último productor copiado y se ignora el primero. No se subieron timeouts ni se relajó ninguna aserción.

**Prueba de regresión determinista.** `lo que el usuario escribe en el instante en que se monta el perfil no se pisa después` dispara la edición desde un `MutationObserver`, justo cuando el campo entra al DOM y antes de los efectos pendientes. **Falla 5 de 5 con el código anterior y pasa con la corrección.** Una primera versión de esa prueba pasaba con el código anterior (no reproducía la carrera) y se descartó.

**Demostración de estabilidad:**
- la prueba original, 40 corridas con la CPU saturada: 0 fallos (antes, 1 de 12);
- 5 corridas completas del frontend seguidas, con las suites de backend corriendo a la vez: 5 de 5 sin fallos.

---

## Deuda técnica y limitaciones

1. **Lista de alérgenos por tipo duplicada.** La presentación de los alérgenos agrupados por «Contiene» y «Puede contener» está escrita dos veces: en `AlergenosSelector` (controlado, sin llamadas) y en `InsumoAllergensSection` (llama a la API en cada acción). Se decidió no unificarlos porque persisten distinto. Ambos componentes llevan un comentario `TECHNICAL DEBT`; si cambia la presentación hay que cambiar los dos o extraer un componente de presentación compartido.
2. **Editar los ingredientes declarados o las advertencias de un insumo no invalida la revisión de alérgenos.** El texto del envase puede cambiar sin que se vuelva a revisar la lista de alérgenos. Queda como limitación documentada.
3. **Corregir la formulación desde un borrador sigue requiriendo eliminarlo.** Fuera de alcance de la HT06; afecta al versionado y queda para el Sprint 3.
4. **No hay listado global de elaboraciones.** Corresponde a HU06. El Dashboard muestra solo las 5 borradores más recientes y avisa cuántos hay en total.
5. **La sección «Elaboraciones en curso» no se muestra ni ofrece reintentar si falla su carga.** Es un bloque secundario; el resto del Dashboard sigue funcionando.
6. **«Nueva elaboración» no explica nada mientras se cargan los productos o si falla esa carga.** Solo dice «Define la formulación…» cuando ya se sabe que ningún producto la tiene.
7. **El escenario A sube de costo** (ver la medición): +4 clics por la declaración obligatoria de alérgenos. Es una decisión de integridad, no un defecto. Un asistente que encadene producto, formulación, insumos y elaboración queda fuera de alcance.
8. **La medición usa una API simulada.** Mide las pantallas, no tiempos reales ni usuarios reales. El servidor real tiene sus propias pruebas (B1 a B8).
9. **Alérgenos sugeridos por una fuente externa (HU13):** nunca marcan la revisión por sí solos; solo la marca el guardado explícito del formulario. HU13 debe usar `POST` con `alergenos` y `initialAlergenos`.

---

## Verificaciones manuales pendientes en un celular real

Las pruebas de adaptación a móviles son estructurales (clases responsive), porque jsdom no calcula estilos ni tamaños de pantalla. **No reemplazan** la prueba en un dispositivo real, que queda **pendiente**, junto con las de HU05. Probar en Chrome para Android y en Safari para iOS:

1. **Formulario de insumo (`/insumos/nuevo` y diálogo de la elaboración):** el selector de alérgenos se usa con una mano; la casilla «Este insumo no contiene alérgenos» y el mensaje de error se leen sin desbordar; el diálogo se desplaza completo.
2. **Registro de elaboración:** «Revisar alérgenos» y «Usar lote …» ocupan el ancho completo y se pueden tocar sin zoom; «Usar los mismos lotes» y su anuncio se ven sin que el teclado los tape; el diálogo «Revisar alérgenos» se abre como panel inferior.
3. **Dashboard:** «Nueva elaboración» deshabilitado con su explicación, el diálogo con el selector de producto y la sección «Elaboraciones en curso» se leen en una columna.
4. **Detalle de una finalizada:** «Registrar otra elaboración» y «Volver al producto» apilados a ancho completo; los textos «No contiene alérgenos (revisado el …)» y «Sin información de revisión de alérgenos» no se cortan.
5. **Producto nuevo:** al guardar se abre el detalle con el aviso de creación.

---

## Observaciones

- Una elaboración finalizada se sigue leyendo siempre desde su información conservada; la interfaz no consulta el insumo vigente. Revisar un insumo después de finalizar no cambia la copia ni el detalle (verificado desde una sesión independiente).
- `PUT /gestion/insumos/{id}/alergenos` toma `FOR UPDATE` sobre el insumo y la finalización lo toma `FOR SHARE`: una revisión que llega durante la finalización espera, y la finalización decide con el estado que bloqueó.
- La invariante «si un insumo tiene filas en `insumos_alergenos`, está revisado» se comprueba tras una secuencia de 17 operaciones, algunas inválidas o ajenas.
- La API no permite volver a dejar «sin revisar» un insumo ya revisado. Las pruebas que necesitan ese estado crean el insumo con `revisado=False` o lo fijan directamente en la base.
