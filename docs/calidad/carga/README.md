# Prueba de carga de la consulta pública (RNF-02)

Escenario: hasta 50 consumidores concurrentes consultan la ficha pública de un producto publicado en el ambiente desplegado, durante 2 minutos de carga sostenida. Medida de respuesta: p95 ≤ 2 s y errores < 1 %.

La consulta pública no escribe en la base de datos: el token de evaluación de HU11 es firmado y no se guarda, así que la prueba no deja registros en el ambiente.

## Cómo ejecutarla

1. Instalar k6: `winget install k6` (Windows) o `brew install k6` (macOS).
2. Obtener el identificador público de un producto publicado: es la parte final de su enlace público, `https://trazapp.netlify.app/p/<ID_PUBLICO>`.
3. Desde esta carpeta:

   ```bash
   k6 run -e BASE_URL=https://trazapp.netlify.app/api -e ID_PUBLICO=<ID_PUBLICO> \
     --summary-export=resultado-carga-AAAA-MM-DD.json consulta_publica.js
   ```

4. Guardar en esta carpeta el JSON que genera k6 y la salida de la consola (`resultado-carga-AAAA-MM-DD.txt`), y anotar el commit desplegado.

## Resultado

Dos corridas el 26-11-2026, desde un computador de escritorio en Chile, contra el backend desplegado en el commit `b9a95ce` (24-11-2026). Mismo escenario y mismo producto publicado; solo cambia el camino de las solicitudes.

| Corrida | Camino | Solicitudes | Fallidas | p95 | Promedio | Máximo | Umbrales | Reporte |
|---|---|---|---|---|---|---|---|---|
| 1 | Netlify (`https://trazapp.netlify.app/api`) → VPS | 737 | 348 (47,2 %) | 727 ms (705 ms en las exitosas) | 860 ms | 21,7 s | No cumple: errores y checks | [resultado-carga-2026-11-26.json](resultado-carga-2026-11-26.json) · [.txt](resultado-carga-2026-11-26.txt) |
| 2 | Directo al VPS (`https://189-24-13-100.sslip.io`) | 6.519 | 0 (0 %) | 109 ms | 94 ms | 1,23 s | Cumple los tres | [resultado-carga-vps-2026-11-26.json](resultado-carga-vps-2026-11-26.json) · [.txt](resultado-carga-vps-2026-11-26.txt) |

## Análisis

- **El backend cumple RNF-02 con carga.** Con 50 usuarios concurrentes sostuvo 39 solicitudes por segundo, sin errores y con un p95 de 109 ms, frente a una meta de 2 s.
- **Las fallas de la corrida 1 no ocurrieron en el backend.** Los registros de la API durante esa corrida muestran 389 respuestas 200 y ninguna otra respuesta: exactamente las 389 que k6 recibió como exitosas. Las 348 restantes nunca llegaron al servidor; se cortaron (0 s) o vencieron su tiempo (hasta 21,7 s) en el proxy de Netlify que reenvía `/api/*` al VPS.
- **Consecuencia para el consumidor:** el frontend publicado consulta la API a través de ese proxy, por lo que, con 50 consumidores simultáneos, cerca de la mitad de las consultas fallarían. Se registra como deuda técnica DT-12, con su plan de corrección, en [`docs/riesgos.md`](../../riesgos.md).
