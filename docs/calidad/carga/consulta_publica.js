// Prueba de carga de la consulta pública (RNF-02 / OE4).
// Escenario: consumidores consultan la ficha pública de un producto publicado en el ambiente desplegado.
// Medida de respuesta: p95 <= 2 s y errores < 1 %.
//
// Uso:
//   k6 run -e BASE_URL=https://trazapp.netlify.app/api -e ID_PUBLICO=<id del producto publicado> \
//     --summary-export=resultado-carga.json consulta_publica.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://trazapp.netlify.app/api';
const ID_PUBLICO = __ENV.ID_PUBLICO;
if (!ID_PUBLICO) {
  throw new Error('Falta ID_PUBLICO: el identificador público de un producto publicado');
}

export const options = {
  scenarios: {
    consumidores: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // subida hasta 50 usuarios concurrentes
        { duration: '2m', target: 50 },  // carga sostenida
        { duration: '15s', target: 0 },  // bajada
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // RNF-02: p95 <= 2 s
    http_req_failed: ['rate<0.01'],    // errores < 1 %
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/publico/productos/${ID_PUBLICO}`, {
    tags: { endpoint: 'consulta_publica' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'trae la ficha del producto': (r) => r.status === 200 && r.json('producto') !== null,
  });
  sleep(1); // un consumidor no consulta en ráfaga
}
