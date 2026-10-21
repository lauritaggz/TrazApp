# HU13 — Resultados de pruebas (T13-08, T13-09 y T13-10)

**Fecha:** 2026-10-20 (T13-08), 2026-10-21 (T13-09 y T13-10); pruebas en Android del 20 y 21-10-2026
**Rama:** `feature/hu13-codigo-barras`
**HEAD al ejecutar:** `1fe8247` (T13-01 a T13-07 comprometidas) más los cambios de T13-08, T13-09 y T13-10, todavía sin commit: este documento, el documento de contexto, `docs/hu13-prueba-celular.md` (resultados de Android), el helper de `hu01.products.test.tsx` y lo de T13-09 (ver «T13-09»)
**Historia:** HU13 — Búsqueda de insumos mediante código de barras
**Criterios de referencia:** CA01 … CA13 y PT13-01 … PT13-15 (`docs/TrazApp_HU13_contexto_agente.md`, sección 4)
**Entorno:** backend con Python 3.12 (contenedor `trazapp-backend`) sobre SQLite en memoria y sobre PostgreSQL 16 (contenedor `trazapp-database`, base aislada `trazapp_test`); frontend con Vitest y Vite (Node local). Revisión de la base: `017_alergenos_revisados_ht06` (`alembic current`); **la HU13 no agrega migración**.

---

## Resumen de la historia

Como productor, quiero escanear con la cámara del celular el código de barras de un insumo para obtener su información sin digitarla. El lector corre en el navegador (detector nativo o ZBar-WASM), la consulta a Open Food Facts corre solo en el backend, los alérgenos se sugieren a partir de las etiquetas de la fuente y del texto de ingredientes, y **nada se registra hasta que el productor guarda el formulario**. El escaneo está en «Nuevo insumo» y en el diálogo «Registrar insumo nuevo» de la elaboración.

Estado: implementada y con pruebas automatizadas aprobadas. **Probada a mano en Chrome para Android (Redmi Note 13 5G, 20 y 21-10-2026): los casos de uso informados quedaron aprobados** (precarga, alérgenos, duplicado, no encontrado, permiso denegado, ingreso manual, linterna, escáner en la elaboración, creación de ingrediente, UPC-A y EAN-8, entre otros; ver «Prueba en el celular»). **Safari para iOS: NO probado por falta de dispositivo**, así que CA12 queda **parcialmente verificado**. La prueba en Android encontró dos hallazgos que originaron la T13-09 (crear el ingrediente sin perder lo recuperado) y la T13-10 (el texto de ingredientes traía el fabricante y su dirección).

---

## Resumen de ejecución

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Backend, SQLite | `python -m pytest -q` (sin `TEST_DATABASE_URL`) | 1250 aprobadas, 148 omitidas, 0 fallos (11 min 15 s) |
| Backend, PostgreSQL | `python -m pytest -q` (con `TEST_DATABASE_URL` → `trazapp_test`) | 1398 aprobadas, 0 omitidas, 0 fallos (24 min 00 s) |
| Frontend | `npx vitest run` | 39 archivos, 898 pruebas aprobadas, 0 fallos (68 s) |
| Type check | `npx tsc -b` | sin errores |
| Build | `npm run build` | correcto; `zbar-<hash>.wasm` (239 kB) y el decodificador (`main-<hash>.js`, 19,7 kB) en archivos aparte |

Las suites se corrieron una después de la otra (nunca dos de PostgreSQL a la vez).

**Línea base (merge de HT06, al empezar la HU13):** SQLite 896 aprobadas y 147 omitidas, PostgreSQL 1043, frontend 555 (23 archivos). **Diferencia:** +354 aprobadas y +1 omitida en SQLite, +355 en PostgreSQL, +343 y +16 archivos en el frontend (898 = 555 + 343). La omitida de más es la prueba de consistencia con el catálogo migrado, que exige PostgreSQL.

Pruebas propias de la HU13 (con casos parametrizados): backend 355 (9 archivos; 354 corren en SQLite), frontend 343 (16 archivos).

**T13-09 (2026-10-21), solo pruebas afectadas, sin volver a correr las suites completas:** +11 pruebas de frontend (9 en `hu13.ingrediente.test.tsx`, 1 en `hu13.dialogo.test.tsx` y 1 en `hu13.recorridos.test.tsx`), con lo que HU13 suma 354 pruebas de frontend en 17 archivos y la suite completa sería de 909 pruebas en 40 archivos. Esa cifra es la suma, **no una corrida**: las suites completas del cuadro son las de T13-08. Sí se corrieron `tsc -b` (sin errores) y `hu13.ingrediente`, `hu13.dialogo`, `hu13.recorridos`, `hu13.busqueda` y `hu04.insumos` (todas aprobadas), y las 3 mutaciones. No se tocó el backend.

**T13-10 (2026-10-21), solo pruebas afectadas:** +31 pruebas de backend (`test_limpieza_ingredientes_hu13.py`), con lo que HU13 suma 386 pruebas de backend en 10 archivos. Corrieron esas 31 en SQLite y PostgreSQL, y los archivos relacionados (`test_consulta_codigo`, `test_fuente_off_fixtures`, `test_alergenos_fixtures`, `test_registro_desde_codigo`, `test_fuente_open_food_facts` y `test_alergenos_deteccion`: 312 en SQLite, 154 en PostgreSQL de los relacionados), todas aprobadas, más las 3 mutaciones. No se tocó el frontend ni ninguna prueba existente. Las suites completas del cuadro siguen siendo las de T13-08.

Evolución de las suites completas durante la historia:

| Tarea | SQLite | PostgreSQL | Frontend |
|---|---|---|---|
| Antes de HU13 | 896 / 147 omitidas | 1043 | 555 |
| T13-03 | 1024 / 147 | 1171 | — |
| T13-04 | 1173 / 148 | 1321 | — |
| T13-01 | — | — | 618 |
| T13-02 | — | — | 729 |
| T13-05 | — | — | 825 |
| T13-06 | 1191 / 148 | 1339 | 859 |
| **T13-08 (cierre)** | **1250 / 148** | **1398** | **898** |

---

## Qué se implementó

| Tarea | Qué hace |
|-------|----------|
| **T13-01** — Lector | `lib/lectorCodigoBarras.ts` (detector nativo si lee EAN-13, EAN-8 y UPC-A; si no, el polyfill con `import()` diferido), hook `useEscanerCodigoBarras` (cámara trasera en dos intentos, ciclo de 250 ms, valida cada lectura, ignora repetidos 4 s, detiene las pistas al reconocer, cerrar y desmontar) y componente `EscanerCodigoBarras`. Dependencia `@undecaf/barcode-detector-polyfill` 0.9.23 y alias de Vite para servir el `.wasm` desde la aplicación. |
| **T13-02** — Ingreso manual y permisos | Campo «Número del código de barras» siempre disponible (normaliza espacios y guiones, valida dígito verificador), clasificación de los errores de la cámara (permiso denegado, sin cámara, cámara ocupada, contexto no seguro, genérico) con mensaje y reintento según el caso, y `docs/licencias-terceros.md`. |
| **T13-03** — Recuperación en el backend | Paquete `app/services/recuperacion/` (`Protocol FuenteProducto`, adaptador de Open Food Facts con `httpx`, servicio), `GET /gestion/insumos/consulta-codigo/{codigo}` (200 encontrado o no, 401, 422, 409, 503), equivalencia UPC-A / EAN-13 en `codigo_barras.py`, 12 respuestas grabadas, guarda de red en `conftest` y script de grabación. La consulta no escribe nada. |
| **T13-04** — Detección de alérgenos | Función pura `detectar_alergenos` y tablas en `alergenos_palabras.py`: etiquetas de la fuente → catálogo, palabras clave en español, trazas, negaciones y excepciones; «contiene» gana sobre «trazas»; lo no reconocible va a `sin_reconocer`. |
| **T13-05** — Precarga e integración | Búsqueda en «Nuevo insumo» y en el diálogo de la elaboración (hook `useBusquedaCodigoBarras`, `BuscarPorCodigo`, formulario vuelto a montar con `key`), confirmación antes de reemplazar lo escrito, alérgenos sugeridos con su origen en `AlergenosSelector`, duplicados (usar, ver o reactivar) y recorridos de interacciones. |
| **T13-06** — Código, fuente y fecha | `POST` rechaza una fuente externa sin fecha (422), copia con `codigo_barras` al finalizar, bloque «Origen de la información» en el detalle (fecha en hora de Chile y enlace a la ficha), mapa de fuentes en `lib/fuentesInsumo.ts`. |
| **T13-07** — Preparación de la prueba en celular | Cierre de dos huecos de T13-06 (misma regla de fuente sin fecha en `PATCH`; la URL de la ficha solo http o https en `POST` y `PATCH`), `npm run dev:https` (HTTPS propio, red local y proxy `/api`), `docs/hu13-prueba-celular.md` y el botón de linterna sobre el video. **La prueba con los celulares queda a cargo de la desarrolladora.** |
| **T13-09** — Crear un ingrediente sin salir del registro de insumo | Botón «Crear ingrediente» junto al selector (en «Nuevo insumo» y en la edición) que abre el `IngredientCreateDialog` de HU03 y reemplaza al enlace a `/ingredientes/nuevo`. El ingrediente creado queda elegido y el resto del formulario (lo escrito, lo precargado por el código, los alérgenos y la fuente, la fecha y la ficha) queda intacto; cancelar no cambia nada; el foco vuelve al selector; con el ingrediente fijo del diálogo de la elaboración no se muestra. Originada por la prueba en Android. |
| **T13-10** — Limpiar el texto de ingredientes recuperado | En el servicio de recuperación, `ingredientes_declarados` de la propuesta sale sin el fabricante y los datos de contacto: se corta desde la primera frase de fabricante («elaborado por», «elaborado y envasado por», «envasado por», «fabricado por», «importado por», «distribuido por», «producido por», «comercializado por») o dato de contacto (fono, teléfono, correo, sitio web, `www.`) hasta el final, y se conserva al final un aviso de alérgenos posterior (`puede contener`, `contiene`, `trazas de`, `elaborado en una línea que procesa…`). Las frases de trazas como «elaborado en una línea que procesa…» no se cortan. **La detección de alérgenos sigue corriendo sobre el texto original** y la `ficha` conserva el original. Si el corte no deja ingredientes, se usa el original. Función pura en `backend/app/services/recuperacion/limpieza.py`. Originada por el hallazgo con el azúcar flor. |
| **T13-08** — Cierre | Investigación y corrección de la prueba intermitente de `hu01.products`, suites completas, este documento y revisión del documento de contexto. |

---

## Archivos de prueba (leyenda de las tablas)

| Clave | Archivo | Pruebas | Qué cubre |
|-------|---------|---------|-----------|
| **B1** | `backend/tests/test_fuente_open_food_facts_hu13.py` | 34 | Adaptador: petición, User-Agent, timeout, interpretación, no encontrado, fallas de red y HTTP, guarda de red |
| **B2** | `backend/tests/test_fuente_off_fixtures_hu13.py` | 46 | Las 12 respuestas grabadas, reintento del UPC-A y el endpoint con respuestas grabadas |
| **B3** | `backend/tests/test_consulta_codigo_hu13.py` | 43 | Contrato del endpoint, duplicados en ambas formas, aislamiento entre productores, «no persiste nada» |
| **B4** | `backend/tests/test_codigo_barras_equivalencias_hu13.py` | 5 | Equivalencia UPC-A / EAN-13 |
| **B5** | `backend/tests/test_alergenos_deteccion_hu13.py` | 124 | Detección: texto, etiquetas, prioridad, normalización |
| **B6** | `backend/tests/test_alergenos_fixtures_hu13.py` | 17 | Detección sobre las respuestas grabadas y en el endpoint |
| **B7** | `backend/tests/test_alergenos_consistencia_hu13.py` | 9 | Las tablas coinciden con el catálogo (una prueba solo en PostgreSQL, con migraciones reales) |
| **B8** | `backend/tests/test_registro_desde_codigo_hu13.py` | 18 | De punta a punta: consulta → registro → código, fuente, fecha, ficha y alérgenos; copia al finalizar |
| **B9** | `backend/tests/test_fuente_y_ficha_hu13.py` | 59 | Reglas de `POST` y `PATCH`: fuente sin fecha y dirección de la ficha |
| **B10** | `backend/tests/test_limpieza_ingredientes_hu13.py` | 31 | Limpieza del texto de ingredientes: tabla de casos, azúcar flor grabado, ficha original, detección sobre el original |
| **F1** | `frontend/src/escaner/hu13.lector.test.ts` | 11 | Nativo frente a polyfill |
| **F2** | `frontend/src/escaner/hu13.polyfill-real.test.ts` | 2 | El polyfill real se importa bajo Vitest |
| **F3** | `frontend/src/escaner/hu13.escaner.test.tsx` | 45 | Hook y componente: cámara, ciclo, validación, repetidos, liberación, linterna |
| **F4** | `frontend/src/escaner/hu13.sin-cdn.test.ts` | 9 | Sin CDN ni consultas directas; alias; mapa de fuentes único |
| **F5** | `frontend/src/escaner/hu13.build.test.ts` | 4 | Build del lector con la configuración real |
| **F6** | `frontend/src/escaner/hu13.dist.test.ts` | 6 | `dist/` real con el escáner dentro de la aplicación |
| **F7** | `frontend/src/escaner/hu13.entrada-lib.test.ts` | 56 | Limpieza y validación de la entrada; clasificación de errores de cámara |
| **F8** | `frontend/src/escaner/hu13.entrada-manual.test.tsx` | 55 | Campo manual, errores de cámara y contexto no seguro |
| **F9** | `frontend/src/escaner/hu13.busqueda-camara.test.tsx` | 5 | Código leído por la cámara → panel cerrado, cámara liberada, una búsqueda |
| **F10** | `frontend/src/escaner/hu13.busqueda-hook.test.tsx` | 17 | Máquina de estados de la búsqueda |
| **F11** | `frontend/src/escaner/hu13.dev-https.test.ts` | 33 | `dev:https`: activación, build idéntico, servidor real y proxy |
| **F12** | `frontend/src/insumos/hu13.busqueda.test.tsx` | 41 | Página «Nuevo insumo»: estados, precarga, confirmación, alérgenos, registro, duplicados |
| **F13** | `frontend/src/insumos/hu13.precarga-lib.test.tsx` | 9 | Precarga a partir de la respuesta; origen en `AlergenosSelector` |
| **F14** | `frontend/src/insumos/hu13.origen.test.tsx` | 30 | «Origen de la información» en el detalle; mapa de fuentes |
| **F15** | `frontend/src/elaboraciones/hu13.dialogo.test.tsx` | 15 | Diálogo de la elaboración: búsqueda, ingrediente fijo, duplicados, Escape |
| **F16** | `frontend/src/recorridos/hu13.recorridos.test.tsx` | 5 | Interacciones: por código frente a manual |

Los nombres que siguen son los de la prueba; cuando hay un bloque `describe` relevante se indica entre comillas.

---

## Trazabilidad CA01 … CA13

**Cómo se verificó cada criterio.** «Automatizado» = pruebas de las tablas. «Celular» = lo verificado a mano en **Chrome para Android** (Redmi Note 13 5G, 20 y 21-10-2026) según `docs/hu13-prueba-celular.md`; **Safari para iOS no se probó**. Solo se marcó lo que se informó; «No informado» o «No probado» significa que no hay resultado en dispositivo y no equivale a aprobado.

| Criterio | Automatizado | Verificado a mano en el celular |
|---|---|---|
| CA01 Activar la cámara desde el registro | Sí | ✔ Android (escáner en «Nuevo insumo» y en el diálogo de la elaboración); iOS no probado |
| CA02 EAN-13, EAN-8 y UPC-A | Sí | ✔ Android: EAN-13 (Loncoleche), UPC-A (atún) y EAN-8 (96385074, leído y no encontrado); iOS no probado |
| CA03 Buscar en bases abiertas | Sí (con respuestas grabadas) | ✔ Android con Loncoleche, el atún, el aceite de girasol y el azúcar flor, entre otros (fuente real); no probado sin conexión; iOS no probado |
| CA04 Ingreso manual | Sí | ✔ Android (Triton ingresada a mano); iOS no probado |
| CA05 Permisos de la cámara | Sí | ✔ Android (permiso denegado: mensaje, sin reintento y campo manual); iOS no probado |
| CA06 Alérgenos al catálogo | Sí | ✔ Android: Loncoleche (Leche por texto), aceite de girasol (soya «Contiene», maní «Trazas»), producto sin ingredientes y azúcar flor; iOS no probado |
| CA07 Ingrediente y duplicados | Sí | ✔ Android: duplicado y creación del ingrediente (T13-09); iOS no probado |
| CA08 Precarga con confirmación | Sí | ✔ Android: precarga y «Reemplazar datos» / «Conservar lo escrito»; iOS no probado |
| CA09 Componente aislado | Sí | No aplica |
| CA10 Producto no encontrado | Sí | ✔ Android (producto no encontrado con el código escrito); iOS no probado |
| CA11 Código, fuente y fecha | Sí | ✔ Android: «Obtenido de Open Food Facts» en el detalle y el código en el detalle de la elaboración; iOS no probado |
| CA12 Chrome Android y Safari iOS | Parcial: solo lo que se puede probar sin dispositivo | **Parcialmente verificado:** Android ✔ a mano; **iOS pendiente** |
| CA13 La cámara se detiene | Sí (con una cámara simulada) | ✔ Android al cerrar el escáner; «al reconocer un código» no se informó por separado; iOS no probado |

### CA01 — Activar la cámara desde el registro de un insumo
**Estado:** cubierto (automatizado); en Chrome para Android, verificado a mano; en iOS, no probado.

| Capa | Pruebas |
|------|---------|
| Frontend | F3 «Arranque de la cámara»: `pide la cámara trasera con 1280×720 ideal en el primer intento`, `hace el segundo intento con solo facingMode si el primero falla por restricciones` · F3 «Componente EscanerCodigoBarras»: `muestra el panel con título, video, texto de estado y botón Cerrar` · F12: `antes de buscar no hay mensaje ni aviso, y el bloque está sobre el formulario` · F15 «Bloque de búsqueda en el diálogo»: `el bloque está dentro del diálogo, sobre el formulario` · F6: `la página de nuevo insumo llega al lector (el escáner está de verdad en la aplicación)` |

### CA02 — Reconocer EAN-13, EAN-8 y UPC-A
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_acepta_ean_13_upc_a_y_ean_8`, `test_un_codigo_invalido_responde_422_sin_consultar_la_fuente` · B4: las 5 pruebas de equivalencia |
| Frontend | F1: `lee solo EAN-13, EAN-8 y UPC-A` · F2: `el polyfill declara los tres formatos que usamos` · F3 «Validación de lo leído»: `descarta una lectura con dígito verificador inválido y sigue buscando`, `descarta lecturas de otros formatos y de largo no permitido`, `acepta un UPC-A de 12 dígitos y un EAN-8` · F8 «Campo del número del código»: `el dígito verificador incorrecto se explica y no se entrega` |

### CA03 — Buscar el producto en una base abierta
**Estado:** cubierto (automatizado; la fuente real nunca se consulta en las pruebas).

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_pide_el_producto_con_los_campos_necesarios`, `test_se_identifica_con_el_user_agent_de_la_configuracion`, `test_la_espera_maxima_viene_de_la_configuracion`, `test_interpreta_un_producto_completo`, `test_la_guarda_bloquea_las_peticiones_http_reales` · B2: `test_el_endpoint_propone_el_insumo_a_partir_de_una_respuesta_grabada` · B3: `test_producto_encontrado_responde_la_propuesta`, `test_el_adaptador_real_encontrado_y_no_encontrado_de_punta_a_punta` |
| Frontend | F10: `al recibir un código cierra el escáner y pasa a buscando` · F9: `cierra el panel, libera la cámara y busca el código una sola vez` · F12 «Estados de la búsqueda»: `encontrado: avisa que viene de Open Food Facts y que hay que revisar` · F4: ningún archivo de `src/` nombra una CDN ni consulta Open Food Facts (la consulta es solo del backend) |

### CA04 — Ingresar a mano el número del código
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Frontend | F8 «Campo del número del código»: `se envía con Enter`, `después de un error se puede corregir y enviar`, `deja el foco en el campo cuando el código no es válido` · F8 «La cámara y el ingreso manual»: `al usar el campo se detiene la cámara`, `un código inválido no detiene la cámara`, `el campo se puede usar mientras la cámara escanea, sin interrumpirla`, `el campo sigue disponible después de reconocer un código con la cámara` · F7: `conserva los ceros del comienzo`, `pide el número si el campo está vacío` · F8 «Contexto no seguro»: `en un contexto no seguro el ingreso manual funciona` |

### CA05 — Cámara no permitida: informarlo y ofrecer el ingreso manual
**Estado:** cubierto (automatizado); en dispositivo, no informado en la prueba de Android (PT13-04) y no probado en iOS.

| Capa | Pruebas |
|------|---------|
| Frontend | F8 «Errores de la cámara (CA05)»: `el permiso denegado explica cómo habilitar la cámara y no ofrece reintentar`, `«Intentar de nuevo» vuelve a abrir la cámara cuando estaba ocupada`, `un fallo del lector (por ejemplo no carga el polyfill) ofrece reintentar`, `el mensaje se anuncia con aria-live en la misma región de estado`, `un código inválido tras un error de cámara muestra el error del campo` · F8 «Contexto no seguro»: `sin contexto seguro explica que hace falta HTTPS y no intenta abrir la cámara`, `sin navigator.mediaDevices pasa lo mismo, aunque el contexto sea seguro` · F7 «Clasificación de los errores de la cámara»: `el permiso denegado explica cómo habilitar la cámara`, `todos los mensajes ofrecen el ingreso manual` · F3: `no repite el pedido si el usuario negó el permiso, y expone el error crudo`, `sin API de cámara, el estado es error por contexto inseguro y no se pide nada` |

### CA06 — Alérgenos desde la fuente y el texto, con «contiene» y «trazas»; lo no reconocido, a asignación manual
**Estado:** cubierto (automatizado). Límites del detector: ver más abajo.

| Capa | Pruebas |
|------|---------|
| Backend | B5: `test_deteccion_desde_el_texto` (70 casos de texto), `test_cada_etiqueta_de_contiene_se_traduce_a_su_alergeno`, `test_cada_etiqueta_de_trazas_se_traduce_a_trazas`, `test_una_etiqueta_sin_mapeo_va_a_asignacion_manual`, `test_si_la_etiqueta_dice_contiene_y_trazas_gana_contiene`, `test_un_alergeno_nunca_esta_a_la_vez_en_contiene_y_en_trazas` · B6: `test_loncoleche_sin_lactosa_trae_leche_desde_el_texto_aunque_la_fuente_no_la_etiquete`, `test_galleta_triton_trae_gluten_y_soya_de_la_etiqueta`, `test_aceite_de_girasol_contiene_la_soja_etiquetada_y_el_mani_es_traza`, `test_el_endpoint_envia_lo_no_reconocible_a_asignacion_manual`, `test_el_endpoint_no_sugiere_un_alergeno_que_falta_en_el_catalogo` · B7: los códigos de las tablas existen en el catálogo (SQLite y base migrada) · B3: `test_la_respuesta_llena_los_alergenos_con_el_catalogo`, `test_el_detector_recibe_las_etiquetas_y_el_texto_de_la_fuente` · B8: `test_los_alergenos_de_la_propuesta_se_guardan_con_su_tipo` |
| Frontend | F12 «Alérgenos sugeridos»: `avisa que son sugeridos y que hay que compararlos con el envase`, `carga los alérgenos con su tipo y muestra de dónde viene cada uno`, `lista lo que no pudo asociar para que el productor lo asigne a mano (CA06)`, `sin sugerencias: el selector queda vacío, no hay aviso, y hay que declarar o marcar «no contiene»`, `solo hay términos sin reconocer: se listan, sin aviso de sugeridos, y el selector sigue vacío` · F13: `los alérgenos sugeridos son el valor del selector: primero lo que contiene, después las trazas` y «AlergenosSelector: el origen es solo presentación» |

### CA07 — Asociar un ingrediente; si el insumo ya existe, indicarlo y permitir usarlo
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_un_codigo_ya_registrado_responde_409_con_el_id_existente`, `test_un_codigo_de_un_insumo_desactivado_responde_409_distinguiendo_el_caso`, `test_la_consulta_detecta_el_duplicado_al_leer_el_ean_13_de_un_upc_a_registrado` (y la inversa), `test_el_codigo_de_otro_productor_no_cuenta_como_duplicado`, `test_el_post_rechaza_el_codigo_en_la_otra_forma`, `test_el_patch_rechaza_cambiar_a_un_codigo_que_existe_en_la_otra_forma` · B8: `test_consultar_el_codigo_ya_registrado_responde_409_con_el_insumo_nuevo` |
| Frontend | F12 «Precarga del formulario»: `conserva el ingrediente que ya se había elegido, sin pedir confirmación`, `sin ingrediente no se puede registrar: lo exige y no envía nada (CA07)` · F12 «El código ya está registrado (409)»: `de un insumo activo: avisa y ofrece ver el insumo, sin precargar nada`, `de un insumo desactivado: ofrece ver el insumo y reactivarlo`, `«Reactivar» lo reactiva y abre su detalle`, `si no se puede reactivar, lo dice y deja las opciones` · F15: `activo y del mismo ingrediente: «Usar este insumo» lo asigna a la línea`, `activo pero de otro ingrediente: lo explica y no lo asigna`, `desactivado y del mismo ingrediente: «Reactivar» lo reactiva y lo asigna`, `desactivado y de otro ingrediente: no lo reactiva y lo explica` |

### CA08 — Precargar el formulario; nada se registra sin confirmación
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B3: `test_la_consulta_no_persiste_nada` (cuenta INSERT, UPDATE y DELETE de la petición y exige 0, en 200, 409, 422 y 503), `test_la_consulta_con_la_fuente_caida_no_persiste_nada`, `test_el_detector_de_escrituras_ve_un_insert_aunque_se_deshaga` · B8: `test_consultar_no_registra_nada` |
| Frontend | F12 «Precarga del formulario»: `completa nombre, marca, presentación, ingredientes declarados y código`, `cada búsqueda monta el formulario otra vez con los datos nuevos` · F12 «Formulario con cambios del productor»: `pide confirmación antes de reemplazarlos y no cambia nada mientras tanto`, `«Reemplazar datos» aplica el producto y conserva el ingrediente elegido`, `«Conservar lo escrito» deja el formulario como estaba y retira el mensaje de producto encontrado`, `alérgenos declarados por el productor también cuentan como cambios` · F12 «El insumo se registra solo al guardar»: `buscar, ver las sugerencias y editar no envía nada: ni el insumo ni sus alérgenos`, `al guardar envía el insumo con alérgenos, fuente, fecha de recuperación y ficha`, `lo que el productor cambia antes de guardar es lo que se envía` · F15: `encontrado: precarga el formulario, el ingrediente sigue fijo, y se registra solo al guardar`, `con datos escritos pide confirmación antes de reemplazarlos` · F13: `un producto encontrado carga sus datos, conserva el ingrediente y guarda de dónde vino` |

### CA09 — Componente aislado, con un adaptador por fuente
**Estado:** cubierto (automatizado, indirectamente: es un criterio de arquitectura).

| Capa | Pruebas |
|------|---------|
| Backend | B3, B6, B8 y B2 reemplazan el adaptador de Open Food Facts por una fuente falsa que cumple el `Protocol FuenteProducto` mediante la dependencia inyectable `get_fuente_producto`: el servicio y el endpoint funcionan sin conocer la fuente. B1 prueba el adaptador solo, con `httpx.MockTransport`. B5 (la detección) no depende de la base ni de la red: es una función pura. |
| Frontend | F4: el frontend nunca nombra ni consulta una fuente externa |

### CA10 — Producto no encontrado: informarlo y permitir el ingreso manual
**Estado:** cubierto (automatizado).

| Capa | Pruebas |
|------|---------|
| Backend | B1: `test_producto_no_encontrado_con_estado_cero`, `test_producto_no_encontrado_con_respuesta_404` · B2: `test_producto_no_encontrado_responde_404_y_el_adaptador_devuelve_none`, `test_el_endpoint_informa_no_encontrado_a_partir_de_una_respuesta_grabada` · B3: `test_producto_no_encontrado_responde_200_con_encontrado_falso` |
| Frontend | F12: `no encontrado: lo dice (CA10) y deja el formulario con el código escrito`, `no encontrado: conserva lo escrito y solo agrega el código, sin pedir confirmación`, `no encontrado: lo escrito sigue protegido al salir de la página` · F15: `no encontrado: conserva lo escrito, agrega el código y avisa` · F13: `no encontrado o sin fuente: conserva lo escrito, agrega el código y no lleva fuente, fecha ni ficha` |

### CA11 — Código, fuente y fecha de recuperación en la ficha del insumo
**Estado:** cubierto (automatizado); en dispositivo, no informado en la prueba de Android (PT13-13) y no probado en iOS.

| Capa | Pruebas |
|------|---------|
| Backend | B8: `test_el_insumo_recuperado_guarda_codigo_fuente_fecha_ficha_y_alergenos_revisados`, `test_la_respuesta_del_registro_tambien_trae_el_origen`, `test_fuente_externa_sin_fecha_responde_422_con_el_campo_y_no_guarda_nada`, `test_fuente_externa_con_la_fecha_nula_tambien_responde_422`, `test_un_insumo_manual_queda_con_fuente_manual_sin_fecha_ni_ficha`, `test_al_finalizar_la_copia_conserva_el_codigo_de_barras_del_insumo_recuperado`, `test_cambiar_el_insumo_recuperado_despues_no_altera_la_copia` · B9: reglas del `PATCH` (`test_patch_que_pone_una_fuente_externa_sin_fecha_responde_422_y_no_cambia_nada`, `test_patch_que_quita_la_fecha_de_un_insumo_recuperado_responde_422`, …) y de la ficha (`test_post_rechaza_una_ficha_con_direccion_que_no_es_http_ni_https`, `test_patch_rechaza_una_ficha_con_direccion_que_no_es_http_ni_https`) · B3: `test_el_codigo_se_guarda_tal_como_se_leyo` |
| Frontend | F14: `un insumo recuperado dice de dónde y cuándo se obtuvo, con la fecha como dd-mm-aaaa`, `la fecha se cuenta en la hora de Chile, no en UTC`, `enlaza a la ficha de la fuente, en otra pestaña y sin darle acceso a esta página`, `recuperado sin fecha (registros anteriores): no inventa una`, `un insumo manual dice «Registrado manualmente» y no ofrece ninguna ficha` · F12: `al guardar envía el insumo con alérgenos, fuente, fecha de recuperación y ficha` |

### CA12 — Funcionar en Chrome para Android y Safari para iOS
**Estado:** **parcialmente verificado.** Android: verificado a mano en Chrome (Redmi Note 13 5G, 20-10-2026). **iOS: pendiente** (sin dispositivo; tarea «Verificar HU13 en Safari iOS»). Lo que se pudo cubrir sin celular:

| Capa | Pruebas |
|------|---------|
| Frontend | F1: `usa el detector nativo cuando soporta los tres formatos` (Chrome para Android), `usa el polyfill cuando el navegador no tiene BarcodeDetector` (Safari para iOS), `usa el polyfill cuando el detector nativo falla al declarar sus formatos` · F2: el polyfill real se importa bajo Vitest · F5 y F6: el `.wasm` va dentro de la aplicación, sin CDN · F11: `dev:https` (HTTPS propio y proxy) para poder probar en el celular |

**Evidencia indirecta para iOS (no reemplaza la prueba de la aplicación completa):** en la HT04 el prototipo con ZBar-WASM escaneó en Safari para iOS, y el lector de HU13 usa ese mismo respaldo cuando no existe `BarcodeDetector`. Falta comprobar la aplicación completa en Safari: acceso a la cámara con el certificado propio, lectura, flujo y cierre de la cámara. Ver «Prueba en el celular».

### CA13 — La cámara se detiene al cerrar o al reconocer un código
**Estado:** cubierto (automatizado, con una cámara simulada que espía `track.stop`); en dispositivo, no informado en la prueba de Android (PT13-14) y no probado en iOS.

| Capa | Pruebas |
|------|---------|
| Frontend | F3 «La cámara siempre se libera (CA13)»: `al reconocer un código`, `al cerrar`, `al desmontar`, `al desmontar mientras el navegador todavía pide el permiso`, `al cerrar mientras se carga el detector, no llega a pedir la cámara`, `al reiniciar no deja una cámara abierta de la sesión anterior` · F3: `«Cerrar» detiene la cámara y avisa con onCerrar`, `Escape cierra el escáner y detiene la cámara` · F9: `cierra el panel, libera la cámara y busca el código una sola vez`, `cerrar el panel sin código libera la cámara y no busca nada` · F8: `al usar el campo se detiene la cámara`, `el escáner no deja pistas ni temporizadores en un contexto no seguro` |

---

## Trazabilidad PT13-01 … PT13-15

«Automatizado» se refiere a las pruebas de las tablas anteriores; «Celular» a `docs/hu13-prueba-celular.md` (Chrome para Android, 20 y 21-10-2026; **Safari para iOS no se probó**). Las celdas que no se informaron figuran como «No informado» o «No probado».

| Caso | Automatizado | Pruebas principales | Celular |
|---|---|---|---|
| PT13-01 EAN-13 en Chrome Android | Aprobado (con detector y cámara simulados) | F1, F3 `entrega el código reconocido una sola vez y deja la cámara detenida`, F9 | ✔ Android (Loncoleche, 20-10) |
| PT13-02 EAN-13 en Safari iOS | Aprobado (ruta del polyfill simulada) | F1 `usa el polyfill cuando el navegador no tiene BarcodeDetector`, F2, F9 | **No probado** (sin dispositivo iOS) |
| PT13-03 UPC-A | Aprobado | F3 `acepta un UPC-A de 12 dígitos y un EAN-8` · B2 `test_open_food_facts_ya_resuelve_el_upc_a_y_no_hace_falta_reintentar`, `test_si_no_encuentra_el_upc_a_reintenta_una_vez_con_el_ean_13_de_cero_inicial` · B3 `test_acepta_ean_13_upc_a_y_ean_8` | ✔ Android (atún como UPC-A, 21-10); iOS no probado |
| PT13-04 Denegar la cámara | Aprobado | F8 «Errores de la cámara (CA05)» | ✔ Android (20-10) |
| PT13-05 Ingreso manual | Aprobado | F8 `se envía con Enter` · F12 `el panel del escáner se cierra al entregar el código y la consulta se hace una sola vez` | ✔ Android (Triton ingresada a mano, 20-10) |
| PT13-06 Producto existente completa el formulario | Aprobado | B2 `test_galleta_con_ingredientes_y_alergenos_etiquetados`, `test_el_endpoint_propone_el_insumo_a_partir_de_una_respuesta_grabada` · F12 `completa nombre, marca, presentación, ingredientes declarados y código` | ✔ Android (Loncoleche, 20-10) |
| PT13-07 Alérgeno solo en el texto (leche sin lactosa) | Aprobado | B2 `test_leche_sin_lactosa_trae_leche_en_los_ingredientes_pero_no_en_las_etiquetas` · B6 `test_loncoleche_sin_lactosa_trae_leche_desde_el_texto_aunque_la_fuente_no_la_etiquete` · B5 · F12 `carga los alérgenos con su tipo y muestra de dónde viene cada uno` | ✔ Android (Loncoleche: Leche por texto, 20-10) |
| PT13-08 Alérgenos no reconocibles | Aprobado | B5 `test_una_etiqueta_sin_mapeo_va_a_asignacion_manual` · B6 `test_el_endpoint_envia_lo_no_reconocible_a_asignacion_manual` · F12 `lista lo que no pudo asociar para que el productor lo asigne a mano (CA06)` | ✔ Android, en parte: el producto sin ingredientes no deja guardar sin declarar (21-10) |
| PT13-09 Producto no encontrado | Aprobado | CA10 | ✔ Android (20-10) |
| PT13-10 Ya registrado | Aprobado | CA07 | ✔ Android (20-10) |
| PT13-11 Registro sin ingrediente | Aprobado | F12 `sin ingrediente no se puede registrar: lo exige y no envía nada (CA07)` | — |
| PT13-12 Cancelar después de buscar | Aprobado | F12 `cancelar después de buscar no registra nada (PT13-12)` · B3 `test_la_consulta_no_persiste_nada` · B8 `test_consultar_no_registra_nada` | — |
| PT13-13 Confirmar el registro | Aprobado | CA11 | ✔ Android (detalle «Obtenido de Open Food Facts», 20-10; código en el detalle de la elaboración, 21-10) |
| PT13-14 La cámara se detiene | Aprobado (cámara simulada) | CA13 | ✔ Android al cerrar (20-10) |
| PT13-15 Fuente sin conexión o no disponible | Aprobado | B3 `test_si_la_fuente_falla_responde_503_con_el_motivo`, `test_un_timeout_real_del_adaptador_responde_503_y_no_200`, `test_las_fallas_http_del_adaptador_responden_503` · B1 · F12 `fuente no disponible (503): lo dice y deja el formulario con el código escrito`, `sin conexión con el servidor: se trata como fuente no disponible` · F15 `fuente no disponible: avisa y deja el código escrito` | **No probado** en dispositivo |

---

## Prueba en el celular

La guía y las tablas están en `docs/hu13-prueba-celular.md`; la prueba la hizo la desarrolladora con `npm run dev:https` (T13-07).

**Android: probado.** Redmi Note 13 5G, Chrome (versión del navegador y de Android no indicadas), 20-10-2026 y 21-10-2026, por IP local (`https://192.168.1.28:5175`). Quién probó y el commit probado no están indicados en las tablas.

**Verificado en Chrome (todo ✔):**

- **20-10-2026:** permiso denegado (mensaje, sin reintento, campo manual); cámara trasera; Loncoleche (`7802910000971`) escaneada con precarga y Leche sugerida por el texto; detalle con «Obtenido de Open Food Facts»; duplicado; producto no encontrado con el código escrito; ingreso manual de la Triton (`8445291716841`); la cámara se apaga al cerrar; linterna (con el botón ajustado); escáner dentro del diálogo de la elaboración.
- **21-10-2026:**
  - T13-09: crear el ingrediente desde el registro de insumo, con los datos intactos.
  - Aceite de girasol (`7790272001005`): soya «Contiene» y maní «Trazas», según la etiqueta.
  - Producto sin ingredientes (azúcar rubia `7801505231950` o polvos de hornear `7802410002239`; no se indicó cuál): sin sugerencias y no deja guardar sin declarar alérgenos o marcar «no contiene».
  - Azúcar flor (`7801505231974`): sin alérgenos falsos. Hallazgo: el texto de ingredientes traía el fabricante y su dirección, lo que originó la T13-10.
  - Confirmación «Reemplazar datos» / «Conservar lo escrito» al escanear con el formulario modificado.
  - Finalizar una elaboración con un insumo escaneado: el detalle de la elaboración muestra el código de barras del insumo.
  - Formatos (CA02), escaneados desde la pantalla del computador: UPC-A `400001143070` (atún, encontrado) y EAN-8 `96385074` (leído, no encontrado).

**No probado en dispositivo:**

- Sin conexión o fuente no disponible (PT13-15): cubierto por pruebas automatizadas.
- El resto de los códigos de la tabla 9.2 (leche entera `7808709504767`, bicarbonato `8413700064197`, el producto sin nombre `7803600002053`, el código inexistente `7801505000358`, y de los de datos incompletos el que no se probó): **cubiertos por pruebas automatizadas con respuestas grabadas**, no por la prueba en el celular.
- Girar el celular y la poca luz: no se informaron.
- «Al reconocer un código se apaga la cámara» no se informó por separado (sí al cerrar).

**iOS (Safari): NO PROBADO por falta de dispositivo.** Todas sus celdas están como «—».

- La linterna en iOS: **esperado según la plataforma, no verificado.** El botón aparece solo si la pista de video declara `torch`, y se espera que Safari no la exponga.
- **CA12 queda parcialmente verificado:** Android a mano; iOS pendiente. Evidencia indirecta: en la HT04 el prototipo con ZBar-WASM escaneó en Safari para iOS, y el lector de HU13 usa el mismo respaldo cuando no existe `BarcodeDetector`. Esto **no reemplaza** la prueba de la aplicación completa en iOS. Sigue abierto, además, si Safari da la cámara en una página con certificado propio (alternativa documentada: túnel con cloudflared).
- **Tarea pendiente: «Verificar HU13 en Safari iOS».**

| Navegador | Lee códigos | Encuentra productos | Alérgenos | Linterna | Cámara se detiene |
|---|---|---|---|---|---|
| Chrome para Android | ✔ (EAN-13, UPC-A y EAN-8) | ✔ | ✔ | ✔ | ✔ al cerrar |
| Safari para iOS | No probado | No probado | No probado | Esperado según la plataforma, no verificado | No probado |

**Problemas encontrados en la prueba (tabla 9.4):**

1. Al registrar un insumo cuyo ingrediente no existe había que salir de la página y se perdían los datos, incluidos los recuperados por el código. Gravedad media. **Originó la T13-09**, corregida y verificada en el celular el 21-10.
2. El texto de ingredientes del azúcar flor traía el fabricante y su dirección. Gravedad baja. **Originó la T13-10** (limpieza en el backend); automatizada, aún no repetida en el celular.

---

## Recorridos: por código de barras frente a manual

`frontend/src/recorridos/hu13.recorridos.test.tsx` (F16) mide el alta de un insumo con el mismo contador de interacciones de HT06 (clics y campos).

| Camino | Interacciones |
|---|---|
| A mano, solo lo obligatorio | 5 (3 campos y 2 clics) |
| A mano, con la misma información que trae el código | **14** (9 campos y 5 clics) |
| **Por código de barras** (con toda esa información) | **5** (2 campos y 3 clics) |
| Por código, con el ingrediente elegido antes | 5 (las mismas) |
| **Por código, cuyo ingrediente no existe** (T13-09: se crea desde el formulario) | **8** (3 campos y 5 clics) |

**Producto escaneado cuyo ingrediente no existe (T13-09):** escanear (1 clic), escribir el número (1 campo), «Buscar» (1 clic), «Crear ingrediente» (1 clic), código interno y nombre del ingrediente (2 campos), «Crear ingrediente» del diálogo (1 clic) y «Guardar insumo» (1 clic) = **8 interacciones, sin salir de la página y con los datos recuperados intactos** (la prueba lo afirma). Antes de T13-09 no había camino que no perdiera los datos: había que salir, crear el ingrediente y volver a escanear.

Escanear ahorra 9 interacciones frente a escribir la misma información, y el camino a mano no tiene ningún paso más por existir el bloque (`el escáner es opcional`). Las 5 incluyen el ingrediente y declarar los alérgenos.

**Los escenarios B y B′ de HT06 no cambiaron:** `src/recorridos/ht06.recorridos.test.tsx` pasa sin modificarse y sigue afirmando **6** interacciones para B y **7** para B′ (el escenario A sigue en 38 clics y 30 campos). HU13 no alarga la segunda elaboración.

---

## Cobertura de la fuente (medida en HT04)

En la validación técnica de la HT04, con 16 insumos reales: **69 % se encontró** en Open Food Facts, **56 % trajo ingredientes** y **12 % trajo alérgenos etiquetados**. Esto justifica dos decisiones: detectar alérgenos también **desde el texto de ingredientes** (si solo se usaran las etiquetas, 88 % de los productos quedaría sin sugerencia), y que el **ingreso manual sea siempre posible**, para el 31 % que no se encuentra y para los encontrados con datos incompletos (azúcar rubia, polvos de hornear y el producto sin nombre, en las fixtures).

---

## Mutaciones verificadas durante HU13

En cada tarea se rompió a propósito una regla a la vez, copiando antes el archivo original y restaurándolo desde esa copia, para comprobar que alguna prueba falla. Se confirmó con `git diff` que solo quedaron los cambios de la tarea.

| Tarea | Qué se rompió | Detectadas |
|-------|---------------|-----------|
| T13-01 — Lector | No detener las pistas al reconocer, aceptar un código inválido, quitar el filtro de repetidos, quitar el alias de `vite.config.ts`, quitar el alias de `vitest.config.ts`, cambiar la versión de la URL del alias, no invalidar el ciclo al cerrar | 7 de 7 |
| T13-02 — Ingreso manual y permisos | Permiso denegado que ofrece reintentar, entrada manual que acepta un dígito verificador inválido, campo manual oculto con la cámara activa, contexto no seguro que igual abre la cámara, foco que no pasa al campo, entrada manual que no detiene la cámara, guiones sin quitar, cámara ocupada sin reintento | 8 de 8 |
| T13-03 — Recuperación | Quitar la guarda de red, no detectar el duplicado en la otra forma, convertir un timeout en 200, persistir con `commit` en la consulta, escribir con `flush` y sin `commit`, quitar el reintento del UPC-A | 6 de 6 (la de `flush` solo se detectó tras agregar el contador de escrituras) |
| T13-04 — Alérgenos | «Trazas» gana sobre «contiene», ignorar la negación «sin», «leche sin lactosa» sin sumar lácteos, perder las etiquetas sin mapeo, no normalizar tildes | 5 de 5 (más una variante equivalente de «leche sin lactosa», que no falla porque «lactosa» suma lácteos por su cuenta) |
| T13-05 — Precarga e integración | Enviar alérgenos al montar, no volver a montar el formulario (página y diálogo), perder el ingrediente, reemplazar sin confirmar, usar un insumo de otro ingrediente, ocultar `sin_reconocer`, ocultar el origen, el panel no se cierra al entregar, aceptar otro código mientras busca, abrir el escáner mientras busca | 11 de 11 (las dos últimas solo tras agregar una prueba directa del hook) |
| T13-06 — Código, fuente y fecha | Backend: fuente externa sin fecha, no guardar la ficha, no guardar la fecha, guardar todo como manual, 422 sin el campo, exigir fecha también a los manuales. Frontend: mostrar «manual» para un recuperado, sin `rel`, sin `target`, aceptar cualquier URL, sin fecha, nombre fuera del mapa, 409 sin insumo como fuente caída | 13 de 13 (6 + 7) |
| T13-07 — Reglas de `PATCH` y ficha | Nueve mutaciones de las reglas de fuente sin fecha y de la dirección de la ficha | 9 de 9 (la de «aceptar `javascript` como esquema» solo tras agregar `javascript://dominio/%0A…`, `data://…` y `file://…`) |
| T13-07 — `dev:https` | Diez mutaciones de la activación, el build idéntico, el proxy y los scripts | 10 de 10 |
| T13-07 — Linterna | La etiqueta no cambia al alternar, el ícono no cambia, el área táctil baja de 44 px | 3 de 3 |
| T13-09 — Crear ingrediente desde el insumo | Se pierde la precarga al crear el ingrediente (3 pruebas fallan), no se selecciona el ingrediente creado (4), el botón aparece con el ingrediente fijo (1) | 3 de 3 |
| T13-10 — Limpieza del texto de ingredientes | Detectar sobre el texto limpio (2 pruebas fallan), cortar también «elaborado en una línea que procesa…» (1; solo se detectó tras agregar un caso en que el texto sigue después del aviso), perder el aviso de alérgenos posterior al corte (5) | 3 de 3 |
| T13-08 — `hu01.products` | No se hicieron mutaciones: el cambio es un helper de pruebas y se midió con carga (ver más abajo) | — |
| **Total de la historia** | | **78 de 78** |

Mutantes equivalentes (no cuentan): «leche sin lactosa» que solo omite la leche, y `flush` sin `commit` antes de reforzar la prueba.

---

## Pruebas existentes que cambiaron de comportamiento

Ninguna se borró ni se relajó.

| Prueba | Cambio y por qué |
|---|---|
| `test_la_respuesta_incluye_la_estructura_completa_de_alergenos_vacia` (T13-03) | Asumía una detección vacía para cualquier producto; con T13-04 «Leche descremada…» sugiere lácteos. Pasó a usar «Agua, sal» y mantiene la misma garantía. |
| 3 pruebas de `hu04.insumos.test.tsx` (T13-06) | Verificaban la sección «Estado y fuente», que se dividió en «Estado» y «Origen de la información». |
| 3 pruebas de `hu13.escaner.test.tsx` (T13-02) | Se declara contexto seguro en el arranque (jsdom no lo declara); «sin API de cámara» espera el error de contexto inseguro; «si la cámara falla» espera el mensaje de permiso denegado. |
| Prueba del hook (T13-06) | `un 409 que no trae el insumo existente es un error de la búsqueda, no una fuente caída` (antes lo trataba como fuente caída). |
| `hu04.insumos.test.tsx`, «sin ingredientes activos ofrece crear uno» (T13-09) | Esperaba el enlace «Crear un ingrediente» a `/ingredientes/nuevo`; ahora es el botón «Crear ingrediente», que abre el diálogo sin salir de la página. Sigue comprobando el texto «Aún no tienes ingredientes activos.» |
| `hu01.products.test.tsx` (T13-08) | El helper `fillValidProductForm` pega los textos largos en vez de teclearlos (ver la prueba intermitente). Mismas aserciones. |

---

## La prueba intermitente de `hu01.products` (T13-08)

**Pruebas:** las de «Nuevo producto» de `frontend/src/products/hu01.products.test.tsx` (por ejemplo «carga categorías disponibles y permite seleccionar varias al crear»). Habían fallado una vez en una corrida normal (T13-05) y, con 16 procesos de carga, en todas las corridas (HT06-08).

**Cómo se reprodujo.** Con 4 procesos de carga (bucles de CPU) y la suite completa del frontend, 3 corridas seguidas con reporte JSON: **1 de 3 falló**, con 3 pruebas del archivo («permite reintentar o continuar si falla la subida de imagen tras crear» y dos de «HT06-07»), y las otras dos corridas dejaron pruebas en **14,5 s y 14,7 s** de un límite de **15 s**. El máximo fue 15,5 s.

**Causa.** No es una carrera ni un defecto de la aplicación. Es un problema de costo de la prueba: cada prueba de creación escribe unos 90 caracteres con `userEvent.type` (código, nombre, descripción, presentación). Medido con un perfilador: **26 ms por tecla** (un commit de React por tecla, unos 10 ms de render, el resto es la simulación de eventos de `user-event` y jsdom); sin carga, cada prueba tarda 2,1 a 2,5 s, unas 6,5 veces menos que el límite de 15 s. Con la CPU compartida con otros procesos ese margen se agota. Pegar el mismo texto cuesta unas 7 veces menos (142 ms frente a 1 030 ms para 39 caracteres).

**Corrección.** En `fillValidProductForm` los tres textos largos (nombre, descripción y presentación) se **pegan** con `user.click` + `user.paste` en lugar de teclearse. El valor final, los eventos de cambio que ve el formulario y todas las aserciones son los mismos; el código y el contenido neto siguen tecleándose y el límite de 15 s no se tocó. Es un cambio de un helper de pruebas, no de la aplicación.

**Resultado con el mismo método (4 procesos de carga, suite completa de 898 pruebas):**

| Tanda | Corridas | Con fallos | Máximo de una prueba de `hu01.products` |
|---|---|---|---|
| Antes de la corrección | 3 | 1 (3 pruebas de ese archivo) | 15,5 s |
| Después, con exactamente 4 procesos | 3 | **0** | **5,0 s** |

Dos tandas más que no se cuentan como demostración: una tuvo 1 fallo en un pico de la máquina mientras se procesaban en paralelo archivos grandes (hasta 13,9 s, y fallos también en `hu02.ingredients` y `hu13.recorridos`), y otra corrió con **8** procesos de carga en lugar de 4 (el script anterior no detenía los de la tanda previa; ya los detiene al terminar): hubo 1 a 4 fallos por corrida, de pruebas con la espera de 4 s de `findBy` (`ht06.alergenos`, `hu13.recorridos`, `hu13.busqueda`, `hu01.products`, `hu02.ingredients`). Esa es la misma fragilidad ya documentada en HT06: con la CPU saturada más de lo que lo estaría un runner, algunas esperas de 4 s no alcanzan. No se tocaron.

**Procesos de carga:** al terminar se detuvieron todos y se confirmó que no queda ninguno (ni de carga ni de Vitest).

---

## Dependencias y licencias

| Paquete | Versión | Licencia | Para qué |
|---|---|---|---|
| `@undecaf/barcode-detector-polyfill` | **0.9.23** (fijada con `--save-exact`, sin `^`) | MIT | Lector de EAN-13, EAN-8 y UPC-A en los navegadores sin `BarcodeDetector` nativo (Safari para iOS) |
| `@undecaf/zbar-wasm` | **0.9.16** (la trae el polyfill) | **LGPL-2.1+** | Decodificador ZBar compilado a WebAssembly (`zbar.wasm`) |
| `jschardet` | 3.1.4 (la declara `zbar-wasm`) | **LGPL-2.1+** | Se instala, pero su código no llega al build del navegador |
| `@vitejs/plugin-basic-ssl` | 2.3.0 (devDependency, versión exacta) | MIT | Certificado propio solo para `npm run dev:https` |

**Licencias de terceros: ver [`licencias-terceros.md`](licencias-terceros.md)** (qué se carga, cómo se separa del código de la aplicación y los enlaces al código fuente). Resumen: el código de `zbar-wasm` y de `jschardet` no se modifica; en el build `zbar-wasm` va en un chunk propio, descargado bajo demanda con `import()` diferido (solo si el navegador no tiene el detector nativo y el productor abre el escáner), y `zbar.wasm` es un archivo aparte (`assets/zbar-<hash>.wasm`). El README del polyfill indica que empaquetar `zbar-wasm` en un proyecto no incumple los requisitos de la LGPL. Código fuente: https://github.com/undecaf/zbar-wasm. Esto es una nota técnica, no una asesoría legal. **Decisión sobre un aviso visible en la aplicación:** sigue abierta (ver «Deuda técnica y riesgos»).

### El `.wasm` se sirve desde la propia aplicación (alias de Vite)

El polyfill **no permite indicar la ubicación del decodificador**: su entrada `dist/main.js` importa `@undecaf/zbar-wasm` desde una URL fija de una CDN pública, y `zbar-wasm` busca `zbar.wasm` junto a su propio módulo. Sin intervenir, el navegador descargaría el decodificador y el `.wasm` desde esa CDN en cada uso.

**Decisión (T13-01):** un `resolve.alias` de Vite que reemplaza esa URL por el paquete instalado desde npm (`vite.alias-zbar.ts`, usado por `vite.config.ts` y `vitest.config.ts`). Vite empaqueta `zbar-wasm` y, como este localiza su binario con `new URL("zbar.wasm", import.meta.url)`, emite `zbar.wasm` como asset de la aplicación y lo sirve del mismo origen. Para Vitest además se indica `server.deps.inline` del polyfill, porque Vitest carga los paquetes de `node_modules` con Node directamente y el alias no les aplicaría.

**Si el polyfill cambia de versión,** la URL puede cambiar y el alias dejaría de coincidir sin avisar. Por eso la versión está fijada y hay pruebas que fallan en ese caso (en `src/escaner/`):

- `hu13.sin-cdn.test.ts`: la URL que reemplaza el alias es exactamente la que importa el polyfill instalado; el polyfill no importa código de ninguna otra URL externa; la versión está fijada sin `^` ni `~`; ningún archivo de `src/` nombra una CDN ni Open Food Facts (el frontend nunca consulta Open Food Facts: lo hace el backend).
- `hu13.build.test.ts`: construye el módulo del lector con la configuración real de Vite y comprueba que el `zbar-*.wasm` está en la salida, que ningún archivo generado nombra una CDN, que ninguno importa desde una URL externa y que el decodificador va en un chunk aparte del que carga primero.
- `hu13.polyfill-real.test.ts`: el polyfill real se importa bajo Vitest, sin pedidos a la red.

### Verificación en desarrollo (`vite`)

Con un servidor de desarrollo con la configuración real del proyecto, se cargó la aplicación en un navegador, se forzó la ruta del polyfill (sin `BarcodeDetector` nativo) y se dibujó un EAN-13 válido (`7802910000971`) en un canvas para que el detector lo leyera:

- el polyfill lo leyó: `rawValue 7802910000971`, formato `ean_13`;
- el `.wasm` se pidió **al propio servidor**: `/node_modules/@undecaf/zbar-wasm/dist/zbar.wasm` → 200;
- **0 pedidos a jsDelivr ni a otra CDN**; el único pedido externo de la página es Google Fonts, previo a HU13.

Esta verificación no reemplaza la prueba con una cámara real en Chrome para Android y Safari para iOS.

### Verificación del `dist/` real (T13-05 y T13-08)

Con el escáner en «Nuevo insumo» y en el diálogo de la elaboración, `npm run build` incluye el lector. Se comprobó sobre la salida real y queda cubierto por `src/escaner/hu13.dist.test.ts`, que hace el mismo build en una carpeta temporal. En el build de T13-08:

- `dist/assets/zbar-<hash>.wasm` está en la aplicación (239 kB), y ningún archivo publicado nombra una CDN ni importa código desde una URL.
- El decodificador va en un archivo aparte (`main-<hash>.js`, 19,7 kB), cargado con `import()` solo al abrir el escáner. El código que carga primero (503 kB) no lo incluye y `index.html` no lo precarga.
- Lo único externo que pide la hoja de estilos es la tipografía de Google Fonts, que la aplicación ya cargaba antes de HU13.
- Vite emite además `index-<hash>.js` (17 kB), la versión de `zbar-wasm` para etiquetas `<script>`. Nada la importa y no se descarga.
- Vite avisa que el chunk principal supera 500 kB: pasó de 483 a 503 kB por el código del escáner (sin el decodificador).

---

## Registro del código, la fuente y la fecha de recuperación (T13-06, CA11)

- **Regla (backend):** `POST /gestion/insumos` con una `fuente` distinta de `manual` y sin `fecha_recuperacion` responde **422** con `{"mensaje", "campo": "fecha_recuperacion"}` y no guarda nada. Un insumo manual no exige fecha. Ninguna prueba de HU04 cambió: todas las que enviaban una fuente externa ya traían la fecha. `PATCH` aplica la misma regla (ver más abajo).
- **De punta a punta** (B8, SQLite y PostgreSQL, leyendo desde una sesión independiente): consulta con una respuesta grabada → registro con los datos de la propuesta → el insumo guarda `codigo_barras`, `fuente = open_food_facts`, `fecha_recuperacion`, la ficha con la URL de la fuente y los alérgenos con su tipo, ya revisados. Los registros manuales siguen con fuente `manual` y sin fecha ni ficha.
- **Información conservada:** al finalizar una elaboración, la copia de un insumo recuperado conserva su `codigo_barras` (y no la ficha, la fuente ni la fecha). Cambiar o desactivar el insumo después no la altera.
- **Detalle del insumo (frontend):** bloque «Origen de la información»: «Registrado manualmente» o «Obtenido de Open Food Facts el dd-mm-aaaa» (fecha en la hora de Chile) con el enlace a la ficha de la fuente, que se abre en otra pestaña con `rel="noopener noreferrer"`. Solo se enlazan direcciones http(s) (un `javascript:` no se convierte en enlace). El nombre visible de cada fuente sale de `src/lib/fuentesInsumo.ts`, el único archivo del código que lo escribe; una prueba estática lo exige.

### La fuente y la ficha también al editar (cierre de T13-06)

Dos reglas, iguales en `POST` y en `PATCH /gestion/insumos/{id}`; ambas responden **422** con `{"mensaje", "campo"}` y no guardan nada:

- **Fuente externa sin fecha** (`campo: "fecha_recuperacion"`). En el `PATCH` se juzga el **resultado final**: la fuente que quedaría y la fecha que quedaría (la que trae el pedido, o la que ya estaba guardada). Poner la fuente a un insumo que ya tenía fecha se acepta; quitar la fecha a un insumo recuperado, no; volver a `manual` sin fecha, sí. **Decisión:** la regla se revisa cuando el pedido toca `fuente` o `fecha_recuperacion`. Un registro anterior a la regla (fuente externa sin fecha, algo que antes el alta permitía) se puede seguir editando en otros campos; si se le toca la fuente, hay que darle la fecha.
- **Dirección de la ficha** (`campo: "ficha"`). Si la ficha trae `url`, debe ser una dirección absoluta http o https, con dominio y sin espacios ni caracteres de control. Se rechazan `javascript:` (también `javascript://dominio/%0A...`), `data:`, `file:`, `ftp:`, direcciones relativas, vacías o que no son texto. Vale para cualquier fuente, también `manual`. Una ficha sin `url` no se toca.

Pruebas: B9 (59), SQLite y PostgreSQL. Ninguna prueba existente cambió.

---

## Preparación de la prueba en celular (T13-07)

La prueba con cámara real la hace la desarrolladora; la guía está en `docs/hu13-prueba-celular.md`. Lo preparado:

- **`npm run dev:https`:** sirve la aplicación por HTTPS con un certificado propio (`@vitejs/plugin-basic-ssl` 2.3.0, devDependency con versión exacta), expuesta en la red local (`0.0.0.0`), y reenvía `/api/...` al backend local (`http://localhost:8000`, o `VITE_DEV_API_TARGET`) quitando el prefijo. El celular habla con un solo origen HTTPS: sin contenido mixto ni CORS.
- **Solo se activa con `VITE_DEV_HTTPS=1`**, que fija el script `scripts/dev-https.mjs` (junto con `VITE_API_URL=/api`). La aplicación arma las direcciones como `${VITE_API_URL}${ruta}`, así que una base relativa funciona sin cambiar código. Sin la variable, `npm run dev` y `npm run build` quedan como antes: el build produce **exactamente los mismos archivos** (mismos nombres con hash) con y sin la variable, y el plugin del certificado ni siquiera se carga.
- **Pruebas** (F11): cuándo se activa; la configuración de Vite en cada modo; el build idéntico; un servidor `dev:https` real contra un backend falso (HTTPS, reenvío de `/api`, método, token y ruta sin prefijo; `/api-docs` no se reenvía); la API relativa en la aplicación; los scripts de `package.json`.
- **Detalle de Vite 8:** en HTTPS no valida la cabecera `Host`, así que un túnel de cloudflared funciona sin configuración extra.
- **Linterna:** botón sobre el video, centrado bajo el recuadro guía, con ícono de la librería del proyecto, área táctil de 44 px, `aria-pressed` y etiqueta «Encender linterna» / «Apagar linterna»; aparece solo si la pista declara `torch`.

---

## Decisiones de diseño

### Las 14 del análisis

| # | Decisión |
|---|---|
| 1 | Ruta: `GET /gestion/insumos/consulta-codigo/{codigo}`. |
| 2 | Producto no encontrado: 200 con `encontrado = false`. |
| 3 | El código se guarda tal como se leyó. Los duplicados se buscan en ambas formas (UPC-A de 12 dígitos y EAN-13 con cero inicial) en la consulta **y** en el `POST` (y el `PATCH`), con un helper compartido en `codigo_barras.py`. |
| 4 | Precarga volviendo a montar el formulario con `key`. |
| 5 | Sin casilla extra. Aviso «Alérgenos sugeridos automáticamente. Compáralos con la etiqueta del envase antes de registrar.» y cada sugerencia muestra su origen (etiqueta o texto). |
| 6 | Ante la duda, sugerir o enviar a `sin_reconocer`. |
| 7 | El `.wasm` se sirve desde la aplicación. |
| 8 | Sin caché de consultas. |
| 9 | Grabación de respuestas autorizada: máximo 11 pedidos (se hicieron 12 con el reintento del UPC-A), pausa de al menos 1 s y User-Agent identificable. |
| 10 | HTTPS de desarrollo con `@vitejs/plugin-basic-ssl`; si iOS no da la cámara, se ve en T13-07. |
| 11 | `POST` con fuente distinta de `manual` y sin fecha → 422. |
| 12 | Ficha: el subconjunto propuesto más la URL del producto en la fuente. |
| 13 | Con varias marcas, la primera. |
| 14 | Dependencias aprobadas. |

### Las que se ajustaron en el camino

| Ajuste | Qué pasó y qué se decidió |
|---|---|
| **Alias de Vite para el `.wasm`** (T13-01) | El polyfill no permite indicar la ubicación del `.wasm` (importa de una CDN fija). Se eligió un `resolve.alias` en `vite.config.ts` y `vitest.config.ts`, con la versión fijada y pruebas que fallan si la URL cambia. |
| **Regla del `PATCH`** (T13-07) | La regla de fuente sin fecha se juzga sobre el resultado final y solo cuando el pedido toca `fuente` o `fecha_recuperacion`, para no bloquear la edición de registros anteriores a la regla. |
| **URL de la ficha** (T13-07) | La ficha la envía el cliente, así que solo se aceptan direcciones http y https en `POST` y `PATCH` (422 con `campo: "ficha"`), y el detalle tampoco enlaza otros esquemas. |
| **Mensaje del 409 sin `insumo_id`** (T13-06) | Un 409 que no dice qué insumo es ya no se muestra como «fuente no disponible»: tiene el estado propio `error` con «No pudimos completar la búsqueda. Intenta de nuevo o completa los datos manualmente.», sin tocar el formulario. |
| **Cierre del panel al entregar el código** (T13-05) | El panel del escáner se cierra y se desmonta al entregar el código (cámara o manual). Consecuencia: el filtro de «mismo código en 4 s» solo actúa dentro de una misma apertura del panel; escanear el mismo envase otra vez vuelve a consultar. |
| **Botón de linterna sobre el video** (T13-07) | Salió de la fila de botones del panel y quedó sobre el video, centrado bajo el recuadro guía, con ícono, estado accesible y área táctil de 44 px, tras la prueba en el celular. |
| **Crear ingrediente sin salir** (T13-09) | El botón «Crear ingrediente» (en «Nuevo insumo» y en la edición) abre el `IngredientCreateDialog` de HU03 y reemplaza al enlace a `/ingredientes/nuevo`. El diálogo se monta **fuera** del `<form>` del insumo (el formulario del ingrediente es otro y uno anidado enviaría el del insumo). El estado del formulario vive en el hook de la página y no se vuelve a montar, así que lo escrito, lo precargado, los alérgenos y la fuente, la fecha y la ficha quedan intactos; el ingrediente creado se agrega a la lista y queda elegido. En el diálogo de la elaboración el ingrediente es fijo y no hay botón. El foco vuelve al selector. **El nombre escrito no se precarga en el diálogo:** el selector es un `<select>` nativo, sin buscador, y el diálogo no admite valores iniciales (no se forzó). |
| **Limpiar el texto de ingredientes** (T13-10) | Solo cambia lo que se **propone** al productor; la detección de alérgenos y la `ficha` usan el original (así un alérgeno mencionado solo después del corte, por ejemplo en el nombre de la empresa, se sigue detectando: es la limitación 1 del detector). Si el texto empieza con una frase de fabricante y no queda nada de ingredientes, se devuelve el original. Los datos de contacto se detectan por palabras (fono, teléfono, correo, sitio web, `www.`, direcciones de correo y de internet), no por números sueltos. |
| Otras | Un 422 de campo lleva `campo`; User-Agent solo en ASCII (`httpx` lo exige); el reintento del UPC-A usa un pedido extra solo ante «no encontrado»; «sin lactosa» nunca se niega; la negación solo se encadena con «ni»; «hay cambios» no cuenta el ingrediente; `fecha_recuperacion` se devuelve también cuando no se encuentra el producto (hora de la consulta). |

---

## Limitaciones conocidas del detector de alérgenos

El detector (`backend/app/services/recuperacion/alergenos.py`, tablas en `backend/app/core/alergenos_palabras.py`) **sugiere**; el productor siempre confirma al guardar. En la duda favorece la detección: sugiere o envía a `sin_reconocer`. Sus límites conocidos:

1. **Nombres de empresa.** Un nombre como «Lácteos del Sur» dentro del texto sugiere lácteos, porque la palabra coincide. Es un falso positivo aceptado a cambio de no perder alérgenos.
2. **«Almidón» a secas** no se marca como ambiguo (podría ser de trigo). «Almidón de maíz» está especificado y no es gluten.
3. **«Sin lactosa» nunca se niega.** «Leche sin lactosa» (y «sin lactosa» solo, o «sin gluten ni lactosa») sugiere lácteos: un producto sin lactosa sigue teniendo proteínas de leche.
4. **La negación solo se encadena con «ni».** «Sin huevo ni leche» niega ambos; «libre de gluten y lactosa» solo niega el gluten. Así «sin azúcar y trigo» no oculta el trigo.
5. **Los textos de `sin_reconocer` salen en minúsculas y sin tildes** («leche de almendras», «mantequilla de cacao»), porque se extraen del texto ya normalizado.
6. **Sin variantes `es:` de las etiquetas de Open Food Facts**, porque ninguna apareció en las fixtures grabadas. Una etiqueta como `es:leche` va a asignación manual.
7. **Dudas que se descartan solas:** «leche de coco» desaparece de `sin_reconocer` si ya hay leche sugerida desde otra fuente; «harina» desaparece si ya hay gluten.
8. **Palabras ambiguas fuera de la lista** («almidón», «proteína», «aroma») no se tratan: solo se detecta lo que está en las tablas.
9. **La fuente cubre poco:** 69 % encontrados, 56 % con ingredientes y 12 % con alérgenos etiquetados (HT04). El ingreso manual es indispensable.

### Caso: aceite de girasol (código 7790272001005)

La etiqueta de Open Food Facts dice **«contiene soja»** (`allergens_tags: en:soybeans`) y el texto de ingredientes dice **«PUEDE CONTENER SOJA. PUEDE CONTENER CACAHUETE.»**. Son informaciones que se contradicen. La regla es que **«contiene» gana sobre «trazas», venga de donde venga**: la soja se sugiere como «contiene» (origen `etiqueta`) y el maní, que solo aparece como traza, como «trazas». El productor **lo revisa contra el envase** antes de registrar; la sugerencia nunca marca el insumo como revisado por sí sola. Pruebas: B6 `test_aceite_de_girasol_contiene_la_soja_etiquetada_y_el_mani_es_traza`, B5 `test_una_traza_de_la_etiqueta_pasa_a_contiene_si_el_texto_dice_contiene` y `test_un_contiene_de_la_etiqueta_no_baja_a_trazas_porque_el_texto_diga_puede_contener`.

---

## Hallazgo: el UPC-A (Open Food Facts ya lo resuelve)

Al grabar las respuestas (T13-03) se vio que Open Food Facts **ya resuelve el UPC-A de 12 dígitos por sí solo**: las respuestas de `400001143070` y `0400001143070` son idénticas (ambas devuelven el producto con código `0400001143070`). El reintento del adaptador (si no encuentra un código de 12 dígitos, pregunta una vez más con la forma EAN-13 de cero inicial) no se dispara con datos reales para este caso; se mantiene como protección y se prueba con fixtures combinadas (404 grabado para la primera forma, producto grabado para la segunda). El reintento solo ocurre ante «no encontrado», nunca ante errores. El producto se informa con el código tal como se leyó. Pruebas: B2 `test_open_food_facts_ya_resuelve_el_upc_a_y_no_hace_falta_reintentar`, `test_si_no_encuentra_el_upc_a_reintenta_una_vez_con_el_ean_13_de_cero_inicial`, `test_si_ninguna_forma_del_upc_a_existe_devuelve_none_tras_dos_pedidos`, `test_los_codigos_que_no_son_upc_a_no_se_reintentan`, `test_un_error_de_la_fuente_no_se_reintenta_con_otra_forma`.

---

## Deuda técnica y riesgos pendientes

1. **Safari para iOS sin probar** (CA12 parcialmente verificado). Tarea pendiente «Verificar HU13 en Safari iOS»: acceso a la cámara con el certificado propio (alternativa: túnel con cloudflared), lectura, flujo completo, cierre de la cámara y el comportamiento real de la linterna. En Android quedan sin probar PT13-15 (sin conexión), girar el celular y la poca luz.
   1. **Repetir en el celular el azúcar flor** (T13-10): la limpieza del texto solo está probada de forma automatizada. La del ingrediente inexistente (T13-09) sí se verificó el 21-10.
   2. **Limpieza del texto:** corta desde la primera frase de fabricante o contacto hasta el final, así que un texto que intercale esa frase en medio de los ingredientes pierde lo que sigue (salvo los avisos de alérgenos). El productor lo ve y lo corrige antes de guardar. Una dirección sin esas palabras (solo calle y comuna) no se detecta.
2. **Primer push con cambios compartidos.** T13-07 tocó `vite.config.ts` y agregó una devDependency; la primera comprobación fuera de esta máquina es GitHub Actions (Netlify instala devDependencies, y el plugin solo se carga con `VITE_DEV_HTTPS=1`).
3. **Carrera de duplicados entre formas.** El índice único de la base solo cubre la forma exacta del código. Dos peticiones simultáneas que registren un UPC-A y su EAN-13 equivalente no las frena la base; la verificación previa del servicio cubre el uso normal.
4. **Aviso de licencias de terceros sin decidir.** `docs/licencias-terceros.md` documenta la LGPL de `zbar-wasm` y `jschardet`, pero no hay un aviso visible en la aplicación. No es una asesoría legal.
5. **Fuente en vivo.** Open Food Facts es una base colaborativa: un producto puede cambiar de contenido o desaparecer. Las pruebas usan respuestas grabadas y no lo detectarían; la prueba en celular (que sí consulta la fuente real) puede mostrar diferencias.
6. **Límites de uso y disponibilidad de Open Food Facts.** Hay timeout y 503 con el motivo, pero no hay caché ni reintentos más allá del UPC-A (decisión 8).
7. **Detector de alérgenos:** limitaciones 1 a 9 de la sección anterior. Sigue siendo una sugerencia que el productor confirma.
8. **Fragilidad de las pruebas con la CPU saturada.** Las esperas de 4 s de `findBy` y los límites de 15 s fallan de forma intermitente con cargas mayores que las de un runner (8 procesos o más en esta máquina): documentado en HT06 y aquí. `hu01.products` quedó corregido para 4 procesos; los demás archivos no se tocaron.
9. **Chunk principal sobre 500 kB** (503 kB) en el build; Vite lo avisa y la aplicación no divide su propio código.
10. **Datos personales en las fixtures.** El texto de ingredientes del azúcar flor incluye la dirección comercial del fabricante (información de empresa); se dejó tal como llegó.
11. **Ficha anterior sin fecha.** Los registros previos a la regla con fuente externa y sin fecha siguen existiendo; el detalle no inventa una fecha.

---

## Observaciones

- La consulta no escribe nada: se verifica contando INSERT, UPDATE y DELETE durante la petición (casos 200, 409, 422 y 503) y comparando el conteo de filas desde una sesión independiente. Una sugerencia de alérgenos nunca marca la revisión: solo el guardado del formulario, con `alergenos` en el `POST`.
- Ninguna prueba consulta la red real: una fixture automática de `conftest` hace fallar cualquier petición HTTP real; el adaptador se prueba con `httpx.MockTransport` y las 12 respuestas grabadas en `backend/tests/fixtures/off/` (solo con los campos pedidos; pruebas automáticas fallan si aparecen correos, teléfonos o credenciales).
- No hay migración (revisión `017_alergenos_revisados_ht06`); las columnas `ficha`, `fuente` y `fecha_recuperacion` ya existían desde la HU04.
- El entorno local de desarrollo usa Python 3.13 y el contenedor 3.12; las suites de este documento corrieron en el contenedor.
