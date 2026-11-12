# HU10 — Resultados de pruebas (T10-06)

**Fecha:** 2026-11-11  
**Rama:** `feature/hu10-consulta-publica` (Pull Request en draft hacia `main`)  
**Historia:** HU10 — Consulta pública mediante QR (Sprint 3, P1, 8 SP)  
**Criterios de referencia:** CA1 … CA11 y PT10-01 … PT10-13 (`docs/context/TrazApp_HU10_contexto_agente.md`, secciones 3 y 7; contrato en las secciones 9.x)  
**Entorno:** backend con Python 3.12 (contenedor `trazapp-backend`) sobre SQLite y PostgreSQL 16; frontend con Vitest y Vite. **Sin migración nueva** (la vigente sigue siendo `018_publicacion_producto_hu09`). Sin dependencias nuevas.  
**Integración continua:** enlace **PENDIENTE** (la desarrolladora lo agrega tras el push). Captura esperada: `docs/test/validacion_hu10/ci_verde_hu10.png` — *(espacio reservado; la captura aún no existe)*. La única ejecución del CI de HU10 informada hasta hoy es la del commit de T10-04 entrega B: frontend, 60 archivos, 1284 pruebas, **1283 aprobadas y 1 fallida** (`ui/ht07.bloque4.test.tsx`: mayúsculas forzadas en la ficha pública); se corrigió en el commit `3b6c8a9` y **no hay todavía una ejecución en verde que citar**.

**Convención de las fuentes de los números:** **(L)** corrida local de hoy (11-11-2026) en el contenedor; **(E)** última corrida local informada en el reporte de la tarea; **(C)** corrida del CI. Nada de este documento se da por pasado en el CI.

---

## a) Resumen

**Historia.** Como consumidor, quiero escanear el código QR de un producto y seleccionar la elaboración correspondiente, para conocer los insumos utilizados y sus alérgenos declarados. HU10 deja lista la API pública sin autenticación (`GET /publico/productos/{id_publico}`), la vista pública `/p/:idPublico` y la previsualización del productor (`GET /gestion/productos/{id}/vista-publica` y `/publicaciones/:productoId/vista-previa`).

**Criterios cumplidos: 11 de 11.** Diez con pruebas automatizadas (L); CA11 (móvil) con la prueba manual en celular **informada por la desarrolladora** (PT10-12), con capturas de la ficha en el celular.

| Estado | Criterios |
|---|---|
| Cumplidos, verificados con pruebas automatizadas (L); en CA3, CA6, CA7 y CA10 se suma la comprobación manual informada | CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10 |
| Cumplido por la prueba manual en celular (PT10-12), informada | CA11 |

Los resultados manuales los informó la desarrolladora (ver «PT10-12 y la prueba en celular») y se anotan tal como los dio. Varias comprobaciones manuales **no tienen captura** (el escaneo del QR, PT10-07 y RT-03: la desarrolladora indicó que no las tomará), de modo que son datos informados, no verificados por una captura. La medición de OE4 (PT10-13) se realizó y cumple: ver la sección g).

### Pruebas automáticas de HU10, por archivo

**Backend** (69 pruebas; ninguna exige PostgreSQL en exclusiva, todas corren en ambos motores):

| Archivo | Pruebas | SQLite | PostgreSQL |
|---|---|---|---|
| `tests/test_consulta_publica_hu10.py` (T10-01: 19, T10-02: 24, T10-03: 13) | 56 | 56 (L) | 56 (L) |
| `tests/test_vista_publica_gestion_hu10.py` (T10-05) | 13 | 13 (L) | 13 (L) |
| **Corrida conjunta de los dos archivos** | 69 | 69 aprobadas, 93 s (L) | 69 aprobadas, 175 s (L) |

El conteo por archivo sale de `pytest --collect-only` (L) y de los reportes de T10-03 y T10-05; la corrida de hoy fue conjunta. Pruebas existentes adaptadas en backend: ninguna eliminada ni relajada (`RUTAS_APROBADAS` crece con cada tarea y la aserción de conjunto exacto sigue siendo estricta).

**Frontend** (69 pruebas de HU10 en 8 archivos, todas (L) en una sola corrida de hoy):

| Archivo | Pruebas |
|---|---|
| `publico/hu10.formato.test.ts` | 6 |
| `publico/hu10.servicio.test.ts` | 4 |
| `publico/hu10.estados.test.tsx` | 13 |
| `publico/hu10.ficha.test.tsx` | 19 |
| `publico/hu10.seleccion.test.tsx` | 8 |
| `publico/hu10.ruta.test.tsx` | 3 |
| `publico/hu10.vistaprevia.test.tsx` | 9 |
| `products/hu10.acciones-ficha.test.tsx` | 7 |

Esa corrida (L) incluyó además `ui/ht07.bloque4.test.tsx`: 11 aprobadas (el archivo que falló en el CI; ahora pasa). Total de la corrida: 80 pruebas en 9 archivos, todas aprobadas.

Pruebas existentes adaptadas en el frontend: `elaboraciones/hu09.visibilidad.test.tsx` (la prueba que fijaba que «Vista previa pública» aún no existía —«son de HU10»— ahora comprueba que existe y apunta a la vista previa; sigue comprobando que no hay «unidades»), y en T10-04 tres pruebas de `hu10.ficha.test.tsx` que daban por hecho el detalle del insumo siempre visible (se actualizaron al diseño plegable aprobado). **Ninguna prueba se eliminó ni se relajó.**

**Directamente afectadas, corridas en la entrega de T10-05 (E):** `auth/hu12.auth` 17, `products/hu09.publicacion` 18, `products/hu09.publicaciones-general` 11, `products/hu09.qr` 15, `elaboraciones/hu09.visibilidad` 16, `ui/fase2Navegacion` 16, `ui/mejoraUiUx` 23. La regresión completa (SQLite, PostgreSQL y frontend) corre en el CI.

---

## b) Trazabilidad PT10-01 … PT10-13

Evidencia = archivo y prueba (backend en `backend/tests/`, frontend en `frontend/src/`) o captura (en `docs/test/validacion_hu10/`, con su nombre de archivo real). Los números de PT salen de la sección 7 del contexto. **«Manual» = hoja de resultados manuales de la desarrolladora, informada en el chat el 11-11-2026.**

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| PT10-01 | Abrir la consulta pública sin sesión | Automatizada | Se muestra la ficha sin pedir cuenta | `test_pt10_01_la_ficha_se_consulta_sin_sesion_y_trae_producto_y_elaboracion`, `test_sin_token_con_token_de_productor_y_con_token_invalido_la_ficha_es_la_misma`; `hu10.ruta`: «se abre sin sesión y sin pedir cuenta», «con una sesión de productor abierta se ve igual…»; `hu10.servicio`: «nunca envía Authorization…» | 200 sin token; la ruta se abre sin sesión y sin el menú del productor; el cliente nunca envía `Authorization` | Aprobado |
| PT10-02 | Producto con tres elaboraciones finalizadas, la más reciente oculta | Automatizada | Muestra por defecto la más reciente visible | `test_pt10_02_por_defecto_la_mas_reciente_visible_con_estado_ok`, `test_una_elaboracion_oculta_o_borrador_no_aparece_en_la_lista_ni_es_la_predeterminada`, `test_la_predeterminada_ordena_por_fecha_y_luego_por_id_descendente` | `estado_elaboracion: ok` con la más reciente visible; la oculta no es la predeterminada ni aparece en la lista | Aprobado |
| PT10-03 | Seleccionar por código y por fecha | Automatizada + manual | Muestra la elaboración elegida | `test_pt10_03_seleccion_por_codigo_con_otra_capitalizacion_y_espacios_en_los_extremos`, `test_pt10_03_seleccion_por_fecha`, `test_fecha_con_dos_visibles_es_varias_…`; `hu10.seleccion` (8). Capturas: selector `WhatsApp Image 2026-11-11 at 6.55.39 PM (3).jpeg`; búsqueda por código `WhatsApp Image 2026-11-11 at 6.55.40 PM (3).jpeg` (`e-002` encuentra `E-002`). Búsqueda por fecha: `WhatsApp Image 2026-11-11 at 7.18.25 PM.jpeg` | Automatizada: selección por código (otra capitalización), por fecha y varias coincidencias. En el celular, el selector lista `E-002 · 11 nov 2026` y `E-001 · 9 nov 2026`, `e-002` abre `E-002` y la fecha `09/11/2026` abre `E-001` | Aprobado (automatizado y capturas). Manual de código y de fecha: **sí** (informado por la desarrolladora el 11-11-2026) |
| PT10-04 | Ingresar un código de elaboración inexistente | Automatizada + manual | Indica que no se encontró, sin error | `test_pt10_04_un_codigo_inexistente_es_no_disponible_sin_error`, `test_oculta_borrador_y_de_otro_producto_dan_el_mismo_cuerpo_que_un_codigo_inexistente`; `hu10.estados`: «elaboración no disponible: mensaje unificado…». Captura: `WhatsApp Image 2026-11-11 at 6.55.40 PM.jpeg` | 200 con `no_disponible`. En el celular, el código `3` muestra «No encontramos información disponible para esa elaboración» sin ningún dato de elaboración | Aprobado (automatizado y captura). Manual «mensaje unificado»: **sí** (informado por la desarrolladora el 11-11-2026) |
| PT10-05 | Revisar un ingrediente de la ficha | Automatizada + captura | Insumo, marca u origen, ingredientes declarados y advertencias | `test_pt10_05_cada_insumo_muestra_nombre_marca_ingredientes_advertencias_y_alergenos`; `hu10.ficha`: «CA4: cada insumo empieza plegado…», «al expandir un insumo muestra sus ingredientes declarados…». Captura: `WhatsApp Image 2026-11-11 at 6.55.39 PM (2).jpeg` (harina expandida) | La API trae los cuatro datos; la vista los muestra (plegado: ingrediente, nombre, «Marca u origen», alérgenos y advertencias; expandido: ingredientes declarados) | Aprobado |
| PT10-06 | Un insumo con leche y otro con trazas de soya y leche | Automatizada | «Contiene: leche» y «Puede contener: soya»; leche no se repite en trazas | `test_pt10_06_contiene_leche_y_trazas_de_soya_y_leche_leche_no_se_repite_en_trazas`, `test_el_mismo_alergeno_contiene_en_dos_insumos_aparece_una_sola_vez`; `hu10.ficha`: «PT10-06: muestra «Contiene» y «Puede contener»…». Captura: `WhatsApp Image 2026-11-11 at 6.55.39 PM.jpeg` | Contiene: Gluten, Leche, Soya; Puede contener: Crustáceos, Huevo, Apio, Mostaza, Sésamo; sin repeticiones | Aprobado |
| PT10-07 | Consultar una elaboración de una versión anterior | Automatizada + manual | Nota de versión distinta, sin número de versión | `test_pt10_07_una_elaboracion_de_la_version_vigente_no_es_version_anterior`, `test_pt10_07_una_elaboracion_de_una_version_anterior_lo_indica_sin_numero_ni_id`, `test_un_producto_sin_version_vigente_marca_version_anterior`; `hu10.ficha`: «CA6: la nota de versión anterior aparece sin número de versión». **Falta la captura `pt10-07_version_anterior`** | `version_anterior: true` sin número ni id de versión; la vista muestra «Esta elaboración se hizo con una receta anterior a la actual» | Aprobado (automatizado). Manual: **sí** (informado por la desarrolladora el 11-11-2026); sin captura (la desarrolladora no la tomará) |
| PT10-08 | Cambiar el insumo después de finalizar y consultar (RT-03) | Automatizada + manual | Muestra la información original | `test_rt03_insumo_modificado_despues_de_finalizar_no_cambia_la_ficha`, `test_rt03_los_grupos_no_cambian_al_modificar_los_alergenos_del_insumo`. **Faltan las capturas `rt03_antes`, `rt03_insumo_modificado` y `rt03_ficha_sin_cambios`** | La ficha y los grupos de alérgenos conservan la marca y los alérgenos originales (ver f) | Aprobado (automatizado). Manual: **sí** (informado por la desarrolladora el 11-11-2026); sin capturas (la desarrolladora no las tomará) |
| PT10-09 | Revisar la respuesta de la API pública | Automatizada | Sin lotes, vencimientos ni identificadores internos | `test_lista_blanca_conjunto_exacto_de_claves` (conjunto exacto de claves más valores centinela: lote, vencimiento, correo, código interno, precio, costo, EAN…), `test_la_lista_blanca_tambien_se_cumple_sin_elaboraciones_visibles`, `test_lista_blanca_de_t10_02_estado_y_coincidencias`; `hu10.ficha`: «CA8: no muestra lotes, vencimientos ni «Consumir preferentemente»» | El cuerpo tiene solo las claves aprobadas; ninguna cadena centinela aparece | Aprobado |
| PT10-10 | Revisar el aviso | Automatizada + captura | Aviso al consumidor visible | `hu10.ficha`: «CA9: el aviso está al final de la ficha, visible y fuera de cualquier bloque plegable»; `hu10.estados`: «el aviso al consumidor está visible en la ficha, en cada estado con datos del producto». Captura: `WhatsApp Image 2026-11-11 at 6.55.40 PM (2).jpeg` («Información complementaria») | El aviso (no reemplaza el rotulado ni certifica…) está visible sin desplegar nada | Aprobado |
| PT10-11 | Previsualizar un producto aún no publicado | Automatizada + manual | Se ve la ficha; el enlace público sigue no disponible | `test_vista_publica_gestion_hu10.py`: `test_pt10_11_previsualiza_un_producto_no_publicado_y_no_cambia_su_publicacion`, `test_pt10_11_despues_de_previsualizar_la_consulta_publica_sigue_no_disponible`; `hu10.vistaprevia` (9). Captura: `WhatsApp Image 2026-11-11 at 7.18.27 PM.jpeg` (vista previa de un producto **publicado**) | 200 con la ficha; `publicado`, `id_publico` y `publicado_en` sin cambio; la consulta pública sigue con el 404 uniforme. La captura muestra la barra «Vista previa pública», «Así verá el consumidor esta ficha…», la insignia «Publicado» y «Volver a la publicación» sobre la ficha; **es de un producto publicado: el caso «no publicado» de PT10-11 lo cubren solo las pruebas automatizadas** | Aprobado (automatizado); captura del caso publicado |
| PT10-12 | Escanear el QR impreso con un celular y recorrer la ficha | Manual | Sin desplazamiento horizontal y con texto legible | Ver «PT10-12 y la prueba en celular» | Redmi Note 13 5G, Android 15: el QR abrió la ficha, **sin desplazamiento horizontal**, textos legibles, selector y búsquedas por código y por fecha funcionan (informado por la desarrolladora el 11-11-2026); las capturas muestran la ficha en el celular | Aprobado (manual informado; sin captura del escaneo) |
| PT10-13 | Medir 100 consultas de prueba | Medición | ≥ 95 % responde en ≤ 2 s (OE4) | `backend/scripts/medir_oe4_hu10.py`; `docs/test/validacion_hu10/oe4_mediciones.csv` y `oe4_resultados.md`; ver g) | n = 100: p50 = 15,5 ms, p95 = 24,9 ms, máximo = 31,1 ms; 100,0 % responde 200 en ≤ 2000 ms; 0 fallidas (ver g) | Aprobado (medición local) |

---

### PT10-12 y la prueba en celular

**Dispositivo (informado por la desarrolladora):** Redmi Note 13 5G; Android 15; navegador «google» (la versión del navegador no se registró). La ficha se abrió en `http://10.221.176.49:5175/p/…`, una dirección de la red local; el navegador avisa «La conexión no es segura» por usar HTTP, esperable en desarrollo.

**Resultados manuales informados por la desarrolladora el 11-11-2026 (en el chat: primero el dispositivo y luego las trece respuestas). Se anotan tal como los dio.**

| Punto de la hoja | Respuesta |
|---|---|
| PT10-12: el QR abrió la ficha | **Sí.** Sin captura del escaneo (no se puede capturar la cámara al leer): dato informado |
| PT10-12: desplazamiento horizontal | **No** (no hubo desplazamiento horizontal) |
| PT10-12: textos legibles | **Sí** |
| PT10-12: selector | **Sí** |
| PT10-12: búsqueda por código | **Sí** |
| PT10-12: búsqueda por fecha | **Sí**; la captura existe (ver abajo) |
| PT10-04 en celular: mensaje unificado | **Sí** |
| PT09-09: mensaje unificado | **Sí** |
| PT09-10: «Información no disponible» | **Sí** |
| PT10-07: nota de versión anterior visible y sin número | **Sí**; sin captura (la desarrolladora indicó que no la tomará) |
| RT-03 manual: ficha sin cambios tras modificar el insumo | **Sí**; sin capturas (la desarrolladora indicó que no las tomará) |
| Insumos plegables: ¿parten abiertos o cerrados? | **Cerrados** (coincide con las capturas) |
| Insumos plegables: ¿se nota que hay advertencias sin abrirlos? | **Sí** |
| Observaciones | Ninguna informada |

**Capturas en `docs/test/validacion_hu10/`.** Los archivos llegaron con nombres de WhatsApp, no con los nombres esperados; **no se movieron ni renombraron**. Correspondencia establecida según el contenido de cada captura (la desarrolladora delegó esta correspondencia):

| Nombre esperado | Archivo existente | Qué muestra |
|---|---|---|
| `pt10-12_qr_abre_ficha.jpg` | `WhatsApp Image 2026-11-11 at 6.55.39 PM (1).jpeg` | La ficha de «Queque de chocolate» abierta en el celular (imagen, producto, «Elaborado por», selector). **No muestra el escaneo del QR** |
| `pt10-12_alergenos.jpg` | `WhatsApp Image 2026-11-11 at 6.55.39 PM.jpeg` | «Contiene» (Gluten, Leche, Soya) y «Puede contener» (Crustáceos, Huevo, Apio, Mostaza, Sésamo); código `E-002`, fecha 11 nov 2026 |
| `pt10-12_insumo.jpg` | `WhatsApp Image 2026-11-11 at 6.55.39 PM (2).jpeg` | Insumos: la harina expandida con sus ingredientes declarados; los demás plegados |
| `pt10-12_aviso.jpg` | `WhatsApp Image 2026-11-11 at 6.55.40 PM (2).jpeg` | «Información complementaria» (el aviso), bajo el mensaje de elaboración no disponible |
| `pt10-12_selector.jpg` | `WhatsApp Image 2026-11-11 at 6.55.39 PM (3).jpeg` | Lista del selector abierta: `E-002 · 11 nov 2026` y `E-001 · 9 nov 2026` |
| `pt10-12_busqueda_codigo.jpg` | `WhatsApp Image 2026-11-11 at 6.55.40 PM (3).jpeg` | `e-002` en minúscula encuentra `E-002` |
| `pt10-12_busqueda_fecha.jpg` | `WhatsApp Image 2026-11-11 at 7.18.25 PM.jpeg` | La fecha `09/11/2026` en «Fecha de elaboración» abre `E-001` (9 nov 2026) con sus alérgenos |
| `pt10-04_codigo_inexistente.jpg` | `WhatsApp Image 2026-11-11 at 6.55.40 PM.jpeg` | Código `3`: «No encontramos información disponible para esa elaboración» |
| `pt09-09_elaboracion_oculta.jpg` | `WhatsApp Image 2026-11-11 at 6.55.40 PM (2).jpeg` | `e-001`: el mismo mensaje unificado. Que `E-001` estaba oculta se infiere de la secuencia (estaba en la lista a las 6:53 y a las 6:54 no se encuentra) |
| `pt09-10_producto_despublicado.jpg` | `WhatsApp Image 2026-11-11 at 6.55.40 PM (1).jpeg` | `/p/Hpz74…`: «Información no disponible», sin datos del producto |
| `pt10-07_version_anterior.jpg` | **no existe** | La desarrolladora indicó que no la tomará |
| `rt03_antes.png`, `rt03_insumo_modificado.png`, `rt03_ficha_sin_cambios.png` | **no existen** | La desarrolladora indicó que no las tomará |
| `pt10-11_vista_previa.png` | `WhatsApp Image 2026-11-11 at 7.18.27 PM.jpeg` | Vista previa de un producto publicado: barra de vista previa con «Publicado» y «Volver a la publicación», sobre la ficha |
| `ci_verde_hu10.png` | **no existe aún** (esperado) | — |

Observaciones: dos nombres esperados (`pt10-12_aviso` y `pt09-09_elaboracion_oculta`) corresponden a la misma captura; `E-001` aparece visible en la captura de la fecha (7:18) porque se volvió a mostrar después de la prueba de PT09-09. Las capturas no permiten comprobar por sí solas la ausencia de desplazamiento horizontal.

---

## c) Escenarios adicionales (sección 7 del contexto)

| Escenario | Prueba | Resultado |
|---|---|---|
| Producto no publicado, eliminado e `id_publico` inexistente: misma respuesta | `test_producto_no_publicado_eliminado_e_inexistente_responden_exactamente_igual`; `test_un_producto_no_publicado_con_codigo_o_fecha_validos_responde_el_404_uniforme`; `test_un_producto_no_disponible_hace_una_sola_consulta` | Aprobado (L) |
| Elaboración oculta pedida por código o fecha: «no disponible» sin datos; nunca en la lista | `test_oculta_borrador_y_de_otro_producto_dan_el_mismo_cuerpo_que_un_codigo_inexistente`, `test_fecha_con_una_visible_y_una_oculta_el_mismo_dia_es_ok_con_la_visible`, `test_fecha_sin_elaboraciones_es_no_disponible_y_la_de_una_oculta_tambien` | Aprobado (L) |
| Lista de elaboraciones: solo finalizadas y visibles | `test_una_elaboracion_oculta_o_borrador_no_aparece_en_la_lista_ni_es_la_predeterminada` | Aprobado (L) |
| Lista blanca: conjunto exacto de claves, incluidos los anidados | `test_lista_blanca_conjunto_exacto_de_claves`, `test_la_lista_blanca_tambien_se_cumple_sin_elaboraciones_visibles`, `test_lista_blanca_de_t10_02_estado_y_coincidencias`; previsualización: `test_la_previsualizacion_tiene_exactamente_los_campos_de_la_lista_blanca` | Aprobado (L) |
| Sin token y con token de productor: misma respuesta | `test_sin_token_con_token_de_productor_y_con_token_invalido_la_ficha_es_la_misma` | Aprobado (L) |
| Previsualización de un producto de otro productor: 404 | `test_otro_productor_inexistente_y_eliminado_responden_404` (también inexistente y eliminado: `{"detail": "Producto no encontrado"}`); sin token o con token inválido: `test_sin_token_o_con_token_invalido_responde_401` | Aprobado (L) |
| Fuente única entre previsualización y consulta pública | `test_la_previsualizacion_es_identica_a_la_consulta_publica_de_un_producto_publicado` (cuerpo idéntico con sin parámetros, `codigo`, `fecha`, varias y ninguna); `test_los_parametros_invalidos_dan_el_mismo_422_que_la_consulta_publica` | Aprobado (L) |
| Cabeceras `no-store` y `noindex` | `test_cabeceras_no_store_y_noindex_en_exito_y_en_no_disponible`; `test_la_previsualizacion_no_se_cachea`; `hu10.estados`: «pide a los buscadores no indexar la página…» | Aprobado (L) |
| Sin N+1 | `test_la_cantidad_de_consultas_es_constante_y_no_supera_el_maximo` (máx. 4), `test_la_seleccion_por_codigo_y_por_fecha_no_supera_el_maximo_de_consultas`, `test_las_consultas_no_superan_el_maximo_con_varios_insumos_y_version_anterior`; previsualización: `test_la_cantidad_de_consultas_es_la_de_la_ficha_mas_la_autenticacion` (**5 = 4 de la ficha + 1 de autenticación**) | Aprobado (L) |
| Fail-closed: copia incompleta | `test_una_copia_sin_una_clave_obligatoria_falla_en_lugar_de_declarar_sin_alergenos`, `test_una_copia_incompleta_responde_500_sin_datos_y_el_log_solo_trae_el_uso_y_la_clave`, `test_una_copia_sin_la_clave_alergenos_sigue_dando_500_y_una_lista_vacia_no` | Aprobado (L) |
| Parámetros inválidos: 422 idéntico con `id_publico` existente e inexistente | `test_parametros_invalidos_dan_422_identico_con_id_publico_existente_e_inexistente` (8 variantes) | Aprobado (L) |
| Pendientes de HU09: PT09-04, PT09-09 y PT09-10 con la vista real | Completados en `docs/test/hu09-test-results.md` (sección «PT09-04, PT09-09 y PT09-10 completados en HU10») con las capturas citadas | PT09-09 y PT09-10: Aprobado (captura y pruebas); PT09-04: la apertura de la ficha en el celular está en la captura, la lectura del QR con la cámara se **informó como funcional, sin captura** |

---

## d) Cobertura CA1 … CA11

| CA | Criterio | Pruebas que lo cubren | Estado |
|---|---|---|---|
| CA1 | Acceso sin registrarse | PT10-01; `hu10.ruta`; `hu10.servicio` | Cumplido |
| CA2 | Producto y elaboración visible más reciente por defecto | PT10-02; `hu10.estados`: «muestra el producto y su elaboración por defecto» | Cumplido |
| CA3 | Seleccionar otra elaboración por código o fecha | PT10-03, PT10-04; `hu10.seleccion` (8) | Cumplido (automatizado y manual informado) |
| CA4 | Insumo, marca u origen, ingredientes declarados y advertencias | PT10-05; `hu10.ficha` | Cumplido |
| CA5 | Alérgenos en «contiene» y «puede contener» | PT10-06; las pruebas de agrupación de T10-03; `hu10.ficha` | Cumplido |
| CA6 | Nota de versión anterior, sin numeración | PT10-07 (tres variantes); `hu10.ficha`: «CA6…» | Cumplido (automatizado y manual informado; sin captura) |
| CA7 | Información conservada, no la vigente | PT10-08; mutación T10-01 a) | Cumplido (automatizado y manual informado; sin capturas RT-03) |
| CA8 | Sin información interna de gestión | PT10-09; `hu10.ficha`: «CA8…» | Cumplido |
| CA9 | Aviso: no reemplaza el rotulado ni certifica | PT10-10; `hu10.ficha`: «CA9…»; `hu10.estados` | Cumplido |
| CA10 | Previsualizar antes de publicar | PT10-11; `test_vista_publica_gestion_hu10.py` (13); `hu10.vistaprevia` (9); `hu10.acciones-ficha` (7) | Cumplido (automatizado); captura de la vista previa de un producto publicado |
| CA11 | Adaptada a móviles | PT10-12 (manual): capturas de la ficha en el celular; `hu10.ficha`: «HT07: ningún texto baja de 12 px y los controles de la búsqueda miden al menos 44 px» | Cumplido: manual informado (sin desplazamiento horizontal, textos legibles, selector y búsquedas funcionan) |

Además se cumplen las dos reglas heredadas de HU09 (producto no publicado y elaboración oculta: «no disponible» sin datos) con las pruebas de la sección c).

---

## e) Mutaciones de T10-01 a T10-05

Todas con copia y restauración, confirmadas con `cmp` (y `git diff` con solo los cambios de la tarea). Cada una hace fallar al menos una prueba. Las de T10-01 a T10-04 se toman de los reportes de cada tarea; las de T10-05 se hicieron en su entrega.

| Tarea | Mutación | Pruebas que fallan | Observaciones |
|---|---|---|---|
| T10-01 | a) construir desde el insumo vigente | `test_rt03_…_no_cambia_la_ficha`, `test_pt10_05_cada_insumo_muestra…`, `test_la_cantidad_de_consultas_es_constante…` (3) | Directa |
| T10-01 | b) ignorar el estado oculto | `test_una_elaboracion_oculta_o_borrador_no_aparece…` (1) | Directa |
| T10-01 | c) responder distinto a no publicado e inexistente | `test_producto_no_publicado_eliminado_e_inexistente_responden_exactamente_igual` (1) | Directa |
| T10-01 | d) agregar un `id` interno a la respuesta | `test_lista_blanca_conjunto_exacto_de_claves`, `test_pt10_01_la_ficha_se_consulta_sin_sesion…`, `test_la_lista_blanca_tambien_se_cumple_sin_elaboraciones_visibles` (3) | Directa |
| T10-02 | a) código sin normalizar mayúsculas | `test_pt10_03_seleccion_por_codigo_…` con `e-001` y con ` e-001\t` (2) | Directa |
| T10-02 | b) contar ocultas al buscar por fecha | `test_fecha_con_una_visible_y_una_oculta…`, `test_fecha_sin_elaboraciones_es_no_disponible…`, `test_con_parametros_y_sin_elaboraciones_visibles…` (3) | Directa |
| T10-02 | c) con varias, devolver la primera en silencio | `test_fecha_con_dos_visibles_es_varias…`, `test_lista_blanca_de_t10_02…` (2) | Directa |
| T10-02 | d) código oculto responde distinto que inexistente | `test_oculta_borrador_y_de_otro_producto_dan_el_mismo_cuerpo…` (1) | Directa |
| T10-03 | a) no excluir de «puede contener» lo que ya está en «contiene» | `test_pt10_06_…`, `test_los_grupos_se_ordenan…` (2) | Directa |
| T10-03 | b) intersección en vez de unión | `test_rt03_insumo_modificado…`, `test_lista_blanca_conjunto_exacto_de_claves`, `test_lista_blanca_de_t10_02…`, `test_pt10_06_…`, `test_solo_trazas_deja_contiene_vacio`, `test_los_grupos_se_ordenan…`, `test_rt03_los_grupos_no_cambian…` (7) | Directa |
| T10-03 | c) `version_anterior` al revés | `test_pt10_07_…vigente…`, `test_pt10_07_…anterior…`, `test_un_producto_sin_version_vigente…` (3) | Directa |
| T10-03 | d) sin deduplicar | `test_el_mismo_alergeno_contiene_en_dos_insumos…`, `test_el_mismo_alergeno_en_trazas_en_dos_insumos…` (2) | Directa |
| T10-04 (A) | Sin mutaciones | — | Quedaron para la entrega B, como se acordó |
| T10-04 (B) | a) enviar `Authorization` en la consulta pública | `hu10.servicio`: «nunca envía Authorization…» | Directa |
| T10-04 (B) | b) «No contiene alérgenos» con la lista vacía | `hu10.ficha`: «una lista vacía dice qué no se declaró…» y «con solo trazas…» | Directa |
| T10-04 (B) | c) mostrar la elaboración con `no_disponible` | `hu10.ficha`: «con una respuesta que contradice su estado…» | Directa |
| T10-04 (B) | d) ocultar el aviso al consumidor | `hu10.ficha`: «CA9: el aviso está al final…»; `hu10.estados`: «el aviso al consumidor está visible…» | Directa. Los insumos plegables posteriores no tuvieron mutaciones propias (ninguna de las cuatro tocaba ese componente) |
| T10-05 | a) la previsualización muestra elaboraciones ocultas | `test_las_ocultas_y_los_borradores_no_aparecen_en_la_previsualizacion` (1) | Directa |
| T10-05 | b) previsualizar publica y genera `id_publico` | `test_pt10_11_previsualiza_…`, `test_pt10_11_despues_de_previsualizar_…`, `test_la_previsualizacion_es_identica_…`, `test_la_cantidad_de_consultas_…` (4) | La primera versión chocó con el CHECK `ck_producto_publicado_requiere_id_publico` (otra forma de detectarla); se repitió generando también el `id_publico` para que la detecten las aserciones |
| T10-05 | c) omitir el filtro por productor | `test_otro_productor_inexistente_y_eliminado_responden_404` (1) | Directa |
| T10-05 | d) «Comprobar ficha pública» con el producto despublicado | `hu10.acciones-ficha`: «no aparece si el producto fue despublicado…» y «al deshabilitar la publicación desaparece…» (2) | Directa |

**En T10-06 no se hicieron mutaciones nuevas** (solo se documentan las existentes).

---

## f) RT-03: la ficha muestra la información conservada

**Prueba automatizada (la que verifica el riesgo):**

- `test_rt03_insumo_modificado_despues_de_finalizar_no_cambia_la_ficha`: se finaliza una elaboración, se modifica después el insumo (marca y alérgenos) y la consulta pública devuelve los valores originales.
- `test_rt03_los_grupos_no_cambian_al_modificar_los_alergenos_del_insumo`: lo mismo para los grupos «contiene» / «puede contener».
- Mutación T10-01 a) (construir desde el insumo vigente): detectada por 3 pruebas, entre ellas la RT-03.

Aprobadas en SQLite y PostgreSQL (L).

**Capturas `rt03_antes.png`, `rt03_insumo_modificado.png`, `rt03_ficha_sin_cambios.png`: no existen** en `docs/test/validacion_hu10/` (la desarrolladora indicó que no las tomará). **RT-03 manual: sí**, la ficha siguió mostrando lo original tras modificar el insumo (informado por la desarrolladora el 11-11-2026); es un dato informado, sin captura que lo respalde. La verificación documentada es la automatizada.

---

## g) OE4: tiempo de respuesta (PT10-13)

**Resultado: CUMPLE.** De 100 consultas, el **100,0 %** respondió 200 en 2000 ms o menos (meta: ≥ 95 %). Medición del 11-11-2026, 22:14.

| Medida | Valor |
|---|---|
| n (consultas medidas) | 100 |
| p50 | 15,5 ms |
| p95 | 24,9 ms |
| Máximo | 31,1 ms |
| Mínimo / media | 10,6 ms / 16,9 ms |
| % ≤ 2000 ms (solo respuestas 200) | 100,0 % |
| Consultas fallidas (código distinto de 200) | 0 |
| Respuestas 200 con estado inesperado | 0 |

Por variante (25 cada una; p50 / p95 / máximo en ms): sin parámetros 16,8 / 26,7 / 28,8; `?codigo=` 15,8 / 24,1 / 31,1; `?fecha=` 15,5 / 24,6 / 28,5; código inexistente 13,8 / 22,9 / 26,7. Datos completos: `docs/test/validacion_hu10/oe4_mediciones.csv` (n, variante, código HTTP, ms) y `docs/test/validacion_hu10/oe4_resultados.md`.

**Método.** `backend/scripts/medir_oe4_hu10.py`: httpx 0.28.1 contra la API real en ejecución (`http://localhost:8000`), dentro del contenedor del backend; no usa `TestClient`. **Solo lee** (únicamente `GET /publico/productos/{id_publico}`, sin token). Descubrimiento de las elaboraciones visibles (no medido), 5 consultas de calentamiento descartadas y 100 consultas secuenciales en cuatro variantes alternadas de 25 (sin parámetros, `?codigo=` visible, `?fecha=` visible, `?codigo=` inexistente), con una conexión reutilizada y tiempo medido con `time.perf_counter()` hasta leer todo el cuerpo. Toda respuesta con un código distinto de 200 cuenta como fallida y se reporta; una fallida nunca cuenta como «dentro de 2 s». Si el producto no está disponible, el script aborta sin escribir nada (así ocurrió en un primer intento, con el producto despublicado; se repitió una sola vez tras republicarlo).

**Entorno.** Docker Desktop (motor 29.7.2, Linux) en Windows 11 Pro, 8 CPU y 12,4 GB asignados; PostgreSQL 16.15 local en el contenedor `trazapp-database`; FastAPI con `uvicorn --reload` (modo de desarrollo, un solo proceso). **Producto medido:** «Queque de chocolate» (`id_publico` `Hpz74Rsz15_kkmwoETmz6g`), con **1 elaboración visible** (`E-002`) y **8 insumos** en ella en el momento de la medición (después se volvió a mostrar `E-001`; la medición no se repitió).

**Limitación (obligatoria):** la medición es local, de un solo cliente y secuencial: mide el tiempo del servidor y de la base de datos, **no el de la red móvil real** ni el de un despliegue, y no mide concurrencia. Con un producto de una sola elaboración visible no se puede extrapolar a productos con muchas elaboraciones (la lista crece con la frecuencia de producción).

---

## h) Decisiones de diseño relevantes

1. **Forma (b) con la lista de elaboraciones.** Un solo endpoint `GET /publico/productos/{id_publico}` con `codigo` o `fecha` opcionales; la respuesta incluye la lista de elaboraciones visibles (código y fecha) para que el consumidor vea todas y elija la suya. Decisión de la desarrolladora (09-11-2026): se prioriza la transparencia; el control del productor es ocultar elaboraciones (HU09).
2. **404 uniforme.** Producto no publicado, eliminado, inexistente o con `id_publico` mal formado: el mismo código y el mismo cuerpo (`{"detail": {"mensaje": "Información no disponible"}}`), con las mismas cabeceras. El parámetro de ruta no lleva `pattern` ni `max_length` (daría un 422 distinto).
3. **Mensaje unificado.** «Elaboración oculta» y «código no encontrado» (dos estados de HT05) se fusionan en «No encontramos información disponible para esa elaboración» (`200` con `elaboracion: null` y `estado_elaboracion: "no_disponible"`): si se distinguieran, quien pruebe códigos sabría que una elaboración oculta existe. Cumple PT10-04 y CA8 de HU09.
4. **Lista blanca y fail-closed.** Cada campo público se declara a mano en el esquema (`extra="forbid"`, nunca desde un objeto ORM) y una prueba afirma el conjunto exacto de claves. Si a una copia conservada le falta `ingrediente`, `insumo` o `alergenos` (o hay un tipo de alérgeno desconocido), la API responde 500 sin datos y el registro lleva solo el id del uso y la clave faltante; una lista vacía significa «sin alérgenos declarados», una clave ausente es error.
5. **Orden de los alérgenos.** El de las pantallas del productor (`ordenar_declarados`): primero los de declaración obligatoria en Chile, luego por nombre (y por código si hay empate). `obligatorio_chile` se lee de la copia y no se expone. Un alérgeno «contiene» en un insumo y «puede contener» en otro queda solo en «Contiene».
6. **`version_anterior` sin número.** Booleano: `true` si la versión de la elaboración no es la vigente o si el producto no tiene versión vigente. No se expone `numero_version`, ningún id de versión ni el contenido de la vigente.
7. **La URL es la fuente de verdad de la selección.** `?codigo=` / `?fecha=` con una entrada de historial por selección: Atrás y los enlaces compartidos funcionan. Es también el identificador para HU11: el par `id_publico` + código de la elaboración.
8. **Fuente única para la previsualización.** `ConsultaPublicaService.previsualizar()` comparte con `consultar()` la función `_ficha()` / `armar_ficha` y las funciones de visibilidad de T09-04 sin modificarlas (el producto se evalúa con la vista `_ProductoComoPublicado`); mismo esquema y misma vista en el frontend (`FichaVista`), solo cambia la fuente de datos. No escribe nada.
9. **`no-store` y `noindex`.** `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow` en la API pública (también en el 404) y `no-store` en la previsualización; la vista agrega `<meta name="robots" content="noindex">` y Netlify añade la cabecera `X-Robots-Tag` para `/p/*`.
10. **Otras:** identidad del producto = la vigente; «Marca u origen» como una sola etiqueta (el modelo tiene un único campo); en el 404 de la previsualización, un producto eliminado responde como inexistente (convención de gestión: solo ve productos activos); `producto.id_publico` puede ser `null` solo en la previsualización de un producto nunca publicado; el cliente de la vista pública nunca envía token aunque haya sesión.

---

## i) Diferencias con el diseño (HT05)

Registradas y aprobadas por la desarrolladora en la sección 9.7 del contexto (`docs/context/TrazApp_HU10_contexto_agente.md`); resumen:

- **Se quitan:** insignia «Información publicada» y escudo «Información trazable» (sugieren una verificación que TrazApp no hace); crédito de foto de ejemplo; «Consumir preferentemente» (vencimiento del lote, dato interno); bloque «Ingredientes declarados» de la fórmula completa (contradice D3; cada insumo muestra el suyo); etiqueta «Rotulación obligatoria» (`obligatorio_chile` no es público). La barra `PreviewToolbar` no se quita: es la `BarraVistaPrevia` de T10-05.
- **Se cambian:** «Marca» / «Origen» pasan a «Marca u origen»; «Advertencias» pasa de lista a un texto; los alérgenos suben antes del detalle de insumos (CA5); lista vacía: «No se declararon alérgenos» / «No se declararon trazas», nunca «No contiene alérgenos» ni «Libre de…»; los estados «elaboración oculta» y «código no encontrado» se fusionan (sección h.3); aviso con el texto de CA9, siempre visible y fuera de bloques plegables; pie «Información declarada por el productor»; textos de 10 px pasan a 12 px como mínimo y controles de 44 px (HT07); colores del prototipo reemplazados por tokens (el modo oscuro funciona solo); **insumos plegables** (pedido de la desarrolladora tras la revisión): cada insumo muestra siempre ingrediente, nombre, «Marca u origen», sus alérgenos y su advertencia, y la flecha despliega solo los ingredientes declarados; nota de versión anterior sin número.
- **Se agregan:** alérgenos por insumo como etiquetas con texto; búsqueda por código y por fecha («Fecha de elaboración», nunca vencimiento); estados que el diseño no tenía (varias coincidencias, sin elaboraciones, error de servidor o de red con «Reintentar», búsqueda no válida, carga).
- **Revisión posterior (T10-06, no es un cambio de diseño):** se detectó que un insumo cuyo texto de advertencias repite su alérgeno (por ejemplo «Contiene gluten» junto con la etiqueta «Contiene: Gluten») muestra la información dos veces: son dos datos distintos del insumo (alérgenos estructurados y advertencias de texto libre). No se modificó; ver limitaciones.

---

## j) Limitaciones

- **La lista de elaboraciones revela la frecuencia de producción.** Decisión consciente de la desarrolladora (D1), mitigada con el ocultamiento de elaboraciones; la lista no tiene tope y puede crecer.
- **La identidad del producto es la vigente.** Nombre, contenido neto, presentación e imagen no están conservados por elaboración: un cambio de nombre se refleja en las elaboraciones antiguas (la composición y los alérgenos sí son los conservados).
- **`max(id)` asume una sola versión vigente.** La versión vigente se calcula como el máximo `id` de las versiones vigentes del producto; si el modelo llegara a admitir más de una vigente a la vez, el cálculo habría que revisarlo.
- **La prueba de «ningún entero» en la lista blanca es frágil ante campos numéricos futuros.** Se usa para garantizar que no hay ids de versión; un campo público numérico legítimo la haría fallar y obligaría a ajustarla.
- **`noindex` por JavaScript más cabecera en Netlify.** El `<meta name="robots">` lo pone la vista al montarse (un buscador que no ejecute JS no lo ve) y la cabecera `X-Robots-Tag` está en `netlify.toml` para `/p/*`, solo efectiva en el despliegue de Netlify; no se probó en un despliegue real.
- **Sin límite de solicitudes** (rate limiting) ni protección anti-bots: fuera de alcance de HU10; queda como riesgo (el endpoint es público y sin autenticación, y permite probar códigos y fechas).
- **La imagen del producto puede ser una URL externa** que escribió el productor; la vista la muestra tal cual, como el resto de la app, y la quita si falla al cargar.
- **Medición de OE4 local:** mide el servidor y la base, no la red móvil, con un producto de una sola elaboración visible (g).
- **Prueba en celular por red local:** HTTP sobre la IP de la red local (el navegador avisa que la conexión no es segura), un solo dispositivo (Redmi Note 13 5G, Android 15) y un solo navegador; no se probó iOS/Safari (se hereda RT-08 de HU09). La prueba manual de CA11 es informada y sin captura del escaneo, y no se tomaron las capturas de PT10-07 ni de RT-03.
- **Advertencias repetidas con el alérgeno:** si el texto libre de «Advertencias» de un insumo repite su alérgeno, la ficha lo muestra dos veces. No se oculta automáticamente (comparar texto libre es frágil y esconder una advertencia por error es peor que repetirla); se corrige editando el insumo.

---

## k) Incidencias

- **Contenedores detenidos externamente durante T10-05.** Los tres contenedores de TrazApp aparecieron detenidos a la vez (base de datos código 0, backend 137, frontend 143; sin OOM). Parece una detención externa, por ejemplo de Docker Desktop. Se reiniciaron con `docker start trazapp-database trazapp-backend trazapp-frontend`, sin tocar volúmenes, y se volvieron a pasar las pruebas del backend. No fue causada por el código.
- **CI del frontend, entrega B de T10-04:** `ui/ht07.bloque4.test.tsx` falló (1 de 1284): la ficha pública usaba la clase `uppercase`, que HT07 prohíbe, en cinco componentes. No se había corrido localmente porque no estaba en la lista de pruebas afectadas. Corregido (se quitó `uppercase tracking-wide(r)`); la prueba pasa (L). Esa corrección y la entrega T10-05 viajan en un mismo commit (`3b6c8a9`, que lleva el mensaje del arreglo).
- **Producto de medición despublicado:** tras comprobar PT09-10 el producto `Hpz74…` quedó despublicado; el primer intento de medir OE4 abortó sin escribir nada. Se republicó y se midió una sola vez (g).
- **Capturas con nombre distinto del esperado:** las del celular llegaron con nombres de WhatsApp; se citan con su nombre real, sin moverlas.
- **Prueba de HU09 adaptada** (`hu09.visibilidad`): explicada en a); no se relajó ninguna aserción.

---

## l) Pendientes para HU11

- **Identificador de la consulta:** el par `(id_publico, codigo de la elaboración)` con la normalización de T10-02 (`strip()` + `casefold()`, sin colapsar espacios internos). El código es inmutable tras finalizar y no expone ningún id interno.
- **La selección ya vive en la URL** (`?codigo=` o `?fecha=`): una evaluación puede asociarse al contexto de la consulta con esa URL; con `?fecha=` y `estado_elaboracion: "varias"` no hay elaboración elegida hasta que el consumidor escoja un código.
- **Ocultar o despublicar tras una evaluación:** HU11 deberá decidir qué pasa con las evaluaciones de una elaboración que luego se oculta.
