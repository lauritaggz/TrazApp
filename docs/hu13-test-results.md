# HU13 — Resultados de pruebas (T13-08)

> **Estado: esqueleto.** Se crea durante T13-01 para no perder lo que ya se decidió. En T13-08 se completan el resumen de ejecución, la trazabilidad CA01 … CA13 y PT13-01 … PT13-15, las mutaciones y la prueba en celular real.

---

## Resumen de ejecución

*Pendiente (T13-08).* Se completará con los números de las suites de backend (SQLite y PostgreSQL) y de frontend, y con el resultado de `npm run build`.

---

## Dependencias y licencias

| Paquete | Versión | Licencia | Para qué |
|---|---|---|---|
| `@undecaf/barcode-detector-polyfill` | **0.9.23** (fijada con `--save-exact`, sin `^`) | MIT | Lector de EAN-13, EAN-8 y UPC-A en los navegadores sin `BarcodeDetector` nativo (Safari para iOS) |
| `@undecaf/zbar-wasm` | **0.9.16** (la trae el polyfill) | **LGPL-2.1+** | Decodificador ZBar compilado a WebAssembly (`zbar.wasm`) |
| `jschardet` | 3.1.4 (la declara `zbar-wasm`) | **LGPL-2.1+** | Se instala, pero su código no llega al build del navegador |

**Licencia LGPL-2.1+ de `zbar-wasm` (y de `jschardet`, su dependencia).** Detalle completo en [`licencias-terceros.md`](licencias-terceros.md). El código de ambos no se modifica: se usan tal como se publican en npm. `jschardet` se instala pero no está en el build del navegador. En el build **se carga como módulo separado del código de la aplicación**: va en un chunk propio, junto con el polyfill, que se descarga bajo demanda mediante un `import()` diferido (solo cuando el navegador no tiene el detector nativo y el productor abre el escáner), y el binario `zbar.wasm` es un archivo aparte (`assets/zbar-<hash>.wasm`). El README del polyfill indica que empaquetar `zbar-wasm` en un proyecto no incumple los requisitos de la LGPL. Código fuente y licencia: https://github.com/undecaf/zbar-wasm. El polyfill es MIT; las dos dependencias LGPL llegan solo a través de él.

*Pendiente (T13-08):* decidir si se agrega un aviso de terceros visible en la aplicación o en el repositorio con el texto de la licencia y el enlace al código fuente. Esto es una nota técnica, no una asesoría legal.

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

Esta verificación no reemplaza la prueba con una cámara real en Chrome para Android y Safari para iOS (T13-07).

---

## Registro del código, la fuente y la fecha de recuperación (T13-06, CA11)

- **Regla (backend):** `POST /gestion/insumos` con una `fuente` distinta de `manual` y sin `fecha_recuperacion` responde **422** con `{"mensaje", "campo": "fecha_recuperacion"}` y no guarda nada. Un insumo manual no exige fecha. Ninguna prueba de HU04 cambió: todas las que enviaban una fuente externa ya traían la fecha. Por ahora la regla vale para el alta; `PATCH` todavía acepta `fuente` sin fecha (quedó fuera del alcance de la tarea).
- **De punta a punta** (`test_registro_desde_codigo_hu13.py`, SQLite y PostgreSQL, leyendo desde una sesión independiente): consulta con una respuesta grabada → registro con los datos de la propuesta → el insumo guarda `codigo_barras`, `fuente = open_food_facts`, `fecha_recuperacion`, la ficha con la URL de la fuente y los alérgenos con su tipo, ya revisados. Los registros manuales siguen con fuente `manual` y sin fecha ni ficha.
- **Información conservada:** al finalizar una elaboración, la copia de un insumo recuperado conserva su `codigo_barras` (y no la ficha, la fuente ni la fecha). Cambiar o desactivar el insumo después no la altera.
- **Detalle del insumo (frontend):** bloque «Origen de la información»: «Registrado manualmente» o «Obtenido de Open Food Facts el dd-mm-aaaa» (fecha en la hora de Chile) con el enlace a la ficha de la fuente, que se abre en otra pestaña con `rel="noopener noreferrer"`. Solo se enlazan direcciones http(s) (la ficha la envía el cliente al registrar, así que un `javascript:` no se convierte en enlace). El nombre visible de cada fuente sale de `src/lib/fuentesInsumo.ts`, el único archivo del código que lo escribe; una prueba estática lo exige.

---

## Verificación del `dist/` real (T13-05)

Con el escáner ya en la página «Nuevo insumo» y en el diálogo de la elaboración, `npm run build` incluye el lector. Se comprobó sobre la salida real y queda cubierto por `src/escaner/hu13.dist.test.ts`, que hace el mismo build en una carpeta temporal:

- `dist/assets/zbar-<hash>.wasm` está en la aplicación (239 kB), y ningún archivo publicado nombra una CDN ni importa código desde una URL.
- El decodificador va en un archivo aparte (`main-<hash>.js`, 19,7 kB), cargado con `import()` solo al abrir el escáner. El código que carga primero (501 kB) no lo incluye y `index.html` no lo precarga.
- Lo único externo que pide la hoja de estilos es la tipografía de Google Fonts, que la aplicación ya cargaba antes de HU13. No tiene relación con el escáner.
- Vite emite además `index-<hash>.js` (17 kB), la versión de `zbar-wasm` para etiquetas `<script>`. Nada la importa y no se descarga.

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
9. **La fuente cubre poco:** en la validación de la HT04, 69 % de los productos se encontró, 56 % con ingredientes y 12 % con alérgenos etiquetados. El ingreso manual es indispensable.

### Caso: aceite de girasol (código 7790272001005)

La etiqueta de Open Food Facts dice **«contiene soja»** (`allergens_tags: en:soybeans`) y el texto de ingredientes dice **«PUEDE CONTENER SOJA. PUEDE CONTENER CACAHUETE.»**. Son informaciones que se contradicen. La regla es que **«contiene» gana sobre «trazas», venga de donde venga**: la soja se sugiere como «contiene» (origen `etiqueta`) y el maní, que solo aparece como traza, como «trazas». El productor **lo revisa contra el envase** antes de registrar; la sugerencia nunca marca el insumo como revisado por sí sola.

---

## Pendiente para T13-08

- Resumen de ejecución y números.
- Trazabilidad CA01 … CA13 y PT13-01 … PT13-15.
- Mutaciones verificadas en HU13 (T13-01, T13-03, T13-04, T13-05 …).
- Prueba en Chrome para Android y Safari para iOS (T13-07) y configuración HTTPS de desarrollo.
- Decisión sobre el aviso de licencias de terceros.
