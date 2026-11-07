# Medición de HU07 (T07-09, CA13)

La medición replica el flujo de la aplicación: con código, Open Food Facts completado con Jumbo si el código coincide; si no lo encuentra o falla, busca en Jumbo por «nombre marca» y toma el primer resultado; sin código, la búsqueda por nombre.

Productos medidos: 37 (encontrados: 37).
Consultas reales: 10; respuestas desde la caché: 112.

| Métrica | Resultado | Meta |
|---|---|---|
| Recuperación (productos encontrados) | 100.0 % (37/37) | — |
| Exactitud (correctas entre los encontrados) | 78.4 % (29/37) | — |
| **Global** (correctas sobre el total; contiene y puede contener exactos) | 78.4 % (29/37) | ≥ 70 % — cumple |
| Con ingredientes (de los que la referencia dice que los tienen) | 94.6 % (35/37) | — |
| Tiempo p90 | 7.27 s | — |
| Consultas dentro de 10 s | 100.0 % (37/37) | ≥ 90 % — cumple |

## Recuperación por camino

| Camino | Encontrados | % |
|---|---|---|
| Por código | 21/21 | 100.0 % |
| Respaldo por nombre (el código no se encontró o la fuente falló) | 7/7 | 100.0 % |
| Por nombre (sin código) | 9/9 | 100.0 % |

## Discrepancias por producto

| Producto | Campo | Esperado | Obtenido | Fuente |
|---|---|---|---|---|
| edra-esencia-vainilla-155ml · Esencia sabor vainilla | puede_contener | cacahuetes;frutos_cascara;gluten;lacteos;sesamo;soja;sulfitos | apio;gluten;huevos;lacteos;mostaza;sesamo;soja | jumbo |
| walmart-lomitos-de-atun-en-aceite-140g · Lomitos de atún en aceite | contiene | pescado;soja | no_indica | open_food_facts |
| lider-gelatina-sin-sabor-4x7-5g · Gelatina en polvo sin sabor | puede_contener | cacahuetes;frutos_cascara;gluten;huevos;lacteos;soja;sulfitos | apio;crustaceos;gluten;huevos;lacteos;mostaza;sesamo;soja | jumbo |
| natura-aceite-maravilla-900ml · Aceite 100% maravilla | contiene | no_indica | soja | combinada |
| natura-aceite-maravilla-900ml · Aceite 100% maravilla | puede_contener | cacahuetes;soja | cacahuetes | combinada |
| maizena-almidon-de-maiz · Almidón de maíz | contiene | sulfitos | no_indica | jumbo |
| nutrisa-linaza-molida-mi-tierra · Linaza molida | puede_contener | soja | no_indica | jumbo |
| lefersa-levadura-seca-instantanea · Levadura seca instantánea | puede_contener | frutos_cascara;gluten;huevos;lacteos;sesamo;soja | no_indica | open_food_facts |
| lefersa-levadura-seca-instantanea · Levadura seca instantánea | ingredientes | si | no | open_food_facts |
| iansagro-lentejas-tetra · Lentejas | puede_contener | gluten | gluten;soja | jumbo |
| juan-valdez-cafe-soluble-liofilizado · Café soluble liofilizado | ingredientes | si | no | open_food_facts |
