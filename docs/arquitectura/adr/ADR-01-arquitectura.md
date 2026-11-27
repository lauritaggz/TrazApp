# ADR-01: Estilo de arquitectura

**Estado:** aceptada (Hito 1)

**Contexto:** el MVP se desarrolla de forma individual, en tres sprints, con un volumen de datos bajo a moderado. Se necesita separar las reglas de conservación de la información (RNF-01) y el aislamiento entre productores (RNF-03) de la presentación y la persistencia, sin agregar complejidad operacional.

**Alternativas:** monolítica; en capas; hexagonal; microservicios.

**Decisión:** monolito modular organizado en capas (presentación, aplicación, lógica de negocio y persistencia). Los módulos (productos e ingredientes, formulación y versiones, insumos comerciales, recuperación de información, elaboraciones, elaboraciones relacionadas y consulta pública) forman parte de una misma aplicación.

**Consecuencias:** un solo backend que desplegar y probar; la separación por capas permite probar la lógica de negocio de forma aislada. Los componentes no escalan de forma independiente, lo que no es una necesidad del MVP.

## Evaluación de las alternativas

| Alternativa | Ventajas | Limitaciones para TrazApp |
|---|---|---|
| Monolítica | Desarrollo y despliegue simples | Puede aumentar el acoplamiento sin una organización interna |
| En capas | Separación clara de responsabilidades y facilidad de mantenimiento | Los componentes no escalan de forma independiente |
| Hexagonal | Alta separación entre lógica de negocio e infraestructura | Complejidad adicional para el alcance actual |
| Microservicios | Independencia y escalabilidad por servicio | Mayor complejidad de despliegue, comunicación y mantenimiento |

Fuente: informe, sección 15.

## Matriz de decisión ponderada

Puntajes de 1 a 5.

| Criterio | Peso | Monolito modular en capas | Hexagonal | Microservicios |
|---|---|---|---|---|
| Esfuerzo de desarrollo y despliegue para una persona en tres sprints | 40 % | 5 | 3 | 1 |
| Separación de la lógica de conservación y aislamiento (RNF-01, RNF-03) | 35 % | 4 | 5 | 4 |
| Facilidad de prueba de la lógica de negocio | 25 % | 4 | 5 | 3 |
| **Puntaje ponderado** | 100 % | **4,40** | 4,20 | 2,55 |

**Justificación de los puntajes**
- *Esfuerzo:* el monolito en capas es un solo backend que desplegar; la hexagonal agrega puertos y adaptadores en todas las capas; los microservicios exigen desplegar y comunicar varios servicios.
- *Separación:* las capas separan la lógica de negocio de la API y la persistencia; la hexagonal la aísla además de toda la infraestructura.
- *Prueba:* los servicios se prueban sin la API (por ejemplo, `test_formulacion_vigente_hu03.py`); en microservicios, los flujos completos cruzan servicios.
