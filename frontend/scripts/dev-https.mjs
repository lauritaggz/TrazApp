// `npm run dev:https` — the dev server over HTTPS, reachable from the local network, with the API
// forwarded to the local backend, to try the barcode scanner on a phone (HU13 / T13-07).
//
//   npm run dev:https                 serves on port 5175
//   npm run dev:https -- --port 5176  another port
//
// It sets the two variables the mode needs and starts the same Vite dev server as `npm run dev`
// (same config file): nothing here runs in `npm run dev` or in the build. See vite.dev-https.ts.
//
// Environment variables (all optional):
//   VITE_DEV_API_TARGET  where the API calls go (default http://localhost:8000)

import os from "node:os";
import { createServer } from "vite";

process.env.VITE_DEV_HTTPS = "1";
// The app asks the API for `/api/...`; the proxy of the dev server forwards it to the backend.
process.env.VITE_API_URL = "/api";

function leerPuerto(argumentos) {
  const indice = argumentos.indexOf("--port");
  if (indice === -1) return undefined;
  const puerto = Number(argumentos[indice + 1]);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    console.error("El puerto de --port no es válido.");
    process.exit(1);
  }
  return puerto;
}

function direccionesDeLaRed(puerto) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((interfaz) => interfaz && interfaz.family === "IPv4" && !interfaz.internal)
    .map((interfaz) => `https://${interfaz.address}:${puerto}/`);
}

const puerto = leerPuerto(process.argv.slice(2));
const servidor = await createServer({
  server: { host: "0.0.0.0", ...(puerto ? { port: puerto, strictPort: true } : {}) },
});
await servidor.listen();

const puertoReal = servidor.config.server.port;
servidor.printUrls();
console.log("\n  Modo HTTPS de desarrollo (HU13): certificado propio, la cámara del celular lo exige.");
console.log("  Abre desde el celular una de estas direcciones y acepta el aviso del certificado:");
for (const direccion of direccionesDeLaRed(puertoReal)) console.log(`    ${direccion}`);
console.log(`  La API se reenvía a ${process.env.VITE_DEV_API_TARGET || "http://localhost:8000"} (el backend debe estar corriendo).\n`);
