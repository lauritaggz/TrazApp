# ADR-02: Conservación de la información histórica de cada elaboración

**Estado:** aceptada (validada con el prototipo de RT-01, Hito 1; completada en el Sprint 2)

**Contexto:** RF-03 y RF-07 exigen que un cambio posterior en la receta o en un insumo no altere lo registrado en elaboraciones anteriores (RNF-01). Es el riesgo técnico principal del proyecto (RT-01).

**Alternativas:** sobrescribir la información vigente; copia completa por elaboración; versionamiento con referencias históricas.

**Decisión:** versionamiento con referencias históricas para la formulación (un cambio sobre una versión ya usada crea una nueva versión del producto) y, al finalizar cada elaboración, una copia inmutable de la información de los insumos utilizados. Las elaboraciones finalizadas no pueden modificarse, y la base de datos lo refuerza con restricciones y triggers.

**Consecuencias:** la elaboración y la ficha pública se reconstruyen sin cambios (0 diferencias en PT10-08 y en el caso completo). Se duplica la información de los insumos por elaboración, un volumen aceptable para el MVP. Las migraciones del modelo deben preservar la información conservada (RT-04).

## Evaluación de las alternativas

| Alternativa | Ventajas | Limitaciones |
|---|---|---|
| Sobrescritura de la información vigente | Implementación sencilla | No conserva el estado histórico |
| Copia completa por elaboración | Conserva el estado de cada elaboración | Duplicación considerable de datos |
| Versionamiento con referencias históricas | Conserva el historial, evita duplicación y permite reconstruir relaciones | Exige diseñar correctamente las relaciones de persistencia |

Fuente: informe, secciones 22.5, 23.3 y 27.

## Matriz de decisión ponderada

La decisión sobre la información de los insumos, que cambia fuera del control del productor, se tomó en el Sprint 2 (informe, sección 33.3.6): la copia al finalizar reemplazó el versionamiento de ingredientes del prototipo. Puntajes de 1 a 5.

| Criterio | Peso | Sobrescritura | Versionar ingredientes e insumos (prototipo RT-01) | Copiar la información del insumo al finalizar |
|---|---|---|---|---|
| Conservación de lo registrado ante cambios (RNF-01) | 40 % | 1 | 5 | 5 |
| Consulta de lo usado en una elaboración (RF-08, RF-11) | 20 % | 1 | 3 | 5 |
| Volumen de datos duplicados | 15 % | 5 | 4 | 3 |
| Complejidad para el productor y para el modelo | 25 % | 5 | 2 | 4 |
| **Puntaje ponderado** | 100 % | 2,60 | 3,70 | **4,45** |

**Justificación de los puntajes**
- *Conservación:* sobrescribir pierde el estado anterior; las otras dos alternativas lo conservan, como mostró PT10-08 (0 diferencias).
- *Consulta:* con la copia, la elaboración se lee directamente; con versiones hay que resolver qué versión de cada ingrediente e insumo correspondía.
- *Duplicación:* la copia repite la información del insumo en cada elaboración; el volumen del MVP es bajo.
- *Complejidad:* versionar insumos obliga al productor a gestionar versiones de productos comerciales que no controla.
