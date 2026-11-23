# HU11 — Resultados de pruebas (T11-04)

**Fecha:** 2026-11-20  
**Rama:** `feature/hu11-evaluacion_utilidad` (con guion y guion bajo; ver i) — Pull Request #29 hacia `main`: https://github.com/lauritaggz/TrazApp/pull/29  
**Historia:** HU11 — Evaluación de utilidad de la información (Sprint 3, P2, 3 SP)  
**Criterios de referencia:** CA1 … CA7 y PT11-01 … PT11-07 (`docs/context/TrazApp_HU11_contexto_agente.md`, secciones 3 y 7).  
**Entorno:** backend en el contenedor `trazapp-backend` sobre SQLite y PostgreSQL 16; frontend con Vitest y Vite en el contenedor `trazapp-frontend`. **Migración nueva: `020_evaluacion_utilidad_hu11`.** Sin dependencias nuevas (el token usa PyJWT, que ya estaba).  
**Integración continua:** ejecución https://github.com/lauritaggz/TrazApp/actions/runs/44795959697 del merge de HU11 (Pull Request #29, commit `9d784bc`): los tres trabajos en verde (Backend SQLite, Backend PostgreSQL y Frontend). Antes, en la rama, la ejecución https://github.com/lauritaggz/TrazApp/actions/runs/44768408541 sobre el commit `962be25` (último commit con código; el de T11-04 solo agrega documentación). **Los tres trabajos en verde:** Backend (PostgreSQL) 2411 pruebas en 29 min, Backend (SQLite) 2208 pasan y 203 se saltan en 14 min, Frontend 1559 pruebas en 72 archivos en 2,5 min (C). **Captura:** `docs/test/validacion_hu11/ci_verde_hu11.png`: «All checks have passed», los 3 trabajos en verde en el Pull Request #29 para el commit `962be25` (Backend PostgreSQL 29 min, Backend SQLite 14 min, Frontend 2 min); corresponde a la ejecución de la rama, y el merge se cita con su enlace. La ejecución anterior (commit `21ab86a`, T11-03) falló en dos pruebas de HU14; ver k.

**Convención de las fuentes de los números:** **(E)** última corrida local informada en el reporte de la tarea que creó o tocó el archivo (T11-01, T11-02 o T11-03), en el contenedor, 18 a 20-11-2026; **(C)** corrida del CI de `962be25` (20-11-2026); **(L)** conteo de hoy con `pytest --collect-only` (recolección, no ejecución); **(M)** resultado manual informado por la desarrolladora. **Hoy no se corrió ninguna prueba ni mutación nueva**: la regresión la ejecuta el CI y las mutaciones salen de los reportes de cada tarea.

---

## a) Resumen

**Historia.** Como consumidor, quiero indicar de forma sencilla si la información consultada me resultó útil. HU11 deja la pregunta «¿Esta información te resultó útil?» al final de la ficha pública, el endpoint anónimo `POST /publico/productos/{id_publico}/evaluaciones` (una sola respuesta por consulta, mediante un token firmado de un solo uso), la tabla `evaluaciones_utilidad` (migración 020) sin datos de quien responde, y los resultados para el productor: `GET /gestion/productos/{id}/evaluaciones`, el campo `evaluacion_utilidad` en el listado y el detalle de productos, y la tarjeta «Evaluación de utilidad» en Publicaciones.

**Criterios cumplidos: 7 de 7.** Todos con pruebas automatizadas, CI en verde (C) y, en CA1, CA2, CA4, CA5, CA6 y CA7, también con la **prueba manual en celular informada por la desarrolladora** con capturas. CA3 queda cubierto por pruebas automatizadas (PT11-03 no tiene fila manual). El CI se cita con el enlace del merge y la captura `ci_verde_hu11.png`.

| Estado | Criterios |
|---|---|
| Cumplidos, verificados con pruebas automatizadas (E) y CI en verde (C) | CA1, CA2, CA3, CA4, CA5, CA6, CA7 |
| Además, con prueba manual informada y capturas (M) | CA1, CA2, CA4, CA5, CA6, CA7 |

### Pruebas automáticas de HU11, por archivo

**Backend** (67 pruebas nuevas en 4 archivos; corren en SQLite y PostgreSQL, salvo las de la migración, que son de PostgreSQL). Conteo (L) y resultado (E) del reporte de la tarea:

| Archivo | Pruebas (L) | SQLite (E) | PostgreSQL (E) | Tarea del resultado |
|---|---|---|---|---|
| `tests/test_evaluacion_token_hu11.py` | 7 | 7 | 7 | T11-01 |
| `tests/test_evaluacion_utilidad_hu11.py` | 24 | 24 | 24 | T11-01 (de nuevo en T11-03, tras tocar el repositorio) |
| `tests/test_migracion_020_evaluacion_hu11.py` | 11 | 1 pasa y 10 se saltan (solo PG) | 11 | T11-01 |
| `tests/test_evaluacion_resultados_hu11.py` | 25 | 25 | 25 | T11-03 |
| **Total de HU11** | **67** | | | |

Corrección de un número anterior: el reporte de T11-01 decía «45 nuevas»; el conteo real de sus tres archivos es **42** (7 + 24 + 11).

**Frontend** (20 pruebas nuevas en 2 archivos). **Resultado (E)**:

| Archivo | Pruebas | Resultado | Tarea |
|---|---|---|---|
| `publico/hu11.evaluacion.test.tsx` | 14 | 14 pasan | T11-02 (y de nuevo en T11-03) |
| `products/hu11.resultados.test.tsx` | 6 | 6 pasan | T11-03 |
| **Total de HU11** | **20** | | |

**Existentes que se corrieron por estar afectadas (E):**

- Backend: `test_consulta_publica_hu10` 56 y `test_vista_publica_gestion_hu10` 13 (SQLite y PostgreSQL); `test_gestion_productos` 28, `test_productos_conteos_elaboraciones_hu09` 7, `test_productos_publicacion_campos_hu09` 12 y `test_publicacion_endpoints_hu09` 20 (ambas bases); `test_publicacion_modelo_hu09` 12 (2 omitidas) en SQLite y 14 en PostgreSQL; migraciones 017 (3 con 11 omitidas / 14), 018 (1 con 15 omitidas / 16) y 019 (1 con 17 omitidas / 18).
- Frontend: `hu10.ficha` 19, `hu10.estados` 13, `hu10.vistaprevia` 9, `hu10.seleccion` 8, `hu10.formato` 6, `hu10.servicio` 4, `hu10.ruta` 3, `hu14.formulacion-oculta` 7 (T11-02: 83 pruebas en 9 archivos); `hu09.publicacion` 18, `hu09.qr` 15, `hu09.qr-service` 12, `hu09.publicaciones-general` 11, `hu09.visibilidad` 16 y `hu10.acciones-ficha` 7 (T11-03: 99 pruebas en 8 archivos). `tsc -b` y `vite build` sin errores en T11-02 y T11-03.

**Corrida completa del CI (C, `962be25`):** PostgreSQL 2411 pasan; SQLite 2208 pasan y 203 se saltan; Frontend 1559 pasan (72 archivos). Es la regresión completa, que incluye las pruebas de arriba.

**Pruebas existentes adaptadas** (ninguna aserción se relajó; cada cambio está explicado en la tarea):

| Archivo | Cambio | Tarea |
|---|---|---|
| `test_consulta_publica_hu10.py` (`RUTAS_APROBADAS`, lista blanca) | Suma `token_evaluacion` | T11-01 |
| `test_consulta_publica_hu10.py` (`…la_ficha_es_la_misma`) | Compara las tres fichas sin ese campo, porque cada token lleva un nonce distinto; agrega que los tres tokens son válidos y diferentes | T11-01 |
| `test_vista_publica_gestion_hu10.py` (`…previsualizacion_es_identica…`) | Compara sin el token; agrega que en la previsualización es `null` y en la pública solo está con `estado = ok` | T11-01 |
| `test_migracion_019_costos_hu14.py` (dos pruebas de cabeza) | Pasan de «cabeza == 019» a «una sola cabeza, la 019 en la cadena y colgando de la 018», como hizo HU14 con la 018 | T11-01 |
| Frontend: `fichaDePrueba` (ayuda de las pruebas de HU10) | Suma `token_evaluacion: null`; las pruebas de HU10 quedan igual | T11-02 |
| `test_costos_api_hu14.py` (2 aserciones de conteo exacto de consultas del detalle) | 12 → 13 y 5 → 6: el detalle suma la consulta agrupada de evaluaciones. Sigue sin depender del número de líneas, que es lo que protege la prueba | commit `962be25` (corrección del CI) |

---

## b) Trazabilidad PT11-01 … PT11-07

Evidencia = archivo y prueba (backend en `backend/tests/`, frontend en `frontend/src/`) o captura (en `docs/test/validacion_hu11/`). Los resultados manuales son los que informó la desarrolladora, tal como los dio (ver «Resultados manuales»).

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| PT11-01 | Abrir una ficha pública | Automatizada + manual | La pregunta aparece al final | `hu11.evaluacion`: «PT11-01: con token aparece al final, después de los insumos y antes del aviso», «…con token null no aparece (otros estados de la elaboración)», «…ni siquiera con un token en la respuesta, la previsualización muestra la pregunta»; backend: `test_token_solo_con_estado_ok_y_null_en_los_otros_estados`. Capturas: `pt11-01_pregunta.jpg`, `pt11-01_pregunta_ficha_publica.jpg`, `pt11-01_ficha_sin_pregunta.jpg` | La pregunta sale con token y no sale sin él ni en la previsualización. Manual: **OK** (pregunta visible en la ficha pública con token; vista previa de gestión sin pregunta) | Aprobado |
| PT11-02 | Responder «Sí» y luego, en otra consulta, «No» | Automatizada + manual | Ambas respuestas se registran | `test_evaluacion_utilidad_hu11.py`: `test_pt11_02_si_y_no_en_consultas_distintas_se_registran_ambas`, `test_la_eleccion_de_otra_elaboracion_queda_asociada_a_esa_elaboracion`; `hu11.evaluacion`: ««Sí» envía util=true… «No» envía util=false», «cambiar de elaboración reinicia la pregunta y usa el token nuevo». Captura: `pt11-02_agradecimiento.jpg` | Se guardan las dos respuestas, cada una con su consulta. Manual: **OK** (responder muestra el agradecimiento; el registro manual no informa «Sí» seguido de «No», eso está solo en la prueba automatizada) | Aprobado |
| PT11-03 | Responder sin sesión | Automatizada | Se registra sin pedir datos | `test_evaluacion_utilidad_hu11.py`: `test_pt11_03_responder_sin_sesion_devuelve_201`, `test_util_no_booleano_campo_extra_o_sin_token_da_422_sin_registrar`; `hu11.evaluacion`: «…sin Authorization aunque haya sesión» | 201 sin cuenta ni cabecera `Authorization`; el cuerpo solo admite `util` (`extra="forbid"`). **No hay fila manual para PT11-03** | Aprobado (automatizado) |
| PT11-04 | Intentar responder dos veces en la misma consulta | Automatizada + manual | La segunda respuesta no se registra | `test_pt11_04_el_mismo_token_dos_veces_da_409_y_una_sola_fila`, `test_la_carrera_del_mismo_nonce_cae_en_409_por_la_restriccion_unica`; `hu11.evaluacion`: «201 y 409 muestran el agradecimiento…», «un doble clic envía una sola vez…», «tras responder guarda solo la marca…». Captura: `pt11-04_recarga_agradecimiento.jpg` | El mismo token da 409 y queda una sola fila. Manual: **OK**: tras recargar la ficha (12:34) se muestra «¡Gracias por tu respuesta!» en lugar de la pregunta y no se generó un registro nuevo (siguen 5) | Aprobado |
| PT11-05 | Revisar el registro guardado | Automatizada + manual | Tiene producto, elaboración y respuesta; no tiene datos que identifiquen al consumidor | `test_pt11_05_la_fila_tiene_producto_elaboracion_y_respuesta`, `test_el_conjunto_exacto_de_columnas_no_tiene_ip_user_agent_ni_token`, `test_con_ip_user_agent_y_token_de_productor_la_fila_no_guarda_rastro`, `test_no_se_registra_token_nonce_ni_user_agent_en_los_logs`; `test_migracion_020_evaluacion_hu11.py`: `test_upgrade_020_crea_la_tabla_con_el_conjunto_exacto_de_columnas`, `test_el_modelo_coincide_con_la_migracion`. Captura: `pt11-05_registro_bd.png` | Columnas exactas: `id`, `producto_id`, `elaboracion_id`, `util`, `nonce_hash`, `fecha`. Manual: **OK**: esas seis columnas (fecha solo día), sin IP ni user agent; 5 registros (4 verdaderos y 1 falso), coherentes con 80 % | Aprobado |
| PT11-06 | Con 3 «Sí» y 1 «No», ver el resultado como productor | Automatizada + manual | Muestra 75 % de respuestas positivas | `test_evaluacion_resultados_hu11.py`: `test_pt11_06_tres_si_y_un_no_dan_75_por_ciento`, `test_half_up_por_el_endpoint_y_en_el_resumen_del_producto` (1/8→13, 1/3→33, 2/3→67, 199/200→100), `test_el_porcentaje_redondea_half_up_con_enteros`; `hu11.resultados`: «cada fila muestra el porcentaje y el total…», «el detalle muestra el porcentaje con su total y la tabla por elaboración». Capturas: `pt11-06_publicaciones_utilidad.jpg`, `pt11-06_detalle_evaluacion.jpg` | 75 % con 3 «Sí» y 1 «No» (automatizado). Manual: **OK** con datos reales: 5 respuestas (4 «Sí» y 1 «No») = **80 %**; los productos sin respuestas muestran «Sin respuestas todavía». El plan proponía 75 % como ejemplo; ese caso y el redondeo están cubiertos por las pruebas automatizadas | Aprobado |
| PT11-07 | Ver los resultados de un producto de otro productor | Automatizada | Responde 404 | `test_pt11_07_el_producto_de_otro_productor_da_404` (mismo cuerpo que un producto inexistente), `test_un_producto_inexistente_o_dado_de_baja_da_404`, `test_el_listado_de_otro_productor_no_trae_los_resultados_ajenos`; mutación T11-03 d) | 404 con `detail` de texto, igual que un producto inexistente. **No hay fila manual para PT11-07** | Aprobado (automatizado) |

### Resultados manuales

**Dispositivo (informado por la desarrolladora):** Redmi Note 13 5G, Android 15, Chrome; red local `http://192.168.1.28:5175`. Ejecutados por Laura el 19 y el 20-11-2026.

| Prueba | Resultado | Evidencia |
|---|---|---|
| PT11-01 Pregunta visible en ficha pública (con token) | OK | `pt11-01_pregunta.jpg`, `pt11-01_pregunta_ficha_publica.jpg` |
| PT11-01 Vista previa de gestión sin pregunta (token `null`) | OK | `pt11-01_ficha_sin_pregunta.jpg` |
| PT11-02 Responder muestra agradecimiento | OK | `pt11-02_agradecimiento.jpg` |
| PT11-04 Recarga mantiene agradecimiento | OK: tras recargar la ficha (12:34) se muestra «¡Gracias por tu respuesta!» en lugar de la pregunta; no se generó un nuevo registro en BD (siguen 5) | `pt11-04_recarga_agradecimiento.jpg` |
| PT11-05 Registro sin datos personales | OK: columnas `id`, `producto_id`, `elaboracion_id`, `util`, `nonce_hash`, `fecha` (solo día); sin IP ni user agent; 5 registros (4 verdaderos y 1 falso) coherentes con 80 % | `pt11-05_registro_bd.png` |
| PT11-06 Resultados en Publicaciones y detalle | OK: 5 respuestas (4 «Sí» y 1 «No») = 80 %; productos sin respuestas muestran «Sin respuestas todavía» | `pt11-06_publicaciones_utilidad.jpg`, `pt11-06_detalle_evaluacion.jpg` |
| CI (SQLite, PostgreSQL, frontend) | OK: los 3 trabajos en verde en el Pull Request #29 (commit `962be25`); merge en verde: https://github.com/lauritaggz/TrazApp/actions/runs/44795959697 | `ci_verde_hu11.png` |

Las capturas no comprueban por sí solas lo que se informa de ellas (el 5 de registros, el momento de la recarga); son datos informados.

**Capturas en `docs/test/validacion_hu11/`:**

| Archivo | Qué muestra (según lo informado) |
|---|---|
| `pt11-01_pregunta.jpg`, `pt11-01_pregunta_ficha_publica.jpg` | PT11-01: la pregunta en la ficha pública |
| `pt11-01_ficha_sin_pregunta.jpg` | PT11-01: la vista previa de gestión, sin pregunta |
| `pt11-02_agradecimiento.jpg` | PT11-02: el agradecimiento tras responder |
| `pt11-04_recarga_agradecimiento.jpg` | PT11-04: tras recargar, el agradecimiento en lugar de la pregunta |
| `pt11-05_registro_bd.png` | PT11-05: el registro guardado, con sus seis columnas |
| `pt11-06_publicaciones_utilidad.jpg`, `pt11-06_detalle_evaluacion.jpg` | PT11-06: resultados en Publicaciones y en el detalle |
| `ci_verde_hu11.png` | CI: «All checks have passed», 3 trabajos en verde en el Pull Request #29 para el commit `962be25` |

---

## c) Escenarios adicionales

| Escenario | Prueba | Resultado |
|---|---|---|
| **Token alterado, vencido o de otro producto → 422 con el mismo cuerpo** (sin registro) | `test_evaluacion_utilidad_hu11.py`: `test_token_alterado_vencido_y_de_otro_producto_dan_el_mismo_422_byte_a_byte`, `test_un_token_para_un_producto_que_no_existe_da_el_mismo_422_que_para_uno_que_si`; `test_evaluacion_token_hu11.py`: `test_token_alterado_firma_de_otra_clave_y_jwt_de_sesion_son_invalidos`, `test_token_vencido_es_invalido_y_a_23h59_es_valido`, `test_token_demasiado_largo_o_ilegible_es_invalido`, `test_la_clave_derivada_no_es_la_del_jwt`; mutación T11-01 b) | Aprobado (E y C) |
| **Elaboración ocultada o producto despublicado después de emitir el token → 404 uniforme** | `test_elaboracion_ocultada_despues_de_emitir_el_token_da_404_uniforme`, `test_producto_despublicado_o_eliminado_despues_de_emitir_da_404_uniforme_igual_al_get` | Aprobado (E y C) |
| **El `GET` de la ficha no escribe**; el token solo con `estado_elaboracion = ok` | `test_el_get_de_la_ficha_no_escribe_en_la_base`, `test_token_solo_con_estado_ok_y_null_en_los_otros_estados`, `test_sin_elaboraciones_visibles_el_token_es_null`, `test_el_token_trae_solo_datos_publicos`, `test_el_get_con_token_no_supera_consultas_maximas` | Aprobado (E y C) |
| **Previsualización sin token** (y sin pregunta) | `test_la_previsualizacion_devuelve_token_null`; `test_vista_publica_gestion_hu10.py` (adaptada); `hu11.evaluacion`: «…ni siquiera con un token en la respuesta, la previsualización muestra la pregunta» (propiedad `evaluable`); mutaciones T11-01 c) y T11-02 a). Captura: `pt11-01_ficha_sin_pregunta.jpg` | Aprobado (E, C y M) |
| **Token de productor ignorado** | `test_con_ip_user_agent_y_token_de_productor_la_fila_no_guarda_rastro`, `test_cada_get_emite_un_token_distinto_y_el_de_productor_se_ignora`; `hu11.evaluacion`: el envío no lleva `Authorization` aunque haya sesión; mutación T11-02 b) | Aprobado (E y C) |
| **Carrera del mismo nonce → 409** (dos envíos casi simultáneos; la restricción única de la base decide) | `test_la_carrera_del_mismo_nonce_cae_en_409_por_la_restriccion_unica`; `test_migracion_020_evaluacion_hu11.py`: `test_la_tabla_rechaza_un_nonce_repetido_y_un_hash_de_otro_largo` | Aprobado (E y C) |
| **Filtro del access log** (las líneas de `/evaluaciones` no van al registro de acceso de uvicorn) y nada de token, nonce ni user agent en los logs | `test_el_registro_de_acceso_de_uvicorn_omite_el_endpoint_de_evaluacion`, `test_no_se_registra_token_nonce_ni_user_agent_en_los_logs` | Aprobado (E y C). Solo cubre el registro de la aplicación; ver g |
| **Fecha en `America/Santiago`** (día sin hora) | La columna usa `hoy_santiago()`, la misma función que HU05, en `evaluacion_service.py`; `test_evaluacion_utilidad_hu11.py` comprueba que la fecha existe (`fila.fecha is not None`) y que la tabla no tiene hora (`test_migracion_020…`); manual: `pt11-05_registro_bd.png` («solo día») | **Cubierto solo en parte:** no hay una prueba de HU11 que fije el día de Santiago frente al de UTC (esa lógica de `hoy_santiago` ya se prueba en las pruebas de elaboraciones de HU05). Se deja anotado, no se inventa |
| **HALF_UP en casos límite** (entero, sin `float` ni `round()`): 1/8→13, 1/3→33, 2/3→67, 199/200→100 | `test_evaluacion_resultados_hu11.py`: `test_el_porcentaje_redondea_half_up_con_enteros` (10 casos, también 3/8→38, 1/2→50, 0/5→0 y 5/5→100), `test_half_up_por_el_endpoint_y_en_el_resumen_del_producto`; mutación T11-03 b) | Aprobado (E y C) |
| **Sin respuestas → `null`** (la interfaz dice «Sin respuestas todavía», nunca «0 %») | `test_evaluacion_resultados_hu11.py`: caso `0/0 → None` y `test_sin_respuestas_el_porcentaje_es_null_y_no_hay_desglose`; `hu11.resultados`: «sin respuestas nunca aparece «0 %» (ni con la clave ausente)», «sin respuestas el detalle dice…»; mutación T11-03 c). Captura: `pt11-06_publicaciones_utilidad.jpg` | Aprobado (E, C y M) |
| Conjunto exacto de columnas de la tabla: ninguna con IP, user agent ni token completo | `test_el_conjunto_exacto_de_columnas_no_tiene_ip_user_agent_ni_token`; `test_upgrade_020_crea_la_tabla_con_el_conjunto_exacto_de_columnas`; mutación T11-01 d) | Aprobado (E y C) |
| Hash del nonce: 64 caracteres hexadecimales y no contiene el nonce | `test_el_hash_del_nonce_son_64_hex_y_no_contiene_el_nonce` | Aprobado (E y C) |
| Cabeceras `no-store` y `noindex` en 201, 409, 422 y 404 | `test_cabeceras_no_store_y_noindex_en_201_409_422_y_404` | Aprobado (E y C) |
| Migración 020: upgrade, unicidad, claves foráneas `RESTRICT` y CHECK, `upgrade → downgrade → upgrade` y downgrade que se niega con evaluaciones | `test_migracion_020_evaluacion_hu11.py` (11, PostgreSQL); `test_upgrade_020_no_toca_las_otras_tablas_ni_las_elaboraciones`, `test_downgrade_020_se_niega_si_hay_evaluaciones_y_no_cambia_nada` | Aprobado (E y C) |
| Resultados: elaboraciones ocultas incluidas en el desglose, en el orden «Predeterminada»; sin mezclar productos | `test_el_desglose_trae_solo_elaboraciones_con_respuestas_incluida_la_oculta_en_orden`, `test_las_respuestas_de_otro_producto_no_se_mezclan` | Aprobado (E y C) |
| Número de consultas constante: el endpoint de resultados hace 3 (autenticación, pertenencia del producto, una lectura agrupada) con una o varias elaboraciones; el listado suma exactamente una consulta agrupada y el total es igual con 1 o con 4 productos | `test_evaluacion_resultados_hu11.py` (dos pruebas); `test_costos_api_hu14.py` adaptada (detalle 13 y 6) | Aprobado (E y C) |
| 401 sin token o con token inválido en los resultados | `test_evaluacion_resultados_hu11.py` | Aprobado (E y C) |
| Estados de la pregunta en el frontend: 201 y 409 agradecen; 422 pide recargar sin reintento; 404 y red ofrecen «Reintentar» con el mismo token; doble clic envía una vez; botones de 44 px | `hu11.evaluacion` (14) | Aprobado (E y C) |
| `localStorage` solo como complemento: guarda la marca (`"1"`) por (`id_publico`, código), nunca la respuesta ni el token; si lanza excepción, la pregunta funciona igual | `hu11.evaluacion`: «tras responder guarda solo la marca del par…», «un 409 también deja la marca…», «con localStorage que lanza excepción…»; mutación T11-02 d) | Aprobado (E y C) |
| Error aislado de la tarjeta de resultados («Reintentar»), textos de 12 px o más y botón de 44 px | `hu11.resultados` (6) | Aprobado (E y C) |

---

## d) Cobertura CA1 … CA7

| CA | Criterio | Pruebas que lo cubren | Estado |
|---|---|---|---|
| CA1 | Al final de la consulta se muestra «¿Esta información te resultó útil?» | PT11-01; `hu11.evaluacion` (3 de PT11-01) | Cumplido (automatizado, capturas y manual informado en celular) |
| CA2 | El consumidor responde con «Sí» o «No» | PT11-02; `hu11.evaluacion`: «Sí» envía `util=true`, «No» envía `util=false` | Cumplido (automatizado y manual informado: agradecimiento tras responder) |
| CA3 | No se requiere cuenta ni información personal | PT11-03; el cuerpo solo admite `util`; sin `Authorization` | Cumplido (automatizado) |
| CA4 | Una sola respuesta por consulta, sin identificar al consumidor | PT11-04; mutación T11-01 a); carrera del mismo nonce | Cumplido (automatizado y manual informado: recarga sin registro nuevo). La garantía es por consulta, no por persona (ver g) |
| CA5 | La respuesta queda asociada al producto y a la elaboración consultada | PT11-02, PT11-05; `test_el_par_producto_elaboracion_es_coherente_con_dos_productos` | Cumplido (automatizado y manual informado: columnas del registro) |
| CA6 | Almacenamiento anónimo y resultados agregados para el productor | PT11-05, PT11-06; mutación T11-01 d) | Cumplido (automatizado y manual informado) |
| CA7 | El productor consulta el porcentaje de respuestas positivas por producto | PT11-06, PT11-07; mutaciones T11-03 a) a d) | Cumplido (automatizado y manual informado: 80 % con 5 respuestas) |

---

## e) Mutaciones de T11-01 a T11-03

Todas con copia y restauración, confirmadas con `cmp` (T11-03 también sin marcas de mutación en `app/`). Cada una hace fallar al menos una prueba. Salen de los reportes de cada tarea; **en T11-04 no se hicieron mutaciones nuevas** (solo se documentan las existentes).

| Tarea | Mutación | Pruebas que fallan | Observaciones |
|---|---|---|---|
| T11-01 | a) el hash del nonce cambia en cada uso, así que se acepta dos veces el mismo token | 5: `test_el_hash_del_nonce_son_64_hex…`, `…pt11_04…409_y_una_sola_fila`, `…pt11_05…`, `…cabeceras_no_store…`, `…la_carrera_del_mismo_nonce…` | Directa |
| T11-01 | b) no se verifica la firma | 3: `token_alterado_firma_de_otra_clave…`, `token_vencido…`, `…mismo_422_byte_a_byte` | Directa |
| T11-01 | c) la previsualización emite token | 2: `la_previsualizacion_devuelve_token_null`, `la_previsualizacion_es_identica…` | Directa |
| T11-01 | d) se agrega una columna `user_agent` al modelo | 3: `…conjunto_exacto_de_columnas…`, `…de_productor_se_ignora` (SQLite) y `…el_modelo_coincide_con_la_migracion` (PostgreSQL) | **La mutación agrega la columna al modelo y la detecta el guardián de columnas**; no se llegó a guardar el user agent desde la ruta. El flujo que no guarda el user agent lo cubre otra prueba (`test_con_ip_user_agent_y_token_de_productor_la_fila_no_guarda_rastro`), que envía esas cabeceras y comprueba que la fila no deja rastro |
| T11-02 | a) `evaluable` encendido en la previsualización | 1: «PT11-01: ni siquiera con un token en la respuesta, la previsualización muestra la pregunta» | Directa |
| T11-02 | b) la evaluación pide `authenticated = true` | 10 de 14 | Con sesión de productor se enviaría `Authorization`; sin sesión, la llamada falla antes de enviarse, y por eso fallan también las de 201, 409, 422, reintento y `localStorage`. La que prueba la ausencia de `Authorization` es ««Sí» envía util=true…» |
| T11-02 | c) sin reinicio al cambiar de elaboración (se quitan `key={token}` y la condición `!cargando`) | 1: «cambiar de elaboración reinicia la pregunta y usa el token nuevo» | Hay que quitar las dos piezas: la pregunta ya se desmonta mientras carga la elaboración nueva, así que quitar solo el `key` no rompe el reinicio |
| T11-02 | d) guarda también la respuesta («true» o «false») en `localStorage` | 1: «tras responder guarda solo la marca del par…» | Directa |
| T11-03 | a) el conteo de positivas incluye los «No» (`else_=1`, en el endpoint y en el listado) | 8 de backend: PT11-06, 4 casos de HALF_UP, el desglose con la oculta, el aislamiento entre productos y el listado y detalle | Directa |
| T11-03 | b) `round()` en lugar de la aritmética entera | 2: `…redondea_half_up_con_enteros[1-8-13]` y `…half_up_por_el_endpoint…[1-7-13]` | El caso 3/8 pasa por casualidad (el redondeo bancario da 38); por eso importa el 1/8 |
| T11-03 | c) «0 %» sin respuestas (frontend) | 3: «cada fila muestra el porcentaje y el total…», «sin respuestas nunca aparece «0 %»…» y «sin respuestas el detalle dice «Sin respuestas todavía»…» | Directa |
| T11-03 | d) se quita el filtro por productor en el endpoint de resultados | 1: `test_pt11_07_el_producto_de_otro_productor_da_404` | El 404 de producto dado de baja se prueba aparte (`test_un_producto_inexistente_o_dado_de_baja_da_404`) y esta mutación no lo ejercita |

**Mutaciones sugeridas por el contexto (sección 7) y dónde se cubren:** aceptar dos veces el mismo token → T11-01 a); no verificar la firma → T11-01 b); guardar la IP o el user agent → T11-01 d) (columna) y la prueba del flujo; emitir token en la previsualización → T11-01 c) y T11-02 a); contar los «No» como positivos → T11-03 a); calcular el porcentaje sobre otro total → T11-03 a) y b) (la mutación a) altera el conteo, no el divisor; no se hizo una mutación específica del divisor); omitir el filtro por productor → T11-03 d).

---

## f) Decisiones de diseño

Las propuso el agente en la Fase 1 de T11-01 (D1 a D6 del contexto) y las aprobó la desarrolladora; la de D1 la decidió ella el 18-11-2026.

1. **Token firmado de un solo uso (decisión de la desarrolladora).** El `GET` público incluye `token_evaluacion` solo con `estado_elaboracion = ok`; no se escribe nada al emitirlo. Es un JWT con PyJWT (HS256) firmado con una **clave derivada** de `JWT_SECRET_KEY` mediante HMAC con una etiqueta fija (así un JWT de sesión nunca vale aquí ni al revés, y no hay un secreto nuevo que configurar), con **audiencia propia** (`trazapp:evaluacion`) y **24 horas de vigencia**. Lleva solo el `id_publico`, el código de la elaboración, un nonce aleatorio y las fechas de emisión y vencimiento, todo público salvo el nonce. El servidor guarda **solo el SHA-256 del nonce**, con restricción única: el segundo envío da 409 y no se registra. Cualquier forma de inválido (alterado, vencido, de otra clave o tipo, ilegible, demasiado largo) da el mismo error. Se descartaron limitar por IP (contradice CA3 y CA6) y usar solo `localStorage` como garantía (no es del servidor).
2. **`localStorage` solo como complemento de la interfaz.** Tras responder, el navegador recuerda el par (`id_publico`, código) ya evaluado y al recargar muestra el agradecimiento. Guarda solo la marca, nunca la respuesta ni el token, con lecturas y escrituras en `try/catch`. No identifica a nadie y no es una garantía.
3. **422 antes que 404.** Un token inválido responde 422 sin consultar nada más; solo con un token válido se mira si el producto y la elaboración siguen visibles (404 uniforme). El 422 es el mismo en los tres casos (alterado, vencido, de otro producto) para no dar pistas.
4. **Ruta anidada.** `POST /publico/productos/{id_publico}/evaluaciones`, bajo la consulta pública, sin `Authorization`, con `{util}` y `extra="forbid"`; el token viaja en el cuerpo del mismo envío. Los resultados del productor viven aparte: `GET /gestion/productos/{id}/evaluaciones`.
5. **Fecha sin hora, en `America/Santiago`.** La columna `fecha` es un día (reduce la posibilidad de correlacionar con otros registros) y usa `hoy_santiago()`, la convención del proyecto, no el día en UTC que se había propuesto.
6. **Porcentaje HALF_UP con enteros y número de respuestas siempre visible.** `(200 × positivas + total) // (2 × total)`; sin `float` ni `round()`, que redondea al par (1 de 8 daría 12 y no 13). Sin respuestas es `null` y la interfaz dice «Sin respuestas todavía», nunca «0 %». El total de respuestas va siempre junto al porcentaje.
7. **`evaluacion_utilidad` en el listado con una consulta agrupada.** Un campo aditivo `{total, positivas, porcentaje}` en `ProductoGestionRead`, calculado con una sola consulta para todo el listado (mismo patrón que los conteos de elaboraciones de HU09), sin una consulta por producto. El endpoint de resultados hace 3 consultas, siempre, y los totales salen de sumar el desglose por elaboración.
8. **Previsualización sin pregunta (propiedad evaluable).** El token es `null` en la previsualización y, además, `FichaVista` tiene la propiedad `evaluable` apagada por defecto, que solo enciende la vista pública. El productor no evalúa sus propios productos aunque la API enviara un token.

Otras decisiones: el desglose por elaboración incluye las elaboraciones ocultas (las respuestas ya existían) y va en el orden «Predeterminada» (fecha desc, id desc); `evaluacionService.ts` queda aparte de `publicacionService.ts` para no tocar los mocks de HU09; `ON DELETE RESTRICT` en las claves foráneas (las elaboraciones finalizadas no se borran); el downgrade de la 020 se niega si hay evaluaciones (mismo criterio de la 018 y la 019); un filtro del access log de uvicorn quita las líneas de `/evaluaciones`.

---

## g) Limitaciones

- **La garantía es por consulta, no por persona.** Cada carga de la ficha de una elaboración es una consulta nueva y recibe un token nuevo. Recargar en otro navegador, en modo incógnito o borrando los datos del sitio permite responder de nuevo. La marca de `localStorage` reduce las repeticiones por recarga, pero no es una garantía.
- **Sin límite de solicitudes.** Un script puede pedir fichas y enviar evaluaciones en masa: el token exige pedir la ficha antes de cada envío, pero no lo impide. El rate limiting está fuera de alcance desde HU10.
- **El proveedor de hosting puede registrar la IP por su cuenta**, fuera del control de la aplicación. El filtro del access log de uvicorn y la ausencia de IP en la base solo cubren lo que la aplicación escribe.
- **Con pocas respuestas el porcentaje es poco representativo** (una sola respuesta da 0 % o 100 %). Por eso el número de respuestas se muestra siempre junto al porcentaje.
- **Rotar `JWT_SECRET_KEY` invalida los tokens emitidos** (la clave de firma se deriva de ella): quien tenga la ficha abierta recibe un 422 al responder y debe volver a abrirla. Un efecto de la derivación; no pierde datos guardados.
- **Los tokens vencen a las 24 horas:** una ficha abierta más tiempo responde 422 y pide recargar.
- **La fecha de Santiago no tiene una prueba propia de HU11** (ver c).
- **Prueba manual:** un solo dispositivo (Redmi Note 13 5G, Android 15, Chrome) por red local en HTTP; no se probó iOS. PT11-03 y PT11-07 no tienen prueba manual. El caso del 75 % no se vio en pantalla (se usaron datos reales, 80 %), pero está cubierto por pruebas automatizadas.
- **Las notas de la desarrolladora son datos informados:** las capturas no demuestran por sí solas el número de registros ni la hora de la recarga.

---

## h) Trabajo futuro

- Limitación de solicitudes por origen **sin guardar la IP junto a la evaluación** (por ejemplo, un contador temporal que no se asocie al registro).
- Mecanismos anti-bots (desafío, cabecera de integridad o similares) si el volumen o el abuso lo justifican.
- Fuera de alcance (contexto): comentarios de texto libre, estrellas o escalas; exportar las evaluaciones o mostrarlas al consumidor; cambiar una respuesta ya enviada.

---

## i) Notas para el informe

- **Horas reales** (estimaciones del agente, sin cronómetro): T11-01 ≈ 2 h (est. 1); T11-02 ≈ 0,75 h (est. 0,5); T11-03 ≈ 1,5 h (est. 0,75); T11-04 ≈ 0,75 h (est. 0,75). Total ≈ 5 h frente a 3 h estimadas.
- **El nombre de la rama lleva guion y guion bajo:** `feature/hu11-evaluacion_utilidad`. El contexto decía `feature/hu11-evaluacion-utilidad` y se corrigió en T11-03.
- **La migración es la 020** (`020_evaluacion_utilidad_hu11`), que cuelga de la 019 de HU14. Se creó como `.pendiente` y la desarrolladora la aprobó; hoy es `020_evaluacion_utilidad_hu11.py` en el repositorio.
- **El Pull Request es el #29**, en `feature/hu11-evaluacion_utilidad` hacia `main`.
- **Las pruebas se corrieron en el contenedor** (`docker compose run --rm --no-deps -T`), sin tocar el puerto 5175.
- **Un número anterior que se corrige:** T11-01 informó «45 nuevas»; son 42 (ver a).

---

## j) Incidencias

- **CI de `21ab86a` (T11-03): dos pruebas de HU14 fallaron en SQLite y en PostgreSQL**, por el mismo motivo: `test_el_numero_de_consultas_del_get_y_del_detalle_no_depende_del_numero_de_lineas` (`13 == 12`) y `test_sin_rendimiento_o_sin_formulacion_el_detalle_no_hace_consultas_de_costos` (`6 == 5`). Cuentan las consultas exactas del detalle del producto, y T11-03 le suma una (el conteo agrupado de evaluaciones). No era una regresión: lo que protegen, que el número no dependa de las líneas de costo, sigue igual. El reporte de T11-03 no corrió ese archivo y por eso no lo detectó. Se ajustaron los dos números con un comentario (commit `962be25`) y el archivo pasa completo en las dos bases (83 pruebas en cada una); la ejecución siguiente del CI quedó en verde.
- **Advertencia de `oxlint`** (`react(set-state-in-effect)`) en `EvaluacionUtilidadCard.tsx`: es el mismo patrón de carga al montar que usa `PublicacionElaboraciones.tsx`; no se cambió para mantener el código uniforme.
- **Una prueba propia mal escrita en T11-01:** esperaba `IntegrityError` para un hash de 65 caracteres, pero `varchar(64)` lo rechaza con `DataError`. Se corrigió la prueba, no el código.
- **Captura del CI:** `ci_verde_hu11.png` muestra la ejecución del Pull Request #29 sobre `962be25` (3 trabajos en verde); la ejecución del merge en `main` se cita con su enlace.
