# Medición de HU07 (T07-09, CA13)

La medición replica el flujo de la aplicación: con código, Open Food Facts completado con Jumbo si el código coincide; si no lo encuentra o falla, busca en Jumbo por «nombre marca» y toma el primer resultado; sin código, la búsqueda por nombre.

Productos medidos: 37 (encontrados: 33).
Consultas reales: 0; respuestas desde la caché: 122.

## Resultado de CA13

**CA13 (fichas correctas, con la identidad del producto verificada): 75,7 %** (28/37; meta ≥ 70 %). Una ficha de otro producto no es correcta aunque coincidan los alérgenos. El valor **antes de verificar la identidad** fue 78,4 % (29/37).

| Métrica | Antes de verificar la identidad (1.ª corrida) | **CA13 oficial** (1.ª corrida, identidad verificada) | Con el detector mejorado (identidad verificada) |
|---|---|---|---|
| Recuperación (encontrados) | 100,0 % | 89,2 % | 89,2 % |
| Exactitud (correctas entre los encontrados) | 78,4 % | 84,8 % | 84,8 % |
| **Global** (correctas sobre el total) | 78,4 % | 75,7 % | 75,7 % |
| Con ingredientes | 94,6 % | 83,8 % | 83,8 % |
| Consultas dentro de 10 s | 100,0 % | 100,0 % | 100,0 % |
| Tiempo p90 | 7,27 s | 7,27 s | 7,27 s |

### Verificación de la identidad

- Por código (21): el código identifica el producto.
- Respaldo por nombre (7): se compara el gtin recuperado con el código de la referencia (un gtin vacío cuenta como distinto): 3 coinciden y 4 no.
- Por nombre, sin código (9): revisados a mano por la desarrolladora: 9 son el mismo producto y 0 no.

Productos distintos: **4**: `edra-esencia-vainilla-155ml` (Esencia de Vainilla Gourmet 165 ml, gtin 7802410004288), `lider-harina-integral-2kg` (Harina Integral 1 kg, gtin 7807910038603), `lider-gelatina-sin-sabor-4x7-5g` (Gelatina Sin Sabor Caja en Polvo 30 g, gtin 7802410708247), `maizena-almidon-de-maiz` (Almidón de Maíz Caja 250 g, gtin 7802640102037)

- De ellos, contaban como correctos antes de verificar la identidad: **1**: `lider-harina-integral-2kg`
- Global: 78,4 % → 75,7 % (-1 fichas correctas de 37).
- Recuperación: 100,0 % → 89,2 %. «Con ingredientes» también baja (94,6 % → 83,8 %) porque los ingredientes de un producto distinto no cuentan.

### Mejoras posteriores a la medición (columna 3)

Sobre las mismas respuestas guardadas en la caché (sin nuevas consultas); el valor oficial no cambia.

1. **Etiquetas con prefijo de idioma** (`es:Maní`): ahora se traducen al alérgeno del catálogo.
   - Antes: 1 producto(s) con términos sin reconocer: `cuisine-and-co-mantequilla-de-mani-500g` → es:Maní
   - Después: 0 producto(s) con términos sin reconocer.
2. **Especies de pescado y mariscos** (pejerrey, corvina, lenguado, albacora, tilapia, gamba, centolla, cholga, macha, sepia, caracol, etc., además de las que ya estaban: atún, salmón, jurel, merluza, reineta, camarón, chorito, jaiba): mejora general del detector.
   - Sin efecto en este conjunto: ninguna ficha cambió.

Global con identidad verificada: 75,7 % (oficial) → 75,7 % (detector mejorado).


## Esta corrida (identidad verificada)

| Métrica | Resultado | Meta |
|---|---|---|
| Recuperación (productos encontrados) | 89,2 % (33/37) | — |
| Exactitud (correctas entre los encontrados) | 84,8 % (28/33) | — |
| **Global** (correctas sobre el total; contiene y puede contener exactos) | 75,7 % (28/37) | ≥ 70 % — cumple |
| Con ingredientes (de los que la referencia dice que los tienen) | 83,8 % (31/37) | — |
| Tiempo p90 | 7,27 s | — |
| Consultas dentro de 10 s | 100,0 % (37/37) | ≥ 90 % — cumple |

## Recuperación por camino

| Camino | Encontrados | % |
|---|---|---|
| Por código | 21/21 | 100,0 % |
| Respaldo por nombre (el código no se encontró o la fuente falló) | 3/7 | 42,9 % |
| Por nombre (sin código) | 9/9 | 100,0 % |

## Discrepancias por producto

| Producto | Campo | Esperado | Obtenido | Fuente |
|---|---|---|---|---|
| edra-esencia-vainilla-155ml · Esencia sabor vainilla | producto | mismo producto | producto distinto: Esencia de Vainilla Gourmet 165 ml (gtin 7802410004288) | jumbo |
| walmart-lomitos-de-atun-en-aceite-140g · Lomitos de atún en aceite | contiene | pescado;soja | no_indica | open_food_facts |
| lider-harina-integral-2kg · Harina integral para todo uso | producto | mismo producto | producto distinto: Harina Integral 1 kg (gtin 7807910038603) | jumbo |
| lider-gelatina-sin-sabor-4x7-5g · Gelatina en polvo sin sabor | producto | mismo producto | producto distinto: Gelatina Sin Sabor Caja en Polvo 30 g (gtin 7802410708247) | jumbo |
| natura-aceite-maravilla-900ml · Aceite 100% maravilla | contiene | no_indica | soja | combinada |
| natura-aceite-maravilla-900ml · Aceite 100% maravilla | puede_contener | cacahuetes;soja | cacahuetes | combinada |
| maizena-almidon-de-maiz · Almidón de maíz | producto | mismo producto | producto distinto: Almidón de Maíz Caja 250 g (gtin 7802640102037) | jumbo |
| nutrisa-linaza-molida-mi-tierra · Linaza molida | puede_contener | soja | no_indica | jumbo |
| lefersa-levadura-seca-instantanea · Levadura seca instantánea | puede_contener | frutos_cascara;gluten;huevos;lacteos;sesamo;soja | no_indica | open_food_facts |
| lefersa-levadura-seca-instantanea · Levadura seca instantánea | ingredientes | si | no | open_food_facts |
| iansagro-lentejas-tetra · Lentejas | puede_contener | gluten | gluten;soja | jumbo |
| juan-valdez-cafe-soluble-liofilizado · Café soluble liofilizado | ingredientes | si | no | open_food_facts |

## Discrepancias clasificadas

| Producto | Campo | Alérgeno | Tipo | Causa probable | Fuente |
|---|---|---|---|---|---|
| edra-esencia-vainilla-155ml | producto | — | producto distinto | el primer resultado de la búsqueda no es el producto | jumbo |
| walmart-lomitos-de-atun-en-aceite-140g | contiene | Pescado | omisión | fuente sin dato (ingredientes no visibles) | open_food_facts |
| walmart-lomitos-de-atun-en-aceite-140g | contiene | Soya | omisión | fuente sin dato (ingredientes no visibles) | open_food_facts |
| lider-harina-integral-2kg | producto | — | producto distinto | el primer resultado de la búsqueda no es el producto | jumbo |
| lider-gelatina-sin-sabor-4x7-5g | producto | — | producto distinto | el primer resultado de la búsqueda no es el producto | jumbo |
| natura-aceite-maravilla-900ml | contiene | Soya | exceso | dato incorrecto de la fuente (la informa en la otra clase) | combinada |
| natura-aceite-maravilla-900ml | puede_contener | Soya | omisión | dato incorrecto de la fuente (lo informa en la otra clase) | combinada |
| maizena-almidon-de-maiz | producto | — | producto distinto | el primer resultado de la búsqueda no es el producto | jumbo |
| nutrisa-linaza-molida-mi-tierra | puede_contener | Soya | omisión | fuente sin dato | jumbo |
| lefersa-levadura-seca-instantanea | puede_contener | Nueces | omisión | fuente sin dato | open_food_facts |
| lefersa-levadura-seca-instantanea | puede_contener | Gluten | omisión | fuente sin dato | open_food_facts |
| lefersa-levadura-seca-instantanea | puede_contener | Huevo | omisión | fuente sin dato | open_food_facts |
| lefersa-levadura-seca-instantanea | puede_contener | Leche | omisión | fuente sin dato | open_food_facts |
| lefersa-levadura-seca-instantanea | puede_contener | Sésamo | omisión | fuente sin dato | open_food_facts |
| lefersa-levadura-seca-instantanea | puede_contener | Soya | omisión | fuente sin dato | open_food_facts |
| iansagro-lentejas-tetra | puede_contener | Soya | exceso | dato incorrecto de la fuente | jumbo |

### Resumen por tipo

| Tipo | Cantidad |
|---|---|
| omisión | 10 |
| exceso | 2 |
| producto distinto | 4 |

### Omisiones de «contiene» (lo más grave: el envase dice que lo contiene)

| Producto | Alérgeno omitido | Causa probable | Fuente |
|---|---|---|---|
| walmart-lomitos-de-atun-en-aceite-140g | Pescado | fuente sin dato (ingredientes no visibles) | open_food_facts |
| walmart-lomitos-de-atun-en-aceite-140g | Soya | fuente sin dato (ingredientes no visibles) | open_food_facts |

## Revisados a mano: productos recuperados por nombre

Sin código no se puede verificar el gtin: la identidad viene de `revision_identidad.csv` (revisión a mano).

| Referencia | Recuperado | gtin recuperado |
|---|---|---|
| gourmet-salsa-de-soya · Salsa de soya Gourmet | Salsa de Soya Gourmet 1 L | 7802410700203 |
| gourmet-cacao-amargo · Cacao amargo Gourmet | Chocolate Amargo Gourmet en Polvo 150 g | 7802410605027 |
| nutrisa-linaza-molida-mi-tierra · Linaza molida Mi Tierra | Semilla de Linaza Mi Tierra Bolsa 200 g | 7803500020119 |
| ambrosoli-gelatina-naranja · Gelatina sabor naranja Ambrosoli | Gelatina Ambrosoli Naranja 100 g | 7802200361089 |
| cuisine-and-co-vinagre-manzana-500ml · Vinagre de manzana Cuisine & Co. | Vinagre de Manzana 500 ml | 7807910036937 |
| quillayes-rallado-vegano · Rallado vegano Quillayes | Queso Vegano Quillayes Envasado Granulado 200 g | 7802930004942 |
| iansagro-lentejas-tetra · Lentejas Iansagro | Lentejas 4 mm Iansa Agro 1 kg | 7801505002949 |
| kraft-mayonesa · Mayonesa Kraft | Mayonesa Kraft Real Mayo Regular Frasco 789 g | — |
| kraft-queso-parmesano-rallado-85g · Queso parmesano rallado Kraft | Queso Rallado Kraft Shaker 85 g | — |
