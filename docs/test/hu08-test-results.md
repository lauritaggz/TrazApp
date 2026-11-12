# HU08 — Resultados de pruebas (T08-05)

**Fecha:** 2026-11-12  
**Rama:** `feature/hu08-elaboraciones-relacionadas` (Pull Request en draft hacia `main`)  
**Historia:** HU08 — Identificación de elaboraciones relacionadas (Sprint 3, P1, 5 SP)  
**Criterios de referencia:** CA1 … CA10 y PT08-01 … PT08-10 (`docs/context/TrazApp_HU08_contexto_agente.md`, secciones 3 y 7)  
**Entorno:** backend con Python 3.12 (contenedor `trazapp-backend`) sobre SQLite y PostgreSQL 16; frontend con Vitest y Vite (contenedor `trazapp-frontend`). **Sin migración nueva** (la vigente sigue siendo `018_publicacion_producto_hu09`: los índices `ix_usos_insumo_insumo_id` e `ix_usos_insumo_lote_id` ya existían). Sin dependencias nuevas.  
**Integración continua:** enlace **PENDIENTE** (la desarrolladora lo agrega tras el push). Captura esperada: `docs/test/validacion_hu08/ci_verde_hu08.png` — *(espacio reservado; la captura aún no existe)*. **No hay todavía una ejecución del CI de HU08 que citar.**

**Convención de las fuentes de los números:** **(E)** última corrida local informada en el reporte de la tarea que se indica, dentro del contenedor; **(C)** corrida del CI. En T08-05 **no se corrió nada**: ningún número de este documento sale de una corrida de hoy ni del CI. Nada se da por pasado en el CI.

---

## a) Resumen

**Historia.** Como productor, quiero identificar en qué elaboraciones se utilizó un insumo o un lote determinado, para actuar rápidamente ante un problema informado por su fabricante. HU08 deja dos consultas de solo lectura, `GET /gestion/insumos/{insumo_id}/elaboraciones` y `GET /gestion/insumos/{insumo_id}/lotes/{lote_id}/elaboraciones`, la pantalla «Rastrear insumo» (`/elaboraciones/rastrear`, pestaña de Elaboraciones) y la sección «Uso reciente en elaboraciones» del detalle del insumo.

**Criterios cumplidos: 10 de 10**, todos con pruebas automatizadas (E). La comprobación manual de PT08-10 (CA1 y CA2 en pantalla) se hizo en un **computador, no en un celular**; la prueba en celular queda **PENDIENTE** (ver «PT08-10 y la prueba manual»).

| Estado | Criterios |
|---|---|
| Cumplidos, verificados con pruebas automatizadas (E) | CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10 |
| Además, comprobación manual informada en computador (PT08-10) | CA1, CA2 |

### Pruebas automáticas de HU08, por archivo

**Backend** (37 pruebas nuevas; todas corren en ambos motores):

| Archivo | Pruebas | SQLite | PostgreSQL | Fuente |
|---|---|---|---|---|
| `tests/test_elaboraciones_relacionadas_insumo_hu08.py` (T08-01) | 22 | 22 (E) | 22 (E) | reporte de T08-02, que lo re-corrió junto al archivo del lote |
| `tests/test_elaboraciones_relacionadas_lote_hu08.py` (T08-02) | 15 | 15 (E) | 15 (E) | reporte de T08-02 |
| **Corrida conjunta de los dos archivos** | 37 | 37 aprobadas (E) | 37 aprobadas (E) | reporte de T08-02 |

**Directamente afectadas en backend, corridas en T08-01 (E):** `test_historial_elaboraciones_hu06.py` 41 (SQLite) y 41 (PostgreSQL); `test_gestion_elaboraciones_hu05.py` 59 y 59; `test_ocultar_elaboracion_hu09.py` 21 y 21. Todas aprobadas.

**Frontend** (42 pruebas nuevas en 2 archivos; fuente: reporte de T08-04, corrida local (E)):

| Archivo | Pruebas |
|---|---|
| `elaboraciones/hu08.rastrear.test.tsx` | 31 |
| `elaboraciones/hu08.detalle-insumo.test.tsx` | 11 |

`elaboraciones/hu08.datos.ts` solo tiene datos compartidos (no es un archivo de pruebas).

**Frontend, directamente afectadas, corridas en T08-04 junto a las nuevas (E):** 15 archivos, **478 pruebas aprobadas**: `ui/detalleRediseno` 4, `elaboraciones/hu06.listado` 13, `elaboraciones/hu06.historial` 34, `elaboraciones/hu06.fidelidad` 16, `elaboraciones/hu09.visibilidad` 16, `elaboraciones/hu05.elaboraciones` 167, `ui/ht07.bloque4` 11, `insumos/hu07.revision` 42, `insumos/hu13.ingrediente` 9, `insumos/hu04.insumos` 77, `dashboard/ht06.accesos` 25, `dashboard/hu02.dashboard` 17, `recorridos/ht06.recorridos` 5, más los dos archivos nuevos (31 + 11). Además, `npm run build` terminó bien y `tsc -b` no dio errores (T08-04, E).

**Pruebas existentes adaptadas:** una, `ui/detalleRediseno.test.tsx` (T08-04). Exigía que `InsumoDetail.tsx` contuviera `ComingSoonCard|próximamente`; ahora lo exige solo para producto e ingrediente y, para el insumo, comprueba lo contrario (la maqueta se reemplazó) y que usa `SeccionUsoInsumo`. No se relajó ninguna aserción ni se eliminó ninguna prueba. En backend no se adaptó ninguna.

**La regresión completa (SQLite, PostgreSQL y frontend) corre en el CI.**

---

## b) Trazabilidad PT08-01 … PT08-10

Evidencia = archivo y prueba (backend en `backend/tests/`, frontend en `frontend/src/`) o captura (en `docs/test/validacion_hu08/`, con su nombre real: `image1.png`, `image2.png`, `image3.png`; no se movieron ni renombraron). **«Manual» = hoja de resultados manuales de la desarrolladora.**

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| PT08-01 | Consultar por el insumo | Automatizada + captura | Devuelve las cuatro elaboraciones con producto, fecha y código | Backend (insumo): `test_pt08_01_consulta_por_insumo_devuelve_las_cuatro_con_producto_fecha_y_codigo`, `test_la_respuesta_solo_tiene_los_campos_acordados`. Frontend: `hu08.rastrear` «PT08-01: muestra las cuatro con producto, código y fecha, y el total». Capturas: `image2.png` (rastreo del insumo «Polvos de Hornear», 3 resultados), `image1.png` (sección del detalle) | Las cuatro, en el orden del historial (fecha desc, id desc: E4, E3, E2, E1), con producto, código y fecha; resumen con 4 elaboraciones y 2 productos | Aprobado |
| PT08-02 | Consultar por uno de los lotes | Automatizada + captura | Devuelve solo las elaboraciones de ese lote | Backend (lote): `test_pt08_02_por_lote_devuelve_solo_las_elaboraciones_de_ese_lote`, `test_el_encabezado_lleva_el_insumo_y_el_lote_y_el_resumen_no_trae_sin_lote`. Frontend: `hu08.rastrear` «PT08-02: lista solo lo que devuelve la consulta del lote…». Captura: `image3.png` (lote 3345, 3 resultados) | Lote L-42 → E4 y E1; lote L-43 → E3. Ni las del segundo lote ni la sin lote (E2) aparecen | Aprobado |
| PT08-03 | Revisar el estado en el resultado | Automatizada + captura | Distingue finalizadas y borrador | Backend: `test_pt08_03_distingue_finalizadas_y_borrador_con_el_origen_de_los_datos`. Frontend: `hu08.rastrear` «PT08-03: distingue «Finalizada» y «Borrador» con texto». Captura: `image3.png` («Borrador» y «Finalizada») | `estado` y `origen_datos` («conservada» / «vigente»); en pantalla, etiquetas de texto | Aprobado |
| PT08-04 | Después de finalizar, cambiar el insumo de un ingrediente en otro borrador y modificar la ficha del insumo | Automatizada + captura | Las finalizadas siguen identificadas por su información conservada | Backend: `test_pt08_04_las_finalizadas_siguen_identificadas_tras_cambiar_el_insumo_en_otro_borrador_y_la_ficha`, `test_rt03_el_codigo_del_lote_mostrado_en_una_finalizada_es_el_conservado`. Captura: `image3.png` (fila QV-01: «Registrado como «Harina Sin polvos Líder 1k»») | E1, E2 y E3 siguen en el resultado con el nombre conservado; el borrador movido a otro insumo deja de aparecer; el encabezado y el borrador muestran el nombre actual. La captura muestra un caso real en que el nombre conservado difiere del actual | Aprobado |
| PT08-05 | Revisar la elaboración registrada sin lote | Automatizada + captura | Aparece indicada como «sin lote» | Backend: `test_pt08_05_la_elaboracion_sin_lote_aparece_indicada_y_se_cuenta_en_el_resumen`. Frontend: `hu08.rastrear` «PT08-05: la elaboración sin lote lleva «Sin lote registrado»…» y «PT08-05: avisa cuántas elaboraciones registran el insumo sin lote». Capturas: `image1.png` («Sin lote registrado» y aviso «2 elaboraciones registran este insumo sin lote.») | `lote_estado: sin_lote` y `resumen.elaboraciones_sin_lote = 1`; en pantalla, la etiqueta «Sin lote registrado» y el aviso | Aprobado |
| PT08-06 | Revisar publicación y visibilidad | Automatizada + captura | Indica el producto publicado y la elaboración oculta | Backend: `test_pt08_06_indica_producto_publicado_y_elaboracion_oculta`, `test_la_visibilidad_publica_sigue_la_regla_de_hu09`. Frontend: `hu08.rastrear` «PT08-06: «Publicado» / «No publicado» y «Oculta al público» solo donde corresponde». Capturas: `image2.png` y `image3.png` («Publicado», «Visibles al público») | `producto.publicado`, `oculta` y `visible_publicamente` por elaboración. **Las capturas muestran «Publicado» y 0 ocultas; el caso «Oculta al público» lo cubren solo las pruebas automatizadas** | Aprobado (automatizado); captura del caso publicado |
| PT08-07 | Contar los resultados contra el conjunto esperado | Automatizada | 100 % de las relacionadas y 0 % de no relacionadas (OE3) | Backend: `test_pt08_07_el_conjunto_devuelto_es_el_esperado_100_por_ciento_relacionadas_0_por_ciento_no_relacionadas` (insumo) y `test_pt08_07_cada_lote_devuelve_el_100_por_ciento_de_las_relacionadas_y_el_0_por_ciento_de_las_otras` (lotes) | Ver la sección c) | Aprobado (escenario construido) |
| PT08-08 | Comparar la base antes y después de consultar | Automatizada | No cambia ningún registro | Backend: `test_pt08_08_la_consulta_no_modifica_ninguna_tabla` (insumo, 6 tablas) y `test_pt08_08_la_consulta_por_lote_no_modifica_ninguna_tabla`. Frontend: `hu08.detalle-insumo` «solo lee: dos GET autenticados con las rutas del backend» | Tablas `elaboraciones`, `usos_insumo`, `insumos_comerciales`, `lotes_insumo`, `elaboraciones_ocultas` y `productos` idénticas antes y después; el cliente solo hace GET | Aprobado |
| PT08-09 | Consultar un insumo o lote de otro productor | Automatizada | Responde 404 | Backend: `test_pt08_09_un_insumo_de_otro_productor_responde_404`, `test_un_insumo_inexistente_responde_404`, `test_pt08_09_lote_de_otro_productor_inexistente_o_de_otro_insumo_responden_404_con_el_mismo_cuerpo`, `test_ca10_nunca_incluye_elaboraciones_de_otro_productor`. Frontend: `hu08.rastrear` «un 404 del insumo…» y «un 404 del lote…» | 404 con `{"detail": "Lote no encontrado"}` en cinco casos (otro productor, lote inexistente, lote de otro insumo, insumo inexistente, insumo de otro productor) con el mismo cuerpo. El frontend decide por el código 404 | Aprobado |
| PT08-10 | Consultar desde el detalle del insumo en un celular | Manual | La sección reemplaza «Próximamente» y se usa sin problemas | Ver «PT08-10 y la prueba manual». Capturas: `image1.png`, `image2.png`, `image3.png`. Automatizadas de apoyo: `hu08.detalle-insumo` «reemplaza el «Próximamente» por la sección de uso» y `detalleRediseno` | Probado en **un computador (Dell Latitude 5420, Windows 11, Firefox)**; rastreo por insumo y por lote funcionan, sin desplazamiento horizontal y con textos legibles (informado). **No se probó en un celular** | **PENDIENTE** en celular; informado en computador (ver la nota sobre una respuesta ambigua) |

---

### PT08-10 y la prueba manual

**Dispositivo (informado por la desarrolladora):** Dell Latitude 5420 (un computador portátil); Windows 11; navegador Firefox (versión no registrada).

**Resultados manuales informados por la desarrolladora. Se anotan tal como los dio.**

| Punto de la hoja | Respuesta |
|---|---|
| PT08-10: la sección del detalle del insumo reemplaza «Próximamente» | **«no»** (respuesta ambigua; ver abajo) |
| PT08-10: Rastrear por insumo funciona | **Sí** |
| PT08-10: Rastrear por lote funciona | **Sí** |
| PT08-10: desplazamiento horizontal | **No** |
| PT08-10: textos legibles | **Sí** |
| Observaciones | Ninguna |

**Dos puntos que quedan abiertos y no se resuelven aquí por suposición:**

1. **La primera respuesta es ambigua.** Leída literalmente, «reemplaza “Próximamente”: no» diría que la sección **no** reemplaza la maqueta, es decir, un fallo. La captura `image1.png` muestra lo contrario: la sección «Uso reciente en elaboraciones» con datos reales y ninguna tarjeta «Próximamente», y las pruebas automatizadas lo comprueban. Lo más probable es que la desarrolladora respondiera «no» a «¿sigue apareciendo “Próximamente”?». **Está por confirmar**; mientras tanto, en el documento figura la respuesta literal, y la lectura plausible se apoya en la captura y en las pruebas, no en la respuesta.
2. **No fue un celular.** PT08-10 pide un celular y el dispositivo informado es un portátil. Las capturas `image2.png` y `image3.png` son de escritorio; `image1.png` es una columna angosta, pero no se informó que sea de un celular. **La prueba en celular (por la red local, como en HT07/HU10) queda PENDIENTE** y no se da por hecha.

**Capturas en `docs/test/validacion_hu08/`** (no se movieron ni renombraron; la correspondencia se estableció según su contenido):

| Archivo | Qué muestra |
|---|---|
| `image1.png` | Detalle del insumo: «Uso reciente en elaboraciones», «7 elaboraciones: 6 finalizadas y 1 borrador», aviso «2 elaboraciones registran este insumo sin lote.», las 5 más recientes con «Sin lote registrado», «Borrador» y «Publicado», el enlace «Ver las 7 elaboraciones y buscar por lote» y los enlaces por lote «3234» y «3345» |
| `image2.png` | Rastrear insumo, «Polvos de Hornear», todos los lotes: 3 resultados; cifras 3 finalizadas, 0 borradores, 3 de productos publicados, 0 ocultas, 3 visibles al público; sin aviso (ninguna sin lote) |
| `image3.png` | Rastrear insumo, «Harina de Trigo Sin polvos Líder 1k», lote 3345 («3345 · vence 20-11-2026»): 3 resultados; aviso «Hay 2 elaboraciones con este insumo sin lote registrado. No se puede descartar que usaran este lote.» con «Ver las elaboraciones de este insumo»; cifras 2 finalizadas, 1 borrador, 3 de productos publicados, 0 ocultas, 2 visibles al público; y «Registrado como «Harina Sin polvos Líder 1k»» en la fila QV-01 |

**Coherencia entre capturas (observación, no una prueba):** en los datos reales de `image1.png` y `image3.png` los números cuadran: 3 elaboraciones del lote 3345 + 2 del lote 3234 + 2 sin lote = 7 elaboraciones, que es el total de la sección del detalle, y las 2 sin lote del aviso del lote coinciden con las del aviso del insumo.

**Falta la captura `ci_verde_hu08.png`** (espacio reservado).

---

## c) OE3 (PT08-07): conteo sobre el escenario base

**Esto es una verificación sobre un escenario construido, no una medición con datos reales.** El escenario lo arman las pruebas por la API (fixture `base` de `test_elaboraciones_relacionadas_insumo_hu08.py`) y el conjunto esperado se fija a mano al construirlo. Sirve para demostrar que la consulta no pierde ni agrega elaboraciones en ese caso; no estima la tasa de acierto en la operación real.

**Escenario:** 6 elaboraciones. Insumo X «Harina Selecta 1 kg» con lotes L-42 y L-43; insumo Y, otra harina.

| Elaboración | Producto | Estado | Usa |
|---|---|---|---|
| E1 | Queque | finalizada | X, lote L-42 |
| E2 | Queque | finalizada | X, sin lote |
| E3 | Galletas | finalizada, oculta (producto publicado) | X, lote L-43 |
| E4 | Galletas | borrador | X, lote L-42 |
| E5 | Queque | finalizada | Y |
| E6 | Queque | borrador | nada del insumo X |

| Consulta | Relacionadas esperadas | Encontradas | No relacionadas | Incluidas | Encontradas (%) | No relacionadas incluidas (%) |
|---|---|---|---|---|---|---|
| Insumo X | 4 (E1, E2, E3, E4) | 4 | 2 (E5, E6) | 0 | **100 %** | **0 %** |
| Insumo Y | 1 (E5) | 1 | 5 | 0 | **100 %** | **0 %** |
| Lote L-42 | 2 (E1, E4) | 2 | 4 (E2, E3, E5, E6) | 0 | **100 %** | **0 %** |
| Lote L-43 | 1 (E3) | 1 | 5 | 0 | **100 %** | **0 %** |

Fuentes: `test_pt08_07_el_conjunto_devuelto_es_el_esperado_…` (insumos X e Y) y `test_pt08_07_cada_lote_devuelve_…` (L-42 y L-43). En ambas, el conjunto devuelto es **igual** al esperado.

**Comprobación adicional con datos reales (captura, no automatizada):** `image2.png` e `image3.png` muestran resultados reales y los números cuadran entre sí (ver arriba), pero **no se contó contra un conjunto esperado independiente**: no es una medición de OE3.

---

## d) Escenarios adicionales

| Escenario | Resultado esperado | Evidencia | Estado |
|---|---|---|---|
| RT-03: nombre del insumo y código del lote tras cambiar lo vigente | La finalizada muestra lo conservado; el borrador, lo actual | Insumo: `test_rt03_el_codigo_del_lote_mostrado_en_una_finalizada_es_el_conservado`, `test_pt08_04_…` (el insumo renombrado). Lote: `test_rt03_el_codigo_del_lote_mostrado_en_una_finalizada_es_el_conservado`. Frontend: «el nombre conservado distinto del actual se avisa…». Captura: `image3.png` (fila QV-01) | Aprobado |
| Borrador que usa el lote | Aparece en la consulta por lote con estado borrador | `test_un_borrador_que_usa_el_lote_aparece_con_estado_borrador_y_datos_vigentes` | Aprobado |
| Borrador con el lote sin definir | `lote_estado: pendiente`, sin lote | `test_borrador_con_lote_pendiente_se_marca_pendiente_y_el_borrador_muestra_datos_vigentes`; frontend «un borrador con el lote sin definir lleva «Lote pendiente»» | Aprobado |
| `otras_sin_lote` | Los dos números correctos y esas elaboraciones fuera del resultado | `test_otras_sin_lote_en_el_escenario_base_cuenta_la_elaboracion_sin_lote_y_no_la_incluye` (`{sin_lote: 1, lote_pendiente: 0}`), `test_otras_sin_lote_cuenta_finalizadas_y_borradores_sin_lote_y_borradores_con_lote_pendiente` (`{sin_lote: 3, lote_pendiente: 1}`), `test_otras_sin_lote_no_cuenta_otros_insumos_ni_otras_elaboraciones_con_lote`. Frontend: los tres avisos (ambos números, solo sin lote, solo pendientes) y sin aviso con ceros. Captura: `image3.png` («Hay 2 elaboraciones con este insumo sin lote registrado…») | Aprobado |
| Insumo desactivado | Sigue siendo consultable | `test_un_insumo_desactivado_sigue_siendo_consultable` | Aprobado |
| Insumo sin usos | Lista vacía y resumen en cero | `test_un_insumo_sin_usos_devuelve_lista_vacia_y_resumen_en_cero` | Aprobado |
| Sin N+1 | Número de consultas constante | Ver abajo | Aprobado |
| D1: columnas contra copia conservada | En toda finalizada coinciden | Ver abajo | Aprobado |

**Número exacto de consultas por solicitud** (fijado en las pruebas como constantes con nombre, igual con pocas y con muchas elaboraciones; el de autenticación es la búsqueda del productor del token):

| Consulta | Autenticación | Datos | Total | Prueba |
|---|---|---|---|---|
| Por insumo | 1 | 2 | **3** | `test_la_cantidad_de_consultas_es_constante_sin_n_mas_1` (4 y 11 elaboraciones) |
| Por lote | 1 | 3 | **4** | `test_la_consulta_por_lote_hace_un_numero_constante_de_consultas` (2 y 8 elaboraciones) |

Datos por insumo: el insumo del productor, y los usos con su elaboración, producto y marca de oculta. Datos por lote: el lote con su insumo, los mismos usos y el conteo de `otras_sin_lote`. En la primera medición, la consulta por lote hacía 5; se redujo a 4 cargando el insumo junto con el lote.

**Las tres pruebas de equivalencia de D1** (en `test_elaboraciones_relacionadas_insumo_hu08.py`):

1. **Invariante:** `test_d1_en_toda_finalizada_las_columnas_coinciden_con_la_copia_conservada`: en las 8 filas de uso de las finalizadas del escenario, `insumo_id`, `lote_id` y `sin_lote` coinciden con `informacion_conservada` (con lote, sin lote y dos insumos).
2. **Oráculo desde las copias:** `test_d1_las_finalizadas_devueltas_son_las_que_dicen_las_copias`: el conjunto calculado solo con los JSON conservados es igual al que devuelve la API.
3. **Tras cambios vigentes:** `test_d1_el_invariante_se_mantiene_tras_cambios_vigentes`: se renombra el insumo, se cambia el código del lote, se mueve un borrador y se desactiva el insumo, y el invariante sigue en pie.

---

## e) Cobertura de CA1 … CA10

| CA | Criterio | Pruebas | Estado |
|---|---|---|---|
| CA1 | Consultar las elaboraciones relacionadas con un insumo | PT08-01; `hu08.rastrear` (resultado del insumo); `hu08.detalle-insumo` | Cumplido |
| CA2 | Consultar las elaboraciones relacionadas con un lote específico | PT08-02; `test_elaboraciones_relacionadas_lote_hu08.py`; `hu08.rastrear` (resultado de un lote) | Cumplido |
| CA3 | Muestra producto, fecha y código | PT08-01; `test_la_respuesta_solo_tiene_los_campos_acordados` | Cumplido |
| CA4 | Incluye finalizadas y borradores, con su estado | PT08-03; `test_un_borrador_que_usa_el_lote_aparece_con_estado_borrador_y_datos_vigentes` | Cumplido |
| CA5 | En las finalizadas, la identificación sale de la información conservada | PT08-04; las tres pruebas de equivalencia de D1; RT-03 | Cumplido (con el límite de D1, ver g) e i)) |
| CA6 | Al consultar por insumo, indica las registradas sin lote | PT08-05; `resumen.elaboraciones_sin_lote`; `hu08.rastrear` | Cumplido |
| CA7 | Indica si el producto está publicado y si la elaboración está oculta | PT08-06; los campos de CA7 en la consulta por lote | Cumplido |
| CA8 | No incluye elaboraciones que no usaron el insumo o lote | PT08-07 (insumo y cada lote); `otras_sin_lote` solo cuenta, nunca incluye | Cumplido |
| CA9 | La consulta no modifica la información | PT08-08 (ambas consultas) | Cumplido |
| CA10 | Solo las elaboraciones del productor autenticado | PT08-09; `test_ca10_nunca_incluye_elaboraciones_de_otro_productor` (fuerza un caso a nivel de base) | Cumplido |

---

## f) Mutaciones

Todas restauradas desde copia y confirmadas con `cmp` (los archivos quedaron idénticos al original). Máximo cuatro por tarea; sin mutaciones nuevas en T08-05.

**T08-01 (backend, consulta por insumo; corridas en SQLite)**

| Mutación | Pruebas que fallan | Observaciones |
|---|---|---|
| a) excluir las elaboraciones sin lote | 12 (PT08-01, PT08-03, PT08-04, PT08-05, PT08-06, PT08-07, oráculo de D1, visibilidad pública, una sola vez, desactivado, CA10 y N+1) | |
| b) omitir el filtro por productor | 1 (`test_ca10_nunca_incluye_elaboraciones_de_otro_productor`) | Por la API no se puede cruzar el insumo de otro productor, así que solo la prueba que fuerza el caso a nivel de base lo detecta. El primer intento tocó otra línea y se repitió con la línea exacta |
| c) nombre del insumo vigente en lugar del conservado | 1 (`test_pt08_04_…`) | |
| d) excluir los borradores | 13 (PT08-01, PT08-03, PT08-04, PT08-05, PT08-06, PT08-07, borrador pendiente, RT-03, visibilidad pública, una sola vez, desactivado, CA10 y N+1) | |

**T08-02 (backend, consulta por lote; corridas en SQLite)**

| Mutación | Pruebas que fallan | Observaciones |
|---|---|---|
| a) incluir usos de otro lote del mismo insumo | 8 (PT08-02, encabezado y resumen, PT08-07, `otras_sin_lote` en base y ampliado, lote de otro productor con el mismo código, N+1 y contraste con la base) | |
| b) incluir las sin lote en el resultado en lugar de contarlas aparte | 8 (las mismas) | Mismo conjunto que a): ambas agregan elaboraciones ajenas al lote |
| c) aceptar un lote que no pertenece al insumo de la ruta | 1 (`test_pt08_09_lote_de_otro_productor_inexistente_o_de_otro_insumo_…`) | |
| d) excluir los borradores de la consulta por lote | 9 (PT08-02, encabezado y resumen, PT08-07, borrador que usa el lote, RT-03, `otras_sin_lote` ampliado, lote de otro productor con el mismo código, N+1 y contraste con la base) | |

**T08-04 (frontend; corridas con Vitest sobre los dos archivos nuevos, 42 pruebas)**

| Mutación | Pruebas que fallan | Observaciones |
|---|---|---|
| a) no mostrar el aviso de `otras_sin_lote` | 3 (los dos avisos con números y redacción, y «un lote sin usos… y el aviso sigue») | |
| b) no mostrar «Sin lote registrado» | 2 (PT08-05 y la sección del detalle) | |
| c) mostrar una elaboración oculta sin su etiqueta | 2 (PT08-06 y las etiquetas del detalle) | |
| d) confundir borrador y finalizada en la etiqueta de estado | 2 (PT08-03 y PT08-02 del rastreo) | |

Fuente: reportes de T08-01, T08-02 y T08-04 (E).

---

## g) Decisiones de diseño

- **D1: columnas para identificar y copia conservada para mostrar.** Las relaciones se buscan por las columnas de `usos_insumo` (`insumo_id`, `lote_id`, `sin_lote`), que son indexables e iguales en SQLite y PostgreSQL. Los datos mostrados de una finalizada (nombre del insumo, lote, ingrediente) salen **solo** de `informacion_conservada`; si falta un dato, queda nulo y nunca se cae al valor vigente (RT-03). **Límite:** la igualdad entre las columnas y la copia **se sostiene por construcción** (la copia solo se escribe en `finalizar_mine`, desde la misma fila y en la misma transacción, y después es inmutable) **y por las pruebas**; **ninguna restricción de la base lo impone** (ningún trigger ni CHECK compara `copia.insumo.id` con `insumo_id`). No se agregó ese CHECK, ni siquiera como seguimiento.
- **Borradores con datos vigentes (CA4).** Un borrador no tiene copia: se identifica por su uso vigente y muestra los datos actuales (`origen_datos: "vigente"`). Puede tener el lote pendiente (`lote_estado: "pendiente"`). Nunca es público ni se oculta.
- **`otras_sin_lote {sin_lote, lote_pendiente}` fuera del resultado (CA8).** La consulta por lote devuelve **solo** las elaboraciones de ese lote. Las elaboraciones del mismo insumo sin lote registrado, y los borradores con el lote pendiente, **no** aparecen en `elaboraciones`: solo se informa cuántas son, para el aviso «no se puede descartar», con enlace a la consulta por insumo.
- **Sin paginación.** Ante un retiro el productor necesita la lista completa, y un total parcial daría falsa seguridad. El volumen esperado es de decenas o pocos cientos. Se puede agregar `limit/offset` sin romper el contrato.
- **Rastrear como pestaña en Elaboraciones.** `/elaboraciones/rastrear`, junto a «Historial», con la selección en la URL (`?insumo=&lote=`). El menú no cambia.
- **Panel de 5 cifras.** «Finalizadas», «Borradores», «De productos publicados», «Ocultas» y «Visibles al público». Tres salen del resumen de la API (finalizadas, borradores, visibles al público) y dos se cuentan en el cliente sobre la lista completa (de productos publicados, ocultas). «Visibles al público» no es lo mismo que «De productos publicados»: además exige una finalizada que no esté oculta.
- **Sin migración.** Los índices sobre `usos_insumo(insumo_id)` y `usos_insumo(lote_id)` ya existían.
- **Un solo mensaje de 404 en la consulta por lote.** Un insumo ajeno, un lote ajeno, un lote inexistente y un lote de otro insumo responden `404` con el mismo cuerpo.
- **Los 404 se distinguen por el código de estado en la interfaz,** porque `parseError` no lee el `detail` del 404.

---

## h) Diferencias con el diseño vigente

Registradas en la sección D6 del contexto de HU08 (aprobadas):

1. **No hay una pantalla de «detalle del lote».** La consulta por lote es la misma pantalla de rastreo con el lote elegido, a la que se llega desde los enlaces por lote del detalle del insumo.
2. **El lote se elige en un selector** (código y fecha de vencimiento, del más reciente al más antiguo, más «Todos los lotes del insumo»), no en un campo de texto libre con coincidencia parcial, porque el backend consulta por `lote_id`. El selector de insumo incluye los inactivos, marcados «(inactivo)».
3. **Panel de cinco cifras** en lugar de cuatro: el diseño llamaba «Publicadas» a los productos publicados, que no es lo que ve el consumidor; se añadió «Visibles al público» y se renombró a «De productos publicados».
4. **La sección del detalle del insumo está en la columna principal,** no en la lateral, porque lista elaboraciones y necesita ancho.

---

## i) Limitaciones

- **D1:** la igualdad entre las columnas y la copia conservada de una finalizada se sostiene por construcción y por las pruebas, no por una restricción de la base (ver g).
- **Selector de lote sin búsqueda por texto:** el sistema de diseño no tiene un selector que permita escribir para filtrar; se usa un `<select>`. Con muchos lotes, hay que recorrer la lista.
- **El conteo de OE3 es sobre un escenario construido,** con un conjunto esperado fijado a mano; no es una medición con datos reales.
- **Prueba en celular pendiente.** PT08-10 se hizo en un portátil (Firefox, Windows 11). La prueba en celular por red local —con la configuración de red documentada en HU10 (`URL_PUBLICA_APP`, `VITE_API_URL` y CORS con la IP)— **no se hizo**, y la primera respuesta manual sobre «Próximamente» está por confirmar (ver b).
- **CI pendiente:** no hay ejecución del CI de HU08 que citar y falta `ci_verde_hu08.png`.
- **Las mutaciones solo cubren lógica nueva,** con un máximo de cuatro por tarea, y corrieron en SQLite (backend) y en Vitest (frontend).
- **La visibilidad pública** del resultado reutiliza la regla de HU09 (`elaboracion_visible_publicamente`); no se re-verificó contra la ficha pública de HU10 en esta historia.

---

## j) Notas para el informe

- **T08-03 quedó absorbida por T08-01:** los campos de CA7 (estado, producto publicado, elaboración oculta y visibilidad pública) salen de la misma consulta y están en el esquema compartido; no hubo trabajo ni horas propias.
- **Horas:** T08-01 unas 1,5 h y T08-02 unas 0,5 h (estimadas en sus reportes; no se cronometró). **T08-04 tomó unas 2 h, contra 1,5 h estimadas;** el excedente fue sobre todo el cuidado con los avisos y el ajuste de los efectos de React para dejar los archivos nuevos sin avisos de lint. T08-05 es documentación, sin código nuevo.
- **Corrección del formato de errores en el contexto:** la regla de la sección 2 decía «`detail` con `{mensaje, …}`» para todos los errores. En el código, el **404 lleva `detail` de texto** y `parseError` no lo lee (la interfaz decide por el código de estado); **409 y 422** llevan `{mensaje, …}` cuando traen datos. Se corrigió el texto del contexto sin cambiar `parseError`.
- **Pruebas existentes adaptadas:** solo `ui/detalleRediseno.test.tsx`, y se explicó por qué.
- **Archivos de HU08:** backend (`gestion_elaboraciones.py`, `elaboracion_service.py`, `elaboracion_repository.py`, `schemas/elaboracion.py`) y frontend (`ElaboracionesRastrear.tsx`, `useElaboracionesRelacionadas.ts`, `relacionadasService.ts`, `lib/relacionadas.ts`, `types/relacionadas.ts`, `components/elaboraciones/relacionadas/`, y cambios en `App.tsx`, `Elaboraciones.tsx` e `InsumoDetail.tsx`). Sin migración, sin dependencias nuevas.
- **Pendiente para cerrar la historia:** el enlace y la captura del CI, la prueba en un celular y la aclaración de la primera respuesta manual de PT08-10.
