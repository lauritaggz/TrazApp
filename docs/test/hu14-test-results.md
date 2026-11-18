# HU14 — Resultados de pruebas (T14-08)

**Fecha:** 2026-11-18  
**Rama:** `feature/hu14-calculadora-costos` (Pull Request en draft hacia `main`)  
**Historia:** HU14 — Calculadora de costos del producto (Sprint 3, P1, 8 SP)  
**Criterios de referencia:** CA1 … CA13 y PT14-01 … PT14-17 (`docs/context/TrazApp_HU14_contexto_agente.md`, secciones 3, 7 y 10). **CA13 lo agregó la desarrolladora** durante T14-06.  
**Entorno:** backend en el contenedor `trazapp-backend` sobre SQLite y PostgreSQL 16; frontend con Vitest y Vite en el contenedor `trazapp-frontend` (desde el host Vitest no arranca). **Migración nueva: `019_costos_producto_hu14`** (el Sprint Planning decía 018; la 018 la tomó HU09). Sin dependencias nuevas.  
**Integración continua:** enlace **PENDIENTE** (la desarrolladora lo agrega tras el push). Captura esperada: `docs/test/validacion_hu14/ci_verde_hu14.png` — *(espacio reservado; la captura aún no existe)*. Del CI de HU14 solo se conocen dos ejecuciones con fallas, ya corregidas (ver k): `hu13.sin-cdn` (un comentario con el nombre de una fuente) y `ht07.bloque4` (mayúsculas forzadas en la calculadora). **No hay todavía una ejecución en verde que citar.**

**Convención de las fuentes de los números:** **(L)** corrida o conteo local de hoy (18-11-2026) en el contenedor; **(E)** última corrida local informada en el reporte de la tarea; **(C)** corrida del CI. Nada de este documento se da por pasado en el CI. **Hoy no se corrió la regresión**: la ejecuta el CI cuando se haga el push; los números por archivo salen de los reportes de cada tarea, y de hoy solo hay conteos de recolección y las corridas indicadas con (L).

---

## a) Resumen

**Historia.** Como productor, quiero calcular el costo de elaborar un producto a partir de sus ingredientes, los precios de mis insumos y otros costos que yo defina, para conocer cuánto me cuesta producir cada tanda y cada unidad. HU14 deja lista la calculadora (`/calculadora?producto=<id>`), los endpoints `GET` y `PUT /gestion/productos/{id}/costos`, el precio y el contenido en el insumo (con «Actualizar precio desde Jumbo»), el costo calculado en el detalle del producto y las cantidades de la formulación ocultas en la interfaz.

**Criterios cumplidos: 13 de 13 en lo automatizado** (incluido el CA13, agregado por la desarrolladora). **La parte móvil de CA1 y CA9 (PT14-17) queda PENDIENTE** de las respuestas manuales de la desarrolladora; las capturas del celular existen (ver «PT14-17 y la prueba en celular») pero las respuestas no se informaron y no se inventan.

| Estado | Criterios |
|---|---|
| Cumplidos, verificados con pruebas automatizadas (E) | CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA13 |
| Con parte manual PENDIENTE (PT14-17, celular) | CA1 y CA9 (la usabilidad en el celular); la automatizada está cumplida |

### Pruebas automáticas de HU14, por archivo

**Backend** (376 pruebas nuevas en 8 archivos, más 3 en el archivo de la formulación de HU03; todas corren en SQLite y PostgreSQL, salvo las de la migración, que son de PostgreSQL). **Conteo de hoy (L)** con `pytest --collect-only` (recolección, no ejecución); **resultado (E)** del reporte de cada tarea:

| Archivo | Pruebas (L) | SQLite (E) | PostgreSQL (E) | Tarea del resultado |
|---|---|---|---|---|
| `tests/test_costos_modelo_hu14.py` | 27 | 27 | 27 | T14-05 |
| `tests/test_migracion_019_costos_hu14.py` | 18 | 1 pasa y 17 se saltan (solo PG) | 18 | T14-02 |
| `tests/test_contenido_parser_hu14.py` | 84 | 84 | 84 | T14-03 |
| `tests/test_precio_contenido_fuentes_hu14.py` | 32 | 32 | 32 | T14-03 (tras la detección de granel por GS1) |
| `tests/test_insumo_costos_hu14.py` | 57 | 57 | 57 | T14-03 (tras la detección de granel por GS1) |
| `tests/test_costos_calculo_hu14.py` | 35 | 35 | 35 | T14-05 |
| `tests/test_costos_servicio_hu14.py` | 41 | 41 | 41 | T14-05 |
| `tests/test_costos_api_hu14.py` | 82 | 82 | 82 | T14-05 |
| **Total de HU14** | **376** | | | |
| `tests/test_gestion_formulacion_hu03.py` (3 nuevas de T14-07; el archivo tiene 25) | 25 | 25 | 25 | T14-07 |

Pruebas existentes de backend adaptadas: `tests/test_migracion_018_publicacion.py` (2 aserciones, ver más abajo). Resultado (E, T14-02): SQLite 1 pasa y 15 se saltan; PostgreSQL 16 pasan.

**Frontend** (191 pruebas nuevas en 6 archivos). **Resultado (E)** de la última corrida que incluyó cada archivo:

| Archivo | Pruebas | Resultado | Última corrida |
|---|---|---|---|
| `lib/hu14.dinero.test.ts` | 66 | 66 pasan | (E) rediseño de la calculadora |
| `insumos/hu14.insumo-precio.test.tsx` | 31 | 31 pasan | (E) fechas en hora de Chile |
| `products/hu14.calculadora.test.tsx` | 73 | 73 pasan | (E) tres ajustes visuales |
| `products/hu14.menu.test.tsx` | 5 | 5 pasan | (E) corrección del CI (`ht07`) |
| `products/hu14.costo-detalle.test.tsx` | 9 | 9 pasan | (E) T14-07 |
| `products/hu14.formulacion-oculta.test.tsx` | 7 | 7 pasan | **(L)** hoy |
| **Total de HU14** | **191** | | |

**Corrida de hoy (L), tras quitar `formatFormulacionCantidad` de `lib/formulationUtils.ts`** (función sin usos; ver más abajo): `hu14.formulacion-oculta` 7, `hu03.formulation` 22, `hu03.formulation-history` 9 y `hu03.formulation-create-ingredient` 10; **48 pruebas en 4 archivos, todas aprobadas**; `tsc -b` y `npm run build` sin errores.

**Pruebas existentes adaptadas, frontend (explicadas una por una en la tarea correspondiente; ninguna aserción se relajó):**

| Archivo | Cambio | Tarea |
|---|---|---|
| `ui/fase2Navegacion.test.tsx`, `products/hu09.publicaciones-general.test.tsx` | Dejaron de afirmar que no existe «Calculadora»; ahora afirman «Calculadora de costos» con `href="/calculadora"` | T14-06 (E2) |
| `ui/mejoraUiUx.test.tsx` | El último enlace del menú (trampa de foco) pasa a ser «Calculadora de costos» | T14-06 (E2) |
| `products/hu03.formulation.test.tsx` (6 pruebas), `hu03.formulation-history`, `hu03.formulation-create-ingredient` (2) | Las cantidades ya no se ven ni se escriben; el payload reenvía el texto de la API («500.000», «1.500»); la validación del par cantidad-unidad pasa a probarse sobre `validateDraftLines` con los mismos mensajes | T14-07 |
| `elaboraciones/hu05.elaboraciones.test.tsx` (2) | La cantidad de la formulación pasa a no mostrarse (registro y PT05-15) | T14-07 |

**Directamente afectadas, corridas en las entregas (E):** `hu04.insumos` 77, `ht06.alergenos` 44, `hu07.nuevo-insumo` 41, `hu07.revision` 42, `hu13.busqueda` 49, `hu13.origen` 31, `hu13.sin-cdn` 9, `ht07.bloque4` 11, `modoOscuro` 23, `hu01.products` 51, `hu05.elaboraciones` 167, `hu06.historial` 34, `hu09.visibilidad` 16, `hu09.publicacion` 18, y las ocho de HU10 (todas pasan). La regresión completa (SQLite, PostgreSQL y frontend) corre en el CI.

---

## b) Trazabilidad PT14-01 … PT14-17

Evidencia = archivo y prueba (backend en `backend/tests/`, frontend en `frontend/src/`) o captura (en `docs/test/validacion_hu14/`, con su nombre real de archivo; ver «PT14-17 y la prueba en celular»). Los números de PT salen de la sección 7 del contexto. Todos los resultados automatizados son (E).

| ID | Caso | Tipo | Resultado esperado | Evidencia | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| PT14-01 | Abrir la calculadora desde el menú y desde el detalle de un producto | Automatizada | Desde el detalle, el producto viene seleccionado | `hu14.menu`: ««Calculadora de costos» está en «Herramientas», después de «Publicaciones», y lleva a /calculadora», «el detalle del producto tiene «Calcular costos» y lleva a /calculadora?producto=<id>»; `hu14.calculadora`: «sin ?producto= pide elegir uno y no calcula nada» | El menú lleva a `/calculadora`; el botón del detalle lleva a `/calculadora?producto=<id>`; sin producto pide elegir uno | Aprobado |
| PT14-02 | Agregar un ingrediente a la formulación (nueva versión) y abrir la calculadora | Automatizada | Aparece la línea nueva; no aparecen ingredientes de versiones anteriores | `test_costos_servicio_hu14.py`: `test_un_ingrediente_nuevo_en_otra_version_aparece_y_uno_de_la_anterior_no`, `test_las_lineas_siguen_el_orden_de_la_formulacion` | Las líneas salen de la versión vigente, en su orden | Aprobado |
| PT14-03 | Insumo de la última elaboración finalizada no habitual; producto sin elaboraciones; ingrediente sin habitual | Automatizada + captura | Preselecciona el usado; luego el habitual; luego «sin insumo» | `test_costos_servicio_hu14.py`: `test_preselecciona_el_insumo_de_la_ultima_finalizada_aunque_no_sea_el_habitual`, `test_sin_elaboraciones_preselecciona_el_habitual`, `test_sin_habitual_ni_elaboraciones_no_hay_insumo`, `test_un_insumo_inactivo_de_la_ultima_cae_al_habitual_y_lo_avisa`; `hu14.calculadora`: «dice de dónde sale cada insumo y avisa si el de la última elaboración ya no está activo», «un ingrediente sin insumos disponibles lo dice y ofrece crear uno». Captura: `WhatsApp Image 2026-11-18 at 4.17.43 PM.jpeg` | Las tres reglas, más el inactivo que cae al habitual con aviso. La captura muestra «Última elaboración» bajo cada ingrediente | Aprobado |
| PT14-04 | Cambiar el insumo con el selector y recargar | Automatizada + captura | Recalcula con el insumo elegido; al recargar vuelve a la preselección | `test_costos_api_hu14.py`: `test_el_parametro_insumo_recalcula_y_el_get_siguiente_vuelve_a_la_preseleccion`, `test_el_put_acepta_el_insumo_alternativo_y_tampoco_lo_guarda`; `test_costos_servicio_hu14.py`: `test_la_alternativa_recalcula_y_no_se_guarda`; `hu14.calculadora`: «elegir otro insumo recalcula con ?insumo=<ingrediente>:<insumo> y no toca la URL», «al cambiar de producto el insumo alternativo se olvida». Captura: `WhatsApp Image 2026-11-18 at 4.18.42 PM.jpeg` | La elección viaja en `?insumo=`, no se guarda ni va a la URL; el siguiente GET vuelve a la preselección. La captura muestra «Elegido ahora (no se guarda)» | Aprobado |
| PT14-05 | Guardar cantidades de una tanda; cantidad 0 o negativa | Automatizada | Se guardan sin crear una versión; 0 o negativa → 422 | `test_costos_api_hu14.py`: `test_guardar_cantidades_calcula_y_no_crea_una_version`, `test_cantidad_cero_o_negativa_es_422_y_no_guarda_nada`, `test_cantidad_y_unidad_van_juntas_y_validas`; `hu14.calculadora`: «guarda solo la línea que cambió, con punto decimal…» y los rechazos del cliente (`0`, `1000001`, `2,5`, `abc`) | Sin versión nueva; 422 sin guardar nada. El cliente envía solo la línea cambiada | Aprobado |
| PT14-06 | Insumo encontrado en Jumbo; insumo solo en Open Food Facts | Automatizada + captura | Precio y contenido precargados con fuente y fecha; el contenido sale de OFF cuando Jumbo no lo tiene | `test_precio_contenido_fuentes_hu14.py`: `test_jumbo_entrega_el_precio_en_pesos_y_el_contenido_neto`, `test_open_food_facts_entrega_solo_el_contenido_nunca_el_precio`, `test_la_combinada_toma_el_contenido_de_open_food_facts_cuando_jumbo_no_lo_tiene`, `test_la_consulta_por_nombre_propone_precio_y_contenido_con_su_fuente`; `test_insumo_costos_hu14.py`: `test_crear_desde_una_busqueda_conserva_la_fuente_jumbo_y_la_fecha_de_recuperacion`, `test_crear_con_el_contenido_de_open_food_facts_conserva_esa_fuente`; `hu14.insumo-precio`: «muestra el precio y el contenido con su fuente y fecha». Captura: `WhatsApp Image 2026-11-18 at 4.18.42 PM (1).jpeg` | Respuestas grabadas (nunca la red real). La captura muestra el detalle de un insumo con «$1.350 · Jumbo · 18-11-2026» y contenido «1 kg · Jumbo» | Aprobado |
| PT14-07 | Editar el precio de un insumo usado en dos productos | Automatizada + captura | Ambos cálculos cambian; la fuente queda «manual» con su fecha | `test_insumo_costos_hu14.py`: `test_editar_el_precio_pasa_la_fuente_a_manual_con_la_fecha_del_cambio`, `test_enviar_el_mismo_precio_no_cambia_su_fuente_ni_su_fecha`; `test_costos_api_hu14.py`: `test_el_costo_calculado_cambia_con_el_precio_del_insumo_y_el_manual_no`; `hu14.insumo-precio`: «cambiar solo el precio envía solo precio_referencia, con punto decimal». Captura: `WhatsApp Image 2026-11-18 at 4.17.43 PM (1).jpeg` | La fuente pasa a «manual» con la fecha del cambio. **No hay una prueba con dos productos a la vez**: el efecto sobre varios productos es estructural (el precio vive en el insumo y el cálculo lo lee) y se verifica con un producto. La captura muestra líneas con «Manual · 18 nov 2026» | Aprobado (un producto); el caso de dos productos no tiene prueba propia |
| PT14-08 | 250 g con 1 kg a $1.000; 200 ml con 1 L a $1.100; 3 un con 12 un a $3.000 | Automatizada + manual | $250, $220 y $750 | `test_costos_calculo_hu14.py`: `test_los_tres_ejemplos_obligatorios_dan_el_decimal_exacto`, `test_convierte_dentro_de_la_misma_magnitud_en_los_dos_sentidos`. Captura parcial: `WhatsApp Image 2026-11-18 at 4.22.41 PM.jpeg`. **Falta la captura `pt14-08_conversiones.png`** | Los tres ejemplos dan el decimal exacto en el backend. La captura existente muestra **otro caso**: 250 «unidad» con un insumo de 1.000 unidad a $1.000 = $250; no son los tres ejemplos ni muestra $220 ni $750 | Aprobado (automatizado). En pantalla: **PENDIENTE** (resultado manual no informado) |
| PT14-09 | Receta en ml con insumo en kg | Automatizada | La línea indica unidades incompatibles y no se muestra el total | `test_costos_servicio_hu14.py`: `test_receta_en_ml_con_insumo_en_kg_es_unidades_incompatibles_y_sin_total`; `test_costos_calculo_hu14.py`: `test_no_convierte_entre_magnitudes_distintas`, `test_solo_son_compatibles_las_unidades_de_la_misma_magnitud`; `test_costos_api_hu14.py`: `test_unidades_incompatibles_se_indican_en_la_linea` | Faltante `unidades_incompatibles` en la línea y sin total | Aprobado |
| PT14-10 | Agregar, editar y eliminar otros costos; monto negativo | Automatizada | El total los incluye; monto negativo → 422 | `test_costos_api_hu14.py`: `test_agregar_editar_y_eliminar_otros_costos_cambia_el_total`, `test_otro_costo_invalido_es_422`, `test_el_monto_cero_y_el_nombre_de_100_caracteres_son_validos`; `hu14.calculadora`: «agregar un otro costo envía la lista completa», «quitar el último otro costo envía la lista vacía», «un otro costo sin nombre, sin monto o con monto inválido se rechaza en el cliente» | El total los suma; el monto negativo da 422 | Aprobado |
| PT14-11 | Rendimiento 8 y sin rendimiento; rendimiento 0 | Automatizada + captura | Por unidad = total ÷ 8; sin rendimiento solo la tanda; 0 → 422 | `test_costos_api_hu14.py`: `test_rendimiento_8_da_el_costo_por_unidad_y_null_lo_borra`, `test_rendimiento_invalido_es_422`; `test_costos_servicio_hu14.py`: `test_con_rendimiento_8_el_costo_por_unidad_es_la_tanda_entre_8`, `test_sin_rendimiento_solo_hay_costo_por_tanda`, `test_la_division_por_el_rendimiento_no_pierde_decimales`; `hu14.calculadora`: «el costo de la tanda se ve aunque falte el rendimiento, y dice cómo ver el de la unidad», «cambiar el rendimiento envía solo el rendimiento; vaciarlo envía null». Captura: `WhatsApp Image 2026-11-18 at 4.17.44 PM.jpeg` | Con rendimiento 20 la captura muestra tanda $22.590 y unidad $1.130 (22.590,357 ÷ 20 = 1.129,52 → $1.130) | Aprobado |
| PT14-12 | Línea sin cantidad, insumo sin precio, ingrediente sin insumo | Automatizada + captura | Indica el faltante en cada línea y no muestra total | `test_costos_servicio_hu14.py`: `test_cada_faltante_se_indica_en_su_linea_y_no_hay_total`, `test_una_linea_puede_tener_varios_faltantes_a_la_vez`, `test_con_faltantes_nunca_hay_total_parcial_pero_si_los_otros_costos`; `hu14.calculadora`: «sin cálculo completo no muestra ningún total (CA9)», «lo que falta se lista con texto en SU línea…», «el recuadro «No se puede calcular el total» lista «Ingrediente: mensaje» y cada uno enlaza con su línea». Captura: `WhatsApp Image 2026-11-18 at 4.18.42 PM.jpeg` | Cada línea dice qué falta con texto («Falta la cantidad del ingrediente en la tanda», «Sin precio») y «Pendiente» en el costo | Aprobado |
| PT14-13 | Cálculo completo con rendimiento; luego borrar un precio | Automatizada | El detalle muestra el costo «calculado»; el manual sigue intacto; al faltar un dato vuelve el manual | `test_costos_api_hu14.py`: `test_el_detalle_trae_el_costo_calculado_y_no_toca_el_costo_de_produccion`, `test_el_costo_calculado_es_null_sin_rendimiento_sin_formulacion_o_con_un_dato_faltante`, `test_el_costo_calculado_cambia_con_el_precio_del_insumo_y_el_manual_no`; `hu14.costo-detalle` (9). **Falta la captura `pt14-13_detalle_calculado.png`** | `costo_calculado` por unidad con la etiqueta «Calculado»; `costo_produccion` no cambia; con `null` se ve el manual como antes | Aprobado (automatizado); sin captura |
| PT14-14 | Editar precios y cantidades con elaboraciones finalizadas | Automatizada + captura | No cambia la información conservada ni las versiones; se muestra la fecha del precio más antiguo | `test_costos_api_hu14.py`: `test_guardar_no_cambia_versiones_elaboraciones_usos_ni_la_informacion_conservada`; `test_costos_servicio_hu14.py`: `test_calcular_no_cambia_nada_de_la_base`, `test_calcular_no_emite_ninguna_sentencia_de_escritura`, `test_el_precio_mas_antiguo_es_el_de_los_insumos_usados_en_lineas_con_costo`; `hu14.calculadora`: «el precio más antiguo se muestra como en el diseño y en hora de Chile». Captura: `WhatsApp Image 2026-11-18 at 4.17.44 PM.jpeg` | Sin escrituras en el cálculo; versiones, elaboraciones y usos intactos. La captura muestra «Precio más antiguo considerado: 17 nov 2026» | Aprobado |
| PT14-15 | GET y PUT de costos de un producto de otro productor | Automatizada | 404 | `test_costos_api_hu14.py`: `test_un_producto_de_otro_productor_o_inexistente_es_404_en_get_y_put`, `test_un_producto_dado_de_baja_es_404`, `test_sin_token_es_401`, `test_el_404_y_el_422_no_se_confunden_con_los_datos_de_otro_productor`; `test_costos_servicio_hu14.py`: `test_los_insumos_y_cantidades_de_otro_productor_no_entran_al_calculo` | 404 con `detail` de texto; un insumo ajeno es indistinguible de uno inexistente | Aprobado |
| PT14-16 | Revisar la formulación y el detalle de una elaboración | Automatizada | No muestran cantidades; los datos siguen en la base | `hu14.formulacion-oculta` (7: lectura y editor sin campos ni textos de cantidad; guardar sin cambios, agregar o quitar reenvía las cantidades tal como vinieron, sin ningún `null`; ficha pública y vista previa sin cantidades); `test_gestion_formulacion_hu03.py`: `test_reenviar_las_mismas_cantidades_no_crea_version` (con la versión sin usar y con la usada) y `test_agregar_un_ingrediente_reenviando_las_cantidades_las_conserva_intactas`; adaptadas de HU03 y HU05 (ver a). **Falta la captura `pt14-16_formulacion_sin_cantidades.png`** | Sin cantidad ni unidad en el editor, el historial, la línea y el detalle de la elaboración; las cantidades se conservan y no se crea versión | Aprobado (automatizado); sin captura |
| PT14-17 | Usar la calculadora en un celular | Manual | Usable sin desplazamiento horizontal y con áreas táctiles de 44 px | Ver «PT14-17 y la prueba en celular»; `hu14.menu`: «los enlaces sueltos de la calculadora miden 44 px (min-h-11)» y la verificación estática de 12 px | Capturas de la calculadora completa, con faltantes y del insumo en el celular. **Las respuestas manuales no se informaron** | **PENDIENTE** |

---

### PT14-17 y la prueba en celular

**Dispositivo, sistema operativo y navegador: PENDIENTE** (la hoja de resultados manuales llegó sin completar y no se infieren). Lo que muestran las capturas, sin interpretarlo: una pantalla de teléfono con el tema oscuro, abierta en una pestaña del navegador sobre `192.168.1.28:5175` (HTTP en la red local; el navegador avisa que no es seguro, esperable en desarrollo). El producto es «Completo Italiano», con 5 ingredientes.

**Resultados manuales — todos PENDIENTES (no se inventan):**

| Punto de la hoja | Respuesta |
|---|---|
| Dispositivo / sistema operativo y versión / navegador | **PENDIENTE** |
| PT14-17: sin desplazamiento horizontal | **PENDIENTE** (las capturas no permiten comprobarlo por sí solas) |
| PT14-17: áreas táctiles cómodas | **PENDIENTE** |
| PT14-17: editar cantidad | **PENDIENTE** (la captura `4.22.41 PM` muestra una cantidad cargada, no la acción de editarla) |
| PT14-17: elegir otro insumo | **PENDIENTE** (la captura `4.18.42 PM` muestra «Elegido ahora (no se guarda)») |
| PT14-17: guardar | **PENDIENTE** |
| PT14-17: editar insumo y volver | **PENDIENTE** |
| PT14-08 en pantalla: $250, $220 y $750 visibles | **PENDIENTE** |
| Observaciones | **PENDIENTE** |

**Capturas en `docs/test/validacion_hu14/`.** Los archivos llegaron con nombres de WhatsApp, no con los esperados; **no se movieron ni renombraron**. Correspondencia según el contenido de cada captura:

| Nombre esperado | Archivo existente | Qué muestra |
|---|---|---|
| `pt14-17_calculadora_completa.jpg` | `WhatsApp Image 2026-11-18 at 4.17.42 PM.jpeg` | Encabezado («Herramientas», «Calculadora de costos»), selector «Completo Italiano», aviso de estimación y el inicio de la tarjeta («5 ingredientes», «Guardado») |
| `pt14-17_calculadora_completa.jpg` (continuación) | `… 4.17.43 PM.jpeg`, `… 4.17.43 PM (1).jpeg`, `… 4.17.43 PM (2).jpeg` | Las líneas: Vienesa ($4.950), Palta Hass, Tomate ($3.150), Mayonesa ($853) y Pan de Completo ($4.975), con origen del insumo, «$ / contenido · fuente · fecha», «Editar insumo», «Actualizar desde Jumbo», cantidad con unidad y costo de la línea |
| `pt14-17_calculadora_completa.jpg` (continuación) | `… 4.17.44 PM.jpeg` | «Otros costos por tanda» vacío, rendimiento 20, Ingredientes $22.590, Otros costos $0, tarjeta verde (tanda $22.590, unidad $1.130, «Calculado»), «Precio más antiguo considerado: 17 nov 2026», «Ver detalle del producto» y la nota de privacidad |
| `pt14-17_calculadora_faltantes.jpg` | `… 4.18.42 PM.jpeg` | «Harina de Trigo» con «Elegido ahora (no se guarda)», sin cantidad: «Pendiente» en rojo y «Falta la cantidad del ingrediente en la tanda»; «Polvos de Hornear» con «Sin precio» |
| `pt14-17_editar_insumo.jpg` | `… 4.18.42 PM (1).jpeg` | **No es el formulario de edición**: es el detalle del insumo «Harina Selecta…», sección «Precio y contenido» ($1.350 · Jumbo · 18-11-2026; 1 kg · Jumbo) con «Actualizar precio desde Jumbo». La captura del formulario de edición y del regreso a la calculadora no existe |
| *(sin nombre esperado)* | `… 4.22.41 PM.jpeg` | Un ingrediente de prueba («Insumo de Prueba · Prueba», $1.000 / 1.000 unidad, Manual, 18 nov 2026) con 250 unidad = $250 |
| `pt14-13_detalle_calculado.png` | **no existe** | — |
| `pt14-16_formulacion_sin_cantidades.png` | **no existe** | — |
| `pt14-08_conversiones.png` | **no existe** | — (la `4.22.41 PM` es otro caso; ver PT14-08) |
| `ci_verde_hu14.png` | **no existe aún** (esperado) | — |

**Observaciones que se desprenden de las capturas (no son resultados manuales informados):**

- **El selector de unidad corta el texto «unidad»:** en la captura se lee «unidac» en las líneas con unidad «unidad» (cuatro capturas). El ancho fijo del selector (76 px, T14-06) deja «unidad» sin entrar completo con la flecha, aunque en el reporte del ajuste visual se esperaba que cupiera. Es un ajuste pendiente; no se tocó en T14-08.
- **Caso real de la limitación ±$1:** con los valores de las capturas, el costo de la línea de la palta no está a la vista, pero se deduce (7 unidad de un insumo de 4 unidad a $4.950 = $8.662,5, que se muestra como $8.663). Las líneas mostradas suman $22.591 y el total mostrado es $22.590 (22.590,357). Ver la limitación sobre la diferencia de $1.
- **«Salchicha Sureña San Jorge 1 kg 20 un.»** (Vienesa, 1 kg → $4.950) ilustra la limitación del contenido único (un insumo guarda un solo contenido, 1 kg o 20 unidades).

---

## c) Escenarios adicionales

| Escenario | Prueba | Resultado |
|---|---|---|
| **CA13 — «Actualizar desde Jumbo» por línea.** Solo con el insumo activo y slug de Jumbo; una consulta por clic; confirmación si el precio es manual; recalcula conservando el insumo alternativo y lo escrito; 409 junto a la línea | `hu14.calculadora`, bloque «Actualizar desde Jumbo en la línea (CA13)» (11): «aparece solo si el insumo está activo y su ficha tiene slug de Jumbo», «no aparece si el insumo está inactivo…», «si falla la consulta de la ficha, el botón no se ofrece», «con un precio de Jumbo actualiza sin confirmar, queda «Actualizando…» y luego recalcula», «cada clic hace una sola consulta…», «si el precio actual es manual pide confirmación; «Conservar mi precio» no consulta Jumbo», «con precio manual, «Reemplazar precio» actualiza y recalcula», «recalcula conservando el insumo alternativo elegido», «un 409 se muestra junto a la línea y no cambia nada ni recalcula», «un error de red lo dice en la línea…», «los cambios sin guardar no se pierden…». El endpoint: `test_insumo_costos_hu14.py` (`test_actualizar_el_precio_desde_jumbo_con_exito`, `test_actualizar_sobrescribe_un_precio_manual`, los 409 sin cambios, `test_el_insumo_de_otro_productor_responde_404_sin_consultar_a_jumbo`); en el insumo: `hu14.insumo-precio`, bloque «botón «Actualizar precio desde Jumbo»» (8) | Aprobado (E) |
| **Parser de contenido** («1 kg», «500 g», «1 L», «12 un», `N x Q` normalizado; lo ambiguo queda nulo, nunca adivinado) | `test_contenido_parser_hu14.py` (84, parametrizadas), entre ellas `test_lo_que_no_entiende_o_es_ambiguo_es_none_nunca_adivina` (incluye «1.000 g»); mutación T14-03 a) | Aprobado (E) |
| **Insumo alternativo fuera de la URL** (solo en el estado del componente; el servidor no lo guarda) | `hu14.calculadora`: «elegir otro insumo recalcula con ?insumo=… y no toca la URL», «al guardar mantiene el insumo elegido en el cálculo…», «cambiar de insumo no pierde lo que se estaba escribiendo», «al cambiar de producto el insumo alternativo se olvida»; backend: `test_el_put_acepta_el_insumo_alternativo_y_tampoco_lo_guarda`; mutación T14-06 b) | Aprobado (E) |
| **Guardado solo de lo cambiado** (solo las líneas modificadas, el rendimiento si cambió, la lista completa de otros costos si cambió; `null` borra) | `hu14.calculadora`: «guarda solo la línea que cambió, con punto decimal, y muestra el cálculo nuevo», «cambiar el rendimiento envía solo el rendimiento; vaciarlo envía null», «borrar la cantidad la quita: se envían cantidad y unidad en null»; `hu14.insumo-precio`: «sin cambios no se envía nada», «vaciar el precio envía null…» | Aprobado (E) |
| **Reenvío de cantidades sin crear versión — backend** | `test_gestion_formulacion_hu03.py`: `test_reenviar_las_mismas_cantidades_no_crea_version` (con la versión sin usar y con la usada) y `test_agregar_un_ingrediente_reenviando_las_cantidades_las_conserva_intactas` | Aprobado en PostgreSQL y SQLite (E) |
| **Reenvío de cantidades sin crear versión — frontend** (el editor conserva el texto de la API, «500.000», que el backend toma como idéntico) | `hu14.formulacion-oculta`: «guardar SIN cambios reenvía cantidad, unidad y notas tal como vinieron, sin ningún null», «agregar un ingrediente reenvía las cantidades guardadas intactas y la línea nueva viaja sin cantidad», «quitar un ingrediente conserva las cantidades de los demás», «una formulación sin cantidades se guarda sin cantidades…»; mutación T14-07 a) | Aprobado (L hoy) |
| **Fechas en hora de Chile** (`America/Santiago`, horario de verano e invierno; marca sin zona = UTC; solo fecha = tal cual) | `hu14.dinero` (66): verano (UTC-3) `01:30Z` → 12-11, `02:59:59Z` → 12-11, `03:00Z` → 13-11; invierno (UTC-4) `03:59:59Z` → 12-07, `04:00Z` → 13-07; cambio de horario del 6-09-2026; desfases explícitos; fecha larga «18 nov 2026»; `hu14.insumo-precio`: «la fecha del precio es la de Chile: 01:30 UTC del 13-11 es el 12-11…»; `hu14.calculadora`: «el precio más antiguo se muestra como en el diseño y en hora de Chile» | Aprobado (E) |
| **Redondeo HALF_UP sobre texto** (sin `number` ni `float`; el medio exacto sube también con negativos, igual que `Decimal`) | `hu14.dinero`: casos límite `0.4999`, `0.5000`, `999.5000` → $1.000, `9007199254740993.4000` y `1.4999999999999999999` (donde `Number()` falla); backend: `test_el_medio_exacto_sube_con_half_up_donde_float_lo_hace_bajar`, `test_redondear_pesos_es_half_up`, `test_el_modulo_no_usa_float_en_ninguna_parte` y `test_este_archivo_de_pruebas_tampoco_usa_float` (revisión por AST); mutaciones T14-04 c) y T14-06 d) | Aprobado (E) |
| Decimales como texto con decimales fijos (4 costos, 2 precios y montos, 3 cantidades) | `test_los_decimales_viajan_como_texto_con_decimales_fijos`; `test_los_valores_de_dinero_quedan_con_cuatro_decimales` | Aprobado (E) |
| Número de consultas constante (GET de costos 8, 9 con elaboración finalizada; detalle 5 sin costo y 12 con él) | `test_el_numero_de_consultas_es_el_mismo_con_2_y_con_8_lineas`, `test_el_numero_de_consultas_tampoco_depende_de_las_alternativas`, `test_el_numero_de_consultas_del_get_y_del_detalle_no_depende_del_numero_de_lineas`, `test_sin_rendimiento_o_sin_formulacion_el_detalle_no_hace_consultas_de_costos` | Aprobado (E) |
| Productos a granel sin precio ni contenido (por la búsqueda, por «granel» en el nombre o por un gtin de circulación restringida de GS1) | `test_un_producto_a_granel_queda_sin_precio_ni_contenido`, `test_un_granel_que_no_dice_granel_se_detecta_por_el_prefijo_de_circulacion_restringida`, `test_un_gtin_normal_o_inutilizable_no_hace_pasar_el_producto_por_granel`, `test_un_producto_a_granel_responde_409_sin_cambios` | Aprobado (E) |
| Migración 019: upgrade, restricciones, `upgrade → downgrade → upgrade` y downgrade que se niega con cualquier dato nuevo | `test_migracion_019_costos_hu14.py` (18, PostgreSQL); `test_costos_modelo_hu14.py` (27, SQLite y PostgreSQL); la prueba de coincidencia modelo-migración | Aprobado (E) |
| Estados y errores de la calculadora (sin productos, sin producto, sin formulación, carga, 404, red y 5xx con «Reintentar», 422 junto a su línea o como aviso general) | `hu14.calculadora`, bloques «estados» (9) y «edición y guardado» (16 casos, dos de ellos parametrizados) | Aprobado (E) |
| Tamaños: ningún texto menor a 12 px y controles de 44 px | `hu14.menu`: «ningún archivo usa text-[10px] ni text-[11px]», «los enlaces sueltos de la calculadora miden 44 px (min-h-11)»; `ht07.bloque4` (11) | Aprobado (E) |

---

## d) Cobertura CA1 … CA13

| CA | Criterio | Pruebas que lo cubren | Estado |
|---|---|---|---|
| CA1 | Página propia con selector de producto; se abre desde el detalle | PT14-01; `hu14.menu` (5); `hu14.calculadora`: encabezado y selector | Cumplido (automatizado). La usabilidad en celular: PENDIENTE (PT14-17) |
| CA2 | Líneas = ingredientes de la formulación vigente | PT14-02 | Cumplido |
| CA3 | Preselección (última elaboración finalizada → habitual → sin insumo) y selector que no guarda | PT14-03, PT14-04; mutaciones T14-04 d) y T14-06 b) | Cumplido (con captura) |
| CA4 | Cantidad y unidad por tanda, guardadas en el producto, sin versiones | PT14-05; mutación T14-05 a) | Cumplido |
| CA5 | Precio y contenido desde Jumbo u Open Food Facts, con fuente y fecha, editables en el insumo; el cambio se refleja en los productos | PT14-06, PT14-07; `hu14.insumo-precio` (31); `test_insumo_costos_hu14.py` (57). El efecto en varios productos no tiene prueba con dos productos (ver PT14-07) | Cumplido (con captura) |
| CA6 | Conversión solo dentro de la misma magnitud | PT14-08, PT14-09; mutación T14-04 a) | Cumplido. En pantalla, $250/$220/$750: PENDIENTE |
| CA7 | Otros costos por tanda, con nombre y monto | PT14-10; mutación T14-02 c) | Cumplido |
| CA8 | Rendimiento | PT14-11; mutación T14-02 d) | Cumplido (con captura) |
| CA9 | Costo por tanda y por unidad; si falta un dato, se indica cuál y en qué línea, sin total incompleto | PT14-09, PT14-11, PT14-12; mutaciones T14-04 b), T14-06 a) y c) | Cumplido (con captura). La usabilidad en celular: PENDIENTE (PT14-17) |
| CA10 | Detalle del producto con el costo calculado «calculado», sin borrar el manual de HU01 | PT14-13; `hu14.costo-detalle` (9); mutaciones T14-05 b), T14-07 b) y c) | Cumplido (sin captura) |
| CA11 | Estimación con precios vigentes; no modifica elaboraciones ni versiones; fecha del precio más antiguo | PT14-14; `hu14.calculadora`: «el aviso de estimación explica que no toca elaboraciones…» | Cumplido (con captura) |
| CA12 | Cada productor accede solo a sus productos | PT14-15; mutación T14-05 c) | Cumplido |
| CA13 | «Actualizar desde Jumbo» por línea *(criterio agregado por la desarrolladora)* | Sección c), primera fila; `hu14.calculadora` (11) | Cumplido |

**Cambio asociado** (ocultar las cantidades de la formulación): PT14-16; `hu14.formulacion-oculta` (7) y el backend (3); mutaciones T14-07 a) y d). Cumplido (automatizado, sin captura).

---

## e) Mutaciones de T14-02 a T14-07

Todas con copia y restauración, confirmadas con `cmp`. Cada una hace fallar al menos una prueba. Salen de los reportes de cada tarea; **en T14-08 no se hicieron mutaciones nuevas** (solo se documentan las existentes). Las de T14-02 se hicieron en SQLite y PostgreSQL; las de T14-03 a T14-05, en SQLite; las del frontend, en el contenedor.

| Tarea | Mutación | Pruebas que fallan | Observaciones |
|---|---|---|---|
| T14-02 | a) quitar el CHECK de cantidad positiva | `test_cantidad_cero_se_rechaza`, `test_cantidad_negativa_se_rechaza` (SQLite y PG); en PG, además, `test_las_restricciones_del_modelo_coinciden_con_las_de_la_migracion` | Directa |
| T14-02 | b) quitar la unicidad (producto, ingrediente) | `test_par_producto_ingrediente_duplicado_se_rechaza` (SQLite y PG); en PG, además, la de coincidencia modelo-migración | Directa |
| T14-02 | c) permitir monto negativo en otros costos | `test_otro_costo_monto_negativo_se_rechaza` (SQLite y PG) | Directa |
| T14-02 | d) permitir rendimiento 0 | `test_rendimiento_cero_se_rechaza` (SQLite y PG) | Directa |
| T14-03 | a) el parser acepta «1.000 g» | 5: `…nunca_adivinado[1.000 g]`, `[1.250 kg]`, `[0.250 kg]`, `[2.500 ml]`, `[6 x 1.000 ml]` | Directa |
| T14-03 | b) editar el precio no cambia la fuente | 2: `test_editar_el_precio_pasa_la_fuente_a_manual_con_la_fecha_del_cambio`, `test_un_precio_de_cero_es_valido` | Directa |
| T14-03 | c) «actualizar-precio» modifica la base si Jumbo falla | 3: `test_si_jumbo_falla_responde_409_y_la_base_no_cambia` (`sin_conexion` y `timeout`), `test_si_jumbo_responde_error_del_servidor_responde_409_sin_cambios` | La primera corrida no valió (se perdieron las comillas del filtro `-k`); se repitió bien |
| T14-03 | d) el granel toma precio y contenido | 4: `test_un_producto_a_granel_queda_sin_precio_ni_contenido`, `test_un_resultado_de_la_busqueda_marcado_granel_tampoco_tiene_precio_ni_contenido`, `test_la_consulta_de_un_granel_no_trae_costos`, `test_un_producto_a_granel_responde_409_sin_cambios` | No se repitió tras sumar la señal del gtin (GS1): cambiar `granel = False` también rompe las pruebas nuevas |
| T14-04 | a) volumen tratado como masa (ml ↔ g) | 5 | Directa |
| T14-04 | b) total parcial con faltantes | 5 | Directa |
| T14-04 | c) cálculo de la línea con `float` | 2 | Directa |
| T14-04 | d) habitual antes que la última elaboración | 4 | Directa |
| T14-05 | a) el PUT crea una versión | 12 | La mayoría falla por la restricción única de versiones al guardar dos veces; también `test_guardar_cantidades_calcula_y_no_crea_una_version` |
| T14-05 | b) `costo_calculado` sobrescribe `costo_produccion` | 4 | Directa |
| T14-05 | c) sin filtro por productor en GET y PUT | 1: `test_un_producto_de_otro_productor_o_inexistente_es_404_en_get_y_put` | Una sola prueba detecta las dos rutas |
| T14-05 | d) el PUT acepta un ingrediente fuera de la formulación | 2 | Directa |
| T14-06 (E1) | d) `redondearPesos` convierte a `number` y usa `Math.round` | 3: dos de negativos y la de «sin float» | La primera versión solo la detectaban las pruebas de negativos; se agregaron `9007199254740993.4000` y `1.4999999999999999999`, donde `Number()` sí falla, y se repitió |
| T14-06 (E2) | a) mostrar un total con faltantes (`costo_tanda ?? total_otros_costos`) | «sin cálculo completo no muestra ningún total (CA9)» | Se separó a) de c) en dos pruebas, a pedido: con a) no falla la de los faltantes (62 pasan) |
| T14-06 (E2) | b) guardar el insumo alternativo en la URL | «elegir otro insumo… no toca la URL» | Directa |
| T14-06 (E2) | c) no mostrar el faltante en su línea | «lo que falta se lista con texto en SU línea…» | Con c) no falla la del total (62 pasan) |
| T14-06 (E2, repetición sobre la estructura nueva) | a) mostrar total con faltantes | 3: «sin cálculo completo no muestra ningún total», «el recuadro… lista… y cada uno enlaza» y «con faltantes en varias líneas…» | Tras rehacer la composición según el diseño |
| T14-06 (E2, repetición) | b) insumo alternativo en la URL | 1: «elegir otro insumo… no toca la URL» | Ídem |
| T14-06 (E2, repetición) | c) no mostrar el faltante en su línea | 1: «lo que falta se lista con texto en SU línea…» | Ídem |
| T14-06 (ajuste visual) | `w-full` en el campo de la cantidad (verificación de la prueba de ancho) | La verificación estática del ancho del grupo cantidad + unidad | No es una de las cuatro de la tarea: comprueba que la prueba detecta el diseño anterior; se restauró con `cmp` |
| T14-07 | a) enviar cantidad y unidad en `null` al guardar la formulación | 4: tres de `hu14.formulacion-oculta` («guardar SIN cambios…», «agregar un ingrediente…», «quitar un ingrediente…») y «quita líneas y reenvía tal como vinieron…» de HU03 | Directa |
| T14-07 | b) mostrar el costo manual aunque exista el calculado | 3 de `hu14.costo-detalle`: el valor calculado, el manual como referencia y «sin valor manual» | Directa |
| T14-07 | c) sobrescribir el manual del formulario con el calculado | 2: «la etiqueta… muestra el manual…» y «guardar otro cambio no envía el costo…» | Directa |
| T14-07 | d) volver a mostrar la cantidad en el detalle de la elaboración | 1: PT05-15 de HU05 | Directa |

**Mutaciones sugeridas por el contexto (sección 7) y dónde se cubren:** magnitudes distintas → T14-04 a); total parcial → T14-04 b) y T14-06 a); `float` → T14-04 c) y T14-06 d); habitual aunque exista una finalizada → T14-04 d); guardar la elección del selector → T14-06 b); versión nueva al guardar cantidades → T14-05 a); sobrescribir el manual → T14-05 b) y T14-07 c); omitir el filtro por productor → T14-05 c).

---

## f) Decisiones de diseño

Las propuso el agente en la Fase 1 de T14-02 y T14-06 y las aprobó la desarrolladora; CA13 y los ajustes visuales los pidió ella.

1. **Fuentes separadas para precio y contenido.** `precio_fuente` ∈ {`jumbo`, `manual`} y `contenido_fuente` ∈ {`jumbo`, `open_food_facts`, `manual`}: Open Food Facts no tiene precio, y PT14-06 pide que el contenido salga de allí cuando Jumbo no lo tiene. Precio, fuente y fecha son los tres nulos o los tres presentes; igual cantidad, unidad y fuente del contenido (CHECK en la base).
2. **`Decimal` en el backend y texto en el JSON.** Nunca `float` ni número JSON. Costos y totales con 4 decimales, precios y montos con 2, cantidades y contenidos con 3. El frontend no suma ni divide: formatea lo que manda el backend, sobre el texto.
3. **Redondeo solo al mostrar.** Todo se calcula sin redondear (multiplicando antes de dividir, precisión 28); el redondeo a pesos enteros es `ROUND_HALF_UP`, en el frontend sobre los dígitos del texto con acarreo manual.
4. **Preselección con el criterio de HU05.** La última elaboración finalizada (`usos_de_la_ultima_finalizada`: `fecha_elaboracion` desc, `finalizada_at` desc, `id` desc) → el insumo habitual activo → sin insumo. Se reutiliza el método de HU05 para no tener dos definiciones de «última»; el contexto decía «como HU06», y `finalizada_at` solo desempata.
5. **Un insumo inactivo cae al habitual.** Si el insumo de la última elaboración está inactivo, o hoy es de otro ingrediente, se descarta, la línea usa el habitual y lleva el aviso `ultimo_inactivo` («El insumo de la última elaboración ya no está activo»). El selector lista solo insumos activos.
6. **Acción «Actualizar precio desde Jumbo».** En el insumo (`POST /gestion/insumos/{id}/actualizar-precio`) y, por pedido de la desarrolladora, **en cada línea de la calculadora (CA13)**: una consulta a Jumbo por clic, solo si el insumo está activo y su ficha tiene slug, con confirmación si el precio actual es manual; ante un fallo, 409 sin cambios.
7. **Guardado explícito.** Botón «Guardar cambios» y «Descartar», sin guardado automático: cada PUT recalcula con 9 o más consultas, un guardado con retraso puede cruzarse con un cambio de insumo alternativo, y el diseño promete «no modifica elaboraciones». Solo se envía lo que cambió; protección al salir con cambios.
8. **El costo manual de HU01 es un costo por unidad** (`productos.costo_produccion` no lo decía): vive junto a `precio_venta` y `contenido_neto`, y CA10 lo compara con el costo calculado por unidad. No se modifica nunca en la base; la interfaz muestra el calculado con «Calculado» cuando existe y el manual cuando es `null`.
9. **Cantidades ocultas, conservadas y reenviadas.** Se ocultan en la interfaz de la formulación y de la elaboración, sin tocar el backend ni los datos: el editor conserva `cantidad` y `unidad` en el borrador y las reenvía tal como vinieron («500.000», que el backend toma como idéntico y no crea versión); las líneas nuevas viajan sin cantidad. Ocultarlas enviando `null` habría borrado las cantidades y creado versiones.
10. **El downgrade de la 019 se niega.** Se niega, sin tocar nada, si existe cualquier dato nuevo (precio o contenido de un insumo, rendimiento, cantidades u otros costos): todo lo escribió el productor y no se puede reconstruir. Con las tablas vacías solo quita lo que agregó el upgrade.

Otras decisiones tomadas en la Fase 1: la unidad se llama `unidad` (no `un`, como el contexto), porque la API, la base y el diseño ya la usan; del contenido se normaliza solo `N x Q` («6 x 200 ml» = 1200 ml; «Pack 3 x 1 L» = 3 L) y lo que no encaja queda sin contenido; los productos a granel quedan sin precio ni contenido; el insumo alternativo solo vive en el estado del componente; `costo_calculado` solo viaja en el detalle (`GET`) y en la respuesta del `PATCH`; sin rendimiento se muestra el costo por tanda; ruta `/calculadora?producto=<id>`.

---

## g) Diferencias con el diseño

Registradas y aprobadas por la desarrolladora (contexto de HU14, T14-06 y T14-07). El diseño es `docs/diseno/DISEÑOS SPRINT 3/CostCalculator.tsx`; T14-01 lo cubre Figma Make.

- **12 px como mínimo:** todo `text-[10px]` pasa a `text-xs`.
- **Controles de 44 px:** selectores, cantidad, unidad, rendimiento, «Editar insumo», «Actualizar desde Jumbo», «Agregar», el botón de quitar y los enlaces de los faltantes. Las filas quedan más altas que en el prototipo.
- **Sin emojis:** el cuadro de la cabecera usa un ícono de caja (`DESIGN.md` los prohíbe).
- **Guardado explícito** en lugar del «Guardado automático» del diseño (ver f.7). El subtítulo «Tanda de 3,5 kg» se elimina: el contrato no trae ese dato.
- **Varios faltantes por línea:** el diseño mostraba uno; aquí se listan todos, cada uno con su ícono y su texto.
- **Costo por tanda sin rendimiento:** el diseño bloqueaba también la tanda cuando faltaba el rendimiento; aquí la tanda se muestra y la fila de la unidad dice «Indica el rendimiento para ver el costo por unidad». El rendimiento no es un faltante de línea.
- **Recálculo al guardar y no mientras se escribe:** el backend calcula con lo guardado; mientras hay cambios pendientes el resumen dice «Estos valores se recalculan cuando guardas los cambios».
- **Sin mayúsculas forzadas:** `ht07.bloque4` prohíbe `uppercase`; los rótulos salen en minúsculas con la primera mayúscula («Herramientas», «Ingrediente», «Insumo seleccionado»). Volver a las capitales del diseño exigiría cambiar esa regla.
- **Estados que el diseño no tenía:** sin productos, sin producto elegido, sin formulación, carga, error con «Reintentar», producto no encontrado e ingrediente sin insumos disponibles.
- **Otras:** el botón «Actualizar desde Jumbo» por línea (CA13); «Pendiente» en rojo si la línea tiene faltantes; el selector de unidad trae «—» para una línea sin cantidad; el subtítulo de la tarjeta de ingredientes cuenta los ingredientes («5 ingredientes», «1 ingrediente»); en el detalle del producto, con el costo calculado, el manual pasa a llamarse «Costo de producción manual» y se ve como referencia («Valor manual: $800 por unidad»); el aviso de estimación nombra la oferta de Jumbo.

---

## h) Limitaciones

- **El precio de Jumbo puede ser de oferta.** Los datos estructurados (`offers.price`) y la búsqueda (`items[].price`) traen un solo precio, sin precio normal, tachado ni vigencia, y no se distinguen. Por eso el cálculo es una estimación; el productor corrige el precio en el insumo y queda como «manual» con su fecha. La calculadora lo advierte.
- **Los productos a granel quedan sin precio ni contenido** (precio por kilo y contenido de una porción). Se detectan por la búsqueda, por «granel» en el nombre o por un gtin de circulación restringida de GS1; un granel sin esas señales, o consultado solo por su slug, puede no detectarse, y otros productos pesados con prefijo restringido también quedan sin precio automático.
- **Un insumo guarda un solo contenido y no se convierte entre peso y unidades.** Una salchicha de «1 kg 20 un.» tiene contenido de 1 kg o de 20 unidades, no ambos; una receta en unidades con un insumo en kilos da «unidades incompatibles».
- **Diferencia de ±$1 entre el total y la suma de las líneas redondeadas.** Cada importe se redondea solo al mostrar, así que el total mostrado puede diferir en $1 de la suma de las líneas mostradas (ver el caso de las capturas, en b).
- **Sin historial de precios:** el precio es el vigente; solo se muestra la fecha del más antiguo considerado.
- **Los costos se recalculan al guardar, no mientras se escribe.**
- **Las validaciones del par cantidad-unidad de HU03 quedaron probadas sobre el borrador, no en la interfaz:** al ocultar los campos, la pantalla ya no puede provocar esos errores; la regla sigue protegida con `validateDraftLines` y los mismos mensajes.
- **El botón de Jumbo de cada línea consulta el insumo para saber si es de Jumbo.** El cálculo no trae `activo` ni la ficha, así que hay una lectura extra por línea al cargar (si falla, el botón no se ofrece). Alternativa más limpia: agregar `activo` y `tiene_jumbo` a `insumos_disponibles` (un cambio de T14-05 que no se aprobó).
- **Al volver de «Editar insumo» se pierde el insumo alternativo elegido** (no vive en la URL por diseño) y, si había cambios sin guardar, se pide confirmar antes de salir.
- **El costo del detalle usa la preselección**, así que puede diferir del que ve el productor en la calculadora tras elegir otro insumo.
- **El selector de unidad corta «unidad»** en el celular (ver las observaciones de b).
- **Prueba en celular por red local** con HTTP y un solo dispositivo; las respuestas manuales están pendientes. jsdom no mide anchos ni saltos de línea: los anchos, los separadores y la alineación están verificados por clases, no por medidas.

---

## i) Trabajo futuro

- Ofrecer «usar N unidades como contenido» cuando la presentación las indique (por ejemplo, «20 un.»).
- Simulación del cálculo sin guardar (recalcular mientras se escribe).
- Historial de precios.
- Acelerar la suite de PostgreSQL: el job superó los 25 minutos y se amplió el límite a 45 (commit `beecf76`).
- Fuera de alcance (contexto): tandas múltiples, costo por elaboración, márgenes y fórmulas para otros costos.

---

## j) Notas para el informe

- **CA13 lo agregó la desarrolladora** (botón «Actualizar desde Jumbo» en cada línea), tras el diseño aprobado; quedó en la sección 3 del contexto de HU14.
- **La edición del insumo no tenía tarea propia en el Sprint Planning:** se hizo en T14-06 (entrega 1: precio y contenido en el detalle y el formulario del insumo, `?volver=` y «Actualizar precio desde Jumbo»).
- **T14-01 (diseño en Figma) quedó cubierto por el diseño de Figma Make** (`CostCalculator.tsx`); el agente no la hizo.
- **La migración es la 019, no la 018** (el Sprint Planning decía 018; la 018 la tomó HU09 por orden de merge).
- **Horas reales** (estimaciones del agente, sin cronómetro; los ajustes visuales y las correcciones del CI no se midieron): T14-02 ≈ 1,5 h (est. 1,25); T14-03 ≈ 2 h (est. 0,75, 1,25 con la acción de Jumbo); T14-04 ≈ 1,5 h (est. 1,5); T14-05 ≈ 1,5 h (est. 1); T14-06 entrega 1 ≈ 1,5 h (aparte de la calculadora); T14-06 entrega 2 ≈ 5 h (est. 2; con CA13 ≈ 0,7 h y el rediseño ≈ 2 h); T14-07 ≈ 2 h (est. 0,75).

---

## k) Incidencias

- **CI del frontend, `hu13.sin-cdn`:** un comentario de `lib/costosInsumo.ts` escribía el nombre de una fuente fuera de `lib/fuentesInsumo.ts`. Se reescribió el comentario (commit `d0f4e91`).
- **CI del frontend, `ht07.bloque4`:** la calculadora usaba `uppercase`, que HT07 prohíbe, en la etiqueta «Herramientas», los encabezados de columna y los rótulos; se quitó. Viajó en el commit de T14-07.
- **Fechas en UTC:** una fecha como `2026-11-13T01:30:00Z` se mostraba como 13-11 y en Chile es el 12-11; se corrigió con `Intl.DateTimeFormat` y `America/Santiago` (commit `ad8eb31`). Se corrigió además una prueba propia de la entrega 1 que daba por UTC el 01-01-2026 (en Chile es el 31-12-2025).
- **Vitest en el host:** falla en `src/test/setup.ts`; las pruebas del frontend se corren en el contenedor.
- **Dos corridas de PostgreSQL a la vez** (una quedó viva en segundo plano) hicieron fallar una corrida de `test_costos_api_hu14.py` en T14-05; no cuenta y se repitió sola.
- **Job de PostgreSQL del CI:** superó el límite de 25 minutos y se amplió a 45 (commit `beecf76`).
- **Acceso desde el celular (18-11-2026):** no cargaba la aplicación. El firewall de Windows bloqueaba los puertos 5175 y 8010 (la desarrolladora creó la regla de entrada) y la API rechazaba el origen del frontend porque `CORS_ORIGINS` del `.env` llevaba una barra final en `http://192.168.1.28:5175/`; se quitó la barra y se recreó el contenedor del backend (`docker compose up -d backend`, sin tocar volúmenes). El `.env` no está en el repositorio. La IP del equipo está escrita fija en `VITE_API_URL` y `CORS_ORIGINS`: si el router le asigna otra, hay que actualizarlas.
- **Capturas con nombre distinto del esperado:** llegaron con nombres de WhatsApp; se citan con su nombre real, sin moverlas. Faltan `pt14-13_detalle_calculado.png`, `pt14-16_formulacion_sin_cantidades.png` y `pt14-08_conversiones.png`, y `ci_verde_hu14.png` aún no existe.
- **Código sin uso retirado en T14-08:** se quitó `formatFormulacionCantidad` de `lib/formulationUtils.ts` (sin usos en `src`; solo aparece su nombre en una expresión regular de `hu14.formulacion-oculta`, que sigue vigilando que la ficha pública no lea cantidades). Sin cambios de comportamiento.
