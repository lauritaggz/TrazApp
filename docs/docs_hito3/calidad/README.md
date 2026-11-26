# A6 · Reportes de seguridad y eficiencia

Comparación de cada escenario de calidad de [`docs/requerimientos.md`](../requerimientos.md) con su resultado medido.

| Escenario | Medida pedida | Resultado | Evidencia | Estado |
|---|---|---|---|---|
| RNF-01 Integridad | 0 diferencias entre la información conservada antes y después de modificar insumos, alérgenos o formulación | 0 diferencias (PT10-08 y caso completo) | [hu10-test-results.md](../test/hu10-test-results.md) · video del flujo: https://youtu.be/RzSH-X8-haY | Cumple |
| RNF-02 Eficiencia | p95 ≤ 2 s en la consulta pública | p95 de 24,9 ms con 100 consultas secuenciales en local; 0 fallidas | [validacion_hu10/oe4_resultados.md](../test/validacion_hu10/oe4_resultados.md) | Parcial: falta prueba de carga con usuarios concurrentes sobre el ambiente desplegado |
| RNF-03 Seguridad | 100 % de los accesos a recursos de otro productor denegados y 0 hallazgos críticos o altos en el escáner | Pruebas de aislamiento aprobadas en cada historia | `backend/tests/test_auth_jwt_access.py` (acceso sin token) · pruebas de aislamiento entre productores, por ejemplo `test_gestion_insumos_hu04.py` y `test_gestion_elaboraciones_hu05.py` | Parcial: falta el reporte del escáner de seguridad |
| RNF-04 Seguridad | La respuesta pública tiene exactamente las claves permitidas y ningún valor interno | Conjunto exacto de claves y ningún valor interno (PT10-09) | [hu10-test-results.md](../test/hu10-test-results.md) (`test_lista_blanca_conjunto_exacto_de_claves`) | Cumple |
| RNF-05 Corrección | ≥ 70 % de fichas que coinciden con el envase | 75,7 % (28 de 37) | [validacion_hu07/resultados.md](../test/validacion_hu07/resultados.md) | Cumple |
| RNF-06 Eficiencia | ≤ 10 s en el 90 % de las recuperaciones | 100 % bajo 10 s | [validacion_hu07/resultados.md](../test/validacion_hu07/resultados.md) | Cumple |

## Brechas declaradas

| Brecha | Escenario | Plan |
|---|---|---|
| No hay prueba de carga con usuarios concurrentes ni medición sobre el ambiente desplegado | RNF-02 | Ejecutar una prueba de carga con una herramienta que genere reporte contra la consulta pública desplegada, y dejar el reporte en esta carpeta |
| No hay reporte de escáner de seguridad | RNF-03 | Ejecutar un análisis de dependencias del backend y del frontend, y un escáner sobre la API desplegada, y dejar los reportes en esta carpeta |

Las dos brechas se registran como deuda técnica en [`docs/riesgos.md`](../riesgos.md).
