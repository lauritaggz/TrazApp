# A6 · Reportes de seguridad y eficiencia

Comparación de cada escenario de calidad de [`docs/requerimientos.md`](../requerimientos.md) con su resultado medido.

| Escenario | Medida pedida | Resultado | Evidencia | Estado |
|---|---|---|---|---|
| RNF-01 Integridad | 0 diferencias entre la información conservada antes y después de modificar insumos, alérgenos o formulación | 0 diferencias (PT10-08 y caso completo) | [hu10-test-results.md](../test/hu10-test-results.md) · video del flujo: https://youtu.be/RzSH-X8-haY | Cumple |
| RNF-02 Eficiencia | p95 ≤ 2 s en la consulta pública | Local: p95 de 24,9 ms (100 consultas secuenciales). Desplegado, 50 usuarios concurrentes: directo al VPS, p95 de 109 ms y 0 % de errores; a través del proxy de Netlify, 47,2 % de solicitudes fallidas | [validacion_hu10/oe4_resultados.md](../test/validacion_hu10/oe4_resultados.md) · [carga/](carga/README.md) | Cumple en el backend; no cumple por el camino que usa el frontend publicado (DT-12) |
| RNF-03 Seguridad | 100 % de los accesos a recursos de otro productor denegados y 0 hallazgos críticos o altos en el escáner | Pruebas de aislamiento aprobadas en cada historia; tras actualizar dependencias, 0 vulnerabilidades conocidas en `pip-audit` y `npm audit`, y 0 hallazgos altos en `bandit` | `backend/tests/test_auth_jwt_access.py` (acceso sin token) · pruebas de aislamiento entre productores, por ejemplo `test_gestion_insumos_hu04.py` y `test_gestion_elaboraciones_hu05.py` | Cumple (ver [Seguridad](#seguridad)) |
| RNF-04 Seguridad | La respuesta pública tiene exactamente las claves permitidas y ningún valor interno | Conjunto exacto de claves y ningún valor interno (PT10-09) | [hu10-test-results.md](../test/hu10-test-results.md) (`test_lista_blanca_conjunto_exacto_de_claves`) | Cumple |
| RNF-05 Corrección | ≥ 70 % de fichas que coinciden con el envase | 75,7 % (28 de 37) | [validacion_hu07/resultados.md](../test/validacion_hu07/resultados.md) | Cumple |
| RNF-06 Eficiencia | ≤ 10 s en el 90 % de las recuperaciones | 100 % bajo 10 s | [validacion_hu07/resultados.md](../test/validacion_hu07/resultados.md) | Cumple |

## Seguridad

Análisis ejecutado el 26-11-2026 sobre el commit `b9a95ce` de `main`. Los reportes completos, generados por cada herramienta, están en [`seguridad/`](seguridad/).

| Herramienta | Qué analiza | Antes (`b9a95ce`) | Después de actualizar dependencias | Reporte |
|---|---|---|---|---|
| `pip-audit` 2.x | Vulnerabilidades conocidas en las dependencias del backend (`backend/requirements.txt`) | 52 avisos en 5 paquetes: `starlette` 0.45.3 (vía `fastapi`), `pyjwt` 2.10.1, `python-multipart` 0.0.20, `python-dotenv` 1.0.1 y `pytest` 8.3.4 | 0 | [antes](seguridad/antes_b9a95ce/pip-audit.json) · [después](seguridad/despues/pip-audit.json) |
| `npm audit` | Vulnerabilidades conocidas en las dependencias del frontend (`package-lock.json`) | 5: 3 altas (`vite`, `undici`, `source-map-js`) y 2 moderadas (`vitest`, `@vitest/mocker`), todas de herramientas de desarrollo y pruebas, que no forman parte del sitio publicado | 0 | [antes](seguridad/antes_b9a95ce/npm-audit.json) · [después](seguridad/despues/npm-audit.json) |
| `bandit` | Análisis estático del código del backend (11 530 líneas de `backend/app`) | 0 altos, 4 medios y 9 bajos | Sin cambios: el código no se modificó | [reporte](seguridad/antes_b9a95ce/bandit.json) |

### Corrección de dependencias

| Paquete | Versión anterior | Versión nueva |
|---|---|---|
| `fastapi` (y `starlette`) | 0.115.8 (0.45.3) | 0.134.0 (1.10.0) |
| `PyJWT` | 2.10.1 | 2.15.1 |
| `python-multipart` | 0.0.20 | 0.0.34 |
| `python-dotenv` | 1.0.1 | 1.2.4 |
| `pytest` | 8.3.4 | 9.2.0 |
| `vite` | 8.2.2 | 8.4.0 |
| `vitest` y `@vitest/coverage-v8` | 4.1.11 | 4.1.12 |
| `undici` y `source-map-js` (dependencias indirectas) | 8.10.0 y 1.2.1 | 8.13.1 y 1.2.4 |

Las suites completas de backend y frontend se ejecutaron de nuevo con las versiones nuevas antes de proponer el cambio.

### Hallazgos de `bandit` que se mantienen

| Hallazgo | Severidad | Ubicación | Justificación |
|---|---|---|---|
| B608 · posible inyección SQL por construcción de texto | Media (confianza baja) | `app/db/triggers_elaboracion.py` (3) | El texto que se arma es la definición de los triggers de inmutabilidad, con nombres de funciones y mensajes que son constantes del propio módulo; no incluye datos de usuarios. |
| B104 · enlace a todas las interfaces | Media | `app/core/config.py` | `0.0.0.0` es necesario dentro del contenedor; el servicio no se expone directamente: Caddy es el único punto de entrada y PostgreSQL solo es accesible desde el servidor. |
| B105 y B106 · posible contraseña en el código | Baja | `app/services/auth_service.py`, `app/services/evaluacion_service.py` | Son la palabra `bearer` del esquema de autenticación y un mensaje de error, no credenciales. |
| B101 · uso de `assert` | Baja | 7 ubicaciones | Comprobaciones de que un valor ya validado antes no es nulo o tiene el tipo esperado; no controlan permisos ni validan datos de entrada. |

## Brechas declaradas

| Brecha | Escenario | Plan |
|---|---|---|
| Con 50 usuarios concurrentes, el proxy de Netlify corta el 47,2 % de las consultas públicas antes de que lleguen al backend | RNF-02 | Que el frontend consulte la API directamente en el dominio del VPS (con CORS para `trazapp.netlify.app`) y repetir la prueba por ese camino |
| No hay escaneo dinámico de la API desplegada | RNF-03 | Ejecutar OWASP ZAP en modo baseline contra la API desplegada y dejar el reporte en `seguridad/` |

Las dos brechas se registran como deuda técnica (DT-12 y DT-03) en [`docs/riesgos.md`](../riesgos.md).
