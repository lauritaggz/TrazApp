# ADR-03: Fuente de información de los insumos comerciales

**Estado:** aceptada (Sprint 3, tras la validación técnica de HT04 en el Sprint 2)

**Contexto:** RF-05 y RF-06 buscan evitar que el productor transcriba la ficha de cada insumo. La información recuperada debe coincidir con el envase en al menos el 70 % de los casos (RNF-05) y obtenerse en 10 s o menos (RNF-06). La fuente externa puede cambiar o bloquearse (RT-06) o entregar datos incorrectos (RT-07).

**Alternativas:** solo Open Food Facts por código de barras; solo scraping de un sitio de venta; combinación de Open Food Facts y un sitio de venta; solo ingreso manual.

**Decisión:** por código de barras se consulta Open Food Facts y, con el nombre y la marca obtenidos, se busca el producto en Jumbo.cl, combinando la información solo si el código de barras coincide. Por nombre o marca se busca en Jumbo.cl, cuyo archivo `ai.txt` autoriza el scraping con atribución de la fuente. Cada fuente es un adaptador aislado, la consulta se hace bajo demanda y el ingreso manual está siempre disponible. Nada se registra sin la confirmación del productor.

**Consecuencias:** 75,7 % de fichas correctas (28 de 37) y 100 % de las recuperaciones bajo 10 s. Jumbo no permite buscar por código de barras y no declara alérgenos de forma consistente; la búsqueda por nombre devolvió otro producto en 4 de 37 casos, lo que obliga a verificar la identidad por código y a mantener la confirmación del productor. La lectura de «puede contener» desde Jumbo depende de la estructura de su página.

## Evaluación de las alternativas

| Alternativa | Hecho medido o verificado |
|---|---|
| Solo Open Food Facts | HT04: 69 % de productos encontrados, 56 % con ingredientes y 12 % con alérgenos |
| Solo un sitio de venta (Jumbo.cl) | Publica ingredientes y código de barras (gtin) en datos estructurados, pero no declara alérgenos de forma consistente y no permite buscar por código |
| Open Food Facts + Jumbo.cl | 75,7 % de fichas correctas sobre 37 productos |
| Solo ingreso manual | 14 interacciones para registrar un insumo con toda su información, frente a 5 por código de barras |

Fuente: informe, secciones 33.4.6, 33.6.3, 34.2 y 34.6.2.

## Matriz de decisión ponderada

Puntajes de 1 a 5.

| Criterio | Peso | Solo Open Food Facts | Solo Jumbo.cl | Open Food Facts + Jumbo.cl | Solo ingreso manual |
|---|---|---|---|---|---|
| Fichas que coinciden con el envase (RNF-05) | | | | | |
| Tiempo de recuperación (RNF-06) | | | | | |
| Reducción de la transcripción manual | | | | | |
| Dependencia de una fuente externa (RT-06) | | | | | |
| **Puntaje ponderado** | 100 % | | | | |
